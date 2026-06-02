-- 批次汇总字段扩展
ALTER TABLE settlement_batches ADD COLUMN source_file TEXT DEFAULT '';
ALTER TABLE settlement_batches ADD COLUMN source_type TEXT DEFAULT 'SCREENSHOT';
ALTER TABLE settlement_batches ADD COLUMN imported_by TEXT;
ALTER TABLE settlement_batches ADD COLUMN imported_at TEXT;
ALTER TABLE settlement_batches ADD COLUMN risk_reviewed_by TEXT;
ALTER TABLE settlement_batches ADD COLUMN risk_reviewed_at TEXT;
ALTER TABLE settlement_batches ADD COLUMN audited_by TEXT;
ALTER TABLE settlement_batches ADD COLUMN audited_at TEXT;
ALTER TABLE settlement_batches ADD COLUMN warning_count INTEGER DEFAULT 0;
ALTER TABLE settlement_batches ADD COLUMN has_mixed_currency INTEGER DEFAULT 0;
ALTER TABLE settlement_batches ADD COLUMN total_commission_amount REAL DEFAULT 0;
ALTER TABLE settlement_batches ADD COLUMN total_tax_amount REAL DEFAULT 0;
ALTER TABLE settlement_batches ADD COLUMN total_net_amount REAL DEFAULT 0;
