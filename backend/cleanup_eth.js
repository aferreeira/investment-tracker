const pool = require('./db');

async function cleanup() {
  try {
    const result = await pool.query(
      "DELETE FROM assets WHERE ativo = 'ETH.TO' AND market = 'canada'"
    );
    console.log('Deleted ' + result.rowCount + ' rows');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

cleanup();
