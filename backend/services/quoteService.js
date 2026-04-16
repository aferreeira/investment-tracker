// quoteService.js - Fetch stock quotes from various sources
const axios = require('axios');

/**
 * Fetch stock quote from Questrade API
 * @param {string} apiToken - Questrade API token
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} - {price, timestamp}
 */
const getQuestradeQuote = async (apiToken, ticker) => {
  try {
    const response = await axios.get('https://api.questrade.com/v1/symbols/search', {
      params: { prefix: ticker },
      headers: { Authorization: `Bearer ${apiToken}` }
    });

    if (!response.data.symbols || response.data.symbols.length === 0) {
      throw new Error(`Ticker ${ticker} not found on Questrade`);
    }

    const symbolId = response.data.symbols[0].symbolId;

    // Fetch current quote
    const quoteResponse = await axios.get(`https://api.questrade.com/v1/symbols/${symbolId}/quotes`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });

    const quote = quoteResponse.data.quotes[0];
    return {
      source: 'questrade',
      ticker,
      price: quote.lastTradePrice,
      timestamp: new Date(quote.lastTradeTime),
      high: quote.highPrice,
      low: quote.lowPrice,
      volume: quote.volume
    };
  } catch (error) {
    console.error(`Error fetching Questrade quote for ${ticker}:`, error.message);
    throw error;
  }
};

/**
 * Fetch stock quote from Yahoo Finance API
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} - {price, timestamp}
 */
const getYahooFinanceQuote = async (ticker) => {
  try {
    // Using a free alternative API (you might need to add an API key)
    const response = await axios.get(`https://api.example.com/quote/${ticker}`);
    
    return {
      source: 'yahoo',
      ticker,
      price: response.data.price,
      timestamp: new Date(response.data.timestamp),
      high: response.data.high,
      low: response.data.low,
      volume: response.data.volume
    };
  } catch (error) {
    console.error(`Error fetching Yahoo Finance quote for ${ticker}:`, error.message);
    throw error;
  }
};

/**
 * Fetch stock quote from AlphaVantage API
 * @param {string} apiKey - AlphaVantage API key
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} - {price, timestamp}
 */
const getAlphaVantageQuote = async (apiKey, ticker) => {
  try {
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'QUOTE_ENDPOINT',
        symbol: ticker,
        apikey: apiKey
      }
    });

    if (response.data['Note'] || response.data['Error Message']) {
      throw new Error(response.data['Note'] || response.data['Error Message']);
    }

    const quote = response.data['Global Quote'];
    return {
      source: 'alphavantage',
      ticker,
      price: parseFloat(quote['05. price']),
      timestamp: new Date(),
      high: parseFloat(quote['03. high']),
      low: parseFloat(quote['04. low']),
      volume: parseInt(quote['06. volume'])
    };
  } catch (error) {
    console.error(`Error fetching AlphaVantage quote for ${ticker}:`, error.message);
    throw error;
  }
};

/**
 * Fetch quotes from multiple sources with fallback
 * @param {Object} tokens - {questrade, alphavantage, ...}
 * @param {Array<string>} tickers - List of ticker symbols
 * @returns {Promise<Object>} - {ticker: {price, source, timestamp, ...}}
 */
const getMultiSourceQuotes = async (tokens, tickers) => {
  const results = {};

  for (const ticker of tickers) {
    try {
      // Try Questrade first
      if (tokens.questrade) {
        try {
          results[ticker] = await getQuestradeQuote(tokens.questrade, ticker);
          continue;
        } catch (error) {
          console.warn(`Questrade failed for ${ticker}, trying AlphaVantage...`);
        }
      }

      // Fallback to AlphaVantage
      if (tokens.alphavantage) {
        try {
          results[ticker] = await getAlphaVantageQuote(tokens.alphavantage, ticker);
          continue;
        } catch (error) {
          console.warn(`AlphaVantage failed for ${ticker}...`);
        }
      }

      // If all sources fail
      results[ticker] = { error: `Could not fetch quote for ${ticker}` };
    } catch (error) {
      results[ticker] = { error: error.message };
    }
  }

  return results;
};

module.exports = {
  getQuestradeQuote,
  getYahooFinanceQuote,
  getAlphaVantageQuote,
  getMultiSourceQuotes
};
