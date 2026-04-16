// migrations.js - Database schema creation and migrations
const pool = require('../config/db');

async function ensureUsersTable() {
  const check = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'users'
    );`
  );

  if (!check.rows[0].exists) {
    console.log('Creating users table…');
    try {
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          refresh_token TEXT,
          first_name VARCHAR(255),
          last_name VARCHAR(255),
          phone VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ users table created successfully.');
    } catch (err) {
      console.error('Error creating users table:', err.message);
    }
  } else {
    console.log('✅ users table already exists.');
  }
}

async function ensureAssetsTable() {
  const check = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'assets'
    );`
  );

  if (!check.rows[0].exists) {
    console.log('Creating assets table…');
    try {
      await pool.query(`
        CREATE TABLE assets (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          ticker VARCHAR(10) NOT NULL,
          quantity NUMERIC(15, 8) NOT NULL,
          average_price NUMERIC(10, 2) NOT NULL,
          current_price NUMERIC(15, 8),
          invested_value NUMERIC(10, 2),
          balance NUMERIC(10, 2),
          variation NUMERIC(10, 2),
          dividend_per_share NUMERIC(10, 2),
          current_monthly_dividend NUMERIC(10, 2),
          current_annual_dividend NUMERIC(10, 2),
          my_monthly_dividend NUMERIC(10, 2),
          my_annual_dividend NUMERIC(10, 2),
          asset_type VARCHAR(10) DEFAULT 'FII',
          market VARCHAR(20) DEFAULT 'brazil',
          platform VARCHAR(50) DEFAULT 'WealthSimple',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, ticker, market),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      console.log('✅ assets table created successfully.');
    } catch (err) {
      console.error('Error creating assets table:', err.message);
    }
  } else {
    console.log('✅ assets table already exists.');
  }
}

module.exports = { ensureUsersTable, ensureAssetsTable };
