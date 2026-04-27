/**
 * Lambda entry point for the Investment Tracker API
 *
 * Setup required before deploying:
 *   cd backend && npm install serverless-http
 *
 * Environment variables set by Terraform:
 *   DB_CLUSTER_ARN  - Aurora cluster ARN (for RDS Data API)
 *   DB_SECRET_ARN   - Secrets Manager secret ARN (for RDS Data API)
 *   DB_NAME         - Database name
 *   NODE_ENV        - Environment (dev/prod)
 *   LAMBDA          - Set to "true" to skip http.listen() in server.js
 *
 * Note: Socket.IO real-time events are disabled in Lambda (stateless).
 *       The io.emit() calls become no-ops — REST API still works normally.
 */

const serverless = require('serverless-http');

// Signal Lambda mode — prevents server.js from calling http.listen()
process.env.LAMBDA = 'true';

// Import the configured Express app
const { app } = require('./server');

module.exports.handler = serverless(app);
