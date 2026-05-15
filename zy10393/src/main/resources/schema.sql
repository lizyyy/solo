CREATE DATABASE IF NOT EXISTS data_repair DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE data_repair;

CREATE TABLE IF NOT EXISTS repair_script (
    id BIGINT PRIMARY KEY COMMENT '主键ID',
    script_no VARCHAR(64) NOT NULL UNIQUE COMMENT '脚本编号',
    script_name VARCHAR(200) NOT NULL COMMENT '脚本名称',
    script_type VARCHAR(32) NOT NULL COMMENT '脚本类型',
    script_content TEXT NOT NULL COMMENT '脚本内容',
    rollback_script TEXT COMMENT '回滚脚本',
    description VARCHAR(500) COMMENT '描述',
    business_system VARCHAR(100) NOT NULL COMMENT '业务系统',
    database_name VARCHAR(100) NOT NULL COMMENT '数据库名称',
    estimated_impact VARCHAR(500) COMMENT '预估影响',
    status INT NOT NULL DEFAULT 0 COMMENT '状态',
    current_handler VARCHAR(64) COMMENT '当前处理人',
    submit_time DATETIME COMMENT '提交时间',
    approval_time DATETIME COMMENT '审批时间',
    execute_time DATETIME COMMENT '执行时间',
    complete_time DATETIME COMMENT '完成时间',
    applicant VARCHAR(64) COMMENT '申请人',
    applicant_dept VARCHAR(100) COMMENT '申请人部门',
    remark VARCHAR(500) COMMENT '备注',
    request_id VARCHAR(128) COMMENT '请求ID(幂等校验)',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    create_by VARCHAR(64) COMMENT '创建人',
    update_by VARCHAR(64) COMMENT '更新人',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    INDEX idx_script_no (script_no),
    INDEX idx_status (status),
    INDEX idx_request_id (request_id),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='修复脚本表';

CREATE TABLE IF NOT EXISTS target_scope (
    id BIGINT PRIMARY KEY COMMENT '主键ID',
    script_id BIGINT NOT NULL COMMENT '脚本ID',
    scope_type VARCHAR(32) NOT NULL COMMENT '范围类型',
    table_name VARCHAR(100) NOT NULL COMMENT '表名',
    primary_key VARCHAR(64) COMMENT '主键字段',
    where_condition VARCHAR(1000) COMMENT 'WHERE条件',
    estimated_rows BIGINT COMMENT '预估影响行数',
    columns_affected VARCHAR(500) COMMENT '影响列',
    remark VARCHAR(500) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    create_by VARCHAR(64) COMMENT '创建人',
    update_by VARCHAR(64) COMMENT '更新人',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    INDEX idx_script_id (script_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='目标范围表';

CREATE TABLE IF NOT EXISTS dry_run_result (
    id BIGINT PRIMARY KEY COMMENT '主键ID',
    script_id BIGINT NOT NULL COMMENT '脚本ID',
    batch_no VARCHAR(64) NOT NULL COMMENT '批次号',
    start_time DATETIME COMMENT '开始时间',
    end_time DATETIME COMMENT '结束时间',
    affected_rows BIGINT COMMENT '影响行数',
    preview_data TEXT COMMENT '预览数据',
    execution_log TEXT COMMENT '执行日志',
    success TINYINT COMMENT '是否成功',
    error_message TEXT COMMENT '错误信息',
    operator VARCHAR(64) COMMENT '操作人',
    remark VARCHAR(500) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    create_by VARCHAR(64) COMMENT '创建人',
    update_by VARCHAR(64) COMMENT '更新人',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    INDEX idx_script_id (script_id),
    INDEX idx_batch_no (batch_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='试跑结果表';

CREATE TABLE IF NOT EXISTS approval_opinion (
    id BIGINT PRIMARY KEY COMMENT '主键ID',
    script_id BIGINT NOT NULL COMMENT '脚本ID',
    action INT COMMENT '审批动作',
    approver VARCHAR(64) COMMENT '审批人',
    approver_dept VARCHAR(100) COMMENT '审批人部门',
    opinion TEXT COMMENT '审批意见',
    approval_level INT COMMENT '审批级别',
    passed TINYINT COMMENT '是否通过',
    remark VARCHAR(500) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    create_by VARCHAR(64) COMMENT '创建人',
    update_by VARCHAR(64) COMMENT '更新人',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    INDEX idx_script_id (script_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批意见表';

CREATE TABLE IF NOT EXISTS execution_batch (
    id BIGINT PRIMARY KEY COMMENT '主键ID',
    script_id BIGINT NOT NULL COMMENT '脚本ID',
    batch_no VARCHAR(64) NOT NULL COMMENT '批次号',
    batch_type INT COMMENT '批次类型',
    start_time DATETIME COMMENT '开始时间',
    end_time DATETIME COMMENT '结束时间',
    affected_rows BIGINT COMMENT '影响行数',
    execution_log TEXT COMMENT '执行日志',
    status INT COMMENT '状态',
    operator VARCHAR(64) COMMENT '操作人',
    success TINYINT COMMENT '是否成功',
    error_message TEXT COMMENT '错误信息',
    remark VARCHAR(500) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    create_by VARCHAR(64) COMMENT '创建人',
    update_by VARCHAR(64) COMMENT '更新人',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    INDEX idx_script_id (script_id),
    INDEX idx_batch_no (batch_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='执行批次表';

CREATE TABLE IF NOT EXISTS rollback_record (
    id BIGINT PRIMARY KEY COMMENT '主键ID',
    script_id BIGINT NOT NULL COMMENT '脚本ID',
    execution_batch_id BIGINT NOT NULL COMMENT '执行批次ID',
    batch_no VARCHAR(64) NOT NULL COMMENT '批次号',
    rollback_proof TEXT COMMENT '回滚证明',
    rollback_script TEXT COMMENT '回滚脚本内容',
    rollback_time DATETIME COMMENT '回滚时间',
    rollback_rows BIGINT COMMENT '回滚行数',
    rollback_log TEXT COMMENT '回滚日志',
    success TINYINT COMMENT '是否成功',
    operator VARCHAR(64) COMMENT '操作人',
    remark VARCHAR(500) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    create_by VARCHAR(64) COMMENT '创建人',
    update_by VARCHAR(64) COMMENT '更新人',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    INDEX idx_script_id (script_id),
    INDEX idx_execution_batch_id (execution_batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='回滚记录表';

CREATE TABLE IF NOT EXISTS timeline_record (
    id BIGINT PRIMARY KEY COMMENT '主键ID',
    script_id BIGINT NOT NULL COMMENT '脚本ID',
    batch_id BIGINT COMMENT '批次ID',
    action INT COMMENT '动作类型',
    from_status INT COMMENT '原状态',
    to_status INT COMMENT '目标状态',
    operator VARCHAR(64) COMMENT '操作人',
    operator_dept VARCHAR(100) COMMENT '操作人部门',
    action_time DATETIME COMMENT '动作时间',
    remark VARCHAR(500) COMMENT '备注',
    detail TEXT COMMENT '详细信息',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    create_by VARCHAR(64) COMMENT '创建人',
    update_by VARCHAR(64) COMMENT '更新人',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    INDEX idx_script_id (script_id),
    INDEX idx_action_time (action_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='时间线记录表';
