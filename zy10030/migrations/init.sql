-- 灰度发布相关表
CREATE TABLE IF NOT EXISTS gray_releases (
    id BIGSERIAL PRIMARY KEY,
    service_name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    description TEXT,
    strategy VARCHAR(50) NOT NULL DEFAULT 'percentage',
    strategy_config JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_gray_releases_service ON gray_releases(service_name);
CREATE INDEX idx_gray_releases_status ON gray_releases(status);
CREATE INDEX idx_gray_releases_created_at ON gray_releases(created_at);

-- 灰度实例表
CREATE TABLE IF NOT EXISTS gray_instances (
    id BIGSERIAL PRIMARY KEY,
    release_id BIGINT NOT NULL REFERENCES gray_releases(id),
    instance_id VARCHAR(255) NOT NULL,
    host VARCHAR(255),
    port INT,
    version VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    traffic_weight INT NOT NULL DEFAULT 0,
    assigned_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gray_instances_release ON gray_instances(release_id);
CREATE INDEX idx_gray_instances_status ON gray_instances(status);

-- 回滚记录表
CREATE TABLE IF NOT EXISTS rollback_records (
    id BIGSERIAL PRIMARY KEY,
    release_id BIGINT NOT NULL REFERENCES gray_releases(id),
    trigger_type VARCHAR(50) NOT NULL,
    trigger_by VARCHAR(100),
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'initiated',
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    failed_steps JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rollback_records_release ON rollback_records(release_id);
CREATE INDEX idx_rollback_records_status ON rollback_records(status);

-- 回滚步骤表
CREATE TABLE IF NOT EXISTS rollback_steps (
    id BIGSERIAL PRIMARY KEY,
    rollback_id BIGINT NOT NULL REFERENCES rollback_records(id),
    step_index INT NOT NULL,
    step_type VARCHAR(100) NOT NULL,
    target_instance VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    params JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rollback_steps_rollback ON rollback_steps(rollback_id);
CREATE INDEX idx_rollback_steps_status ON rollback_steps(status);

-- 全链路追踪表
CREATE TABLE IF NOT EXISTS trace_spans (
    id BIGSERIAL PRIMARY KEY,
    trace_id VARCHAR(64) NOT NULL,
    span_id VARCHAR(64) NOT NULL,
    parent_span_id VARCHAR(64),
    service_name VARCHAR(255) NOT NULL,
    operation_name VARCHAR(255) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_ms BIGINT,
    status VARCHAR(50),
    http_method VARCHAR(10),
    http_url TEXT,
    http_status_code INT,
    db_statement TEXT,
    db_table VARCHAR(255),
    message_topic VARCHAR(255),
    message_partition INT,
    message_offset BIGINT,
    attributes JSONB NOT NULL DEFAULT '{}',
    events JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trace_spans_trace ON trace_spans(trace_id);
CREATE INDEX idx_trace_spans_span ON trace_spans(span_id);
CREATE INDEX idx_trace_spans_service ON trace_spans(service_name);
CREATE INDEX idx_trace_spans_start_time ON trace_spans(start_time);

-- 消息消费记录表（用于幂等性）
CREATE TABLE IF NOT EXISTS message_dedup_records (
    id BIGSERIAL PRIMARY KEY,
    message_id VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    partition INT NOT NULL,
    offset BIGINT NOT NULL,
    consumer_group VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'processing',
    processed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, topic, consumer_group)
);

CREATE INDEX idx_message_dedup_message ON message_dedup_records(message_id);
CREATE INDEX idx_message_dedup_topic ON message_dedup_records(topic, partition, offset);
CREATE INDEX idx_message_dedup_created ON message_dedup_records(created_at);

-- 问题报告表
CREATE TABLE IF NOT EXISTS incident_reports (
    id BIGSERIAL PRIMARY KEY,
    report_id VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    category VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    trigger_release_id BIGINT REFERENCES gray_releases(id),
    trigger_rollback_id BIGINT REFERENCES rollback_records(id),
    affected_services TEXT[],
    root_cause TEXT,
    impact_analysis TEXT,
    resolution_steps TEXT,
    timeline JSONB NOT NULL DEFAULT '[]',
    related_traces TEXT[],
    export_format VARCHAR(20),
    exported_at TIMESTAMP,
    file_path VARCHAR(500),
    reported_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE INDEX idx_incident_reports_status ON incident_reports(status);
CREATE INDEX idx_incident_reports_severity ON incident_reports(severity);
CREATE INDEX idx_incident_reports_created ON incident_reports(created_at);

-- 故障注入配置表
CREATE TABLE IF NOT EXISTS fault_injection_configs (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    fault_type VARCHAR(100) NOT NULL,
    target_service VARCHAR(255),
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    config JSONB NOT NULL DEFAULT '{}',
    probability DECIMAL(5,4) NOT NULL DEFAULT 0.1,
    duration_seconds INT,
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fault_configs_target ON fault_injection_configs(target_service);
CREATE INDEX idx_fault_configs_type ON fault_injection_configs(fault_type);

-- 请求统计表
CREATE TABLE IF NOT EXISTS request_metrics (
    id BIGSERIAL PRIMARY KEY,
    service_name VARCHAR(255) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    http_method VARCHAR(10),
    timestamp TIMESTAMP NOT NULL,
    request_count INT NOT NULL DEFAULT 0,
    error_count INT NOT NULL DEFAULT 0,
    p50_latency_ms INT,
    p95_latency_ms INT,
    p99_latency_ms INT,
    avg_latency_ms DECIMAL(10,2),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_request_metrics_service ON request_metrics(service_name);
CREATE INDEX idx_request_metrics_timestamp ON request_metrics(timestamp);

-- 补偿事务表（Saga模式）
CREATE TABLE IF NOT EXISTS saga_transactions (
    id BIGSERIAL PRIMARY KEY,
    saga_id VARCHAR(64) NOT NULL UNIQUE,
    saga_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    current_step INT NOT NULL DEFAULT 0,
    total_steps INT NOT NULL,
    compensating_mode BOOLEAN NOT NULL DEFAULT FALSE,
    context JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_saga_transactions_saga_id ON saga_transactions(saga_id);
CREATE INDEX idx_saga_transactions_status ON saga_transactions(status);

-- Saga步骤表
CREATE TABLE IF NOT EXISTS saga_steps (
    id BIGSERIAL PRIMARY KEY,
    saga_id VARCHAR(64) NOT NULL REFERENCES saga_transactions(saga_id) ON DELETE CASCADE,
    step_index INT NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    action_params JSONB,
    compensation_params JSONB,
    error_message TEXT,
    executed_at TIMESTAMP,
    compensated_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(saga_id, step_index)
);

CREATE INDEX idx_saga_steps_saga ON saga_steps(saga_id);

