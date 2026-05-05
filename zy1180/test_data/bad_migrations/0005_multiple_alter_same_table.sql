-- Bad Migration: Multiple ALTER TABLE on same large table
-- Lock held for extended period

ALTER TABLE large_table 
ADD COLUMN field_a VARCHAR(255);

ALTER TABLE large_table 
ADD COLUMN field_b INTEGER DEFAULT 0;

ALTER TABLE large_table 
ALTER COLUMN field_a SET NOT NULL;

ALTER TABLE large_table 
ADD CONSTRAINT chk_field_b CHECK (field_b >= 0);

CREATE INDEX idx_large_table_field_b 
ON large_table(field_b);
