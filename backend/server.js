require('dotenv').config(); // Load .env variables

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
const { ensureUsersTable, ensureAssetsTable, ensureTokensTable } = require('./utils/migrations');
const { hashPassword, comparePassword, createAccessToken, createRefreshToken, verifyToken } = require('./services/authService');
const { verifyJWT } = require('./middleware/authMiddleware');
const pool = require('./config/db');
const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const { getFundData } = require('./services/scraper');
const { getCanadianStockData, getCanadianStocksData, getNDAXPrice, getNDAXPricesData } = require('./services/priceService');
const app = express();
// No-op io for Lambda (overwritten with real Socket.IO when running as a server)
let io = { emit: () => {} };
const { extractTickerData } = require('./utils/extractTickerData');
const authRoutes = require('./routes/authRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const { generalLimiter, authLimiter, quoteFetchLimiter } = require('./middleware/rateLimitMiddleware');
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Apply rate limiting
app.use('/api/auth', authLimiter);
app.use('/api/quotes', quoteFetchLimiter);
app.use(generalLimiter);

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/quotes', quoteRoutes);

// Helper function to compute derived fields
function computeDerivedFields(quantity, averagePrice, currentPrice, dividendPerShare) {
  const investedValue = quantity * averagePrice;
  const balance = quantity * currentPrice;
  const variation = ((balance - investedValue) / investedValue) * 100;
  const currentMonthlyDividend = (dividendPerShare / currentPrice) * 100;
  const currentAnnualDividend = (dividendPerShare / currentPrice) * 12 * 100;
  const myMonthlyDividend = (dividendPerShare / averagePrice) * 100;
  const myAnnualDividend = (dividendPerShare / averagePrice) * 12 * 100;
  return { investedValue, balance, variation, currentMonthlyDividend, currentAnnualDividend, myMonthlyDividend, myAnnualDividend };
}

// Helper function to upsert an asset in the database
async function upsertAsset({ userId, ticker, quantity, averagePrice, currentPrice, dividendPerShare, assetType, market = 'brazil', platform = 'WealthSimple' }) {
  // Compute derived fields
  const {
    investedValue,
    balance,
    variation,
    currentMonthlyDividend,
    currentAnnualDividend,
    myMonthlyDividend,
    myAnnualDividend,
  } = computeDerivedFields(quantity, averagePrice, currentPrice, dividendPerShare);

  const query = `
    INSERT INTO assets (
      user_id, ticker, quantity, average_price, current_price, invested_value, balance, variation,
      dividend_per_share, current_monthly_dividend, current_annual_dividend, my_monthly_dividend, my_annual_dividend, asset_type, market, platform
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (user_id, ticker, market) DO UPDATE SET
      quantity        = EXCLUDED.quantity,
      average_price   = EXCLUDED.average_price,
      current_price   = EXCLUDED.current_price,
      invested_value  = EXCLUDED.invested_value,
      balance         = EXCLUDED.balance,
      variation       = EXCLUDED.variation,
      dividend_per_share       = EXCLUDED.dividend_per_share,
      current_monthly_dividend = EXCLUDED.current_monthly_dividend,
      current_annual_dividend  = EXCLUDED.current_annual_dividend,
      my_monthly_dividend      = EXCLUDED.my_monthly_dividend,
      my_annual_dividend       = EXCLUDED.my_annual_dividend,
      asset_type      = EXCLUDED.asset_type,
      market          = EXCLUDED.market,
      platform        = EXCLUDED.platform
    RETURNING *
  `;
  const values = [
    userId,
    ticker,
    quantity,
    averagePrice,
    currentPrice,
    investedValue,
    balance,
    variation,
    dividendPerShare,
    currentMonthlyDividend,
    currentAnnualDividend,
    myMonthlyDividend,
    myAnnualDividend,
    assetType,
    market,
    platform
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

// ===== AUTHENTICATION ENDPOINTS =====

// POST /api/auth/register - Register a new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user already exists
    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rowCount > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, first_name, last_name, phone, created_at',
      [email, passwordHash]
    );

    const user = result.rows[0];
    console.log(`✅ User registered: ${email}`);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        createdAt: user.created_at
      }
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login - Authenticate user and return tokens
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const result = await pool.query('SELECT id, email, password_hash, first_name, last_name, phone, created_at FROM users WHERE email = $1', [email]);
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Compare password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create tokens
    const accessToken = await createAccessToken(user.id, user.email);
    const refreshToken = await createRefreshToken(user.id, user.email);

    // Store refresh token in database
    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

    console.log(`📝 User logged in: ${email}`);

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        createdAt: user.created_at
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh - Get new access token using refresh token
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const payload = await verifyToken(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if token matches stored token
    const result = await pool.query('SELECT refresh_token FROM users WHERE id = $1', [payload.userId]);
    if (result.rowCount === 0 || result.rows[0].refresh_token !== refreshToken) {
      return res.status(401).json({ error: 'Refresh token mismatch' });
    }

    // Create new access token
    const newAccessToken = await createAccessToken(payload.userId, payload.email);

    console.log(`🔄 Token refreshed for user: ${payload.email}`);

    res.json({
      accessToken: newAccessToken
    });
  } catch (err) {
    console.error('Token refresh error:', err.message);
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// POST /api/auth/logout - Invalidate refresh token
app.post('/api/auth/logout', verifyJWT, async (req, res) => {
  try {
    // Clear refresh token
    await pool.query('UPDATE users SET refresh_token = NULL WHERE id = $1', [req.user.userId]);

    console.log(`👋 User logged out: ${req.user.email}`);

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// PUT /api/auth/profile - Update user profile
app.put('/api/auth/profile', verifyJWT, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    // Update user profile
    const result = await pool.query(
      'UPDATE users SET first_name = $1, last_name = $2, phone = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING id, email, first_name, last_name, phone, created_at, updated_at',
      [firstName || null, lastName || null, phone || null, req.user.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    console.log(`✏️  User profile updated: ${user.email}`);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/auth/google - Google OAuth authentication
app.post('/api/auth/google', async (req, res) => {
  try {
    const { googleToken } = req.body;

    if (!googleToken) {
      return res.status(400).json({ error: 'Google token required' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'your-google-client-id-here.apps.googleusercontent.com' || clientId === 'YOUR-ACTUAL-CLIENT-ID-HERE.apps.googleusercontent.com') {
      console.error('❌ Google Client ID not configured in backend');
      return res.status(500).json({ error: 'Server configuration error: Google Client ID not set' });
    }

    // Verify Google token — accept tokens from web OR iOS client IDs
    const client = new OAuth2Client(clientId);
    const iosClientId = process.env.GOOGLE_IOS_CLIENT_ID;
    const audience = [clientId, iosClientId].filter(Boolean);
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: googleToken,
        audience,
      });
    } catch (verifyError) {
      console.error('Token verification error:', verifyError.message);
      // Try without audience as last resort
      ticket = await client.verifyIdToken({ idToken: googleToken });
    }

    const payload = ticket.getPayload();
    const { email, given_name, family_name } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Invalid Google token: no email' });
    }

    // Upsert user — atomic, avoids duplicate key race conditions
    const upsertResult = await pool.query(
      `INSERT INTO users (email, first_name, last_name, password_hash)
       VALUES ($1, $2, $3, '')
       ON CONFLICT (email) DO UPDATE
         SET first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), users.first_name),
             last_name  = COALESCE(NULLIF(EXCLUDED.last_name,  ''), users.last_name)
       RETURNING id, email, first_name, last_name, phone, created_at`,
      [email, given_name || '', family_name || '']
    );
    const user = upsertResult.rows[0];
    console.log(`✅ Google auth: ${user ? 'login' : 'error'} for ${email}`);

    // Create tokens
    const accessToken = await createAccessToken(user.id, user.email);
    const refreshToken = await createRefreshToken(user.id, user.email);

    // Store refresh token in database
    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

    res.json({
      message: 'Google authentication successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        createdAt: user.created_at
      }
    });
  } catch (err) {
    console.error('❌ Google authentication error:', err.message);
    res.status(401).json({ error: 'Google authentication failed: ' + err.message });
  }
});

// ===== END AUTHENTICATION ENDPOINTS =====

// New endpoint to insert assets in bulk from JSON data
app.post('/api/assets/bulk', verifyJWT, async (req, res) => {
  try {
    let assetsArray = req.body.assets;
    if (!Array.isArray(assetsArray)) {
      assetsArray = await extractTickerData();
    }

    if (!assetsArray || assetsArray.length === 0) {
      return res.status(400).json({ error: 'No assets provided' });
    }

    console.log('📥 Bulk assets received:', JSON.stringify(assetsArray[0], null, 2));

    const insertedAssets = [];
    const market = req.body.market || 'brazil'; // Default to brazil for bulk import

    for (const asset of assetsArray) {
      // Extract asset fields (English names only)
      const ticker = asset.ticker;
      const quantity = asset.quantity;
      const averagePrice = asset.averagePrice;
      const currentPrice = asset.currentPrice || parseFloat(averagePrice) || 0;
      const assetType = asset.asset_type || 'Ticker';
      const platform = asset.platform || 'WealthSimple';
      const dy = asset.dy || 0;

      if (!ticker) {
        console.error('❌ Missing ticker in asset:', asset);
        continue; // Skip this asset if no ticker
      }

      let dividendPerShareNum = 0;
      if (assetType === 'Ticker') {
        dividendPerShareNum = [(dy / 12) / 100] * parseFloat(currentPrice);
      } else {
        try {
          const data = await getFundData(ticker);
          dividendPerShareNum = data.dividendPerShareNum || 0;
        } catch (fundErr) {
          console.warn(`⚠️ Could not fetch fund data for ${ticker}:`, fundErr.message);
          dividendPerShareNum = 0;
        }
      }

      // Call upsertAsset helper function
      const upsertedAsset = await upsertAsset({
        userId: req.user.userId,
        ticker,
        quantity: parseFloat(quantity) || 0,
        averagePrice: parseFloat(averagePrice) || 0,
        currentPrice: parseFloat(currentPrice) || 0,
        dividendPerShare: dividendPerShareNum,
        assetType,
        market,
        platform
      });

      insertedAssets.push(upsertedAsset);
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

// GET /api/assets: Retrieve all assets for the authenticated user.
app.get('/api/assets', verifyJWT, async (req, res) => {
  try {
    const market = req.query.market || 'brazil';
    const result = await pool.query('SELECT * FROM assets WHERE user_id = $1 AND market = $2', [req.user.userId, market]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/assets/upload-csv: Upload CSV file with portfolio data

// Endpoint to extract tickers from a hard-coded list, scrape external data, and insert them
app.post('/api/extract-tickers', verifyJWT, async (req, res) => {
  try {
    // 1. Get the list of tickers
    const tickers = await extractTickerData();
    const insertedAssets = [];

    // 2. Process each ticker
    for (const { ticker, quantity, averagePrice, currentPrice } of tickers) {
      const { dividendPerShareNum } = await getFundData(ticker);
      
      const asset = await upsertAsset({
        userId: req.user.userId,
        ticker,
        quantity,
        averagePrice,
        currentPrice,
        dividendPerShare: dividendPerShareNum,
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
app.post('/api/assets', verifyJWT, async (req, res) => {
  const { ticker, quantity, averagePrice } = req.body;
  if (!ticker || !quantity || !averagePrice) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    // Call getFundData to retrieve external data
    const { currentPriceNum, dividendPerShareNum } = await getFundData(ticker);
    
    const asset = await upsertAsset({
      userId: req.user.userId,
      ticker,
      quantity: parseFloat(quantity),
      averagePrice: parseFloat(averagePrice),
      currentPrice: currentPriceNum,
      dividendPerShare: dividendPerShareNum,
    });
    
    // Optionally emit a socket event (if using socket.io)
    // io.emit('assetAdded', asset);
    
    res.status(201).json(asset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add asset' });
  }
});

app.post('/api/assets/update-hg', verifyJWT, async (req, res) => {
  const { asset } = req.body;
  if (!asset) {
    return res.status(400).json({ error: 'Asset is required' });
  }

  try {
    // Retrieve the asset from the database (only user's assets)
    const dbResult = await pool.query('SELECT * FROM assets WHERE ticker = $1 AND user_id = $2', [asset, req.user.userId]);
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
    
    // Extract current price and dividend per share from the API response
    // (Assuming the API returns "price" and "dividend" fields)
    const currentPrice = parseFloat(data.price);
    const dividendPerShare = parseFloat(data.dividend);

    // Perform calculations
    const quantity = parseFloat(dbAsset.quantity);
    const averagePrice = parseFloat(dbAsset.average_price);
    const investedValue = quantity * averagePrice;
    const balance = quantity * currentPrice;
    const variation = ((balance - investedValue) / investedValue) * 100;
    const currentMonthlyDividend = (dividendPerShare / currentPrice) * 100;
    const currentAnnualDividend = (dividendPerShare / currentPrice) * 12 * 100;
    const myMonthlyDividend = (dividendPerShare / averagePrice) * 100;
    const myAnnualDividend = (dividendPerShare / averagePrice) * 12 * 100;
    
    // Update asset in the database with new values (only user's asset)
    const updateQuery = `
      UPDATE assets SET 
        current_price = $1, 
        invested_value = $2,
        balance = $3,
        variation = $4,
        dividend_per_share = $5,
        current_monthly_dividend = $6,
        current_annual_dividend = $7,
        my_monthly_dividend = $8,
        my_annual_dividend = $9
      WHERE ticker = $10 AND user_id = $11
      RETURNING *`;
    const updateValues = [
      currentPrice,
      investedValue,
      balance,
      variation,
      dividendPerShare,
      currentMonthlyDividend,
      currentAnnualDividend,
      myMonthlyDividend,
      myAnnualDividend,
      asset,
      req.user.userId
    ];
    const updateResult = await pool.query(updateQuery, updateValues);
    const updatedAsset = updateResult.rows[0];
    
    // Emit socket event to notify connected clients
    io.emit('assetUpdated', {
      asset: updatedAsset.ticker,
      currentPrice: updatedAsset.current_price,
      dividendPerShare: updatedAsset.dividend_per_share,
      investedValue: updatedAsset.invested_value,
      balance: updatedAsset.balance,
      variation: updatedAsset.variation,
      currentMonthlyDividend: updatedAsset.current_monthly_dividend,
      currentAnnualDividend: updatedAsset.current_annual_dividend,
      myMonthlyDividend: updatedAsset.my_monthly_dividend,
      myAnnualDividend: updatedAsset.my_annual_dividend
    });
    
    res.json(updatedAsset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update asset using HG Brasil API' });
  }
});

// POST /api/assets/update: Update current price and dividend per share for an asset.
app.post('/api/assets/update', verifyJWT, async (req, res) => {
  const { asset } = req.body;
  if (!asset) {
    return res.status(400).json({ error: 'Asset is required' });
  }

  // Simulate fetching external data. Replace with an actual API call as needed.
  const currentPrice = +(Math.random() * 100).toFixed(2);
  const dividendPerShare = +(Math.random() * 5).toFixed(2);

  try {
    await pool.query(
      'UPDATE assets SET current_price = $1, dividend_per_share = $2 WHERE ticker = $3 AND user_id = $4',
      [currentPrice, dividendPerShare, asset, req.user.userId]
    );
    
    // Emit an update event with the new data.
    io.emit('assetUpdated', { asset, currentPrice, dividendPerShare });
    res.json({ asset, currentPrice, dividendPerShare });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// DELETE endpoint to remove an asset by its ticker
app.delete('/api/assets/:ticker', verifyJWT, async (req, res) => {
  const { ticker } = req.params;
  try {
    // Delete asset from the database (only if it belongs to the user)
    const result = await pool.query(
      'DELETE FROM assets WHERE ticker = $1 AND user_id = $2 RETURNING *',
      [ticker, req.user.userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Optionally, emit a socket event to update connected clients
    io.emit('assetDeleted', ticker);
    
    res.json({ message: 'Asset deleted', asset: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// POST /api/assets/update-canadian-prices: Update prices for Canadian stocks from Yahoo Finance
app.post('/api/assets/update-canadian-prices', verifyJWT, async (req, res) => {
  try {
    // Get all Canadian assets EXCEPT NDAX (NDAX uses CoinGecko) and Manulife (manual only)
    const result = await pool.query(
      'SELECT id, ticker, quantity, average_price FROM assets WHERE user_id = $1 AND market = $2 AND platform != $3 AND platform != $4',
      [req.user.userId, 'canada', 'NDAX', 'Manulife']
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No Canadian assets found (excluding NDAX and Manulife)' });
    }

    const tickers = result.rows.map(row => row.ticker);
    const { results: priceData, errors } = await getCanadianStocksData(tickers);

    const updatedAssets = [];

    for (const data of priceData) {
      try {
        const asset = result.rows.find(a => a.ticker === data.ticker);
        if (!asset) continue;

        // Calculate derived fields
        const quantity = parseFloat(asset.quantity);
        const averagePrice = parseFloat(asset.average_price);
        const currentPrice = data.currentPrice;
        const dividendPerShare = data.dividendRate || 0;

        const {
          investedValue,
          balance,
          variation,
          currentMonthlyDividend,
          currentAnnualDividend,
          myMonthlyDividend,
          myAnnualDividend,
        } = computeDerivedFields(quantity, averagePrice, currentPrice, dividendPerShare);

        // Update asset in database
        const updateQuery = `
          UPDATE assets SET
            current_price = $1,
            invested_value = $2,
            balance = $3,
            variation = $4,
            dividend_per_share = $5,
            current_monthly_dividend = $6,
            current_annual_dividend = $7,
            my_monthly_dividend = $8,
            my_annual_dividend = $9
          WHERE ticker = $10 AND user_id = $11
          RETURNING *
        `;

        const updateResult = await pool.query(updateQuery, [
          currentPrice,
          investedValue,
          balance,
          variation,
          dividendPerShare,
          currentMonthlyDividend,
          currentAnnualDividend,
          myMonthlyDividend,
          myAnnualDividend,
          data.ticker,
          req.user.userId
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
app.post('/api/assets/update-canadian-price/:ticker', verifyJWT, async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();

    // Fetch current data from database (only user's asset)
    const dbResult = await pool.query(
      'SELECT * FROM assets WHERE ticker = $1 AND market = $2 AND user_id = $3',
      [ticker, 'canada', req.user.userId]
    );

    if (dbResult.rows.length === 0) {
      return res.status(404).json({ error: 'Canadian asset not found' });
    }

    const asset = dbResult.rows[0];

    // Fetch latest price data from Yahoo Finance
    const priceData = await getCanadianStockData(ticker);

    // Calculate derived fields
    const quantity = parseFloat(asset.quantity);
    const averagePrice = parseFloat(asset.average_price);
    const currentPrice = priceData.currentPrice;
    const dividendPerShare = priceData.dividendRate || 0;

    const {
      investedValue,
      balance,
      variation,
      currentMonthlyDividend,
      currentAnnualDividend,
      myMonthlyDividend,
      myAnnualDividend,
    } = computeDerivedFields(quantity, averagePrice, currentPrice, dividendPerShare);

    // Update asset in database
    const updateQuery = `
      UPDATE assets SET
        current_price = $1,
        invested_value = $2,
        balance = $3,
        variation = $4,
        dividend_per_share = $5,
        current_monthly_dividend = $6,
        current_annual_dividend = $7,
        my_monthly_dividend = $8,
        my_annual_dividend = $9
      WHERE ticker = $10 AND user_id = $11
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [
      currentPrice,
      investedValue,
      balance,
      variation,
      dividendPerShare,
      currentMonthlyDividend,
      currentAnnualDividend,
      myMonthlyDividend,
      myAnnualDividend,
      ticker,
      req.user.userId
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
app.post('/api/assets/update-ndax-prices', verifyJWT, async (req, res) => {
  try {
    console.log('📊 Starting NDAX price update for user:', req.user.userId);
    
    // Get all NDAX assets for the authenticated user
    const result = await pool.query(
      'SELECT id, ticker, quantity, average_price, platform FROM assets WHERE user_id = $1 AND market = $2 AND platform = $3',
      [req.user.userId, 'canada', 'NDAX']
    );

    if (result.rows.length === 0) {
      console.warn('⚠️ No NDAX assets found for user:', req.user.userId);
      return res.status(400).json({ error: 'No NDAX assets found' });
    }

    console.log(`Found ${result.rows.length} NDAX assets to update`);
    
    const tickers = result.rows.map(row => row.ticker);
    const { results: priceData, errors } = await getNDAXPricesData(tickers);

    const updatedAssets = [];

    for (const data of priceData) {
      try {
        const asset = result.rows.find(a => a.ticker === data.ticker);
        if (!asset) continue;

        // Calculate derived fields
        const quantity = parseFloat(asset.quantity);
        const averagePrice = parseFloat(asset.average_price);
        const currentPrice = data.currentPrice;
        const dividendPerShare = data.dividendRate || 0;

        const {
          investedValue,
          balance,
          variation,
          currentMonthlyDividend,
          currentAnnualDividend,
          myMonthlyDividend,
          myAnnualDividend,
        } = computeDerivedFields(quantity, averagePrice, currentPrice, dividendPerShare);

        // Update asset in database (only user's asset)
        const updateQuery = `
          UPDATE assets SET
            current_price = $1,
            invested_value = $2,
            balance = $3,
            variation = $4,
            dividend_per_share = $5,
            current_monthly_dividend = $6,
            current_annual_dividend = $7,
            my_monthly_dividend = $8,
            my_annual_dividend = $9
          WHERE ticker = $10 AND user_id = $11
          RETURNING *
        `;

        const updateResult = await pool.query(updateQuery, [
          currentPrice,
          investedValue,
          balance,
          variation,
          dividendPerShare,
          currentMonthlyDividend,
          currentAnnualDividend,
          myMonthlyDividend,
          myAnnualDividend,
          data.ticker,
          req.user.userId
        ]);

        if (updateResult.rows.length > 0) {
          const updatedAsset = updateResult.rows[0];
          updatedAssets.push(updatedAsset);
          console.log(`✓ Updated ${data.ticker}: $${currentPrice} (${variation >= 0 ? '+' : ''}${variation.toFixed(2)}%)`);
          
          // Emit socket event for real-time update
          io.emit('assetUpdated', updatedAsset);
        }
      } catch (error) {
        console.error(`Error updating ${data.ticker}:`, error.message);
        errors.push({ ticker: data.ticker, error: error.message });
      }
    }

    console.log(`✅ NDAX update complete: ${updatedAssets.length} updated, ${errors.length} errors`);
    
    res.json({
      message: `Updated ${updatedAssets.length} NDAX assets`,
      count: updatedAssets.length,
      assets: updatedAssets,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('❌ Error updating NDAX prices:', err.message);
    res.status(500).json({ error: 'Failed to update NDAX prices' });
  }
});

// PUT /api/assets/update-price: Manually update price, quantity, or avg price for an asset
app.put('/api/assets/update-price', verifyJWT, async (req, res) => {
  try {
    const { ticker, current_price, quantity, average_price } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: 'Missing ticker' });
    }

    // Fetch asset from database (only user's asset)
    const dbResult = await pool.query(
      'SELECT * FROM assets WHERE ticker = $1 AND user_id = $2',
      [ticker, req.user.userId]
    );

    if (dbResult.rows.length === 0) {
      return res.status(404).json({ error: `Asset ${ticker} not found` });
    }

    const asset = dbResult.rows[0];

    // Use provided values or fall back to current asset values
    const newQuantity = quantity !== undefined ? parseFloat(quantity) : parseFloat(asset.quantity);
    const newAveragePrice = average_price !== undefined ? parseFloat(average_price) : parseFloat(asset.average_price);
    const newCurrentPrice = current_price !== undefined ? parseFloat(current_price) : parseFloat(asset.current_price);
    const dividendPerShare = parseFloat(asset.dividend_per_share) || 0;

    const {
      investedValue,
      balance,
      variation,
      currentMonthlyDividend,
      currentAnnualDividend,
      myMonthlyDividend,
      myAnnualDividend,
    } = computeDerivedFields(newQuantity, newAveragePrice, newCurrentPrice, dividendPerShare);

    // Update asset in database
    const updateQuery = `
      UPDATE assets SET
        quantity = $1,
        average_price = $2,
        current_price = $3,
        invested_value = $4,
        balance = $5,
        variation = $6,
        current_monthly_dividend = $7,
        current_annual_dividend = $8,
        my_monthly_dividend = $9,
        my_annual_dividend = $10
      WHERE ticker = $11 AND user_id = $12
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [
      newQuantity,
      newAveragePrice,
      newCurrentPrice,
      investedValue,
      balance,
      variation,
      currentMonthlyDividend,
      currentAnnualDividend,
      myMonthlyDividend,
      myAnnualDividend,
      ticker,
      req.user.userId
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

// Export app for Lambda (lambda.js) — skip server startup in Lambda mode
module.exports = { app };

if (!process.env.LAMBDA) (async () => {
  try {
    await ensureUsersTable();
    await ensureAssetsTable();
    await ensureTokensTable();
    const httpServer = http.createServer(app);
    io = new Server(httpServer, { cors: { origin: '*' } });
    io.on('connection', socket => console.log('Client connected:', socket.id));
    httpServer.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  } catch (err) {
    console.error('startup failed:', err);
    process.exit(1);
  }
})();