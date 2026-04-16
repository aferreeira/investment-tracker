-- Migration: Add tokens table for API key storage
-- Created: [Current Date]
-- Purpose: Store encrypted API tokens for various services

CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  service_name VARCHAR(50) NOT NULL,
  token_value TEXT NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_service UNIQUE (user_id, service_name)
);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tokens_user_service ON tokens(user_id, service_name);
CREATE INDEX IF NOT EXISTS idx_tokens_expires_at ON tokens(expires_at);

-- Optional: Add an audit log table for token access
CREATE TABLE IF NOT EXISTS token_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  service_name VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL, -- 'created', 'read', 'updated', 'deleted'
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create an index on the audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON token_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON token_audit_log(created_at);
