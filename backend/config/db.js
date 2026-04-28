// db.js
// In Lambda: wraps Aurora RDS Data API (HTTPS, no VPC needed).
// Locally:   uses a real pg Pool (Docker Compose `db` service).

// ─── Local pg pool (lazy-initialized) ───────────────────────────────────────
let _localPool = null;
function localPool() {
  if (!_localPool) {
    const { Pool } = require('pg');
    _localPool = new Pool({
      user:     process.env.POSTGRES_USER     || 'postgres',
      host:     process.env.POSTGRES_HOST     || 'db',
      database: process.env.POSTGRES_DB       || 'investment_db',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      port:     parseInt(process.env.POSTGRES_PORT) || 5432,
    });
  }
  return _localPool;
}

// ─── RDS Data API client + resume retry (shared) ─────────────────────────────
const { rdsClient, executeWithResume } = require('../utils/rdsHelper');

// ─── Convert pg $1/$2 positional params → RDS Data API :p1/:p2 named params ──
function convertParams(sql, values) {
  const parameters = [];
  const convertedSql = sql.replace(/\$(\d+)/g, (_, n) => {
    const value = values[parseInt(n) - 1];
    const name = `p${n}`;
    let sqlValue;
    if (value === null || value === undefined) {
      sqlValue = { isNull: true };
    } else if (typeof value === 'boolean') {
      sqlValue = { booleanValue: value };
    } else if (typeof value === 'number') {
      sqlValue = Number.isInteger(value) ? { longValue: value } : { doubleValue: value };
    } else {
      sqlValue = { stringValue: String(value) };
    }
    parameters.push({ name, value: sqlValue });
    return `:${name}`;
  });
  return { convertedSql, parameters };
}

// ─── pg-compatible pool ───────────────────────────────────────────────────────
const pool = {
  async query(sql, values = []) {
    if (process.env.LAMBDA !== 'true') {
      return localPool().query(sql, values);
    }

    const { ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
    const { convertedSql, parameters } = convertParams(sql, values);

    const response = await executeWithResume(new ExecuteStatementCommand({
      resourceArn:           process.env.DB_CLUSTER_ARN,
      secretArn:             process.env.DB_SECRET_ARN,
      database:              process.env.DB_NAME || 'investment_tracker',
      sql:                   convertedSql,
      parameters:            parameters.length ? parameters : undefined,
      includeResultMetadata: true,
    }));

    const rows = (response.records || []).map(record => {
      const row = {};
      (response.columnMetadata || []).forEach((col, i) => {
        const field = record[i];
        row[col.name] = field.isNull
          ? null
          : (field.stringValue ?? field.longValue ?? field.doubleValue ?? field.booleanValue ?? null);
      });
      return row;
    });

    return {
      rows,
      rowCount: response.numberOfRecordsUpdated ?? rows.length,
    };
  },
};

module.exports = pool;
