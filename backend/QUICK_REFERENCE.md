# Quick Reference Guide

## Authentication

### Register
```bash
curl -X POST http://localhost:9100/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john","email":"john@example.com","password":"pass123"}'
```

### Login
```bash
curl -X POST http://localhost:9100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"pass123"}'
```
Save the `token` from response.

### Verify Token
```bash
curl -X POST http://localhost:9100/api/auth/verify \
  -H "Authorization: Bearer $TOKEN"
```

## Store API Tokens

### Questrade
```bash
curl -X POST http://localhost:9100/api/auth/api-token/questrade \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"apiToken":"your_questrade_token"}'
```

### AlphaVantage
```bash
curl -X POST http://localhost:9100/api/auth/api-token/alphavantage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"apiToken":"your_alphavantage_key"}'
```

## Get Quotes

### Single Quote
```bash
curl -X GET http://localhost:9100/api/quotes/AAPL \
  -H "Authorization: Bearer $TOKEN"
```

### Single Quote from Specific Source
```bash
curl -X GET "http://localhost:9100/api/quotes/AAPL?source=questrade" \
  -H "Authorization: Bearer $TOKEN"
```

### Multiple Quotes
```bash
curl -X POST http://localhost:9100/api/quotes/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tickers":["AAPL","GOOGL","MSFT"]}'
```

### Historical Quotes
```bash
curl -X GET "http://localhost:9100/api/quotes/history/AAPL?days=30&interval=daily" \
  -H "Authorization: Bearer $TOKEN"
```

## Environment Setup

### Generate Encryption Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Generate JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Copy .env Template
```bash
cp .env.example .env
```

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Docker
```bash
docker-compose up --build
```

## Database Operations

### Initialize DB
```bash
# The database initializes automatically on server startup
# Manual initialization:
psql -U postgres -h localhost -d investment_db < db-init.sql
```

### Check Tokens Table
```bash
psql -U postgres -h localhost -d investment_db
SELECT * FROM tokens;
SELECT * FROM users;
SELECT * FROM assets;
```

## Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request body/parameters |
| 401 | Unauthorized | Missing/invalid authorization token |
| 403 | Forbidden | No API token stored for service |
| 404 | Not Found | Ticker not found in API |
| 429 | Too Many Requests | Rate limit exceeded, wait and retry |
| 500 | Server Error | Check server logs |

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/api/auth/*` | 5 req / 15 min |
| `/api/quotes/*` | 20 req / min |
| Other `/api/*` | 100 req / 15 min |

## Useful JavaScript Snippets

### Login and Save Token
```javascript
const login = async (email, password) => {
  const res = await fetch('http://localhost:9100/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  localStorage.setItem('token', data.token);
  return data;
};
```

### Get Quote
```javascript
const getQuote = async (ticker) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`http://localhost:9100/api/quotes/${ticker}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.json();
};
```

### Store API Token
```javascript
const storeToken = async (service, apiToken) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`http://localhost:9100/api/auth/api-token/${service}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ apiToken })
  });
  return res.json();
};
```

## Debugging

### Check Server Logs
```bash
# If running with npm run dev, logs appear in terminal
tail -f /var/log/investment-tracker.log  # if logging to file
```

### Test Token Encryption
```bash
node -e "
const { encryptToken, decryptToken } = require('./backend/services/tokenEncryption');
const encrypted = encryptToken('test_token');
const decrypted = decryptToken(encrypted);
console.log('Original:', 'test_token');
console.log('Encrypted:', encrypted.substring(0, 20) + '...');
console.log('Decrypted:', decrypted);
"
```

### Debug JWT Token
```bash
# Decode JWT (without verification)
node -e "
const token = 'your_jwt_token_here';
console.log(JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()));
"
```

### Check Database Connection
```bash
psql -U postgres -h localhost -c "SELECT version();"
```

## File Structure

```
backend/
├── config/
│   └── db.js                    # Database connection
├── middleware/
│   ├── apiAuthMiddleware.js     # API authentication
│   ├── authMiddleware.js        # Existing auth middleware
│   └── rateLimitMiddleware.js   # Rate limiting
├── routes/
│   ├── authRoutes.js            # Auth endpoints
│   └── quoteRoutes.js           # Quote endpoints
├── services/
│   ├── authService.js           # Existing auth service
│   ├── tokenService.js          # Token management
│   ├── tokenEncryption.js       # Token encryption
│   ├── quoteService.js          # Quote fetching
│   └── priceService.js          # Existing price service
├── utils/
│   ├── migrations.js            # Database migrations
│   └── extractTickerData.js     # Existing utility
├── migrations/
│   └── 001_create_tokens_table.sql  # Token table schema
├── package.json                 # Dependencies
├── server.js                    # Main server file
└── .env                         # Environment variables
```

## Tips & Tricks

1. **Reuse token**: Save JWT in localStorage/sessionStorage to avoid re-authenticating
2. **Batch requests**: Use `/api/quotes/batch` for multiple tickers (faster)
3. **Error handling**: Always check `res.ok` or status before parsing JSON
4. **Rate limiting**: Implement exponential backoff in clientside code
5. **Token expiration**: Refresh token 1 hour before expiration
6. **Multiple APIs**: Store tokens for multiple sources, system auto-selects best

## Resources

- API Docs: `API_DOCUMENTATION.md`
- Setup Guide: `SETUP_GUIDE.md`
- Implementation: `IMPLEMENTATION_SUMMARY.md`
- Main README: `../README.md`
