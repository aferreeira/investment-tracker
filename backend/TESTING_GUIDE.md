# Testing Guide - Investment Tracker Backend

## Prerequisites

Before running tests, ensure:
- ✅ Node.js 14+ installed
- ✅ PostgreSQL running
- ✅ All dependencies installed (`npm install`)
- ✅ `.env` file configured with all required variables
- ✅ Server started (`npm run dev` or `npm start`)

## Health Check

### 1. Check Server is Running
```bash
curl http://localhost:9100
```

Expected: Connection should work (may return 404 if no root route, but server is running)

### 2. Check Database Connection
```bash
psql -U postgres -h localhost -d investment_db -c "SELECT 1"
```

Expected: `?column?` with value `1`

## Test Scenarios

### Scenario 1: User Registration & Login

#### Step 1: Register User
```bash
curl -X POST http://localhost:9100/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "testpass123"
  }'
```

Expected Response:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

✅ **Test Passed** if you get the above response
❌ **Test Failed** if you get:
- 400: Check email/password are provided
- 409: Email already exists, use different email
- 500: Check database is running

#### Step 2: Login User
```bash
curl -X POST http://localhost:9100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123"
  }'
```

Expected Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Login successful"
}
```

✅ **Test Passed** if you get JWT token
❌ **Test Failed** if you get:
- 401: Invalid credentials, check email and password
- 400: Missing email or password

#### Step 3: Verify Token
```bash
# Replace with actual token from login response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:9100/api/auth/verify \
  -H "Authorization: Bearer $TOKEN"
```

Expected Response:
```json
{
  "valid": true,
  "userId": 1,
  "email": "test@example.com"
}
```

✅ **Test Passed** if valid is true
❌ **Test Failed** if you get:
- 401: Token is invalid or expired
- 400: Missing Authorization header

### Scenario 2: Store API Tokens

#### Step 1: Store Questrade Token
```bash
TOKEN="your_jwt_token_from_login"

curl -X POST http://localhost:9100/api/auth/api-token/questrade \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiToken": "test_questrade_token_12345"
  }'
```

Expected Response:
```json
{
  "message": "Questrade token saved successfully"
}
```

✅ **Test Passed** if you get success message
❌ **Test Failed** if you get:
- 401: Invalid JWT token
- 400: Missing apiToken
- 403: User not authenticated

#### Step 2: Verify Token Stored in Database
```bash
psql -U postgres -h localhost -d investment_db -c \
  "SELECT service_name, expires_at FROM tokens WHERE user_id = 1;"
```

Expected: One row with `questrade` service

✅ **Test Passed** if questrade is listed
❌ **Test Failed** if no rows returned

#### Step 3: Store AlphaVantage Token (Optional)
```bash
TOKEN="your_jwt_token_from_login"

curl -X POST http://localhost:9100/api/auth/api-token/alphavantage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiToken": "test_alphavantage_key_12345"
  }'
```

Expected Response:
```json
{
  "message": "AlphaVantage token saved successfully"
}
```

### Scenario 3: Fetch Stock Quotes

**Note**: These tests will only work if you have valid API tokens stored.

#### Step 1: Single Quote
```bash
TOKEN="your_jwt_token_from_login"

curl -X GET http://localhost:9100/api/quotes/AAPL \
  -H "Authorization: Bearer $TOKEN"
```

Expected Response (if Questrade token is valid):
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

✅ **Test Passed** if you get quote data
❌ **Test Failed** if you get:
- 401: Invalid JWT
- 403: "No questrade token found" - Store token first
- 404: API couldn't find ticker
- 500: API call failed

#### Step 2: Batch Quotes
```bash
TOKEN="your_jwt_token_from_login"

curl -X POST http://localhost:9100/api/quotes/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tickers": ["AAPL", "GOOGL"]
  }'
```

Expected Response:
```json
{
  "tickers": ["AAPL", "GOOGL"],
  "quotes": {
    "AAPL": { "source": "questrade", "price": 150.25, ... },
    "GOOGL": { "source": "questrade", "price": 136.50, ... }
  },
  "timestamp": "2024-01-15T10:31:00Z"
}
```

✅ **Test Passed** if you get multiple quotes
❌ **Test Failed** if you get:
- 400: Max 20 tickers per request
- 403: No API tokens configured

#### Step 3: Quote with Source Preference
```bash
TOKEN="your_jwt_token_from_login"

curl -X GET "http://localhost:9100/api/quotes/AAPL?source=questrade" \
  -H "Authorization: Bearer $TOKEN"
```

✅ **Test Passed** if request succeeds
❌ **Test Failed** if you get error

### Scenario 4: Rate Limiting Tests

#### Test General Rate Limit
```bash
# Make 101 requests rapidly (without auth)
for i in {1..101}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9100/
  sleep 0.1
done
```

Expected: First 100 return 200-404, request 101+ should return 429

✅ **Test Passed** if you get 429 after limit exceeded
❌ **Test Failed** if you keep getting 200

#### Test Auth Rate Limit
```bash
# Make 6 failed login attempts (limit is 5)
for i in {1..6}; do
  curl -s -X POST http://localhost:9100/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"wrong@example.com","password":"wrong"}'
  sleep 0.1
done
```

Expected: 6th request should return 429

✅ **Test Passed** if 6th request returns 429
❌ **Test Failed** if all return 401

### Scenario 5: Error Handling Tests

#### Test Invalid Token
```bash
curl -X POST http://localhost:9100/api/auth/verify \
  -H "Authorization: Bearer invalid_token_xyz"
```

Expected Response: 401 Unauthorized
```json
{
  "valid": false,
  "error": "Invalid or expired token"
}
```

#### Test Missing Authorization
```bash
curl -X POST http://localhost:9100/api/auth/verify
```

Expected Response: 401 Unauthorized
```json
{
  "error": "Missing authorization header"
}
```

#### Test Invalid Credentials
```bash
curl -X POST http://localhost:9100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@example.com",
    "password": "wrong"
  }'
```

Expected Response: 401 Unauthorized
```json
{
  "error": "Invalid credentials"
}
```

#### Test Duplicate Email Registration
```bash
curl -X POST http://localhost:9100/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user1",
    "email": "test@example.com",  # Email already used
    "password": "pass123"
  }'
```

Expected Response: 409 Conflict
```json
{
  "error": "Email already registered"
}
```

## Database Verification

### Check Users Table
```bash
psql -U postgres -h localhost -d investment_db \
  -c "SELECT id, email, created_at FROM users;"
```

Expected: One or more user records

### Check Tokens Table
```bash
psql -U postgres -h localhost -d investment_db \
  -c "SELECT id, user_id, service_name, created_at FROM tokens;"
```

Expected: One or more token records with encrypted values

### Check Encryption
```bash
psql -U postgres -h localhost -d investment_db \
  -c "SELECT token_value FROM tokens LIMIT 1;"
```

Expected: Encrypted token (not readable plain text) like:
```
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8
```

## Performance Testing

### Load Test - 100 Quote Requests
```bash
TOKEN="your_jwt_token"

time for i in {1..100}; do
  curl -s -H "Authorization: Bearer $TOKEN" \
    http://localhost:9100/api/quotes/AAPL > /dev/null
done
```

Expected: Completes in < 30 seconds
⏱️ **Good**: < 10 seconds
⚠️ **Acceptable**: 10-30 seconds
❌ **Poor**: > 30 seconds

### Batch Quote Performance
```bash
TOKEN="your_jwt_token"

time curl -X POST http://localhost:9100/api/quotes/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tickers": ["AAPL", "GOOGL", "MSFT", "AMZN", "NVDA", 
                "TSLA", "META", "NFLX", "GOOG", "ORCL",
                "INTC", "CSCO", "IBM", "DELL", "HPQ",
                "VRTX", "AZN", "JNJ", "PFE", "ABBV"]
  }' > /dev/null
```

Expected: Completes in < 15 seconds

## Automated Test Script

Create `test.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:9100"

echo "=== Starting Tests ==="

# Register
echo "1. Testing registration..."
RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"test\",\"email\":\"test$RANDOM@example.com\",\"password\":\"pass123\"}")
echo $RESPONSE | grep -q "registered" && echo "✅ Registration passed" || echo "❌ Registration failed"

# Login
echo "2. Testing login..."
TOKEN=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"pass123\"}" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
[ ! -z "$TOKEN" ] && echo "✅ Login passed" || echo "❌ Login failed"

# Verify
echo "3. Testing token verification..."
curl -s -X POST $BASE_URL/api/auth/verify \
  -H "Authorization: Bearer $TOKEN" | grep -q "valid" && echo "✅ Verification passed" || echo "❌ Verification failed"

echo "=== Tests Complete ==="
```

Run with: `bash test.sh`

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Connection refused | Server not running | Run `npm run dev` |
| Database error | DB not running | Start PostgreSQL |
| 401 Unauthorized | Invalid JWT | Re-login and get new token |
| 403 Forbidden | No API token | Store token via `/api/auth/api-token/...` |
| 429 Too Many Requests | Rate limit | Wait 1 minute then retry |
| 404 Ticker not found | API doesn't know ticker | Use valid ticker symbol |
| Encryption fails | Wrong key format | Regenerate KEY with `node` command |

## Manual Testing Checklist

- [ ] Server starts without errors
- [ ] Database tables created
- [ ] User registration works
- [ ] User login returns JWT
- [ ] JWT verification works
- [ ] API token storage works
- [ ] API token encryption verified
- [ ] Quote fetching works
- [ ] Batch quotes work
- [ ] Rate limiting enforced
- [ ] Error messages appropriate
- [ ] All HTTP status codes correct
- [ ] Database queries working

## Performance Checklist

- [ ] Registration completes in < 1 second
- [ ] Login completes in < 1 second
- [ ] Single quote fetch in < 2 seconds
- [ ] Batch quotes (20 tickers) in < 10 seconds
- [ ] Rate limiting doesn't cause slowdown
- [ ] Error responses are fast

---

**Note**: For production testing, use proper test frameworks like Jest or Mocha. This guide is for manual verification.
