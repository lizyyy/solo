-- Bad Migration: Mixing CONCURRENTLY with other operations
-- CONCURRENTLY cannot run inside a transaction block
-- This will FAIL when executed

CREATE INDEX CONCURRENTLY idx_safe_index 
ON some_table(column_a);

-- This will cause the entire migration to fail
-- because CONCURRENTLY cannot be in a transaction
ALTER TABLE some_table 
ADD COLUMN new_column VARCHAR(255);

CREATE INDEX idx_another_index 
ON some_table(new_column);
