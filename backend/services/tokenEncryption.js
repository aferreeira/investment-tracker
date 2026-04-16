// tokenEncryption.js - Encrypt/decrypt sensitive tokens
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || 
  crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

if (!process.env.TOKEN_ENCRYPTION_KEY) {
  console.warn('⚠️  Warning: TOKEN_ENCRYPTION_KEY not set in .env. Using random key. Add this to .env for persistence:');
  console.warn(`TOKEN_ENCRYPTION_KEY=${ENCRYPTION_KEY}`);
}

/**
 * Encrypt a token
 * @param {string} token - The plain text token
 * @returns {string} - Encrypted token in format: iv:encryptedData
 */
const encryptToken = (token) => {
  if (!token) return null;
  
  try {
    const iv = crypto.randomBytes(16);
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Error encrypting token:', error.message);
    throw error;
  }
};

/**
 * Decrypt a token
 * @param {string} encryptedToken - Encrypted token in format: iv:encryptedData
 * @returns {string} - Plain text token
 */
const decryptToken = (encryptedToken) => {
  if (!encryptedToken) return null;
  
  try {
    const [iv, encrypted] = encryptedToken.split(':');
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      keyBuffer,
      Buffer.from(iv, 'hex')
    );
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting token:', error.message);
    throw error;
  }
};

module.exports = { encryptToken, decryptToken };
