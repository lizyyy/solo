-- Migration 0004: Dangerous operations
-- CRITICAL risk - irreversible operations

-- DROP TABLE - IRREVERSIBLE!
DROP TABLE IF EXISTS old_audit_logs;

-- TRUNCATE - IRREVERSIBLE!
TRUNCATE TABLE temp_data;

-- DROP COLUMN - IRREVERSIBLE!
ALTER TABLE users 
DROP COLUMN IF EXISTS middle_name;

-- RENAME table - breaks existing queries
ALTER TABLE user_addresses 
RENAME TO addresses;

-- RENAME column
ALTER TABLE orders 
RENAME COLUMN total_amount TO grand_total;
