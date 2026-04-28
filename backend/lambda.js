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
const { ensureUsersTable, ensureAssetsTable, ensureTokensTable } = require('./utils/migrations');

// Run migrations once per container cold start
let migrationsDone = false;
async function runMigrations() {
  if (migrationsDone) return;

  // The database itself may not exist yet on first deploy — create it via the
  // default 'postgres' db, then run table migrations against the app database.
  if (process.env.LAMBDA === 'true') {
    const { ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
    const { executeWithResume } = require('./utils/rdsHelper');
    const base = {
      resourceArn: process.env.DB_CLUSTER_ARN,
      secretArn:   process.env.DB_SECRET_ARN,
    };

    // Check whether the database exists (also handles resume via retry)
    const check = await executeWithResume(new ExecuteStatementCommand({
      ...base,
      database: 'postgres',
      sql: `SELECT 1 FROM pg_database WHERE datname = '${process.env.DB_NAME || 'investment_tracker'}'`,
      includeResultMetadata: false,
    }));

    if (!check.records || check.records.length === 0) {
      console.log(`Creating database ${process.env.DB_NAME || 'investment_tracker'}...`);
      await executeWithResume(new ExecuteStatementCommand({
        ...base,
        database: 'postgres',
        sql: `CREATE DATABASE "${process.env.DB_NAME || 'investment_tracker'}"`,
      }));
      console.log('Database created.');
    }
  }

  await ensureUsersTable();
  await ensureAssetsTable();
  await ensureTokensTable();
  migrationsDone = true;
}

const serverlessHandler = serverless(app);

module.exports.handler = async (event, context) => {
  await runMigrations();
  return serverlessHandler(event, context);
};
