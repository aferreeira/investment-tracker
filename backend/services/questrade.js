// questrade.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const QUESTRADE_TOKEN_FILE = path.join(__dirname, 'questrade_token.txt');
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
const priceCache = new Map();

/**
 * Get refresh token from file (latest rotated token) or environment variable (initial setup)
 */
function getRefreshToken() {
  try {
    // First try to get from local file (contains the most recent rotated token)
    if (fs.existsSync(QUESTRADE_TOKEN_FILE)) {
      const token = fs.readFileSync(QUESTRADE_TOKEN_FILE, 'utf8').trim();
      if (token) return token;
    }
    
    // Fall back to environment variable on first run (when file doesn't exist yet)
    if (process.env.QUESTRADE_REFRESH_TOKEN) {
      return process.env.QUESTRADE_REFRESH_TOKEN;
    }
  } catch (error) {
    console.error('Error reading Questrade token:', error.message);
  }
  return null;
}

/**
 * Save refresh token to file
 */
function saveRefreshToken(token) {
  try {
    fs.writeFileSync(QUESTRADE_TOKEN_FILE, token, 'utf8');
    console.log('Questrade token updated');
  } catch (error) {
    console.error('Error saving Questrade token:', error.message);
  }
}

/**
 * Authenticate with Questrade and get access token
 */
async function authenticateQuestrade() {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    throw new Error('Questrade refresh token not found. Run: python stockApi.py "your_token_here"');
  }

  try {
    const response = await axios.get('https://login.questrade.com/oauth2/token', {
      params: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      },
      timeout: 10000
    });

    const data = response.data;

    if (data.error) {
      throw new Error(`Auth error: ${data.error_description || data.error}`);
    }

    const accessToken = data.access_token;
    const apiServer = data.api_server;
    const newRefreshToken = data.refresh_token;

    // Save new token for next time
    if (newRefreshToken) {
      saveRefreshToken(newRefreshToken);
    }

    return {
      accessToken,
      apiServer,
      expiresIn: data.expires_in
    };
  } catch (error) {
    console.error('Questrade authentication failed:', error.message);
    throw error;
  }
}

/**
 * Search for symbol ID on Questrade
 */
async function searchSymbolId(symbol, accessToken, apiServer) {
  try {
    const response = await axios.get(`${apiServer}v1/symbols/search`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        prefix: symbol
      },
      timeout: 10000
    });

    if (response.data.symbols && response.data.symbols.length > 0) {
      return response.data.symbols[0].symbolId;
    }

    throw new Error(`Symbol ${symbol} not found`);
  } catch (error) {
    console.error(`Error searching symbol ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Get quote from Questrade for a symbol with pre-authenticated access token
 */
async function getQuestionareQuote(ticker, accessToken, apiServer) {
  try {
    // Check cache first
    const cacheKey = `questrade_${ticker}`;
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return {
        ticker,
        currentPrice: cached.price,
        bid: cached.bid,
        ask: cached.ask,
        currency: 'USD',
        source: 'questrade-cached',
        lastUpdate: cached.timestamp
      };
    }

    // Search for symbol ID
    const symbolId = await searchSymbolId(ticker, accessToken, apiServer);

    // Get quote
    const quoteResponse = await axios.get(`${apiServer}v1/markets/quotes`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        ids: symbolId
      },
      timeout: 10000
    });

    if (!quoteResponse.data.quotes || quoteResponse.data.quotes.length === 0) {
      throw new Error(`No quote data for ${ticker}`);
    }

    const quote = quoteResponse.data.quotes[0];
    const lastPrice = quote.lastTradePrice;
    const bid = quote.bidPrice;
    const ask = quote.askPrice;

    if (!lastPrice) {
      throw new Error(`No price available for ${ticker}`);
    }

    // Cache result
    priceCache.set(cacheKey, {
      price: lastPrice,
      bid,
      ask,
      timestamp: Date.now()
    });

    return {
      ticker,
      currentPrice: parseFloat(lastPrice.toFixed(2)),
      bid: parseFloat(bid.toFixed(2)),
      ask: parseFloat(ask.toFixed(2)),
      currency: 'USD',
      source: 'questrade',
      lastUpdate: new Date()
    };
  } catch (error) {
    console.error(`Error fetching ${ticker} from Questrade:`, error.message);
    throw error;
  }
}

/**
 * Fetch current price for a ticker via Questrade with pre-authenticated access token
 */
async function getStockData(ticker, accessToken, apiServer) {
  const normalizedTicker = ticker.toUpperCase();

  try {
    return await getQuestionareQuote(normalizedTicker, accessToken, apiServer);
  } catch (error) {
    console.error(`Questrade fetch failed for ${ticker}:`, error.message);
    throw error;
  }
}

/**
 * Batch fetch prices for multiple tickers in parallel using single authentication
 */
async function getStocksData(tickers) {
  const results = [];
  const errors = [];

  try {
    // Authenticate once for all tickers
    const auth = await authenticateQuestrade();
    
    // Create promises for all tickers with delay to avoid rate limiting
    const promises = tickers.map((ticker, index) => 
      new Promise((resolve, reject) => {
        setTimeout(() => {
          getStockData(ticker, auth.accessToken, auth.apiServer)
            .then(resolve)
            .catch(reject);
        }, index * 100); // 100ms delay between requests to avoid rate limiting
      })
    );

    const settledResults = await Promise.allSettled(promises);

    settledResults.forEach((settlement, index) => {
      const ticker = tickers[index];

      if (settlement.status === 'fulfilled') {
        const data = settlement.value;
        if (data.currentPrice) {
          results.push(data);
        } else {
          errors.push({ ticker, error: data.error || 'Price not found' });
        }
      } else {
        errors.push({ ticker, error: settlement.reason?.message || 'Unknown error' });
      }
    });
  } catch (error) {
    console.error('Batch fetch error:', error.message);
    tickers.forEach(ticker => {
      errors.push({ ticker, error: error.message });
    });
  }

  return { results, errors };
}

module.exports = { getStockData, getStocksData, authenticateQuestrade };
