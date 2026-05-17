-- ========================================
-- 报表订阅服务邮件订阅退回处理数据库
-- 核心表结构设计
-- ========================================

-- 状态枚举类型
CREATE TYPE subscription_status AS ENUM (
    'PENDING',      -- 待发送
    'BOUNCING',     -- 退回中
    'SUSPENDED',    -- 暂停
    'RESUMED'       -- 已恢复
);

-- 退回原因类型
CREATE TYPE bounce_reason AS ENUM (
    'MAILBOX_FULL',         -- 邮箱已满
    'INVALID_RECIPIENT',    -- 收件人无效
    'SPAM_REJECTED',        -- 被反垃圾邮件拒绝
    'DNS_FAILURE',          -- DNS解析失败
    'CONNECTION_TIMEOUT',   -- 连接超时
    'CONTENT_REJECTED',     -- 内容被拒绝
    'RELAY_DENIED',         -- 中继被拒绝
    'OTHER'                 -- 其他
);

-- 操作类型
CREATE TYPE action_type AS ENUM (
    'SEND',                 -- 发送
    'BOUNCE',               -- 退回
    'RETRY',                -- 重试
    'SUSPEND',              -- 暂停
    'RESUME',               -- 恢复
    'MANUAL_RESEND',        -- 人工补发
    'IMPORT',               -- 导入
    'EXPORT'                -- 导出
);

-- ========================================
-- 1. 订阅人表 (subscribers)
-- ========================================
CREATE TABLE subscribers (
    subscriber_id       BIGSERIAL PRIMARY KEY,
    email               VARCHAR(255) NOT NULL UNIQUE,
    name                VARCHAR(100) NOT NULL,
    department          VARCHAR(100),
    position            VARCHAR(100),
    phone               VARCHAR(20),
    company             VARCHAR(200),
    is_active           BOOLEAN DEFAULT true,
    email_verified      BOOLEAN DEFAULT false,
    last_verified_at    TIMESTAMP,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by          VARCHAR(100) DEFAULT 'system',
    
    INDEX idx_subscriber_email (email),
    INDEX idx_subscriber_department (department),
    INDEX idx_subscriber_active (is_active)
);

-- ========================================
-- 2. 报表表 (reports)
-- ========================================
CREATE TABLE reports (
    report_id           BIGSERIAL PRIMARY KEY,
    report_code         VARCHAR(50) NOT NULL UNIQUE,
    report_name         VARCHAR(200) NOT NULL,
    report_type         VARCHAR(50) NOT NULL,  -- SALES, FINANCE, HR, OPERATIONS
    description         TEXT,
    frequency           VARCHAR(20) NOT NULL,  -- DAILY, WEEKLY, MONTHLY, QUARTERLY
    schedule_time       TIME,
    template_path       VARCHAR(500),
    export_format       VARCHAR(20) DEFAULT 'PDF',  -- PDF, EXCEL, CSV
    is_active           BOOLEAN DEFAULT true,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by          VARCHAR(100) DEFAULT 'system',
    owner_department    VARCHAR(100),
    
    INDEX idx_report_code (report_code),
    INDEX idx_report_type (report_type),
    INDEX idx_report_active (is_active)
);

-- ========================================
-- 3. 报表订阅记录表 (report_subscriptions) - 核心表
-- ========================================
CREATE TABLE report_subscriptions (
    subscription_id     BIGSERIAL PRIMARY KEY,
    subscriber_id       BIGINT NOT NULL REFERENCES subscribers(subscriber_id),
    report_id           BIGINT NOT NULL REFERENCES reports(report_id),
    
    -- 订阅配置
    email_subject       VARCHAR(300),
    custom_message      TEXT,
    attachment_enabled  BOOLEAN DEFAULT true,
    
    -- 发送状态
    status              subscription_status DEFAULT 'PENDING',
    last_sent_at        TIMESTAMP,
    next_send_at        TIMESTAMP,
    
    -- 退回处理
    bounce_count        INT DEFAULT 0,
    last_bounce_at      TIMESTAMP,
    last_bounce_reason  bounce_reason,
    retry_count         INT DEFAULT 0,
    max_retries         INT DEFAULT 3,
    retry_interval_hours INT DEFAULT 24,
    
    -- 人工处理
    suspended_at        TIMESTAMP,
    suspended_by        VARCHAR(100),
    suspend_reason      TEXT,
    resumed_at          TIMESTAMP,
    resumed_by          VARCHAR(100),
    
    -- 导入来源
    import_batch_id     VARCHAR(100),
    is_imported         BOOLEAN DEFAULT false,
    import_error        TEXT,
    
    -- 审计
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by          VARCHAR(100) DEFAULT 'system',
    updated_by          VARCHAR(100),
    
    CONSTRAINT fk_subscription_subscriber FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id),
    CONSTRAINT fk_subscription_report FOREIGN KEY (report_id) REFERENCES reports(report_id),
    
    INDEX idx_subscription_status (status),
    INDEX idx_subscription_subscriber (subscriber_id),
    INDEX idx_subscription_report (report_id),
    INDEX idx_subscription_next_send (next_send_at),
    INDEX idx_subscription_bounce (bounce_count),
    INDEX idx_subscription_import (import_batch_id)
);

-- ========================================
-- 4. 退回历史记录表 (bounce_history)
-- ========================================
CREATE TABLE bounce_history (
    history_id          BIGSERIAL PRIMARY KEY,
    subscription_id     BIGINT NOT NULL REFERENCES report_subscriptions(subscription_id),
    
    -- 退回详情
    bounce_reason       bounce_reason NOT NULL,
    bounce_details      TEXT,
    bounce_timestamp    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 发送信息
    sent_at             TIMESTAMP,
    email_subject       VARCHAR(300),
    smtp_status_code    VARCHAR(20),
    smtp_response       TEXT,
    
    -- 处理结果
    action_taken        action_type,
    retry_scheduled_at  TIMESTAMP,
    processed_at        TIMESTAMP,
    processed_by        VARCHAR(100),
    
    -- 关联
    original_history_id BIGINT,  -- 关联原始退回记录（用于补发场景）
    is_resend           BOOLEAN DEFAULT false,
    resend_count        INT DEFAULT 0,
    
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_bounce_history_subscription FOREIGN KEY (subscription_id) REFERENCES report_subscriptions(subscription_id),
    
    INDEX idx_bounce_history_subscription (subscription_id),
    INDEX idx_bounce_history_timestamp (bounce_timestamp),
    INDEX idx_bounce_history_reason (bounce_reason),
    INDEX idx_bounce_history_original (original_history_id)
);

-- ========================================
-- 5. 订阅操作日志表 (subscription_audit_log)
-- ========================================
CREATE TABLE subscription_audit_log (
    log_id              BIGSERIAL PRIMARY KEY,
    subscription_id     BIGINT REFERENCES report_subscriptions(subscription_id),
    subscriber_id       BIGINT REFERENCES subscribers(subscriber_id),
    report_id           BIGINT REFERENCES reports(report_id),
    
    action              action_type NOT NULL,
    action_by           VARCHAR(100) NOT NULL,
    action_timestamp    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    old_status          subscription_status,
    new_status          subscription_status,
    old_retry_count     INT,
    new_retry_count     INT,
    old_bounce_count    INT,
    new_bounce_count    INT,
    
    comments            TEXT,
    ip_address          VARCHAR(50),
    user_agent          VARCHAR(500),
    
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_audit_subscription (subscription_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_timestamp (action_timestamp)
);

-- ========================================
-- 6. 导出记录表 (export_records)
-- ========================================
CREATE TABLE export_records (
    export_id           BIGSERIAL PRIMARY KEY,
    export_batch_id     VARCHAR(100) NOT NULL UNIQUE,
    export_type         VARCHAR(50) NOT NULL,  -- BOUNCE_LIST, SUBSCRIPTION_LIST, AUDIT_LOG
    export_format       VARCHAR(20) DEFAULT 'EXCEL',
    export_status       VARCHAR(20) DEFAULT 'PROCESSING',  -- PROCESSING, COMPLETED, FAILED
    
    -- 筛选条件
    start_date          TIMESTAMP,
    end_date            TIMESTAMP,
    status_filter       subscription_status,
    report_id_filter    BIGINT,
    subscriber_id_filter BIGINT,
    
    -- 文件信息
    file_name           VARCHAR(500),
    file_path           VARCHAR(1000),
    file_size_bytes     BIGINT,
    record_count        INT,
    
    -- 导出人
    exported_by         VARCHAR(100),
    exported_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at        TIMESTAMP,
    
    error_message       TEXT,
    
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_export_batch (export_batch_id),
    INDEX idx_export_status (export_status),
    INDEX idx_export_date (exported_at)
);

-- ========================================
-- 7. 导出-订阅关联表 (export_subscription_mapping)
-- 用于记录导出文件中包含哪些订阅记录
-- ========================================
CREATE TABLE export_subscription_mapping (
    mapping_id          BIGSERIAL PRIMARY KEY,
    export_id           BIGINT NOT NULL REFERENCES export_records(export_id),
    subscription_id     BIGINT NOT NULL REFERENCES report_subscriptions(subscription_id),
    history_id          BIGINT REFERENCES bounce_history(history_id),  -- 关联具体的退回历史
    
    included_in_export  BOOLEAN DEFAULT true,
    export_row_number   INT,
    
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_export_mapping_export FOREIGN KEY (export_id) REFERENCES export_records(export_id),
    CONSTRAINT fk_export_mapping_subscription FOREIGN KEY (subscription_id) REFERENCES report_subscriptions(subscription_id),
    CONSTRAINT fk_export_mapping_history FOREIGN KEY (history_id) REFERENCES bounce_history(history_id),
    
    INDEX idx_export_mapping_export (export_id),
    INDEX idx_export_mapping_subscription (subscription_id)
);

-- ========================================
-- 8. 导入记录表 (import_records)
-- ========================================
CREATE TABLE import_records (
    import_id           BIGSERIAL PRIMARY KEY,
    import_batch_id     VARCHAR(100) NOT NULL UNIQUE,
    import_type         VARCHAR(50) NOT NULL,  -- SUBSCRIBERS, SUBSCRIPTIONS, BOUNCES
    
    file_name           VARCHAR(500),
    file_path           VARCHAR(1000),
    total_rows          INT,
    success_count       INT DEFAULT 0,
    failed_count        INT DEFAULT 0,
    
    imported_by         VARCHAR(100),
    imported_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at        TIMESTAMP,
    
    import_status       VARCHAR(20) DEFAULT 'PROCESSING',  -- PROCESSING, COMPLETED, PARTIAL, FAILED
    error_message       TEXT,
    
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_import_batch (import_batch_id),
    INDEX idx_import_status (import_status)
);

-- ========================================
-- 9. 导入坏行表 (import_bad_rows)
-- ========================================
CREATE TABLE import_bad_rows (
    bad_row_id          BIGSERIAL PRIMARY KEY,
    import_id           BIGINT NOT NULL REFERENCES import_records(import_id),
    
    row_number          INT NOT NULL,
    row_data            JSONB,
    raw_row_data        TEXT,
    
    error_type          VARCHAR(100),
    error_message       TEXT,
    error_details       JSONB,
    
    is_resolved         BOOLEAN DEFAULT false,
    resolved_at         TIMESTAMP,
    resolved_by         VARCHAR(100),
    resolution_notes    TEXT,
    
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_bad_rows_import FOREIGN KEY (import_id) REFERENCES import_records(import_id),
    
    INDEX idx_bad_rows_import (import_id),
    INDEX idx_bad_rows_resolved (is_resolved),
    INDEX idx_bad_rows_error_type (error_type)
);

-- ========================================
-- 视图：订阅详情视图（包含订阅人、报表信息）
-- ========================================
CREATE VIEW v_subscription_details AS
SELECT 
    s.subscription_id,
    s.subscriber_id,
    s.report_id,
    sb.email,
    sb.name as subscriber_name,
    sb.department,
    r.report_code,
    r.report_name,
    r.report_type,
    r.frequency,
    s.status,
    s.last_sent_at,
    s.next_send_at,
    s.bounce_count,
    s.last_bounce_at,
    s.last_bounce_reason,
    s.retry_count,
    s.max_retries,
    s.suspended_at,
    s.suspended_by,
    s.created_at,
    s.updated_at
FROM report_subscriptions s
JOIN subscribers sb ON s.subscriber_id = sb.subscriber_id
JOIN reports r ON s.report_id = r.report_id;

-- ========================================
-- 视图：退回历史详情视图
-- ========================================
CREATE VIEW v_bounce_history_details AS
SELECT 
    bh.history_id,
    bh.subscription_id,
    sb.email,
    sb.name as subscriber_name,
    r.report_code,
    r.report_name,
    bh.bounce_reason,
    bh.bounce_details,
    bh.bounce_timestamp,
    bh.sent_at,
    bh.email_subject,
    bh.smtp_status_code,
    bh.smtp_response,
    bh.action_taken,
    bh.retry_scheduled_at,
    bh.is_resend,
    bh.resend_count,
    bh.original_history_id
FROM bounce_history bh
JOIN report_subscriptions s ON bh.subscription_id = s.subscription_id
JOIN subscribers sb ON s.subscriber_id = sb.subscriber_id
JOIN reports r ON s.report_id = r.report_id;

-- ========================================
-- 自动更新时间戳触发器
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscribers_updated_at BEFORE UPDATE ON subscribers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON report_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
