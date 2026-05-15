CREATE TABLE IF NOT EXISTS edge_node (
    id BIGINT PRIMARY KEY COMMENT '节点ID',
    node_code VARCHAR(64) NOT NULL UNIQUE COMMENT '节点编码',
    node_name VARCHAR(128) COMMENT '节点名称',
    node_ip VARCHAR(64) COMMENT '节点IP',
    region VARCHAR(64) COMMENT '所属区域',
    status TINYINT DEFAULT 1 COMMENT '状态:0-停用,1-启用',
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记'
);

CREATE TABLE IF NOT EXISTS config_version (
    id BIGINT PRIMARY KEY COMMENT '版本ID',
    version_no VARCHAR(64) NOT NULL UNIQUE COMMENT '版本号',
    config_type VARCHAR(32) NOT NULL COMMENT '配置类型',
    config_content TEXT COMMENT '配置内容',
    publish_time DATETIME COMMENT '发布时间',
    publisher VARCHAR(64) COMMENT '发布人',
    status TINYINT DEFAULT 1 COMMENT '状态:0-草稿,1-已发布,2-已下线',
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记'
);

CREATE TABLE IF NOT EXISTS config_delivery (
    id BIGINT PRIMARY KEY COMMENT '下发ID',
    delivery_no VARCHAR(64) NOT NULL UNIQUE COMMENT '下发单号',
    node_id BIGINT NOT NULL COMMENT '节点ID',
    node_code VARCHAR(64) NOT NULL COMMENT '节点编码',
    version_id BIGINT NOT NULL COMMENT '版本ID',
    version_no VARCHAR(64) NOT NULL COMMENT '版本号',
    delivery_time DATETIME COMMENT '下发时间',
    status TINYINT DEFAULT 1 COMMENT '状态:1-待签收,2-已签收,3-生效中,4-已生效,5-签收失败,6-生效失败',
    ack_time DATETIME COMMENT '签收时间',
    effective_time DATETIME COMMENT '生效时间',
    retry_count INT DEFAULT 0 COMMENT '重试次数',
    last_retry_time DATETIME COMMENT '最后重试时间',
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    UNIQUE KEY uk_node_version (node_code, version_no)
);

CREATE TABLE IF NOT EXISTS ack_receipt (
    id BIGINT PRIMARY KEY COMMENT '回执ID',
    receipt_no VARCHAR(64) NOT NULL UNIQUE COMMENT '回执单号',
    delivery_id BIGINT NOT NULL COMMENT '下发ID',
    delivery_no VARCHAR(64) NOT NULL COMMENT '下发单号',
    node_id BIGINT NOT NULL COMMENT '节点ID',
    node_code VARCHAR(64) NOT NULL COMMENT '节点编码',
    version_id BIGINT NOT NULL COMMENT '版本ID',
    version_no VARCHAR(64) NOT NULL COMMENT '版本号',
    ack_result TINYINT NOT NULL COMMENT '签收结果:1-成功,2-失败',
    ack_time DATETIME COMMENT '签收时间',
    ack_by VARCHAR(64) COMMENT '签收来源',
    client_ip VARCHAR(64) COMMENT '客户端IP',
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记'
);

CREATE TABLE IF NOT EXISTS effective_check (
    id BIGINT PRIMARY KEY COMMENT '校验ID',
    delivery_id BIGINT NOT NULL COMMENT '下发ID',
    delivery_no VARCHAR(64) NOT NULL COMMENT '下发单号',
    node_id BIGINT NOT NULL COMMENT '节点ID',
    node_code VARCHAR(64) NOT NULL COMMENT '节点编码',
    version_id BIGINT NOT NULL COMMENT '版本ID',
    version_no VARCHAR(64) NOT NULL COMMENT '版本号',
    check_time DATETIME COMMENT '校验时间',
    check_result TINYINT COMMENT '校验结果:1-成功,2-失败,3-校验中',
    check_detail TEXT COMMENT '校验详情',
    check_by VARCHAR(64) COMMENT '校验人/系统',
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记'
);

CREATE TABLE IF NOT EXISTS failure_reason (
    id BIGINT PRIMARY KEY COMMENT '失败记录ID',
    delivery_id BIGINT NOT NULL COMMENT '下发ID',
    delivery_no VARCHAR(64) NOT NULL COMMENT '下发单号',
    node_id BIGINT NOT NULL COMMENT '节点ID',
    node_code VARCHAR(64) NOT NULL COMMENT '节点编码',
    version_id BIGINT NOT NULL COMMENT '版本ID',
    version_no VARCHAR(64) NOT NULL COMMENT '版本号',
    failure_type TINYINT NOT NULL COMMENT '失败类型:1-签收失败,2-生效失败',
    failure_code VARCHAR(64) COMMENT '错误码',
    failure_msg TEXT COMMENT '错误信息',
    failure_detail TEXT COMMENT '详细错误',
    failure_time DATETIME COMMENT '失败时间',
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记'
);

CREATE TABLE IF NOT EXISTS retry_task (
    id BIGINT PRIMARY KEY COMMENT '重试任务ID',
    task_no VARCHAR(64) NOT NULL UNIQUE COMMENT '任务单号',
    delivery_id BIGINT NOT NULL COMMENT '下发ID',
    delivery_no VARCHAR(64) NOT NULL COMMENT '下发单号',
    node_id BIGINT NOT NULL COMMENT '节点ID',
    node_code VARCHAR(64) NOT NULL COMMENT '节点编码',
    version_id BIGINT NOT NULL COMMENT '版本ID',
    version_no VARCHAR(64) NOT NULL COMMENT '版本号',
    retry_type TINYINT NOT NULL COMMENT '重试类型:1-补发配置,2-重新校验',
    retry_count INT DEFAULT 0 COMMENT '已重试次数',
    max_retry INT DEFAULT 3 COMMENT '最大重试次数',
    next_retry_time DATETIME COMMENT '下次重试时间',
    last_retry_time DATETIME COMMENT '最后重试时间',
    status TINYINT DEFAULT 1 COMMENT '状态:1-待执行,2-执行中,3-成功,4-失败,5-已取消',
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记'
);

CREATE INDEX idx_delivery_node ON config_delivery(node_code);
CREATE INDEX idx_delivery_version ON config_delivery(version_no);
CREATE INDEX idx_delivery_status ON config_delivery(status);
CREATE INDEX idx_receipt_delivery ON ack_receipt(delivery_no);
CREATE INDEX idx_check_delivery ON effective_check(delivery_no);
CREATE INDEX idx_failure_delivery ON failure_reason(delivery_no);
CREATE INDEX idx_retry_delivery ON retry_task(delivery_no);
CREATE INDEX idx_retry_status ON retry_task(status);
CREATE INDEX idx_retry_next_time ON retry_task(next_retry_time);
