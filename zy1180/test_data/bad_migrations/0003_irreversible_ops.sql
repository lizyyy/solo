-- Bad Migration: Irreversible operations
-- These cannot be rolled back easily

DROP TABLE IF EXISTS important_data;

TRUNCATE TABLE audit_logs;

ALTER TABLE users 
DROP COLUMN IF EXISTS legacy_field;

ALTER TABLE products 
DROP CONSTRAINT IF EXISTS fk_category;
