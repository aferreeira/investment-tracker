# investment-tracker

Multi-market investment portfolio tracker with support for Brazilian (B3) and Canadian (TSX/US) securities.

## Features

### 🇧🇷 Brazilian Market (B3)
- Real-time tracking of stocks (Tickers) and real estate funds (FIIs)
- Automatic data sync with investidor10.com.br
- Dividend yield calculations
- Portfolio performance metrics

### 🇨🇦 Canadian Market (WealthSimple)
- Import holdings from CSV export (WealthSimple format)
- Real-time price updates via Yahoo Finance
- Support for Canadian stocks (TSX) and US stocks
- Separate portfolio tracking from Brazil

## Quick Start

### Prerequisites
- Node.js + npm
- PostgreSQL
- Docker (optional)

### Installation

1. Clone the repository
```bash
git clone <repo-url>
cd investment-tracker
```

2. Install dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

3. Setup environment variables
```bash
# backend/.env (optional, defaults work with docker-compose)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=investment_db
POSTGRES_HOST=db
POSTGRES_PORT=5432
```

4. Start the application
```bash
# Using docker-compose (recommended)
docker-compose up

# Or manually start backend and frontend
cd backend && npm start
cd frontend && npm start
```

Access the application at `http://localhost:3000`

## Usage

### Brazil Portfolio
1. Navigate to `/brazil`
2. Data automatically syncs from investidor10.com.br
3. View your stocks and FIIs organized by category

### Canada Portfolio (WealthSimple)
1. Navigate to `/canada`
2. Export your portfolio from WealthSimple as CSV
3. Upload the CSV file using the import form
4. Click "🔄 Refresh Prices" to update current prices
5. View real-time gains/losses and dividend yields

For detailed CSV format instructions, see [WEALTHSIMPLE_GUIDE.md](WEALTHSIMPLE_GUIDE.md)

## API Endpoints

### Assets
- `GET /api/assets?market=brazil|canada` - Get assets for a market
- `POST /api/assets/bulk` - Bulk insert Brazilian assets
- `POST /api/assets/upload-csv` - Upload Canadian portfolio CSV
- `POST /api/assets/update-canadian-prices` - Refresh all Canadian stock prices
- `POST /api/assets/update-canadian-price/:ticker` - Refresh single stock price
- `POST /api/assets` - Manually add asset
- `DELETE /api/assets/:ativo` - Remove asset

## Project Structure

```
investment-tracker/
├── backend/
│   ├── server.js           # Express server
│   ├── db.js               # PostgreSQL connection
│   ├── migrations.js       # Database schema
│   ├── csvParser.js        # CSV file parser
│   ├── scraper.js          # Brazilian data scraper (investidor10)
│   ├── yahooFinance.js     # Canadian price fetcher (Yahoo Finance)
│   ├── extractTickerData.js # Brazilian ticker extraction
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── BrazilInvestment.js
│   │   ├── CanadaInvestment.js
│   │   ├── AssetTracker.js
│   │   └── App.css
│   └── package.json
├── docker-compose.yml
├── WEALTHSIMPLE_GUIDE.md
└── README.md
```

## Technologies

- **Backend**: Express.js, PostgreSQL, Socket.io
- **Frontend**: React, Axios, Socket.io-client, Recharts
- **Data Sources**: investidor10.com.br (Brazil), Yahoo Finance (Canada)
- **CSV Parsing**: csv-parser
- **File Upload**: multer

## TODO

- [ ] Add authentication/multi-user support
- [ ] Automated price refresh intervals
- [ ] Portfolio allocation charts
- [ ] Tax reporting features
- [ ] Mobile app version
- [ ] Additional market support (US, Europe)

## License

MIT
