// db.js
const { Pool } = require('pg');

const pool = new Pool({
  user:     process.env.POSTGRES_USER   || 'postgres',
  host:     process.env.POSTGRES_HOST   || 'db',
  database: process.env.POSTGRES_DB     || 'investment_db',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  port:     process.env.POSTGRES_PORT   || 5432,
});

module.exports = pool;
