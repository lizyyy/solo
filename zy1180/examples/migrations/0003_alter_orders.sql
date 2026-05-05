-- Migration 0003: Alter orders table
-- High risk operations - ACCESS EXCLUSIVE lock

-- Add new column with default
-- In PostgreSQL 11+, this is fast, but still requires ACCESS EXCLUSIVE lock
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12, 2) DEFAULT 0;

-- Add new column without default (fast)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);

-- Alter column type - HIGH RISK!
-- This requires full table rewrite and will block all operations
ALTER TABLE orders 
ALTER COLUMN status TYPE VARCHAR(100);

-- Add foreign key constraint
-- Will scan the entire table to validate
ALTER TABLE orders 
ADD CONSTRAINT fk_orders_promotion 
FOREIGN KEY (promotion_id) REFERENCES promotions(id);
