-- 版本快照表
CREATE TABLE IF NOT EXISTS version_snapshot (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    data_version TEXT NOT NULL,
    calculation_version TEXT NOT NULL,
    data_files TEXT,
    is_active INTEGER DEFAULT 1,
    can_rollback INTEGER DEFAULT 1
);

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_log (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL,
    operator TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT NOT NULL,
    affected_objects TEXT,
    previous_snapshot_id TEXT,
    can_undo INTEGER DEFAULT 1,
    FOREIGN KEY (previous_snapshot_id) REFERENCES version_snapshot(id)
);

-- 导入批次表
CREATE TABLE IF NOT EXISTS import_batch (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    uploader TEXT NOT NULL,
    status TEXT NOT NULL,
    total_rows INTEGER DEFAULT 0,
    valid_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    version TEXT NOT NULL,
    FOREIGN KEY (version) REFERENCES version_snapshot(id)
);

-- 导入警告表
CREATE TABLE IF NOT EXISTS data_import_warning (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    source_file TEXT NOT NULL,
    row_number INTEGER,
    object_id TEXT,
    object_name TEXT,
    warning_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    suggestion TEXT,
    raw_data TEXT,
    FOREIGN KEY (batch_id) REFERENCES import_batch(id)
);

-- 客户表
CREATE TABLE IF NOT EXISTS customer (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    customer_type TEXT NOT NULL,
    credit_rating TEXT,
    industry TEXT,
    attributes TEXT,
    version TEXT NOT NULL,
    source_file TEXT NOT NULL,
    source_batch TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (version) REFERENCES version_snapshot(id),
    FOREIGN KEY (source_batch) REFERENCES import_batch(id)
);

-- 担保合同表
CREATE TABLE IF NOT EXISTS guarantee_contract (
    id TEXT PRIMARY KEY,
    guarantor_id TEXT NOT NULL,
    guaranteed_id TEXT NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CNY',
    start_date DATE,
    end_date DATE,
    contract_number TEXT,
    is_counter_guarantee INTEGER DEFAULT 0,
    counter_guarantee_id TEXT,
    attributes TEXT,
    version TEXT NOT NULL,
    source_file TEXT NOT NULL,
    source_row INTEGER,
    source_batch TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guarantor_id) REFERENCES customer(id),
    FOREIGN KEY (guaranteed_id) REFERENCES customer(id),
    FOREIGN KEY (counter_guarantee_id) REFERENCES guarantee_contract(id),
    FOREIGN KEY (version) REFERENCES version_snapshot(id),
    FOREIGN KEY (source_batch) REFERENCES import_batch(id)
);

-- 授信余额表
CREATE TABLE IF NOT EXISTS credit_line (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    total_amount DECIMAL(18,2) NOT NULL,
    used_amount DECIMAL(18,2) DEFAULT 0,
    available_amount DECIMAL(18,2) DEFAULT 0,
    as_of_date DATE NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CNY',
    attributes TEXT,
    version TEXT NOT NULL,
    source_file TEXT NOT NULL,
    source_row INTEGER,
    source_batch TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customer(id),
    FOREIGN KEY (version) REFERENCES version_snapshot(id),
    FOREIGN KEY (source_batch) REFERENCES import_batch(id)
);

-- 反担保表
CREATE TABLE IF NOT EXISTS counter_guarantee (
    id TEXT PRIMARY KEY,
    guarantee_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    coverage_ratio DECIMAL(5,4) DEFAULT 0,
    attributes TEXT,
    version TEXT NOT NULL,
    source_file TEXT NOT NULL,
    source_row INTEGER,
    source_batch TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guarantee_id) REFERENCES guarantee_contract(id),
    FOREIGN KEY (provider_id) REFERENCES customer(id),
    FOREIGN KEY (version) REFERENCES version_snapshot(id),
    FOREIGN KEY (source_batch) REFERENCES import_batch(id)
);

-- 风险分析结果表
CREATE TABLE IF NOT EXISTS risk_analysis_result (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    customer_name TEXT,
    total_exposure DECIMAL(18,2) DEFAULT 0,
    guarantee_chain_risk TEXT,
    cross_guarantee_risk TEXT,
    counter_guarantee_coverage DECIMAL(5,4) DEFAULT 0,
    credit_concentration DECIMAL(5,4) DEFAULT 0,
    overall_risk_level TEXT NOT NULL,
    risk_factors TEXT,
    risk_score DECIMAL(5,2) DEFAULT 0,
    calculation_version TEXT NOT NULL,
    calculation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    version TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customer(id),
    FOREIGN KEY (version) REFERENCES version_snapshot(id)
);

-- 批量任务表
CREATE TABLE IF NOT EXISTS batch_task (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    progress INTEGER DEFAULT 0,
    started_at DATETIME,
    completed_at DATETIME,
    failed_items TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_customer_version ON customer(version);
CREATE INDEX IF NOT EXISTS idx_guarantee_version ON guarantee_contract(version);
CREATE INDEX IF NOT EXISTS idx_guarantee_guarantor ON guarantee_contract(guarantor_id);
CREATE INDEX IF NOT EXISTS idx_guarantee_guaranteed ON guarantee_contract(guaranteed_id);
CREATE INDEX IF NOT EXISTS idx_credit_version ON credit_line(version);
CREATE INDEX IF NOT EXISTS idx_credit_customer ON credit_line(customer_id);
CREATE INDEX IF NOT EXISTS idx_counter_guarantee_version ON counter_guarantee(version);
CREATE INDEX IF NOT EXISTS idx_risk_version ON risk_analysis_result(version);
CREATE INDEX IF NOT EXISTS idx_risk_customer ON risk_analysis_result(customer_id);
CREATE INDEX IF NOT EXISTS idx_warning_batch ON data_import_warning(batch_id);
CREATE INDEX IF NOT EXISTS idx_version_active ON version_snapshot(is_active);
CREATE INDEX IF NOT EXISTS idx_operation_timestamp ON operation_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_batch_status ON batch_task(status);
