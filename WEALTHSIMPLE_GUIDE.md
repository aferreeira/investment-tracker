# WealthSimple CSV Export Guide

## How to Export Your Portfolio from WealthSimple

1. Log in to your WealthSimple account
2. Navigate to your trading account
3. Look for an "Export" or "Download" option (usually near your account settings)
4. Export your holdings as CSV format
5. Upload the CSV file using the "Choose File" button in the Canada Investment Tracker

## Expected CSV Format

Your CSV file should contain the following columns:

```
ticker,quantity,avg_price,current_price
AAPL,10,150.25,175.50
MSFT,5,320.15,345.80
TD.TO,25,80.50,82.25
ENB.TO,50,45.00,46.75
```

### Column Definitions:
- **ticker** (or symbol, ativo): Stock ticker symbol (e.g., AAPL, TD.TO, ENB.TO)
  - For Canadian stocks, include the `.TO` suffix (Toronto Stock Exchange)
  - For US stocks, use the regular ticker symbol (AAPL, MSFT, etc.)
- **quantity** (or qty, shares, quantidade): Number of shares you own
- **avg_price** (or average_price, preco_medio): Your average purchase price per share
- **current_price** (or price, preco_atual): Current market price per share (can be left blank, will be updated automatically)

### Flexible Column Names:
The system accepts various common naming conventions:
- `ticker` / `symbol` / `ativo`
- `quantity` / `qty` / `shares` / `quantidade`
- `avg_price` / `average_price` / `avgprice` / `preco_medio`
- `current_price` / `currentprice` / `price` / `preco_atual`

## Example Files

### Simple Format (only required fields):
```csv
ticker,quantity,avg_price,current_price
TD.TO,25,80.50,82.25
ENB.TO,50,45.00,46.75
RY.TO,10,165.30,170.50
```

### With Alternative Column Names:
```csv
symbol,qty,avgprice,price
TD.TO,25,80.50,82.25
ENB.TO,50,45.00,46.75
```

## Features

After uploading your CSV:
- [x] All holdings are imported into the Canada tracker
- [x] Click "🔄 Refresh Prices" to update current prices from Yahoo Finance
- [x] Automatic calculation of gains/losses
- [x] Real-time dividend yield information (where available)
- [x] Separate tracking from your Brazil portfolio

## Notes

- The system uses Yahoo Finance API for real-time Canadian stock prices
- Prices are updated on-demand when you click "Refresh Prices"
- Your portfolio data is stored locally in the database
- The tracker will safely separate Canadian assets from Brazilian assets
