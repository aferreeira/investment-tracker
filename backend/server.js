require('dotenv').config(); // Load .env variables

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ensureTickerTypeColumn, ensureMarketColumn, ensurePlatformColumn, ensureDecimalQuantidade } = require('./migrations');
const pool = require('./db');
const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const { getFundData } = require('./scraper');
const { parseCSV } = require('./csvParser');
const { getCanadianStockData, getCanadianStocksData, getNDAXPrice, getNDAXPricesData } = require('./yahooFinance');
const app = express();
const { extractTickerData } = require('./extractTickerData');
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Setup multer for file uploads (store in memory)
const upload = multer({ storage: multer.memoryStorage() });

// Helper function to compute derived fields
function computeDerivedFields(quantidade, precoMedio, precoAtual, dyPorCota) {
  const valorInvestido = quantidade * precoMedio;
  const saldo = quantidade * precoAtual;
  const variacao = ((saldo - valorInvestido) / valorInvestido) * 100;
  const dyAtualMensal = (dyPorCota / precoAtual) * 100;
  const dyAtualAnual = (dyPorCota / precoAtual) * 12 * 100;
  const dyMeuMensal = (dyPorCota / precoMedio) * 100;
  const dyMeuAnual = (dyPorCota / precoMedio) * 12 * 100;
  return { valorInvestido, saldo, variacao, dyAtualMensal, dyAtualAnual, dyMeuMensal, dyMeuAnual };
}

// Helper function to upsert an asset in the database
async function upsertAsset({ ativo, quantidade, precoMedio, precoAtual, dyPorCota, ticker_type, market = 'brazil', platform = 'WealthSimple' }) {
  // Compute derived fields
  const {
    valorInvestido,
    saldo,
    variacao,
    dyAtualMensal,
    dyAtualAnual,
    dyMeuMensal,
    dyMeuAnual,
  } = computeDerivedFields(quantidade, precoMedio, precoAtual, dyPorCota);

  const query = `
    INSERT INTO assets (
      ativo, quantidade, preco_medio, preco_atual, valor_investido, saldo, variacao,
      dy_por_cota, dy_atual_mensal, dy_atual_anual, dy_meu_mensal, dy_meu_anual, ticker_type, market, platform
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (ativo) DO UPDATE SET
      quantidade        = EXCLUDED.quantidade,
      preco_medio       = EXCLUDED.preco_medio,
      preco_atual       = EXCLUDED.preco_atual,
      valor_investido   = EXCLUDED.valor_investido,
      saldo             = EXCLUDED.saldo,
      variacao          = EXCLUDED.variacao,
      dy_por_cota       = EXCLUDED.dy_por_cota,
      dy_atual_mensal   = EXCLUDED.dy_atual_mensal,
      dy_atual_anual    = EXCLUDED.dy_atual_anual,
      dy_meu_mensal     = EXCLUDED.dy_meu_mensal,
      dy_meu_anual      = EXCLUDED.dy_meu_anual,
      ticker_type       = EXCLUDED.ticker_type,
      market            = EXCLUDED.market,
      platform          = EXCLUDED.platform
    RETURNING *
  `;
  const values = [
    ativo,
    quantidade,
    precoMedio,
    precoAtual,
    valorInvestido,
    saldo,
    variacao,
    dyPorCota,
    dyAtualMensal,
    dyAtualAnual,
    dyMeuMensal,
    dyMeuAnual,
    ticker_type,
    market,
    platform
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

// New endpoint to insert assets in bulk from JSON data
app.post('/api/assets/bulk', async (req, res) => {
  try {
    let assetsArray = req.body.assets;
    if (!Array.isArray(assetsArray)) {
      assetsArray = await extractTickerData();
    }

    const insertedAssets = [];
    const market = req.body.market || 'brazil'; // Default to brazil for bulk import

    for (const { ativo, quantidade, precoMedio, precoAtual, ticker_type, dy } of assetsArray) {
      if (ticker_type === 'Ticker') {
        dyPorCotaNum = [(dy / 12) / 100] * precoAtual;
      } else {
        const data = await getFundData(ativo);
        dyPorCotaNum = data.dyPorCotaNum;
      }

      // Call your upsertAsset helper function.
      const asset = await upsertAsset({
        ativo,
        quantidade: parseFloat(quantidade),
        precoMedio: parseFloat(precoMedio),
        precoAtual: precoAtual,
        dyPorCota: dyPorCotaNum,
        ticker_type,
        market
      });

      insertedAssets.push(asset);
    }

    res.status(201).json({
      message: 'Assets inserted successfully',
      assets: insertedAssets
    });
  } catch (err) {
    console.error('Error in bulk asset insertion:', err);
    res.status(500).json({ error: 'Failed to insert assets in bulk' });
  }
});

// GET /api/assets: Retrieve all assets.
app.get('/api/assets', async (req, res) => {
  try {
    const market = req.query.market || 'brazil';
    const result = await pool.query('SELECT * FROM assets WHERE market = $1', [market]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/assets/upload-csv: Upload CSV file with portfolio data
app.post('/api/assets/upload-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const market = req.body.market || 'canada';
    const csvData = await parseCSV(req.file.buffer);

    if (csvData.length === 0) {
      return res.status(400).json({ error: 'No valid data found in CSV' });
    }

    // Fetch current prices for all tickers from the API
    const { results: priceData, errors: priceErrors } = await getCanadianStocksData(
      csvData.map(row => row.ticker)
    );

    // Create a map of ticker -> current price
    const priceMap = {};
    priceData.forEach(price => {
      priceMap[price.ticker] = price.currentPrice;
    });

    const insertedAssets = [];
    const missingPrices = [];

    for (const { ticker, quantidade, precoMedio, precoAtual, platform } of csvData) {
      try {
        // Use fetched price if available, otherwise use provided price or avg price as fallback
        let finalPrice = precoAtual > 0 ? precoAtual : priceMap[ticker];
        
        if (!finalPrice || finalPrice === 0) {
          finalPrice = precoMedio; // Fallback to avg price
          missingPrices.push(ticker);
        }

        const asset = await upsertAsset({
          ativo: ticker,
          quantidade: parseFloat(quantidade),
          precoMedio: parseFloat(precoMedio),
          precoAtual: parseFloat(finalPrice),
          dyPorCota: 0,
          ticker_type: 'Ticker',
          market,
          platform: platform || 'WealthSimple'
        });

        insertedAssets.push(asset);
      } catch (error) {
        console.error(`Error inserting ticker ${ticker}:`, error.message);
      }
    }

    res.status(201).json({
      message: `CSV uploaded successfully. Prices fetched from API for all assets.`,
      count: insertedAssets.length,
      assets: insertedAssets,
      ...(missingPrices.length > 0 && { 
        warning: `${missingPrices.length} assets used average price as fallback: ${missingPrices.join(', ')}`
      }),
      ...(priceErrors.length > 0 && {
        priceErrors: priceErrors.slice(0, 5) // Show first 5 errors
      })
    });
  } catch (err) {
    console.error('Error processing CSV upload:', err);
    res.status(500).json({ error: 'Failed to process CSV upload' });
  }
});

// Endpoint to extract tickers from a hard-coded list, scrape external data, and insert them
app.post('/api/extract-tickers', async (req, res) => {
  try {
    // 1. Get the list of tickers
    const tickers = await extractTickerData();
    const insertedAssets = [];

    // 2. Process each ticker
    for (const { ativo, quantidade, precoMedio, precoAtual } of tickers) {
      const { dyPorCotaNum } = await getFundData(ativo);
      
      const asset = await upsertAsset({
        ativo,
        quantidade,
        precoMedio,
        precoAtual,
        dyPorCota: dyPorCotaNum,
      });
      insertedAssets.push(asset);
    }

    res.status(201).json({
      message: 'Tickers extracted and inserted successfully',
      assets: insertedAssets,
    });
  } catch (err) {
    console.error('Error extracting and inserting tickers:', err);
    res.status(500).json({ error: 'Failed to extract and insert tickers' });
  }
});

// Endpoint to add a new asset manually
app.post('/api/assets', async (req, res) => {
  const { ativo, quantidade, precoMedio } = req.body;
  if (!ativo || !quantidade || !precoMedio) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    // Call getFundData to retrieve external data
    const { precoAtualNum, dyPorCotaNum } = await getFundData(ativo);
    
    const asset = await upsertAsset({
      ativo,
      quantidade: parseFloat(quantidade),
      precoMedio: parseFloat(precoMedio),
      precoAtual: precoAtualNum,
      dyPorCota: dyPorCotaNum,
    });
    
    // Optionally emit a socket event (if using socket.io)
    // io.emit('assetAdded', asset);
    
    res.status(201).json(asset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add asset' });
  }
});

app.post('/api/assets/update-hg', async (req, res) => {
  const { asset } = req.body;
  if (!asset) {
    return res.status(400).json({ error: 'Asset is required' });
  }

  try {
    // Retrieve the asset from the database
    const dbResult = await pool.query('SELECT * FROM assets WHERE ativo = $1', [asset]);
    if (dbResult.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    const dbAsset = dbResult.rows[0];

    // Construct ticker symbol for HG Brasil (append '.SA' if missing)
    let ticker = asset;
    if (!ticker.endsWith('.SA')) {
      ticker = ticker + '.SA';
    }

    // Build HG Brasil API URL
    const hgUrl = `${process.env.HG_API_BASE_URL}?symbol=${ticker}&key=${process.env.HG_API_KEY}`;
    
    // Call HG Brasil API
    const hgResponse = await axios.get(hgUrl);
    
    // Ensure we have valid data (assume the API returns an object with "results")
    if (!hgResponse.data || !hgResponse.data.results) {
      return res.status(500).json({ error: 'Failed to retrieve data from HG Brasil API' });
    }
    
    // Assume the response's results are keyed by the ticker (e.g. "PETR4.SA")
    const data = hgResponse.data.results[ticker];
    if (!data) {
      return res.status(500).json({ error: 'No data found for ticker ' + ticker });
    }
    
    // Extract Preço Atual and DY por Cota from the API response
    // (Assuming the API returns "price" and "dividend" fields)
    const preco_atual = parseFloat(data.price);
    const dy_por_cota = parseFloat(data.dividend);

    // Perform calculations
    const quantidade = parseFloat(dbAsset.quantidade);
    const preco_medio = parseFloat(dbAsset.preco_medio);
    const valor_investido = quantidade * preco_medio;
    const saldo = quantidade * preco_atual;
    const variacao = ((saldo - valor_investido) / valor_investido) * 100;
    const dy_atual_mensal = (dy_por_cota / preco_atual) * 100;
    const dy_atual_anual = (dy_por_cota / preco_atual) * 12 * 100;
    const dy_meu_mensal = (dy_por_cota / preco_medio) * 100;
    const dy_meu_anual = (dy_por_cota / preco_medio) * 12 * 100;
    
    // Update asset in the database with new values
    const updateQuery = `
      UPDATE assets SET 
        preco_atual = $1, 
        valor_investido = $2,
        saldo = $3,
        variacao = $4,
        dy_por_cota = $5,
        dy_atual_mensal = $6,
        dy_atual_anual = $7,
        dy_meu_mensal = $8,
        dy_meu_anual = $9
      WHERE ativo = $10
      RETURNING *`;
    const updateValues = [
      preco_atual,
      valor_investido,
      saldo,
      variacao,
      dy_por_cota,
      dy_atual_mensal,
      dy_atual_anual,
      dy_meu_mensal,
      dy_meu_anual,
      asset
    ];
    const updateResult = await pool.query(updateQuery, updateValues);
    const updatedAsset = updateResult.rows[0];
    
    // Emit socket event to notify connected clients
    io.emit('assetUpdated', {
      asset: updatedAsset.ativo,
      precoAtual: updatedAsset.preco_atual,
      dyPorCota: updatedAsset.dy_por_cota,
      valorInvestido: updatedAsset.valor_investido,
      saldo: updatedAsset.saldo,
      variacao: updatedAsset.variacao,
      dyAtualMensal: updatedAsset.dy_atual_mensal,
      dyAtualAnual: updatedAsset.dy_atual_anual,
      dyMeuMensal: updatedAsset.dy_meu_mensal,
      dyMeuAnual: updatedAsset.dy_meu_anual
    });
    
    res.json(updatedAsset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update asset using HG Brasil API' });
  }
});

// POST /api/assets/update: Update "Preço Atual" and "DY por Cota" for an asset.
app.post('/api/assets/update', async (req, res) => {
  const { asset } = req.body;
  if (!asset) {
    return res.status(400).json({ error: 'Asset is required' });
  }

  // Simulate fetching external data. Replace with an actual API call as needed.
  const precoAtual = +(Math.random() * 100).toFixed(2);
  const dyPorCota = +(Math.random() * 5).toFixed(2);

  try {
    await pool.query(
      'UPDATE assets SET preco_atual = $1, dy_por_cota = $2 WHERE ativo = $3',
      [precoAtual, dyPorCota, asset]
    );
    
    // Emit an update event with the new data.
    io.emit('assetUpdated', { asset, precoAtual, dyPorCota });
    res.json({ asset, precoAtual, dyPorCota });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// DELETE endpoint to remove an asset by its "ativo"
app.delete('/api/assets/:ativo', async (req, res) => {
  const { ativo } = req.params;
  try {
    // Delete asset from the database
    const result = await pool.query(
      'DELETE FROM assets WHERE ativo = $1 RETURNING *',
      [ativo]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Optionally, emit a socket event to update connected clients
    io.emit('assetDeleted', ativo);
    
    res.json({ message: 'Asset deleted', asset: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// POST /api/assets/update-canadian-prices: Update prices for Canadian stocks from Yahoo Finance
app.post('/api/assets/update-canadian-prices', async (req, res) => {
  try {
    // Get all Canadian assets EXCEPT NDAX (NDAX uses CoinGecko) and Manulife (manual only)
    const result = await pool.query(
      'SELECT id, ativo, quantidade, preco_medio FROM assets WHERE market = $1 AND platform != $2 AND platform != $3',
      ['canada', 'NDAX', 'Manulife']
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No Canadian assets found (excluding NDAX and Manulife)' });
    }

    const tickers = result.rows.map(row => row.ativo);
    const { results: priceData, errors } = await getCanadianStocksData(tickers);

    const updatedAssets = [];

    for (const data of priceData) {
      try {
        const asset = result.rows.find(a => a.ativo === data.ticker);
        if (!asset) continue;

        // Calculate derived fields
        const quantidade = parseFloat(asset.quantidade);
        const precoMedio = parseFloat(asset.preco_medio);
        const precoAtual = data.currentPrice;
        const dyPorCota = data.dividendRate || 0;

        const {
          valorInvestido,
          saldo,
          variacao,
          dyAtualMensal,
          dyAtualAnual,
          dyMeuMensal,
          dyMeuAnual,
        } = computeDerivedFields(quantidade, precoMedio, precoAtual, dyPorCota);

        // Update asset in database
        const updateQuery = `
          UPDATE assets SET
            preco_atual = $1,
            valor_investido = $2,
            saldo = $3,
            variacao = $4,
            dy_por_cota = $5,
            dy_atual_mensal = $6,
            dy_atual_anual = $7,
            dy_meu_mensal = $8,
            dy_meu_anual = $9
          WHERE ativo = $10
          RETURNING *
        `;

        const updateResult = await pool.query(updateQuery, [
          precoAtual,
          valorInvestido,
          saldo,
          variacao,
          dyPorCota,
          dyAtualMensal,
          dyAtualAnual,
          dyMeuMensal,
          dyMeuAnual,
          data.ticker
        ]);

        if (updateResult.rows.length > 0) {
          const updatedAsset = updateResult.rows[0];
          updatedAssets.push(updatedAsset);
          
          // Emit socket event for real-time update
          io.emit('assetUpdated', updatedAsset);
        }
      } catch (error) {
        console.error(`Error updating ${data.ticker}:`, error.message);
        errors.push({ ticker: data.ticker, error: error.message });
      }
    }

    res.json({
      message: `Updated ${updatedAssets.length} Canadian assets`,
      count: updatedAssets.length,
      assets: updatedAssets,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Error updating Canadian prices:', err);
    res.status(500).json({ error: 'Failed to update Canadian prices' });
  }
});

// POST /api/assets/update-canadian-price/:ticker: Update price for a single Canadian stock
app.post('/api/assets/update-canadian-price/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();

    // Fetch current data from database
    const dbResult = await pool.query(
      'SELECT * FROM assets WHERE ativo = $1 AND market = $2',
      [ticker, 'canada']
    );

    if (dbResult.rows.length === 0) {
      return res.status(404).json({ error: 'Canadian asset not found' });
    }

    const asset = dbResult.rows[0];

    // Fetch latest price data from Yahoo Finance
    const priceData = await getCanadianStockData(ticker);

    // Calculate derived fields
    const quantidade = parseFloat(asset.quantidade);
    const precoMedio = parseFloat(asset.preco_medio);
    const precoAtual = priceData.currentPrice;
    const dyPorCota = priceData.dividendRate || 0;

    const {
      valorInvestido,
      saldo,
      variacao,
      dyAtualMensal,
      dyAtualAnual,
      dyMeuMensal,
      dyMeuAnual,
    } = computeDerivedFields(quantidade, precoMedio, precoAtual, dyPorCota);

    // Update asset in database
    const updateQuery = `
      UPDATE assets SET
        preco_atual = $1,
        valor_investido = $2,
        saldo = $3,
        variacao = $4,
        dy_por_cota = $5,
        dy_atual_mensal = $6,
        dy_atual_anual = $7,
        dy_meu_mensal = $8,
        dy_meu_anual = $9
      WHERE ativo = $10
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [
      precoAtual,
      valorInvestido,
      saldo,
      variacao,
      dyPorCota,
      dyAtualMensal,
      dyAtualAnual,
      dyMeuMensal,
      dyMeuAnual,
      ticker
    ]);

    const updatedAsset = updateResult.rows[0];

    // Emit socket event for real-time update
    io.emit('assetUpdated', updatedAsset);

    res.json(updatedAsset);
  } catch (err) {
    console.error(`Error updating price for ${req.params.ticker}:`, err);
    res.status(500).json({ error: `Failed to update price for ${req.params.ticker}` });
  }
});

// POST /api/assets/update-ndax-prices: Update prices for NDAX crypto assets using CoinGecko
app.post('/api/assets/update-ndax-prices', async (req, res) => {
  try {
    // Get all NDAX assets
    const result = await pool.query(
      'SELECT id, ativo, quantidade, preco_medio, platform FROM assets WHERE market = $1 AND platform = $2',
      ['canada', 'NDAX']
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No NDAX assets found' });
    }

    const tickers = result.rows.map(row => row.ativo);
    const { results: priceData, errors } = await getNDAXPricesData(tickers);

    const updatedAssets = [];

    for (const data of priceData) {
      try {
        const asset = result.rows.find(a => a.ativo === data.ticker);
        if (!asset) continue;

        // Calculate derived fields
        const quantidade = parseFloat(asset.quantidade);
        const precoMedio = parseFloat(asset.preco_medio);
        const precoAtual = data.currentPrice;
        const dyPorCota = data.dividendRate || 0;

        const {
          valorInvestido,
          saldo,
          variacao,
          dyAtualMensal,
          dyAtualAnual,
          dyMeuMensal,
          dyMeuAnual,
        } = computeDerivedFields(quantidade, precoMedio, precoAtual, dyPorCota);

        // Update asset in database
        const updateQuery = `
          UPDATE assets SET
            preco_atual = $1,
            valor_investido = $2,
            saldo = $3,
            variacao = $4,
            dy_por_cota = $5,
            dy_atual_mensal = $6,
            dy_atual_anual = $7,
            dy_meu_mensal = $8,
            dy_meu_anual = $9
          WHERE ativo = $10
          RETURNING *
        `;

        const updateResult = await pool.query(updateQuery, [
          precoAtual,
          valorInvestido,
          saldo,
          variacao,
          dyPorCota,
          dyAtualMensal,
          dyAtualAnual,
          dyMeuMensal,
          dyMeuAnual,
          data.ticker
        ]);

        if (updateResult.rows.length > 0) {
          const updatedAsset = updateResult.rows[0];
          updatedAssets.push(updatedAsset);
          
          // Emit socket event for real-time update
          io.emit('assetUpdated', updatedAsset);
        }
      } catch (error) {
        console.error(`Error updating ${data.ticker}:`, error.message);
        errors.push({ ticker: data.ticker, error: error.message });
      }
    }

    res.json({
      message: `Updated ${updatedAssets.length} NDAX assets`,
      count: updatedAssets.length,
      assets: updatedAssets,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Error updating NDAX prices:', err);
    res.status(500).json({ error: 'Failed to update NDAX prices' });
  }
});

// PUT /api/assets/update-price: Manually update price, quantity, or avg price for an asset
app.put('/api/assets/update-price', async (req, res) => {
  try {
    const { ativo, preco_atual, quantidade, preco_medio } = req.body;

    if (!ativo) {
      return res.status(400).json({ error: 'Missing ativo' });
    }

    // Fetch asset from database
    const dbResult = await pool.query(
      'SELECT * FROM assets WHERE ativo = $1',
      [ativo]
    );

    if (dbResult.rows.length === 0) {
      return res.status(404).json({ error: `Asset ${ativo} not found` });
    }

    const asset = dbResult.rows[0];

    // Use provided values or fall back to current asset values
    const newQuantidade = quantidade !== undefined ? parseFloat(quantidade) : parseFloat(asset.quantidade);
    const newPrecoMedio = preco_medio !== undefined ? parseFloat(preco_medio) : parseFloat(asset.preco_medio);
    const newPrecoAtual = preco_atual !== undefined ? parseFloat(preco_atual) : parseFloat(asset.preco_atual);
    const dyPorCota = parseFloat(asset.dy_por_cota) || 0;

    const {
      valorInvestido,
      saldo,
      variacao,
      dyAtualMensal,
      dyAtualAnual,
      dyMeuMensal,
      dyMeuAnual,
    } = computeDerivedFields(newQuantidade, newPrecoMedio, newPrecoAtual, dyPorCota);

    // Update asset in database
    const updateQuery = `
      UPDATE assets SET
        quantidade = $1,
        preco_medio = $2,
        preco_atual = $3,
        valor_investido = $4,
        saldo = $5,
        variacao = $6,
        dy_atual_mensal = $7,
        dy_atual_anual = $8,
        dy_meu_mensal = $9,
        dy_meu_anual = $10
      WHERE ativo = $11
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [
      newQuantidade,
      newPrecoMedio,
      newPrecoAtual,
      valorInvestido,
      saldo,
      variacao,
      dyAtualMensal,
      dyAtualAnual,
      dyMeuMensal,
      dyMeuAnual,
      ativo
    ]);

    const updatedAsset = updateResult.rows[0];

    // Emit socket event for real-time update
    io.emit('assetUpdated', updatedAsset);

    res.json(updatedAsset);
  } catch (err) {
    console.error('Error updating manual price:', err);
    res.status(500).json({ error: 'Failed to update manual price' });
  }
});

const PORT = process.env.PORT || 9100;

(async () => {
  try {
    await ensureTickerTypeColumn();
    await ensureMarketColumn();
    await ensurePlatformColumn();
    await ensureDecimalQuantidade();
    const httpServer = http.createServer(app);
    io = new Server(httpServer, { cors: { origin: '*' } });
    io.on('connection', socket => console.log('Client connected:', socket.id));
    httpServer.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  } catch (err) {
    console.error('startup failed:', err);
    process.exit(1);
  }
})();