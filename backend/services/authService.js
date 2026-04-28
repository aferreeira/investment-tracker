// auth.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const ACCESS_TOKEN_EXPIRATION = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRATION = '7d'; // 7 days

// Hash password
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Compare password with hash
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Create access token (short-lived)
async function createAccessToken(userId, email) {
  const token = jwt.sign({ userId, email, type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRATION });
  return token;
}

// Create refresh token (long-lived)
async function createRefreshToken(userId, email) {
  const token = jwt.sign({ userId, email, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRATION });
  return token;
}

// Verify token
async function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  createAccessToken,
  createRefreshToken,
  verifyToken
};
