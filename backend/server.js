const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');
const { getFundData } = require('./scraper');
const app = express();
app.use(cors());
app.use(express.json());

app.use(bodyParser.json());

// Configure PostgreSQL connection.
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB || 'investment_db',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
});

// Create HTTP server and attach socket.io.
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, set this to your frontend URL.
  },
});

// When a new client connects.
io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);
});

// GET /api/assets: Retrieve all assets.
app.get('/api/assets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assets');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/assets: Add a new asset.
app.post('/api/assets', async (req, res) => {
  const { ativo, quantidade, precoMedio } = req.body;
  if (!ativo || !quantidade || !precoMedio) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    // Call the scraper function from scraper.js
    const { precoAtualNum, dyPorCotaNum } = await getFundData(ativo);
    
    // Now parse values and perform calculations...
    const quantidadeNum = parseFloat(quantidade);
    const precoMedioNum = parseFloat(precoMedio);
    
    const valorInvestido = quantidadeNum * precoMedioNum;
    const saldo = quantidadeNum * precoAtualNum;
    const variacao = ((saldo - valorInvestido) / valorInvestido) * 100;
    const dyAtualMensal = (dyPorCotaNum / precoAtualNum) * 100;
    const dyAtualAnual = (dyPorCotaNum / precoAtualNum) * 12 * 100;
    const dyMeuMensal = (dyPorCotaNum / precoMedioNum) * 100;
    const dyMeuAnual = (dyPorCotaNum / precoMedioNum) * 12 * 100;
    
    // Insert into database here (adjust query as needed)
    const insertQuery = `
      INSERT INTO assets (
        ativo, quantidade, preco_medio, preco_atual, valor_investido, saldo, variacao,
        dy_por_cota, dy_atual_mensal, dy_atual_anual, dy_meu_mensal, dy_meu_anual
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (ativo) DO UPDATE SET
        quantidade = EXCLUDED.quantidade,
        preco_medio = EXCLUDED.preco_medio,
        preco_atual = EXCLUDED.preco_atual,
        valor_investido = EXCLUDED.valor_investido,
        saldo = EXCLUDED.saldo,
        variacao = EXCLUDED.variacao,
        dy_por_cota = EXCLUDED.dy_por_cota,
        dy_atual_mensal = EXCLUDED.dy_atual_mensal,
        dy_atual_anual = EXCLUDED.dy_atual_anual,
        dy_meu_mensal = EXCLUDED.dy_meu_mensal,
        dy_meu_anual = EXCLUDED.dy_meu_anual
      RETURNING *
    `;
    const insertValues = [
      ativo,
      quantidadeNum,
      precoMedioNum,
      precoAtualNum,
      valorInvestido,
      saldo,
      variacao,
      dyPorCotaNum,
      dyAtualMensal,
      dyAtualAnual,
      dyMeuMensal,
      dyMeuAnual
    ];
    
    // Assume pool is defined and connected to your PostgreSQL database.
    const result = await pool.query(insertQuery, insertValues);
    const newAsset = result.rows[0];
    
    // Emit socket event or any other response handling...
    // io.emit('assetAdded', newAsset); // if using socket.io
    
    res.status(201).json(newAsset);
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

// Start the server on port 5000.
const PORT = process.env.PORT || 9100;
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
