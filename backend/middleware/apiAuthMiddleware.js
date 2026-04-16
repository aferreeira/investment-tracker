// apiAuthMiddleware.js - Middleware to handle API authentication
const jwt = require('jsonwebtoken');
const { getToken } = require('../services/tokenService');

/**
 * Middleware to verify and inject API token into request
 * @param {string} serviceName - The name of the service (e.g., 'questrade')
 * @returns {Function} Express middleware function
 */
const requireApiAuth = (serviceName) => {
  return async (req, res, next) => {
    try {
      // Get user ID from JWT token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.substring(7);
      let userId;

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.userId;
      } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      // Retrieve the API token from database
      const tokenData = await getToken(userId, serviceName);
      if (!tokenData) {
        return res.status(403).json({ error: `No ${serviceName} token found. Please authenticate with ${serviceName}.` });
      }

      // Check expiration
      if (tokenData.expiresAt && new Date(tokenData.expiresAt) < new Date()) {
        return res.status(403).json({ error: `${serviceName} token has expired. Please re-authenticate.` });
      }

      // Inject into request
      req.apiToken = tokenData.token;
      req.userId = userId;
      req.serviceName = serviceName;

      next();
    } catch (error) {
      console.error('Auth middleware error:', error.message);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };
};

module.exports = { requireApiAuth };
