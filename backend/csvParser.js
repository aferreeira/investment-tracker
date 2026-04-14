// csvParser.js
const csv = require('csv-parser');
const { Readable } = require('stream');

/**
 * Parse CSV buffer into array of objects
 * Expected CSV columns:
 * - ticker/symbol/ativo: Stock ticker (e.g., AAPL, GOOG)
 * - quantity/quantidade: Number of shares
 * - avg_price/preco_medio: Average purchase price
 * - platform (optional): WealthSimple, NDAX, Manulife, etc.
 * - current_price/preco_atual (optional): Will be fetched from API if not provided
 */
async function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    // Create a readable stream from the buffer
    const readable = Readable.from([buffer]);
    
    readable
      .pipe(csv({
        mapHeaders: ({ header }) => {
          // Normalize header names to lowercase
          const normalized = header.toLowerCase().trim();
          // Map common aliases
          const mapping = {
            'ticker': 'ticker',
            'symbol': 'ticker',
            'ativo': 'ticker',
            'quantity': 'quantidade',
            'qty': 'quantidade',
            'shares': 'quantidade',
            'quantidade': 'quantidade',
            'avg_price': 'precoMedio',
            'average_price': 'precoMedio',
            'avgprice': 'precoMedio',
            'preco_medio': 'precoMedio',
            'avg price': 'precoMedio',
            'current_price': 'precoAtual',
            'currentprice': 'precoAtual',
            'price': 'precoAtual',
            'preco_atual': 'precoAtual',
            'current price': 'precoAtual',
          };
          return mapping[normalized] || normalized;
        }
      }))
      .on('data', (row) => {
        // Clean and validate the row
        const cleanedRow = {
          ticker: String(row.ticker || row.symbol || row.ativo || '').trim().toUpperCase(),
          quantidade: parseFloat(row.quantidade || row.quantity || row.qty || 0),
          precoMedio: parseFloat(row.precoMedio || row.avg_price || row.avgprice || 0),
          precoAtual: parseFloat(row.precoAtual || row.current_price || row.currentprice || row.price || 0), // Optional, will be fetched if 0
          platform: String(row.platform || 'WealthSimple').trim(),
        };
        
        // Validate required fields (current_price is optional now)
        if (cleanedRow.ticker && cleanedRow.quantidade > 0 && cleanedRow.precoMedio > 0) {
          results.push(cleanedRow);
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

module.exports = { parseCSV };
