# Investment Tracker Backend - API Documentation

## Overview

This backend provides a comprehensive REST API for managing investment portfolios, fetching real-time stock quotes, and handling user authentication with secure token management.

## Features

- **User Authentication**: JWT-based authentication with secure password hashing
- **API Token Management**: Encrypted storage of third-party API tokens (Questrade, AlphaVantage)
- **Real-time Stock Quotes**: Fetch current stock prices from multiple sources
- **Rate Limiting**: Built-in rate limiting to prevent abuse
- **Asset Management**: Track investments across multiple markets
- **WebSocket Support**: Real-time updates via Socket.io

## Setup

### Prerequisites

- Node.js 14+
- PostgreSQL 12+
- npm

### Installation

```bash
cd backend
npm install
```

### Configuration

1. Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

2. Key environment variables to set:

```
JWT_SECRET=your_secure_jwt_secret
TOKEN_ENCRYPTION_KEY=your_32_byte_hex_key
ENCRYPTION_KEY=your_encryption_key_for_tokens
```

### Generate Encryption Key

To generate a 32-byte hex encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Database Setup

The database will be automatically initialized on server startup. To manually initialize:

```bash
docker-compose up db
# In another terminal:
psql -U postgres -h localhost -d investment_db -f db-init.sql
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

## API Endpoints

### Authentication Endpoints

#### Register User
- **POST** `/api/auth/register`
- **Body**: `{ username, email, password }`
- **Response**: `{ token, userId }`
- **Rate Limit**: 5 requests / 15 minutes

```bash
curl -X POST http://localhost:9100/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "secure_password"
  }'
```

#### Login
- **POST** `/api/auth/login`
- **Body**: `{ email, password }`
- **Response**: `{ token, message }`
- **Rate Limit**: 5 requests / 15 minutes

```bash
curl -X POST http://localhost:9100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "secure_password"
  }'
```

#### Verify Token
- **POST** `/api/auth/verify`
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Response**: `{ valid, userId, email }`

```bash
curl -X POST http://localhost:9100/api/auth/verify \
  -H "Authorization: Bearer your_jwt_token"
```

#### Store Questrade Token
- **POST** `/api/auth/api-token/questrade`
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Body**: `{ apiToken }`
- **Response**: `{ message }`

```bash
curl -X POST http://localhost:9100/api/auth/api-token/questrade \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{ "apiToken": "your_questrade_token" }'
```

#### Store AlphaVantage Token
- **POST** `/api/auth/api-token/alphavantage`
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Body**: `{ apiToken }`
- **Response**: `{ message }`

### Quote Endpoints

All quote endpoints require `Authorization: Bearer <jwt_token>` header.

#### Get Single Quote
- **GET** `/api/quotes/:ticker`
- **Query Params**: 
  - `source` (optional): 'questrade' or 'alphavantage'
- **Rate Limit**: 20 requests / minute
- **Response**: `{ source, ticker, price, timestamp, high, low, volume }`

```bash
curl -X GET http://localhost:9100/api/quotes/AAPL \
  -H "Authorization: Bearer your_jwt_token"
```

With specific source:
```bash
curl -X GET "http://localhost:9100/api/quotes/AAPL?source=questrade" \
  -H "Authorization: Bearer your_jwt_token"
```

#### Get Batch Quotes
- **POST** `/api/quotes/batch`
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Body**: `{ tickers: ['AAPL', 'GOOGL', ...], source (optional) }`
- **Max Tickers**: 20 per request
- **Rate Limit**: 20 requests / minute
- **Response**: `{ tickers, quotes: {AAPL: {...}, ...}, timestamp }`

```bash
curl -X POST http://localhost:9100/api/quotes/batch \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "tickers": ["AAPL", "GOOGL", "MSFT"],
    "source": "questrade"
  }'
```

#### Get Historical Quotes
- **GET** `/api/quotes/history/:ticker`
- **Query Params**:
  - `days` (optional, default: 30)
  - `interval` (optional, default: 'daily'): 1min, 5min, 15min, 30min, 60min, daily
- **Rate Limit**: 20 requests / minute
- **Response**: `{ ticker, days, interval, message }`

```bash
curl -X GET "http://localhost:9100/api/quotes/history/AAPL?days=60&interval=daily" \
  -H "Authorization: Bearer your_jwt_token"
```

## Error Handling

### Common Error Responses

```json
{
  "error": "Missing authorization header"
}
```

Status codes:
- `400`: Bad Request (missing or invalid parameters)
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (no API token configured)
- `404`: Not Found (ticker not found)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

## Rate Limiting

The API implements multiple rate limiting strategies:

1. **General Limit**: 100 requests / 15 minutes per IP
2. **Auth Limit**: 5 requests / 15 minutes per IP
3. **Quote Limit**: 20 requests / minute per user

Limit info is returned in response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640634000
```

## Security Best Practices

1. **Environment Variables**: Never commit `.env` files. Use `.env.example` as template.

2. **Token Encryption**: API tokens are encrypted using AES-256-CBC before storage.

3. **JWT Secret**: Use a strong, random secret generated during deployment.

4. **HTTPS**: Always use HTTPS in production.

5. **CORS**: Configure CORS appropriately for your domain.

6. **Rate Limiting**: Enable Redis for distributed rate limiting in production.

7. **Token Expiration**: Set appropriate expiration times for API tokens.

## Integration Examples

### JavaScript/Fetch

```javascript
// Authenticate and get token
const loginResponse = await fetch('http://localhost:9100/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password'
  })
});

const { token } = await loginResponse.json();

// Store API token
await fetch('http://localhost:9100/api/auth/api-token/questrade', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ apiToken: 'questrade_api_token' })
});

// Fetch quote
const quoteResponse = await fetch('http://localhost:9100/api/quotes/AAPL', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const quote = await quoteResponse.json();
```

### cURL

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:9100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}' | jq -r '.token')

# Store token
curl -X POST http://localhost:9100/api/auth/api-token/questrade \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"apiToken": "your_token"}'

# Get quote
curl -X GET http://localhost:9100/api/quotes/AAPL \
  -H "Authorization: Bearer $TOKEN"
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tokens Table
```sql
CREATE TABLE tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL FOREIGN KEY,
  service_name VARCHAR(50) NOT NULL,
  token_value TEXT NOT NULL (encrypted),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, service_name)
);
```

### Assets Table
```sql
CREATE TABLE assets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL FOREIGN KEY,
  ticker VARCHAR(10) NOT NULL,
  quantity NUMERIC(15, 8) NOT NULL,
  average_price NUMERIC(10, 2) NOT NULL,
  current_price NUMERIC(15, 8),
  asset_type VARCHAR(10),
  market VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Troubleshooting

### Database Connection Error
- Check PostgreSQL is running
- Verify `.env` database credentials
- Ensure database exists

### Rate Limit Exceeded
- Wait for the time specified in `X-RateLimit-Reset` header
- Implement exponential backoff in clients

### Token Encryption Error
- Verify `TOKEN_ENCRYPTION_KEY` is set correctly
- Regenerate key if corrupted: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Quote Fetch Failures
- Verify API tokens are stored correctly
- Check API service status
- Review rate limits on external APIs

## Contributing

Please follow the existing code structure and add appropriate error handling for new endpoints.

## License

MIT
