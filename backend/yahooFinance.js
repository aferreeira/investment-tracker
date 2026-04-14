// yahooFinance.js
const axios = require('axios');
const cheerio = require('cheerio');
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
  console.log('Questrade module not available, will use Yahoo Finance fallback');
}

/**
 * Fetch crypto price from CoinGecko (free, no API key needed)
 */
async function getCryptoPrice(symbol) {
  const cryptoMap = {
    'BTC': 'bitcoin',
    'SONIC': 'sonic-svm'
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
 * Fetch stock price by scraping Yahoo Finance HTML (supports Canadian .TO stocks)
 */
async function getStockPrice(ticker) {
  try {
    let normalizedTicker = ticker.toUpperCase();
    if (!normalizedTicker.includes('.')) {
      normalizedTicker += '.TO'; // .TO is Toronto Stock Exchange
    }

    // Check cache first
    const cacheKey = `stock_${normalizedTicker}`;
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return {
        ticker: ticker,
        currentPrice: cached.price,
        currency: 'CAD',
        source: 'cached',
        lastUpdate: cached.timestamp
      };
    }

    // Scrape Yahoo Finance HTML
    const url = `https://ca.finance.yahoo.com/quote/${normalizedTicker}/`;
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 8000
    });

    const $ = cheerio.load(html);
    
    // Yahoo Finance stores price in a data-symbol attribute with specific structure
    let price = null;

    // Method 1: Look for the main price display (usually in a fin-streamer element)
    const priceElement = $('fin-streamer[data-symbol="' + normalizedTicker + '"][data-field="regularMarketPrice"]');
    if (priceElement.length > 0) {
      price = parseFloat(priceElement.text());
    }

    // Method 2: Look for price in span tags with specific classes
    if (!price || isNaN(price)) {
      $('span').each((i, elem) => {
        const text = $(elem).text().trim();
        // Look for a number pattern that could be the price
        const match = text.match(/^[\d,]+\.?\d*$/);
        if (match && parseFloat(text.replace(/,/g, '')) > 1) {
          price = parseFloat(text.replace(/,/g, ''));
          return false; // break
        }
      });
    }

    // Method 3: Look in the page title or other meta info
    if (!price || isNaN(price)) {
      const titleMatch = html.match(/\$?([\d,]+\.\d{2})/);
      if (titleMatch) {
        price = parseFloat(titleMatch[1].replace(/,/g, ''));
      }
    }

    if (!price || isNaN(price)) {
      throw new Error(`Could not extract price from Yahoo Finance page for ${normalizedTicker}`);
    }

    const cleanPrice = parseFloat(price).toFixed(2);
    
    // Cache the result
    priceCache.set(cacheKey, { price: parseFloat(cleanPrice), timestamp: Date.now() });

    return {
      ticker: ticker,
      currentPrice: parseFloat(cleanPrice),
      currency: 'CAD',
      source: 'yahoo-finance-scrape',
      lastUpdate: new Date()
    };
  } catch (error) {
    console.error(`Error fetching ${ticker} from Yahoo Finance:`, error.message);
    throw error;
  }
}

/**
 * Fetch stock price from Investing.com as a fallback (useful for stocks that Yahoo Finance can't find)
 */
async function getStockPriceFromInvesting(ticker) {
  try {
    let normalizedTicker = ticker.toUpperCase();
    if (!normalizedTicker.includes('.')) {
      normalizedTicker += '.TO'; // .TO is Toronto Stock Exchange
    }

    // Check cache first
    const cacheKey = `stock_investing_${normalizedTicker}`;
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return {
        ticker: ticker,
        currentPrice: cached.price,
        currency: 'CAD',
        source: 'cached-investing',
        lastUpdate: cached.timestamp
      };
    }

    // Map of ticker symbols to investing.com URL paths
    const tickerMap = {
      'AG.TO': 'first-majestic',
      'ZRE.TO': 'granite-real-estate-investment-trust'
    };

    const urlPath = tickerMap[normalizedTicker] || normalizedTicker.toLowerCase();
    const url = `https://www.investing.com/equities/${urlPath}`;

    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 8000
    });

    const $ = cheerio.load(html);
    
    let price = null;

    // Method 1: Look for the main price in a specific data attribute or span
    // Investing.com typically shows price in a span with class containing "last-price" or similar
    const priceSpan = $('[data-test="instrument-price-last"]');
    if (priceSpan.length > 0) {
      price = parseFloat(priceSpan.text());
    }

    // Method 2: Look for price in common investing.com structures
    if (!price || isNaN(price)) {
      $('span[class*="instrument"]').each((i, elem) => {
        const text = $(elem).text().trim();
        const match = text.match(/^[\d,]+\.?\d*$/);
        if (match && parseFloat(text.replace(/,/g, '')) > 0.1) {
          price = parseFloat(text.replace(/,/g, ''));
          return false;
        }
      });
    }

    // Method 3: Look for price in the page source directly
    if (!price || isNaN(price)) {
      const priceMatch = html.match(/"last":"([\d.]+)"/);
      if (priceMatch) {
        price = parseFloat(priceMatch[1]);
      }
    }

    // Method 4: Search for common price patterns in the HTML
    if (!price || isNaN(price)) {
      const allPricesMatch = html.match(/data-value="([\d.]+)"/g);
      if (allPricesMatch && allPricesMatch.length > 0) {
        // Extract first valid price value
        for (let match of allPricesMatch) {
          const val = parseFloat(match.match(/[\d.]+/)[0]);
          if (val > 0.1 && val < 10000) { // reasonable price range
            price = val;
            break;
          }
        }
      }
    }

    if (!price || isNaN(price)) {
      throw new Error(`Could not extract price from Investing.com for ${normalizedTicker}`);
    }

    const cleanPrice = parseFloat(price).toFixed(2);

    // Cache the result
    priceCache.set(cacheKey, { price: parseFloat(cleanPrice), timestamp: Date.now() });

    return {
      ticker: ticker,
      currentPrice: parseFloat(cleanPrice),
      currency: 'CAD',
      source: 'investing-scrape',
      lastUpdate: new Date()
    };
  } catch (error) {
    console.error(`Error fetching ${ticker} from Investing.com:`, error.message);
    throw error;
  }
}

/**
 * Fetch current price for a Canadian stock or crypto ticker
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
        } else {
          errors.push({ ticker, error: data.error || 'Price not found' });
        }
      } else {
        errors.push({ ticker, error: settlement.reason?.message || 'Unknown error' });
      }
    });
  } catch (error) {
    console.error('NDAX batch fetch error:', error.message);
    tickers.forEach(ticker => {
      errors.push({ ticker, error: error.message });
    });
  }

  return { results, errors };
}

/**
 * Batch fetch prices for multiple Canadian tickers in parallel
 */
async function getCanadianStocksData(tickers) {
  // Use Questrade only (temporarily)
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
