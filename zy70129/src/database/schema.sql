-- 场馆押金退还服务 - 数据库Schema

-- 租借订单
CREATE TABLE IF NOT EXISTS rental_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    venue_id TEXT NOT NULL,
    venue_name TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    rental_start_time DATETIME NOT NULL,
    rental_end_time DATETIME NOT NULL,
    actual_end_time DATETIME,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_by TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remark TEXT
);

-- 订单状态变更日志
CREATE TABLE IF NOT EXISTS order_status_logs (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    FOREIGN KEY (order_id) REFERENCES rental_orders(id)
);

-- 验收清单模板
CREATE TABLE IF NOT EXISTS checklist_templates (
    id TEXT PRIMARY KEY,
    venue_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    item_category TEXT,
    default_quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 验收清单（订单维度）
CREATE TABLE IF NOT EXISTS checklists (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    template_item_id TEXT,
    item_name TEXT NOT NULL,
    item_category TEXT,
    expected_quantity INTEGER NOT NULL DEFAULT 1,
    actual_quantity INTEGER,
    is_damaged INTEGER DEFAULT 0,
    damage_degree TEXT,
    damage_photo_urls TEXT,
    unit_price DECIMAL(10,2),
    checked_by TEXT,
    checked_at DATETIME,
    remark TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES rental_orders(id),
    FOREIGN KEY (template_item_id) REFERENCES checklist_templates(id)
);

-- 损坏扣费记录
CREATE TABLE IF NOT EXISTS damage_charges (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    checklist_item_id TEXT,
    item_name TEXT NOT NULL,
    damage_degree TEXT,
    charge_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    charge_reason TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_manual_adjustment INTEGER DEFAULT 0,
    adjustment_reason TEXT,
    FOREIGN KEY (order_id) REFERENCES rental_orders(id),
    FOREIGN KEY (checklist_item_id) REFERENCES checklists(id)
);

-- 水电记录表
CREATE TABLE IF NOT EXISTS utility_records (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    utility_type TEXT NOT NULL CHECK (utility_type IN ('WATER', 'ELECTRICITY')),
    initial_reading DECIMAL(10,2) NOT NULL,
    final_reading DECIMAL(10,2),
    unit_price DECIMAL(10,2) NOT NULL,
    usage_amount DECIMAL(10,2),
    calculated_amount DECIMAL(10,2),
    record_by TEXT,
    record_at DATETIME,
    remark TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES rental_orders(id)
);

-- 水电分摊记录表（用于多个订单共享水电时的分摊）
CREATE TABLE IF NOT EXISTS utility_allocations (
    id TEXT PRIMARY KEY,
    utility_record_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    allocation_ratio DECIMAL(5,4) NOT NULL DEFAULT 1,
    allocated_amount DECIMAL(10,2) NOT NULL,
    allocation_rule TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utility_record_id) REFERENCES utility_records(id),
    FOREIGN KEY (order_id) REFERENCES rental_orders(id)
);

-- 费用汇总表
CREATE TABLE IF NOT EXISTS order_fee_summaries (
    id TEXT PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    damage_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    utility_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    other_deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
    refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    calculated_by TEXT,
    calculated_at DATETIME,
    is_manually_adjusted INTEGER DEFAULT 0,
    adjustment_reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES rental_orders(id)
);

-- 退款队列
CREATE TABLE IF NOT EXISTS refund_queue (
    id TEXT PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    refund_amount DECIMAL(10,2) NOT NULL,
    refund_method TEXT NOT NULL CHECK (refund_method IN ('CASH', 'BANK_TRANSFER', 'ORIGINAL_PAYMENT')),
    status TEXT NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at DATETIME,
    last_error TEXT,
    processed_by TEXT,
    processed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES rental_orders(id)
);

-- 退款记录
CREATE TABLE IF NOT EXISTS refund_records (
    id TEXT PRIMARY KEY,
    queue_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    refund_amount DECIMAL(10,2) NOT NULL,
    refund_method TEXT NOT NULL,
    transaction_no TEXT,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PROCESSING')),
    operator TEXT NOT NULL,
    operated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remark TEXT,
    FOREIGN KEY (queue_id) REFERENCES refund_queue(id),
    FOREIGN KEY (order_id) REFERENCES rental_orders(id)
);

-- 幂等性控制表
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT UNIQUE NOT NULL,
    request_hash TEXT NOT NULL,
    response_data TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

-- 操作审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    target_id TEXT,
    target_type TEXT,
    operator TEXT NOT NULL,
    operated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    remark TEXT
);

-- 人工调整记录
CREATE TABLE IF NOT EXISTS manual_adjustments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('DAMAGE', 'UTILITY', 'OTHER', 'REFUND')),
    old_value DECIMAL(10,2) NOT NULL,
    new_value DECIMAL(10,2) NOT NULL,
    adjustment_amount DECIMAL(10,2) NOT NULL,
    reason TEXT NOT NULL,
    adjusted_by TEXT NOT NULL,
    adjusted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_by TEXT,
    FOREIGN KEY (order_id) REFERENCES rental_orders(id)
);

-- 财务报表汇总
CREATE TABLE IF NOT EXISTS financial_reports (
    id TEXT PRIMARY KEY,
    report_date DATE NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('DAILY', 'WEEKLY', 'MONTHLY')),
    total_deposits_received DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_damage_charges DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_utility_charges DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_refunds DECIMAL(15,2) NOT NULL DEFAULT 0,
    pending_refunds DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(report_date, report_type)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_rental_orders_status ON rental_orders(status);
CREATE INDEX IF NOT EXISTS idx_rental_orders_end_time ON rental_orders(rental_end_time);
CREATE INDEX IF NOT EXISTS idx_checklists_order_id ON checklists(order_id);
CREATE INDEX IF NOT EXISTS idx_damage_charges_order_id ON damage_charges(order_id);
CREATE INDEX IF NOT EXISTS idx_utility_records_order_id ON utility_records(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_queue_status ON refund_queue(status);
CREATE INDEX IF NOT EXISTS idx_refund_queue_next_retry ON refund_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON audit_logs(operator);
CREATE INDEX IF NOT EXISTS idx_manual_adjustments_order_id ON manual_adjustments(order_id);
