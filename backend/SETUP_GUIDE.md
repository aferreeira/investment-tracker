# Investment Tracker - Setup & Integration Guide

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Generate Encryption Keys

Generate a 32-byte hex encryption key for token encryption:

```bash
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

This will output something like:
```
ENCRYPTION_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update `.env` with your values:

```env
# Server
PORT=9100
NODE_ENV=development

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=investment_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_me_in_production

# Token Encryption - generate one from step 2
TOKEN_ENCRYPTION_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0
ENCRYPTION_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0

# Optional: API Keys
QUESTRADE_REFRESH_TOKEN=your_questrade_token
ALPHAVANTAGE_API_KEY=your_alphavantage_key
```

### 4. Start the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

**Docker:**
```bash
docker-compose up --build
```

The server will start on `http://localhost:9100`

## Usage Flow

### Step 1: User Registration & Login

Register a new user:
```bash
curl -X POST http://localhost:9100/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "secure_password_123"
  }'
```

Response:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "john@example.com",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

Login to get JWT token:
```bash
curl -X POST http://localhost:9100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "secure_password_123"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Login successful"
}
```

Save this token - you'll need it for all other requests.

### Step 2: Store API Tokens

Store your Questrade API token securely:

```bash
curl -X POST http://localhost:9100/api/auth/api-token/questrade \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "apiToken": "your_questrade_api_token_here"
  }'
```

Or store AlphaVantage token:

```bash
curl -X POST http://localhost:9100/api/auth/api-token/alphavantage \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "apiToken": "your_alphavantage_key_here"
  }'
```

The token is automatically encrypted and stored in the database.

### Step 3: Fetch Stock Quotes

Get current quote for AAPL:

```bash
curl -X GET http://localhost:9100/api/quotes/AAPL \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

Response:
```json
{
  "source": "questrade",
  "ticker": "AAPL",
  "price": 150.25,
  "timestamp": "2024-01-15T10:30:00Z",
  "high": 151.50,
  "low": 149.75,
  "volume": 50000000
}
```

### Step 4: Batch Fetch Quotes

Get multiple quotes at once:

```bash
curl -X POST http://localhost:9100/api/quotes/batch \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "tickers": ["AAPL", "GOOGL", "MSFT"]
  }'
```

Response:
```json
{
  "tickers": ["AAPL", "GOOGL", "MSFT"],
  "quotes": {
    "AAPL": {
      "source": "questrade",
      "price": 150.25,
      "timestamp": "2024-01-15T10:30:00Z"
    },
    "GOOGL": {
      "source": "questrade",
      "price": 136.50,
      "timestamp": "2024-01-15T10:30:00Z"
    },
    "MSFT": {
      "source": "questrade",
      "price": 310.75,
      "timestamp": "2024-01-15T10:30:00Z"
    }
  },
  "timestamp": "2024-01-15T10:31:00Z"
}
```

## Frontend Integration

### JavaScript Example

```javascript
class InvestmentTrackerAPI {
  constructor(baseURL = 'http://localhost:9100') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('authToken');
  }

  // Authentication
  async register(username, email, password) {
    const res = await fetch(`${this.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    return res.json();
  }

  async login(email, password) {
    const res = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    this.token = data.token;
    localStorage.setItem('authToken', this.token);
    return data;
  }

  async logout() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  // Token Management
  async storeQuestradeToken(apiToken) {
    const res = await fetch(`${this.baseURL}/api/auth/api-token/questrade`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ apiToken })
    });
    return res.json();
  }

  // Quote Fetching
  async getQuote(ticker, source = null) {
    const url = new URL(`${this.baseURL}/api/quotes/${ticker}`);
    if (source) url.searchParams.append('source', source);

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return res.json();
  }

  async getBatchQuotes(tickers) {
    const res = await fetch(`${this.baseURL}/api/quotes/batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tickers })
    });
    return res.json();
  }
}

// Usage Example
(async () => {
  const api = new InvestmentTrackerAPI();

  // Register and login
  await api.register('john_doe', 'john@example.com', 'password123');
  await api.login('john@example.com', 'password123');

  // Store Questrade token
  await api.storeQuestradeToken('your_questrade_token');

  // Fetch single quote
  const aapl = await api.getQuote('AAPL');
  console.log('AAPL Quote:', aapl);

  // Fetch multiple quotes
  const quotes = await api.getBatchQuotes(['AAPL', 'GOOGL', 'MSFT']);
  console.log('Batch Quotes:', quotes);
})();
```

### React Component Example

```jsx
import React, { useState, useEffect } from 'react';

function QuoteViewer() {
  const [quotes, setQuotes] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('authToken');

  const fetchQuote = async (ticker) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:9100/api/quotes/${ticker}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch quote');

      const data = await res.json();
      setQuotes(prev => ({ ...prev, [ticker]: data }));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchQuotes = async (tickers) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:9100/api/quotes/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tickers })
      });

      if (!res.ok) throw new Error('Failed to fetch quotes');

      const data = await res.json();
      setQuotes(data.quotes);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={() => fetchBatchQuotes(['AAPL', 'GOOGL', 'MSFT'])}>
        Load Quotes
      </button>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <div>
        {Object.entries(quotes).map(([ticker, quote]) => (
          <div key={ticker} style={{ padding: '10px', border: '1px solid #ccc' }}>
            <h3>{ticker}</h3>
            <p>Price: ${quote.price}</p>
            <p>High: ${quote.high}</p>
            <p>Low: ${quote.low}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default QuoteViewer;
```

## Database Structure

The system creates three main tables:

### users
- Stores user profiles and hashed passwords
- One record per user

### tokens
- Stores encrypted API tokens for each service
- Each user can have tokens for multiple services (questrade, alphavantage, etc.)
- Tokens are automatically encrypted before storage
- Optional expiration support for token refresh

### assets
- Stores investment holdings
- One record per ticker per user per market

## Security Features

✅ **Password Hashing**: Passwords are hashed with bcryptjs
✅ **Token Encryption**: API tokens encrypted with AES-256
✅ **JWT Authentication**: Stateless, secure token-based auth
✅ **Rate Limiting**: Prevents brute force and spam attacks
✅ **HTTPS Ready**: Works with HTTPS in production
✅ **Secure Headers**: CORS and security headers configured

## Troubleshooting

### "Invalid token"
- Token has expired (24h default)
- Re-login to get a new token
- Check JWT_SECRET matches on server

### "No questrade token found"
- You need to store the token first via `/api/auth/api-token/questrade`
- Check that the token is non-empty

### "Rate limit exceeded"
- Too many requests in short time
- Wait according to `X-RateLimit-Reset` header
- Implement backoff logic in frontend

### "Database connection error"
- Ensure PostgreSQL is running
- Check `.env` database credentials
- Verify database exists and is accessible

## Next Steps

1. **Frontend Integration**: Use the React/JavaScript examples above
2. **Error Handling**: Implement proper error handling for all API calls
3. **Token Refresh**: Consider implementing token refresh endpoint for longer sessions
4. **WebSocket**: Connect to Socket.io for real-time updates
5. **Advanced Features**: Historical quote data, portfolio analytics, etc.

## API Reference Documentation

Full API documentation is available in `API_DOCUMENTATION.md`

## Support

For issues or questions:
1. Check error messages and logs
2. Review API_DOCUMENTATION.md
3. Check database schema in `db-init.sql`
4. Review example code in this guide
