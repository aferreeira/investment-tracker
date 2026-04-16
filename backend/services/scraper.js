// scraper.js
const axios = require('axios');
const cheerio = require('cheerio');

async function getFundData(ticker) {
  // Construct URL using lowercase ticker
  const url = `https://www.fundsexplorer.com.br/funds/${ticker.toLowerCase()}`;
  try {
    const { data: html } = await axios.get(url);
    // console.log(html);
    const $ = cheerio.load(html);
    let dyPorCota = '';
    $('div.indicators__box').each((i, element) => {
      const boxText = $(element).text();
      if (boxText.includes('Último Rendimento')) {
        // Get the value inside the <b> tag of this box.
        dyPorCota = $(element).find('b').first().text().trim();
        return false; // break out of the loop once found
      }
    });
    dyPorCota = dyPorCota.replace(',', '.'); 

    const dyPorCotaNum = parseFloat(dyPorCota);
    
    return { dyPorCotaNum };
  } catch (error) {
    console.error(`Error fetching data for ticker ${ticker}:`, error.message);
    throw error;
  }
}

module.exports = { getFundData };
