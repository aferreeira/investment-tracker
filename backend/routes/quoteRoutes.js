// quoteRoutes.js - Routes for fetching stock quotes
const express = require('express');
const router = express.Router();
const { getMultiSourceQuotes, getQuestradeQuote, getAlphaVantageQuote } = require('../services/quoteService');
const { getToken } = require('../services/tokenService');
const { quoteFetchLimiter } = require('../middleware/rateLimitMiddleware');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-must-be-at-least-32-bytes';

/**
 * Helper function to extract user ID from JWT
 */
const getUserIdFromRequest = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing authorization header');
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, JWT_SECRET);
  return decoded.userId;
};

/**
 * GET /quotes/:ticker - Get current quote for a single ticker
 * Query params: source (optional: questrade, alphavantage, etc.)
 * Headers: Authorization: Bearer <JWT>
 */
router.get('/:ticker', quoteFetchLimiter, async (req, res) => {
  try {
    const { ticker } = req.params;
    const { source } = req.query;

    if (!ticker || ticker.trim() === '') {
      return res.status(400).json({ error: 'Missing ticker symbol' });
    }

    const userId = await getUserIdFromRequest(req);

    // If specific source requested
    if (source === 'questrade') {
      const tokenData = await getToken(userId, 'questrade');
      if (!tokenData) {
        return res.status(403).json({ error: 'Questrade token not configured' });
      }
      const quote = await getQuestradeQuote(tokenData.token, ticker.toUpperCase());
      return res.json(quote);
    }

    if (source === 'alphavantage') {
      const tokenData = await getToken(userId, 'alphavantage');
      if (!tokenData) {
        return res.status(403).json({ error: 'AlphaVantage token not configured' });
      }
      const quote = await getAlphaVantageQuote(tokenData.token, ticker.toUpperCase());
      return res.json(quote);
    }

    // Default: Try multiple sources
    const tokens = {};
    const questradeToken = await getToken(userId, 'questrade');
    const alphavantageToken = await getToken(userId, 'alphavantage');

    if (questradeToken) tokens.questrade = questradeToken.token;
    if (alphavantageToken) tokens.alphavantage = alphavantageToken.token;

    if (Object.keys(tokens).length === 0) {
      return res.status(403).json({ error: 'No API tokens configured' });
    }

    const quotes = await getMultiSourceQuotes(tokens, [ticker.toUpperCase()]);
    const quote = quotes[ticker.toUpperCase()];

    if (quote.error) {
      return res.status(404).json(quote);
    }

    res.json(quote);
  } catch (error) {
    console.error('Error fetching quote:', error.message);
    if (error.message.includes('Missing authorization')) {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

/**
 * POST /quotes/batch - Get quotes for multiple tickers
 * Body: { tickers: ['AAPL', 'GOOGL', ...], source: (optional) }
 * Headers: Authorization: Bearer <JWT>
 */
router.post('/batch', quoteFetchLimiter, async (req, res) => {
  try {
    const { tickers, source } = req.body;

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid tickers array' });
    }

    if (tickers.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 tickers per request' });
    }

    const userId = await getUserIdFromRequest(req);

    const tokens = {};
    const questradeToken = await getToken(userId, 'questrade');
    const alphavantageToken = await getToken(userId, 'alphavantage');

    if (questradeToken) tokens.questrade = questradeToken.token;
    if (alphavantageToken) tokens.alphavantage = alphavantageToken.token;

    if (Object.keys(tokens).length === 0) {
      return res.status(403).json({ error: 'No API tokens configured' });
    }

    const normalizedTickers = tickers.map(t => t.toUpperCase());
    const quotes = await getMultiSourceQuotes(tokens, normalizedTickers);

    res.json({
      tickers: normalizedTickers,
      quotes,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching batch quotes:', error.message);
    if (error.message.includes('Missing authorization')) {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

/**
 * GET /quotes/history/:ticker - Get historical quotes for a ticker
 * Query params: days (default: 30), interval (1min, 5min, 15min, 30min, 60min, daily)
 * Headers: Authorization: Bearer <JWT>
 */
router.get('/history/:ticker', quoteFetchLimiter, async (req, res) => {
  try {
    const { ticker } = req.params;
    const { days = 30, interval = 'daily' } = req.query;

    if (!ticker || ticker.trim() === '') {
      return res.status(400).json({ error: 'Missing ticker symbol' });
    }

    const userId = await getUserIdFromRequest(req);

    // TODO: Implement historical data fetching from database or API
    // This would require storing quote history or fetching from external API

    res.json({
      ticker: ticker.toUpperCase(),
      days: parseInt(days),
      interval,
      message: 'Historical data fetching not yet implemented. Please check back soon.'
    });
  } catch (error) {
    console.error('Error fetching historical quotes:', error.message);
    res.status(500).json({ error: 'Failed to fetch historical quotes' });
  }
});

module.exports = router;
