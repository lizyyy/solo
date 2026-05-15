CREATE TABLE IF NOT EXISTS api_endpoint (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    api_path VARCHAR(512) NOT NULL COMMENT 'API路径',
    http_method VARCHAR(32) COMMENT 'HTTP方法',
    description VARCHAR(1024) COMMENT '描述',
    original_response_sample TEXT COMMENT '原始响应样例',
    request_id_key VARCHAR(128) COMMENT '请求ID键',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS client_scene (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    scene_code VARCHAR(128) NOT NULL UNIQUE COMMENT '场景编码',
    scene_name VARCHAR(256) COMMENT '场景名称',
    client_type VARCHAR(64) COMMENT '客户端类型',
    client_version VARCHAR(64) COMMENT '客户端版本',
    user_group VARCHAR(64) COMMENT '用户分组',
    description VARCHAR(1024) COMMENT '描述',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS slimming_rule (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_no VARCHAR(128) NOT NULL UNIQUE COMMENT '规则编号',
    api_endpoint_id BIGINT COMMENT 'API端点ID',
    api_path VARCHAR(512) NOT NULL COMMENT 'API路径',
    field_config TEXT COMMENT '字段配置JSON',
    exclude_fields TEXT COMMENT '排除字段列表，逗号分隔',
    include_fields TEXT COMMENT '包含字段列表，逗号分隔',
    nested_rules TEXT COMMENT '嵌套规则JSON',
    client_scene_id BIGINT COMMENT '客户端场景ID',
    scene_code VARCHAR(128) COMMENT '场景编码',
    status INT NOT NULL DEFAULT 0 COMMENT '状态：0草稿，10校验中，20生效，30失效，40已回滚',
    version VARCHAR(32) COMMENT '版本号',
    previous_version VARCHAR(32) COMMENT '上一个版本',
    effective_time TIMESTAMP COMMENT '生效时间',
    expire_time TIMESTAMP COMMENT '失效时间',
    created_by VARCHAR(128) COMMENT '创建人',
    remark VARCHAR(1024) COMMENT '备注',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS slimming_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(128) NOT NULL UNIQUE COMMENT '请求ID',
    rule_id BIGINT COMMENT '规则ID',
    rule_no VARCHAR(128) COMMENT '规则编号',
    api_path VARCHAR(512) COMMENT 'API路径',
    scene_code VARCHAR(128) COMMENT '场景编码',
    client_ip VARCHAR(128) COMMENT '客户端IP',
    original_size INT COMMENT '原始响应大小（字节）',
    slimmed_size INT COMMENT '瘦身响应大小（字节）',
    saved_size INT COMMENT '节省大小（字节）',
    saved_ratio DOUBLE COMMENT '节省比例（%）',
    request_time TIMESTAMP COMMENT '请求时间',
    success TINYINT DEFAULT 1 COMMENT '是否成功',
    error_message TEXT COMMENT '错误信息',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rule_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_id BIGINT NOT NULL COMMENT '规则ID',
    rule_no VARCHAR(128) NOT NULL COMMENT '规则编号',
    operation_type INT NOT NULL COMMENT '操作类型：1创建，2校验，3激活，4停用，5回滚，6更新',
    previous_status INT COMMENT '操作前状态',
    current_status INT COMMENT '操作后状态',
    operator VARCHAR(128) COMMENT '操作人',
    operation_remark VARCHAR(1024) COMMENT '操作备注',
    snapshot_before TEXT COMMENT '操作前快照',
    snapshot_after TEXT COMMENT '操作后快照',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_slimming_rule_api_path ON slimming_rule(api_path);
CREATE INDEX IF NOT EXISTS idx_slimming_rule_scene_code ON slimming_rule(scene_code);
CREATE INDEX IF NOT EXISTS idx_slimming_rule_status ON slimming_rule(status);
CREATE INDEX IF NOT EXISTS idx_slimming_record_request_id ON slimming_record(request_id);
CREATE INDEX IF NOT EXISTS idx_slimming_record_api_path ON slimming_record(api_path);
CREATE INDEX IF NOT EXISTS idx_slimming_record_request_time ON slimming_record(request_time);
CREATE INDEX IF NOT EXISTS idx_rule_history_rule_id ON rule_history(rule_id);
