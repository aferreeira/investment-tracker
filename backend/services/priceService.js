// priceService.js
// Centralized price fetching service using Questrade (stocks) + CoinGecko (crypto)
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
const priceCache = new Map();
const QUESTRADE_TOKEN_FILE = path.join(__dirname, 'questrade_token.txt');

// Try to use Questrade if available
let questrade = null;
try {
  if (fs.existsSync(QUESTRADE_TOKEN_FILE)) {
    questrade = require('./questrade');
  }
} catch (error) {
  console.log('Questrade module not available');
}

/**
 * Fetch crypto price from CoinGecko (free, no API key needed)
 */
async function getCryptoPrice(symbol) {
  const cryptoMap = {
    'BTC': 'bitcoin',
    'SONIC': 'sonic-3'
  };
  
  const coinId = cryptoMap[symbol.toUpperCase()];
  if (!coinId) {
    throw new Error(`Crypto ${symbol} not supported`);
  }

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
 * Batch fetch NDAX prices using CoinGecko
 */
async function getNDAXPricesData(tickers) {
  console.log(`Trying CoinGecko for NDAX batch: ${tickers.join(', ')}`);
  
  const promises = tickers.map(ticker => getNDAXPrice(ticker));
  const results = [];
  const errors = [];

  try {
    const settledResults = await Promise.allSettled(promises);

    settledResults.forEach((settlement, index) => {
      const ticker = tickers[index];
      
      if (settlement.status === 'fulfilled') {
        const data = settlement.value;
        if (data.currentPrice) {
          results.push(data);
          console.log(`✓ ${ticker}: $${data.currentPrice}`);
        } else {
          errors.push({ ticker, error: data.error || 'Price not found' });
          console.error(`✗ ${ticker}: Price not found`);
        }
      } else {
        errors.push({ ticker, error: settlement.reason?.message || 'Unknown error' });
        console.error(`✗ ${ticker}: ${settlement.reason?.message || 'Unknown error'}`);
      }
    });
    
    console.log(`CoinGecko returned ${results.length} results, ${errors.length} errors`);
  } catch (error) {
    console.error('NDAX batch fetch error:', error.message);
    tickers.forEach(ticker => {
      errors.push({ ticker, error: error.message });
    });
  }

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
