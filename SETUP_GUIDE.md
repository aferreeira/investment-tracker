# Quick Setup Guide - Brazil ➜ Canada Migration

## What's New? 🎉

Your investment tracker now supports tracking both your **Brazilian** (B3) and **Canadian** (WealthSimple) portfolios separately!

### Brazil Portfolio (Already Working ✅)
- Automatic sync from investidor10.com.br
- Stocks and FIIs organized by category
- Access at: `http://localhost:3000/brazil`

### Canada Portfolio (NEW 🆕)
- Import your WealthSimple holdings via CSV
- Real-time prices from Yahoo Finance
- Track gains/losses in CAD
- Access at: `http://localhost:3000/canada`

---

## Step-by-Step Setup

### 1. Install New Dependencies
```bash
cd backend
npm install
```

**New packages added:**
- `csv-parser` - Parse uploaded CSV files
- `multer` - Handle file uploads
- `yahoo-finance2` - Fetch Canadian stock prices

### 2. Start the App
```bash
docker-compose up
# OR manually:
cd backend && npm start
cd frontend && npm start
```

### 3. Import Your WealthSimple Portfolio

1. Go to WealthSimple and export your holdings as CSV
2. Navigate to `http://localhost:3000/canada`
3. Click "Choose File" and select your CSV
4. Wait for success message
5. Click "🔄 Refresh Prices" to update prices

### 4. CSV Format

Your CSV should have these columns:
```
ticker,quantity,avg_price,current_price
TD.TO,25,80.50,82.25
AAPL,5,150.25,175.50
```

For detailed instructions, see [WEALTHSIMPLE_GUIDE.md](../WEALTHSIMPLE_GUIDE.md)

### 5. Test with Sample Data
A sample CSV is included: `sample_portfolio.csv`
Use it to test the upload process!

---

## Key Features

✅ **Separate Tracking**
- Brazil and Canada portfolios are kept separate
- No mixing of currencies (BRL vs CAD/USD)

✅ **Automatic Calculations**
- Gains/losses
- Variation percentage
- Total portfolio value

✅ **Real-Time Prices**
- Click "Refresh Prices" to update all tickers at once
- Or update individual stocks programmatically

✅ **Live Updates**
- Socket.io ensures all connected clients see updates in real-time

---

## API Reference

### Upload CSV
```bash
POST /api/assets/upload-csv
Content-Type: multipart/form-data
Body: file (CSV), market: "canada"
```

### Refresh Prices
```bash
POST /api/assets/update-canadian-prices
# Updates all Canadian stock prices from Yahoo Finance
```

### Get Assets
```bash
GET /api/assets?market=canada
GET /api/assets?market=brazil
```

---

## Troubleshooting

### CSV Upload Fails
- ✓ Make sure CSV has headers: `ticker`, `quantity`, `avg_price`, `current_price`
- ✓ File must be under 5MB
- ✓ Ticker symbols should be uppercase (TD.TO, AAPL, etc.)

### Prices Don't Update
- ✓ Make sure you have internet connection (Yahoo Finance API needs it)
- ✓ Check browser console for errors
- ✓ Ticker might not exist in Yahoo Finance database

### Brazil Page Shows No Data
- ✓ This is normal on first load
- ✓ Data syncs automatically from investidor10.com.br
- ✓ May take a few seconds to load

---

## Next Steps (Optional)

Consider implementing:
1. **Auto-refresh** - Prices update every 30 minutes
2. **Watchlist** - Track stocks you don't own
3. **Alerts** - Notify when prices hit targets
4. **Export Reports** - PDF/CSV export of portfolio

---

## Questions?

- Check [WEALTHSIMPLE_GUIDE.md](../WEALTHSIMPLE_GUIDE.md) for CSV format details
- See [README.md](../README.md) for full documentation
- Check the console for any backend errors

Enjoy tracking your investments! 🚀
