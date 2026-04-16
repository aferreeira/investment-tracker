// authRoutes.js - Authentication routes
const express = require('express');
const { SignJWT, jwtVerify } = require('jose');
const router = express.Router();
const { saveToken } = require('../services/tokenService');
const { authLimiter } = require('../middleware/rateLimitMiddleware');

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-must-be-at-least-32-bytes');

/**
 * POST /auth/register - Register a new user
 * Body: { username, email, password }
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // TODO: Hash password and save user to database
    // await User.create({ username, email, password: hashedPassword });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /auth/login - Login user
 * Body: { email, password }
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    // TODO: Verify user credentials
    // const user = await User.findOne({ email });
    // if (!user || !user.verifyPassword(password)) {
    //   return res.status(401).json({ error: 'Invalid credentials' });
    // }

    // Temporary user ID (replace with actual user lookup)
    const userId = 1;

    const token = await new SignJWT({ userId, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(JWT_SECRET);

    res.json({ token, message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /auth/api-token/questrade - Store Questrade API token
 * Body: { apiToken }
 * Headers: Authorization: Bearer <JWT>
 */
router.post('/api-token/questrade', async (req, res) => {
  try {
    const { apiToken } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    if (!apiToken) {
      return res.status(400).json({ error: 'Missing apiToken' });
    }

    const token = authHeader.substring(7);
    let userId;

    try {
      const decoded = await jwtVerify(token, JWT_SECRET);
      userId = decoded.payload.userId;
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    await saveToken(userId, 'questrade', apiToken);

    res.json({ message: 'Questrade token saved successfully' });
  } catch (error) {
    console.error('Error saving API token:', error.message);
    res.status(500).json({ error: 'Failed to save API token' });
  }
});

/**
 * POST /auth/api-token/alphavantage - Store AlphaVantage API token
 * Body: { apiToken }
 * Headers: Authorization: Bearer <JWT>
 */
router.post('/api-token/alphavantage', async (req, res) => {
  try {
    const { apiToken } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    if (!apiToken) {
      return res.status(400).json({ error: 'Missing apiToken' });
    }

    const token = authHeader.substring(7);
    let userId;

    try {
      const decoded = await jwtVerify(token, JWT_SECRET);
      userId = decoded.payload.userId;
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    await saveToken(userId, 'alphavantage', apiToken);

    res.json({ message: 'AlphaVantage token saved successfully' });
  } catch (error) {
    console.error('Error saving API token:', error.message);
    res.status(500).json({ error: 'Failed to save API token' });
  }
});

/**
 * POST /auth/verify - Verify JWT token
 * Headers: Authorization: Bearer <JWT>
 */
router.post('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = await jwtVerify(token, JWT_SECRET);
      res.json({ valid: true, userId: decoded.payload.userId, email: decoded.payload.email });
    } catch (error) {
      res.status(401).json({ valid: false, error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
