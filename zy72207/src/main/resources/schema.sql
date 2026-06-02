CREATE TABLE IF NOT EXISTS refund_batch (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_no VARCHAR(50) NOT NULL,
    batch_name VARCHAR(200),
    batch_date TIMESTAMP,
    fund_code VARCHAR(20),
    fund_name VARCHAR(200),
    custodian VARCHAR(200),
    total_count INT,
    total_amount DECIMAL(18,4),
    process_status VARCHAR(30),
    current_step VARCHAR(30),
    operator VARCHAR(50),
    supervisor VARCHAR(50),
    remark VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS custodian_confirmation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    batch_no VARCHAR(50),
    original_row_no INT,
    biz_no VARCHAR(50),
    merchant_no VARCHAR(50),
    merchant_name VARCHAR(200),
    trade_date DATE,
    settlement_date DATE,
    original_amount DECIMAL(18,4),
    original_principal DECIMAL(18,4),
    original_fee DECIMAL(18,4),
    currency VARCHAR(10),
    original_status VARCHAR(50),
    original_remark VARCHAR(500),
    raw_content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ex_dividend_evidence (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    batch_no VARCHAR(50),
    biz_no VARCHAR(50),
    ex_dividend_date DATE,
    evidence_source VARCHAR(200),
    evidence_content TEXT,
    screenshot_url VARCHAR(500),
    reviewer VARCHAR(50),
    review_remark VARCHAR(500),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS refund_detail (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    batch_no VARCHAR(50),
    biz_no VARCHAR(50),
    same_biz_no_group VARCHAR(50),
    detail_type VARCHAR(20),
    custodian_row_no INT,
    merchant_no VARCHAR(50),
    merchant_name VARCHAR(200),
    trade_date DATE,
    settlement_date DATE,
    original_amount DECIMAL(18,4),
    confirmed_amount DECIMAL(18,4),
    principal DECIMAL(18,4),
    fee DECIMAL(18,4),
    currency VARCHAR(10),
    process_status VARCHAR(30),
    manual_changes VARCHAR(500),
    manual_operator VARCHAR(50),
    manual_operate_at TIMESTAMP,
    evidence_status VARCHAR(20),
    diff_status VARCHAR(20),
    diff_remark VARCHAR(500),
    supervisor_remark VARCHAR(500),
    supervisor VARCHAR(50),
    supervisor_reviewed_at TIMESTAMP,
    remark VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS self_check_result (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    batch_no VARCHAR(50),
    check_type VARCHAR(30),
    check_result VARCHAR(20),
    check_detail TEXT,
    affected_biz_nos TEXT,
    operator VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT,
    batch_no VARCHAR(50),
    detail_id BIGINT,
    biz_no VARCHAR(50),
    operation VARCHAR(50),
    old_value TEXT,
    new_value TEXT,
    operator VARCHAR(50),
    remark VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refund_batch_no ON refund_batch(batch_no);
CREATE INDEX IF NOT EXISTS idx_custodian_batch_id ON custodian_confirmation(batch_id);
CREATE INDEX IF NOT EXISTS idx_custodian_biz_no ON custodian_confirmation(batch_id, biz_no);
CREATE INDEX IF NOT EXISTS idx_evidence_batch_id ON ex_dividend_evidence(batch_id);
CREATE INDEX IF NOT EXISTS idx_evidence_biz_no ON ex_dividend_evidence(batch_id, biz_no);
CREATE INDEX IF NOT EXISTS idx_detail_batch_id ON refund_detail(batch_id);
CREATE INDEX IF NOT EXISTS idx_detail_biz_no ON refund_detail(batch_id, biz_no);
CREATE INDEX IF NOT EXISTS idx_detail_group ON refund_detail(batch_id, same_biz_no_group);
CREATE INDEX IF NOT EXISTS idx_detail_status ON refund_detail(batch_id, process_status);
CREATE INDEX IF NOT EXISTS idx_check_batch_id ON self_check_result(batch_id);
CREATE INDEX IF NOT EXISTS idx_audit_batch_id ON audit_log(batch_id);
