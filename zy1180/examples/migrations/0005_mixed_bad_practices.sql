-- Migration 0005: Mixed bad practices
-- Multiple issues in one file

-- Bad: Mixing CONCURRENTLY with other operations
-- CONCURRENTLY cannot run in a transaction block!
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_coupon_code 
ON orders(coupon_code);

-- This will fail because CONCURRENTLY is already used
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS tags JSONB;

-- Another bad: Multiple ALTER TABLE in same transaction
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE users 
ALTER COLUMN first_name SET NOT NULL;

-- Missing CONCURRENTLY
CREATE INDEX IF NOT EXISTS idx_users_phone_verified 
ON users(phone_verified) WHERE phone_verified = FALSE;
