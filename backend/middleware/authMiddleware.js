// authMiddleware.js
const { verifyToken } = require('../services/authService');

// Middleware to verify JWT token
async function verifyJWT(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const payload = await verifyToken(token);

    if (!payload || payload.type !== 'access') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user info to request
    req.user = {
      userId: payload.userId,
      email: payload.email
    };

    next();
  } catch (err) {
    console.error('JWT verification error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { verifyJWT };
