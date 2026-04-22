// priceService.js
// Centralized price fetching service using Questrade (stocks) + CoinGecko (crypto)
const axios = require('axios');

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
const priceCache = new Map();

// Try to use Questrade if available
let questrade = null;
try {
  questrade = require('./questrade');
} catch (error) {
  console.log('Questrade module not available');
}

/**
 * Fetch crypto price from CoinGecko (free, no API key needed)
 * Includes retry logic for rate limiting (429 errors)
 */
async function getCryptoPrice(symbol, retries = 3) {
  const cryptoMap = {
    'BTC': 'bitcoin',
    'SONIC': 'sonic-3'
  };
  
  const coinId = cryptoMap[symbol.toUpperCase()];
  if (!coinId) {
    throw new Error(`Crypto ${symbol} not supported`);
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: coinId,
          vs_currencies: 'cad',
          include_market_cap: false,
          include_24hr_vol: false,
          include_24hr_change: false,
          include_last_updated_at: true
        },
        timeout: 5000
      });

      const price = response.data[coinId]?.cad;
      if (!price) throw new Error(`Price not found from CoinGecko for ${symbol}`);

      return {
        ticker: symbol,
        currentPrice: parseFloat(price.toFixed(8)),
        currency: 'CAD',
        source: 'coingecko',
        lastUpdate: new Date()
      };
    } catch (error) {
      // If 429 (rate limit), retry with exponential backoff
      if (error.response?.status === 429 && attempt < retries - 1) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`⚠️ CoinGecko rate limited for ${symbol}. Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      
      // For other errors or final attempt, throw the error
      throw error;
    }
  }
}

/**
 * Fetch current price for a Canadian stock ticker using Questrade
 */
async function getCanadianStockData(ticker) {
  const normalizedTicker = ticker.toUpperCase();
  
  // Skip manual-entry-only tickers
  if (normalizedTicker === 'MANU') {
    return {
      ticker: ticker,
      currentPrice: null,
      source: 'manual',
      note: 'Manual entry only - update price manually',
      lastUpdate: new Date()
    };
  }
  
  // Check if it's crypto
  if (normalizedTicker === 'BTC' || normalizedTicker === 'SONIC') {
    return getCryptoPrice(normalizedTicker);
  }
  
  // Use Questrade only
  if (questrade) {
    console.log(`Using Questrade for ${ticker}...`);
    return await questrade.getStockData(ticker);
  } else {
    throw new Error('Questrade module not available');
  }
}

/**
 * Fetch price from CoinGecko for NDAX crypto assets
 */
async function getNDAXPrice(ticker) {
  const normalizedTicker = ticker.toUpperCase();
  
  // For NDAX, use crypto prices from CoinGecko
  return getCryptoPrice(normalizedTicker);
}

/**
 * Batch fetch NDAX prices using CoinGecko with rate limiting
 */
async function getNDAXPricesData(tickers) {
  console.log(`Trying CoinGecko for NDAX batch: ${tickers.join(', ')}`);
  
  const results = [];
  const errors = [];
  
  // CoinGecko has rate limiting, so we'll fetch sequentially with delays
  // Free tier allows ~10-50 calls/minute, so we'll use 200ms between requests
  const RATE_LIMIT_DELAY = 200; // ms between requests

  for (const ticker of tickers) {
    try {
      const data = await getNDAXPrice(ticker);
      if (data.currentPrice) {
        results.push(data);
        console.log(`✓ ${ticker}: $${data.currentPrice}`);
      } else {
        errors.push({ ticker, error: data.error || 'Price not found' });
        console.error(`✗ ${ticker}: Price not found`);
      }
    } catch (error) {
      errors.push({ ticker, error: error.message || 'Unknown error' });
      console.error(`✗ ${ticker}: ${error.message || 'Unknown error'}`);
    }
    
    // Add delay between requests to avoid rate limiting
    if (ticker !== tickers[tickers.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  console.log(`CoinGecko returned ${results.length} results, ${errors.length} errors`);
  return { results, errors };
}

/**
 * Batch fetch prices for multiple Canadian tickers in parallel using Questrade
 */
async function getCanadianStocksData(tickers) {
  if (questrade) {
    try {
      console.log(`Trying Questrade for batch: ${tickers.join(', ')}`);
      const { results, errors } = await questrade.getStocksData(tickers);
      console.log(`Questrade returned ${results.length} results, ${errors.length} errors`);
      return { results, errors };
    } catch (error) {
      console.error(`Questrade batch fetch failed: ${error.message}`);
      throw error;
    }
  } else {
    throw new Error('Questrade module not available');
  }
}

module.exports = { getCanadianStockData, getCanadianStocksData, getNDAXPrice, getNDAXPricesData };
