-- ============================================================
-- 服务依赖变更订阅系统 - 数据库模型
-- ============================================================

-- 1. 服务表 - 记录所有服务的基本信息
CREATE TABLE IF NOT EXISTS services (
    service_id VARCHAR(64) PRIMARY KEY,
    service_name VARCHAR(255) NOT NULL,
    service_owner VARCHAR(255),
    owner_email VARCHAR(255),
    current_version VARCHAR(64),
    description TEXT,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 服务依赖关系表 - 构建依赖图
CREATE TABLE IF NOT EXISTS service_dependencies (
    dependency_id VARCHAR(64) PRIMARY KEY,
    upstream_service_id VARCHAR(64) NOT NULL,
    downstream_service_id VARCHAR(64) NOT NULL,
    dependency_type VARCHAR(32) DEFAULT 'DIRECT',
    min_compatible_version VARCHAR(64),
    max_compatible_version VARCHAR(64),
    dependency_strength VARCHAR(32) DEFAULT 'NORMAL',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (upstream_service_id) REFERENCES services(service_id),
    FOREIGN KEY (downstream_service_id) REFERENCES services(service_id),
    UNIQUE (upstream_service_id, downstream_service_id)
);

-- 3. 变更公告表 - 记录服务变更/升级公告
CREATE TABLE IF NOT EXISTS change_notices (
    notice_id VARCHAR(64) PRIMARY KEY,
    upstream_service_id VARCHAR(64) NOT NULL,
    change_type VARCHAR(32) NOT NULL,
    change_title VARCHAR(255) NOT NULL,
    change_description TEXT,
    old_version VARCHAR(64),
    new_version VARCHAR(64) NOT NULL,
    change_date TIMESTAMP NOT NULL,
    compatibility_start_date TIMESTAMP,
    compatibility_end_date TIMESTAMP,
    rollback_window_end_date TIMESTAMP,
    compatibility_deadline_days INTEGER,
    rollback_window_days INTEGER,
    is_breaking_change BOOLEAN DEFAULT FALSE,
    notice_status VARCHAR(32) DEFAULT 'DRAFT',
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (upstream_service_id) REFERENCES services(service_id)
);

-- 4. 订阅确认表 - 下游服务对公告的订阅和确认
CREATE TABLE IF NOT EXISTS subscription_confirmations (
    confirmation_id VARCHAR(64) PRIMARY KEY,
    notice_id VARCHAR(64) NOT NULL,
    downstream_service_id VARCHAR(64) NOT NULL,
    subscription_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subscription_status VARCHAR(32) DEFAULT 'PENDING',
    confirmation_date TIMESTAMP,
    confirmation_by VARCHAR(255),
    confirmation_notes TEXT,
    affected_versions TEXT[],
    mitigation_plan TEXT,
    estimated_completion_date TIMESTAMP,
    actual_completion_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (notice_id) REFERENCES change_notices(notice_id),
    FOREIGN KEY (downstream_service_id) REFERENCES services(service_id),
    UNIQUE (notice_id, downstream_service_id)
);

-- 5. 规则决策日志表 - 记录关键业务规则决策，确保可复查
CREATE TABLE IF NOT EXISTS rule_decision_logs (
    decision_id VARCHAR(64) PRIMARY KEY,
    rule_name VARCHAR(128) NOT NULL,
    rule_version VARCHAR(32) DEFAULT '1.0',
    input_context JSONB NOT NULL,
    decision_result JSONB NOT NULL,
    decision_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trigger_source VARCHAR(64),
    related_notice_id VARCHAR(64),
    related_confirmation_id VARCHAR(64),
    FOREIGN KEY (related_notice_id) REFERENCES change_notices(notice_id),
    FOREIGN KEY (related_confirmation_id) REFERENCES subscription_confirmations(confirmation_id)
);

-- 6. 报告快照表 - 保存报告快照，支持历史追溯
CREATE TABLE IF NOT EXISTS report_snapshots (
    snapshot_id VARCHAR(64) PRIMARY KEY,
    report_type VARCHAR(64) NOT NULL,
    report_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    report_parameters JSONB,
    report_summary JSONB,
    report_details JSONB,
    generated_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_dependencies_upstream ON service_dependencies(upstream_service_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_downstream ON service_dependencies(downstream_service_id);
CREATE INDEX IF NOT EXISTS idx_notices_service ON change_notices(upstream_service_id);
CREATE INDEX IF NOT EXISTS idx_notices_status ON change_notices(notice_status);
CREATE INDEX IF NOT EXISTS idx_notices_date ON change_notices(change_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_notice ON subscription_confirmations(notice_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_service ON subscription_confirmations(downstream_service_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscription_confirmations(subscription_status);
CREATE INDEX IF NOT EXISTS idx_rule_logs_rule ON rule_decision_logs(rule_name);
CREATE INDEX IF NOT EXISTS idx_rule_logs_timestamp ON rule_decision_logs(decision_timestamp);
