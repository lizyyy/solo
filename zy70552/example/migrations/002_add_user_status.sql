-- UP
ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD INDEX idx_status (status);

-- ROLLBACK
ALTER TABLE users DROP INDEX idx_status;
ALTER TABLE users DROP COLUMN status;
