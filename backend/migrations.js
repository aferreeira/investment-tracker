// migrations.js
const pool = require('./db');

async function ensureTickerTypeColumn() {
  const check = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name='assets' AND column_name='ticker_type'`
  );

  if (check.rowCount === 0) {
    console.log('Adding ticker_type column to assets table…');
    await pool.query(
      `ALTER TABLE assets
       ADD COLUMN ticker_type VARCHAR(10) NOT NULL DEFAULT 'FII'`
    );
    console.log('ticker_type column added.');
  } else {
    console.log('ticker_type column already exists.');
  }
}

module.exports = { ensureTickerTypeColumn };
