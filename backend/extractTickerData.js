async function extractTickerData() {
    // Hard-coded list of ticker data
    const tickers = [
      { ativo: 'RBFF11', quantidade: 37, precoMedio: 46.24 },
      { ativo: 'CACR11', quantidade: 18, precoMedio: 81.42 },
      { ativo: 'JURO11', quantidade: 16, precoMedio: 93.28 },
      { ativo: 'RVBI11', quantidade: 23, precoMedio: 59.26 },
      { ativo: 'MXRF11', quantidade: 161, precoMedio: 9 },
      { ativo: 'CPTS11', quantidade: 203, precoMedio: 6.35 },
      { ativo: 'VISC11', quantidade: 14, precoMedio: 92.12 },
      { ativo: 'PORD11', quantidade: 166, precoMedio: 6.92 },
      { ativo: 'PVBI11', quantidade: 16, precoMedio: 71.34 },
      { ativo: 'GARE11', quantidade: 142, precoMedio: 7.99 },
      { ativo: 'XPML11', quantidade: 12, precoMedio: 97.35 },
      { ativo: 'VILG11', quantidade: 8, precoMedio: 69.36 },
      { ativo: 'HGLG11', quantidade: 4, precoMedio: 149.25 }
    ];
    
    // Return the list of tickers
    return tickers;
  }
  
  module.exports = { extractTickerData };