-- Bad Migration: ALTER COLUMN TYPE on large table
-- This requires full table rewrite and ACCESS EXCLUSIVE lock

ALTER TABLE orders 
ALTER COLUMN total_amount TYPE BIGINT;

ALTER TABLE order_items 
ALTER COLUMN unit_price TYPE DECIMAL(14, 4);

ALTER TABLE users 
ALTER COLUMN email TYPE VARCHAR(500);
