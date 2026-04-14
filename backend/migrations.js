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

async function ensureMarketColumn() {
  const check = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name='assets' AND column_name='market'`
  );

  if (check.rowCount === 0) {
    console.log('Adding market column to assets table…');
    await pool.query(
      `ALTER TABLE assets
       ADD COLUMN market VARCHAR(20) NOT NULL DEFAULT 'brazil'`
    );
    console.log('market column added.');
  } else {
    console.log('market column already exists.');
  }
}

async function ensurePlatformColumn() {
  const check = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name='assets' AND column_name='platform'`
  );

  if (check.rowCount === 0) {
    console.log('Adding platform column to assets table…');
    await pool.query(
      `ALTER TABLE assets
       ADD COLUMN platform VARCHAR(50) DEFAULT 'WealthSimple'`
    );
    console.log('platform column added.');
  } else {
    console.log('platform column already exists.');
  }
}

async function ensureDecimalQuantidade() {
  const check = await pool.query(
    `SELECT data_type FROM information_schema.columns 
     WHERE table_name='assets' AND column_name='quantidade'`
  );

  if (check.rowCount > 0 && check.rows[0].data_type === 'integer') {
    console.log('Converting quantidade column from INTEGER to NUMERIC (for crypto support)…');
    try {
      await pool.query(
        `ALTER TABLE assets 
         ALTER COLUMN quantidade TYPE NUMERIC(15, 8) USING CAST(quantidade AS NUMERIC(15, 8))`
      );
      console.log('quantidade column converted to NUMERIC(15, 8).');
    } catch (err) {
      console.error('Error converting quantidade column:', err.message);
    }
  } else {
    console.log('quantidade column is already NUMERIC or migration not needed.');
  }
}

module.exports = { ensureTickerTypeColumn, ensureMarketColumn, ensurePlatformColumn, ensureDecimalQuantidade };
