-- Migration: Increase average_price precision to match current_price
-- This allows storing more decimal places for crypto assets like NDAX

ALTER TABLE assets
  ALTER COLUMN average_price TYPE NUMERIC(15, 8);

-- Also update related computed fields for consistency
ALTER TABLE assets
  ALTER COLUMN invested_value TYPE NUMERIC(15, 8),
  ALTER COLUMN balance TYPE NUMERIC(15, 8),
  ALTER COLUMN variation TYPE NUMERIC(15, 8),
  ALTER COLUMN dividend_per_share TYPE NUMERIC(15, 8),
  ALTER COLUMN current_monthly_dividend TYPE NUMERIC(15, 8),
  ALTER COLUMN current_annual_dividend TYPE NUMERIC(15, 8),
  ALTER COLUMN my_monthly_dividend TYPE NUMERIC(15, 8),
  ALTER COLUMN my_annual_dividend TYPE NUMERIC(15, 8);
