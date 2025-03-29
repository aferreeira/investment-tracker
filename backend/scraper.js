// scraper.js
const axios = require('axios');
const cheerio = require('cheerio');

async function getFundData(ticker) {
  // Construct URL using lowercase ticker
  console.log(`https://www.fundsexplorer.com.br/funds/${ticker.toLowerCase()}`);
  const url = `https://www.fundsexplorer.com.br/funds/${ticker.toLowerCase()}`;
//   const url = `https://www.fundsexplorer.com.br/funds/xpml11`;
  try {
    const { data: html } = await axios.get(url);
    // console.log(html);
    const $ = cheerio.load(html);
    let precoAtual = $('div.headerTicker__content__price p').first().text().trim();
    let dyPorCota = '';
    $('div.indicators__box').each((i, element) => {
      const boxText = $(element).text();
      if (boxText.includes('Último Rendimento')) {
        // Get the value inside the <b> tag of this box.
        dyPorCota = $(element).find('b').first().text().trim();
        return false; // break out of the loop once found
      }
    });
    precoAtual = precoAtual.replace(/R\$\s*/, '').replace(',', '.');
    dyPorCota = dyPorCota.replace(',', '.'); 

    const precoAtualNum = parseFloat(precoAtual);
    const dyPorCotaNum = parseFloat(dyPorCota);
    
    return { precoAtualNum, dyPorCotaNum };
  } catch (error) {
    console.error(`Error fetching data for ticker ${ticker}:`, error.message);
    throw error;
  }
}

module.exports = { getFundData };
