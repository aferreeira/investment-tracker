// tokenService.js - Manage encrypted tokens in database
const pool = require('../config/db');
const { encryptToken, decryptToken } = require('./tokenEncryption');

/**
 * Save or update a token in the database
 * @param {number} userId - User ID
 * @param {string} serviceName - Service name (e.g., 'questrade')
 * @param {string} tokenValue - The token to encrypt and save
 * @param {Date} expiresAt - When the token expires (optional)
 * @returns {Promise<Object>} - The saved token record
 */
const saveToken = async (userId, serviceName, tokenValue, expiresAt = null) => {
  try {
    const encryptedToken = encryptToken(tokenValue);
    
    const query = `
      INSERT INTO tokens (user_id, service_name, token_value, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, service_name) 
      DO UPDATE SET 
        token_value = EXCLUDED.token_value, 
        expires_at = EXCLUDED.expires_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, user_id, service_name, expires_at, created_at, updated_at;
    `;
    
    const result = await pool.query(query, [userId, serviceName, encryptedToken, expiresAt]);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving token:', error.message);
    throw error;
  }
};

/**
 * Get a token from the database and decrypt it
 * @param {number} userId - User ID
 * @param {string} serviceName - Service name (e.g., 'questrade')
 * @returns {Promise<Object|null>} - {token, expiresAt} or null if not found
 */
const getToken = async (userId, serviceName) => {
  try {
    const query = `
      SELECT token_value, expires_at FROM tokens 
      WHERE user_id = $1 AND service_name = $2;
    `;
    
    const result = await pool.query(query, [userId, serviceName]);
    
    if (result.rows.length === 0) {
      console.warn(`Token not found for user ${userId} and service ${serviceName}`);
      return null;
    }
    
    const row = result.rows[0];
    return {
      token: decryptToken(row.token_value),
      expiresAt: row.expires_at
    };
  } catch (error) {
    console.error('Error retrieving token:', error.message);
    throw error;
  }
};

/**
 * Delete a token from the database
 * @param {number} userId - User ID
 * @param {string} serviceName - Service name
 * @returns {Promise<void>}
 */
const deleteToken = async (userId, serviceName) => {
  try {
    const query = `DELETE FROM tokens WHERE user_id = $1 AND service_name = $2;`;
    await pool.query(query, [userId, serviceName]);
  } catch (error) {
    console.error('Error deleting token:', error.message);
    throw error;
  }
};

/**
 * Check if a token exists and is not expired
 * @param {number} userId - User ID
 * @param {string} serviceName - Service name
 * @returns {Promise<boolean>}
 */
const tokenExists = async (userId, serviceName) => {
  try {
    const query = `
      SELECT id FROM tokens 
      WHERE user_id = $1 AND service_name = $2 
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);
    `;
    
    const result = await pool.query(query, [userId, serviceName]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking token existence:', error.message);
    throw error;
  }
};

module.exports = { saveToken, getToken, deleteToken, tokenExists };
