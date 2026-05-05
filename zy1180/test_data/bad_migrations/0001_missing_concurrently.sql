-- Bad Migration: Missing CONCURRENTLY
-- This will block all writes during index creation

CREATE INDEX idx_large_table_status 
ON large_table(status);

CREATE INDEX idx_large_table_created_at 
ON large_table(created_at);

-- Another bad one
DROP INDEX IF EXISTS old_idx_name;
