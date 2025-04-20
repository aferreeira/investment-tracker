// extractTickerData.js
const axios = require('axios');

async function extractTickerData() {
  const url = 'https://investidor10.com.br/api/carteiras/datatable/ativos/1485125/Fii?draw=1&columns%5B0%5D%5Bdata%5D=ticker&columns%5B0%5D%5Bname%5D=ticker&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=true&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=segment&columns%5B1%5D%5Bname%5D=segment&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=true&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=fii_type&columns%5B2%5D%5Bname%5D=fii_type&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=true&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B3%5D%5Bdata%5D=quantity&columns%5B3%5D%5Bname%5D=quantity&columns%5B3%5D%5Bsearchable%5D=true&columns%5B3%5D%5Borderable%5D=true&columns%5B3%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B3%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B4%5D%5Bdata%5D=avg_price&columns%5B4%5D%5Bname%5D=avg_price&columns%5B4%5D%5Bsearchable%5D=true&columns%5B4%5D%5Borderable%5D=true&columns%5B4%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B4%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B5%5D%5Bdata%5D=current_price&columns%5B5%5D%5Bname%5D=current_price&columns%5B5%5D%5Bsearchable%5D=true&columns%5B5%5D%5Borderable%5D=true&columns%5B5%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B5%5D%5Bsearch%5D%5Bregex%5D=false&order%5B0%5D%5Bcolumn%5D=8&order%5B0%5D%5Bdir%5D=desc&start=0&length=35';

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    // Map the API response into the shape your app expects
    const tickers = response.data.data.map(item => ({
      ativo: item.ticker_name,
      quantidade: item.quantity,
      precoMedio: item.avg_price,
      precoAtual: item.current_price
    }));

    return tickers;
  } catch (err) {
    console.error('Error fetching data from Investidor10 API:', err.message);
    throw err;
  }
}

module.exports = { extractTickerData };
