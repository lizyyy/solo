-- 直播电商后台主播优惠券撤回系统数据库初始化脚本
-- PostgreSQL 14+

-- 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============ 枚举类型定义 ============

-- 优惠券批次状态
CREATE TYPE coupon_batch_status AS ENUM (
    'pending',      -- 待发放
    'distributed',  -- 已发放
    'withdrawing',  -- 撤回中
    'invalid'       -- 已失效
);

-- 单张优惠券状态
CREATE TYPE coupon_record_status AS ENUM (
    'pending',      -- 待发放
    'distributed',  -- 已发放
    'used',         -- 已使用
    'expired',      -- 已过期
    'withdrawn'     -- 已撤回
);

-- 撤回操作状态
CREATE TYPE withdraw_operation_status AS ENUM (
    'initiated',    -- 已发起
    'processing',   -- 处理中
    'partial',      -- 部分成功
    'completed',    -- 已完成
    'failed'        -- 失败
);

-- 发放范围类型
CREATE TYPE scope_type AS ENUM (
    'all_users',        -- 所有用户
    'new_users',        -- 新用户
    'specified_users',  -- 指定用户
    'level_users'       -- 指定等级用户
);

-- ============ 主播表 ============
CREATE TABLE anchors (
    anchor_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anchor_name VARCHAR(100) NOT NULL,
    anchor_phone VARCHAR(20),
    room_id VARCHAR(50) UNIQUE NOT NULL,
    room_name VARCHAR(200),
    platform VARCHAR(50) NOT NULL DEFAULT 'douyin', -- douyin, kuaishou, taobao
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_anchors_room_id ON anchors(room_id);
CREATE INDEX idx_anchors_platform ON anchors(platform);

-- ============ 撤回原因字典表 ============
CREATE TABLE withdraw_reasons (
    reason_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reason_code VARCHAR(50) UNIQUE NOT NULL,
    reason_name VARCHAR(200) NOT NULL,
    reason_desc TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============ 优惠券批次表 ============
CREATE TABLE coupon_batches (
    batch_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_no VARCHAR(50) UNIQUE NOT NULL,
    batch_name VARCHAR(200) NOT NULL,
    anchor_id UUID NOT NULL REFERENCES anchors(anchor_id),
    coupon_type VARCHAR(50) NOT NULL, -- discount, reduce, free_shipping
    coupon_value DECIMAL(10,2) NOT NULL,
    min_spend DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL,
    distributed_count INTEGER NOT NULL DEFAULT 0,
    used_count INTEGER NOT NULL DEFAULT 0,
    withdrawn_count INTEGER NOT NULL DEFAULT 0,
    valid_start_time TIMESTAMP NOT NULL,
    valid_end_time TIMESTAMP NOT NULL,
    status coupon_batch_status NOT NULL DEFAULT 'pending',
    scope_type scope_type NOT NULL DEFAULT 'all_users',
    remark TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) NOT NULL,
    updated_by VARCHAR(50),
    
    CONSTRAINT chk_valid_time CHECK (valid_end_time > valid_start_time),
    CONSTRAINT chk_counts CHECK (distributed_count + withdrawn_count <= total_count)
);

CREATE INDEX idx_coupon_batches_anchor ON coupon_batches(anchor_id);
CREATE INDEX idx_coupon_batches_status ON coupon_batches(status);
CREATE INDEX idx_coupon_batches_valid_time ON coupon_batches(valid_start_time, valid_end_time);

-- ============ 发放范围明细表 ============
CREATE TABLE distribution_scopes (
    scope_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES coupon_batches(batch_id) ON DELETE CASCADE,
    scope_type scope_type NOT NULL,
    target_value VARCHAR(500), -- 用户ID列表、等级值等
    target_count INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_distribution_scopes_batch ON distribution_scopes(batch_id);

-- ============ 优惠券记录表 ============
CREATE TABLE coupon_records (
    record_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES coupon_batches(batch_id),
    coupon_code VARCHAR(100) UNIQUE NOT NULL,
    user_id VARCHAR(50),
    user_phone VARCHAR(20),
    user_nickname VARCHAR(100),
    status coupon_record_status NOT NULL DEFAULT 'pending',
    distribute_time TIMESTAMP,
    use_time TIMESTAMP,
    withdraw_time TIMESTAMP,
    order_no VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_batch_coupon UNIQUE (batch_id, coupon_code)
);

CREATE INDEX idx_coupon_records_batch ON coupon_records(batch_id);
CREATE INDEX idx_coupon_records_user ON coupon_records(user_id);
CREATE INDEX idx_coupon_records_status ON coupon_records(status);
CREATE INDEX idx_coupon_records_distribute ON coupon_records(distribute_time);

-- ============ 撤回操作记录表 ============
CREATE TABLE withdraw_operations (
    operation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES coupon_batches(batch_id),
    reason_id UUID REFERENCES withdraw_reasons(reason_id),
    reason_remark TEXT,
    operator VARCHAR(50) NOT NULL,
    operator_name VARCHAR(100) NOT NULL,
    status withdraw_operation_status NOT NULL DEFAULT 'initiated',
    total_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    fail_details JSONB, -- 失败详情：[{record_id, coupon_code, user_id, reason}]
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_withdraw_operations_batch ON withdraw_operations(batch_id);
CREATE INDEX idx_withdraw_operations_status ON withdraw_operations(status);
CREATE INDEX idx_withdraw_operations_operator ON withdraw_operations(operator);

-- ============ 操作日志表 ============
CREATE TABLE operation_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_type VARCHAR(50) NOT NULL, -- create, distribute, withdraw, cancel, etc.
    batch_id UUID REFERENCES coupon_batches(batch_id),
    record_id UUID REFERENCES coupon_records(record_id),
    operator VARCHAR(50) NOT NULL,
    operator_name VARCHAR(100) NOT NULL,
    before_status VARCHAR(50),
    after_status VARCHAR(50),
    remark TEXT,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_operation_logs_batch ON operation_logs(batch_id);
CREATE INDEX idx_operation_logs_record ON operation_logs(record_id);
CREATE INDEX idx_operation_logs_created ON operation_logs(created_at);

-- ============ 触发器：更新时间自动更新 ============
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_anchors_updated_at BEFORE UPDATE ON anchors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coupon_batches_updated_at BEFORE UPDATE ON coupon_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coupon_records_updated_at BEFORE UPDATE ON coupon_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_withdraw_operations_updated_at BEFORE UPDATE ON withdraw_operations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============ 视图：批次统计视图 ============
CREATE OR REPLACE VIEW v_coupon_batch_stats AS
SELECT 
    cb.batch_id,
    cb.batch_no,
    cb.batch_name,
    a.anchor_name,
    a.room_id,
    cb.status,
    cb.total_count,
    cb.distributed_count,
    cb.used_count,
    cb.withdrawn_count,
    (cb.total_count - cb.distributed_count - cb.withdrawn_count) AS remaining_count,
    cb.valid_start_time,
    cb.valid_end_time,
    cb.created_at
FROM coupon_batches cb
JOIN anchors a ON cb.anchor_id = a.anchor_id;

-- ============ 视图：撤回操作详情视图 ============
CREATE OR REPLACE VIEW v_withdraw_operation_details AS
SELECT 
    wo.operation_id,
    wo.batch_id,
    cb.batch_no,
    cb.batch_name,
    a.anchor_name,
    wr.reason_name,
    wo.reason_remark,
    wo.operator_name,
    wo.status,
    wo.total_count,
    wo.success_count,
    wo.fail_count,
    wo.started_at,
    wo.completed_at,
    wo.created_at
FROM withdraw_operations wo
JOIN coupon_batches cb ON wo.batch_id = cb.batch_id
JOIN anchors a ON cb.anchor_id = a.anchor_id
LEFT JOIN withdraw_reasons wr ON wo.reason_id = wr.reason_id;
