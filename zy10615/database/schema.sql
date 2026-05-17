-- ============================================
-- 仓储WMS接口批次库存冻结释放系统
-- 数据库表结构设计
-- ============================================

-- 1. SKU主表
CREATE TABLE IF NOT EXISTS sku (
    sku_id VARCHAR(64) PRIMARY KEY COMMENT 'SKU编码',
    sku_name VARCHAR(255) NOT NULL COMMENT 'SKU名称',
    category VARCHAR(128) COMMENT '商品分类',
    unit VARCHAR(32) DEFAULT '件' COMMENT '单位',
    spec VARCHAR(255) COMMENT '规格',
    is_active TINYINT DEFAULT 1 COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_sku_name (sku_name),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SKU主表';

-- 2. 批次库存表
CREATE TABLE IF NOT EXISTS batch_inventory (
    batch_id VARCHAR(64) PRIMARY KEY COMMENT '批次ID',
    sku_id VARCHAR(64) NOT NULL COMMENT 'SKU编码',
    batch_no VARCHAR(128) NOT NULL COMMENT '批次号',
    warehouse_code VARCHAR(64) NOT NULL COMMENT '仓库编码',
    warehouse_name VARCHAR(128) COMMENT '仓库名称',
    location_code VARCHAR(64) COMMENT '库位编码',
    production_date DATE COMMENT '生产日期',
    expiry_date DATE COMMENT '有效期至',
    supplier_code VARCHAR(64) COMMENT '供应商编码',
    supplier_name VARCHAR(128) COMMENT '供应商名称',
    total_qty DECIMAL(18,4) DEFAULT 0 COMMENT '总库存数量',
    available_qty DECIMAL(18,4) DEFAULT 0 COMMENT '可用数量',
    frozen_qty DECIMAL(18,4) DEFAULT 0 COMMENT '冻结数量',
    released_qty DECIMAL(18,4) DEFAULT 0 COMMENT '已释放数量',
    quality_status VARCHAR(32) DEFAULT 'PENDING' COMMENT '质检状态：PENDING-待质检 PASSED-已通过 FAILED-已失败',
    inventory_status VARCHAR(32) DEFAULT 'AVAILABLE' COMMENT '库存状态：AVAILABLE-可用 FROZEN-冻结中 RELEASE_AUDIT-释放审核中 RELEASED-已释放',
    is_locked TINYINT DEFAULT 0 COMMENT '是否被锁定',
    lock_reason VARCHAR(255) COMMENT '锁定原因',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_sku_batch_warehouse (sku_id, batch_no, warehouse_code),
    INDEX idx_sku_id (sku_id),
    INDEX idx_batch_no (batch_no),
    INDEX idx_warehouse_code (warehouse_code),
    INDEX idx_inventory_status (inventory_status),
    INDEX idx_quality_status (quality_status),
    INDEX idx_expiry_date (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='批次库存表';

-- 3. 冻结原因配置表
CREATE TABLE IF NOT EXISTS freeze_reason (
    reason_code VARCHAR(64) PRIMARY KEY COMMENT '原因编码',
    reason_name VARCHAR(255) NOT NULL COMMENT '原因名称',
    reason_type VARCHAR(64) NOT NULL COMMENT '原因类型：QUALITY-质量问题 AUDIT-审计需要 ADJUST-库存调整 EMERGENCY-紧急冻结',
    description TEXT COMMENT '原因描述',
    is_active TINYINT DEFAULT 1 COMMENT '是否启用',
    sort_order INT DEFAULT 0 COMMENT '排序',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_reason_type (reason_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='冻结原因配置表';

-- 4. 库存冻结记录表
CREATE TABLE IF NOT EXISTS inventory_freeze (
    freeze_id VARCHAR(64) PRIMARY KEY COMMENT '冻结记录ID',
    freeze_no VARCHAR(128) NOT NULL UNIQUE COMMENT '冻结单号',
    sku_id VARCHAR(64) NOT NULL COMMENT 'SKU编码',
    batch_id VARCHAR(64) NOT NULL COMMENT '批次ID',
    batch_no VARCHAR(128) NOT NULL COMMENT '批次号',
    warehouse_code VARCHAR(64) NOT NULL COMMENT '仓库编码',
    reason_code VARCHAR(64) NOT NULL COMMENT '冻结原因编码',
    reason_name VARCHAR(255) COMMENT '冻结原因名称',
    freeze_qty DECIMAL(18,4) NOT NULL COMMENT '冻结数量',
    freeze_operator VARCHAR(64) COMMENT '冻结操作人',
    freeze_time DATETIME COMMENT '冻结时间',
    freeze_remark TEXT COMMENT '冻结备注',
    evidence_attachments JSON COMMENT '冻结证据附件（JSON数组）',
    status VARCHAR(32) DEFAULT 'FROZEN' COMMENT '状态：FROZEN-冻结中 RELEASE_AUDIT-释放审核中 RELEASED-已释放 PARTIAL_RELEASED-部分释放',
    release_audit_operator VARCHAR(64) COMMENT '释放审核人',
    release_audit_time DATETIME COMMENT '释放审核时间',
    release_audit_remark TEXT COMMENT '释放审核备注',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_freeze_no (freeze_no),
    INDEX idx_sku_id (sku_id),
    INDEX idx_batch_id (batch_id),
    INDEX idx_warehouse_code (warehouse_code),
    INDEX idx_reason_code (reason_code),
    INDEX idx_status (status),
    INDEX idx_freeze_time (freeze_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存冻结记录表';

-- 5. 释放凭证表
CREATE TABLE IF NOT EXISTS release_voucher (
    voucher_id VARCHAR(64) PRIMARY KEY COMMENT '凭证ID',
    voucher_no VARCHAR(128) NOT NULL UNIQUE COMMENT '释放凭证号',
    freeze_id VARCHAR(64) NOT NULL COMMENT '冻结记录ID',
    freeze_no VARCHAR(128) NOT NULL COMMENT '冻结单号',
    sku_id VARCHAR(64) NOT NULL COMMENT 'SKU编码',
    batch_id VARCHAR(64) NOT NULL COMMENT '批次ID',
    release_qty DECIMAL(18,4) NOT NULL COMMENT '释放数量',
    release_type VARCHAR(64) NOT NULL COMMENT '释放类型：FULL-全部释放 PARTIAL-部分释放',
    release_reason VARCHAR(255) COMMENT '释放原因',
    release_operator VARCHAR(64) COMMENT '释放操作人',
    release_time DATETIME COMMENT '释放时间',
    release_remark TEXT COMMENT '释放备注',
    evidence_attachments JSON COMMENT '释放证据附件（JSON数组）',
    related_order_no VARCHAR(128) COMMENT '关联单号',
    related_order_type VARCHAR(64) COMMENT '关联单类型',
    status VARCHAR(32) DEFAULT 'COMPLETED' COMMENT '状态：AUDITING-审核中 COMPLETED-已完成 CANCELLED-已取消',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_voucher_no (voucher_no),
    INDEX idx_freeze_id (freeze_id),
    INDEX idx_freeze_no (freeze_no),
    INDEX idx_sku_id (sku_id),
    INDEX idx_release_time (release_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='释放凭证表';

-- 6. 库存快照表（过程追踪）
CREATE TABLE IF NOT EXISTS inventory_snapshot (
    snapshot_id VARCHAR(64) PRIMARY KEY COMMENT '快照ID',
    batch_id VARCHAR(64) NOT NULL COMMENT '批次ID',
    sku_id VARCHAR(64) NOT NULL COMMENT 'SKU编码',
    batch_no VARCHAR(128) NOT NULL COMMENT '批次号',
    warehouse_code VARCHAR(64) NOT NULL COMMENT '仓库编码',
    total_qty DECIMAL(18,4) DEFAULT 0 COMMENT '总库存数量',
    available_qty DECIMAL(18,4) DEFAULT 0 COMMENT '可用数量',
    frozen_qty DECIMAL(18,4) DEFAULT 0 COMMENT '冻结数量',
    released_qty DECIMAL(18,4) DEFAULT 0 COMMENT '已释放数量',
    inventory_status VARCHAR(32) COMMENT '库存状态',
    action_type VARCHAR(64) NOT NULL COMMENT '操作类型：FREEZE-冻结 RELEASE-释放 CONFLICT-冲突 IMPORT-导入 EXPORT-导出',
    action_id VARCHAR(64) COMMENT '操作关联ID（冻结ID/释放ID等）',
    action_no VARCHAR(128) COMMENT '操作单号',
    operator VARCHAR(64) COMMENT '操作人',
    action_time DATETIME COMMENT '操作时间',
    action_remark TEXT COMMENT '操作备注',
    before_snapshot JSON COMMENT '操作前快照',
    after_snapshot JSON COMMENT '操作后快照',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_batch_id (batch_id),
    INDEX idx_sku_id (sku_id),
    INDEX idx_action_type (action_type),
    INDEX idx_action_time (action_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存快照表';

-- 7. 冲突记录表
CREATE TABLE IF NOT EXISTS inventory_conflict (
    conflict_id VARCHAR(64) PRIMARY KEY COMMENT '冲突ID',
    conflict_no VARCHAR(128) NOT NULL UNIQUE COMMENT '冲突编号',
    conflict_type VARCHAR(64) NOT NULL COMMENT '冲突类型：QUALITY_SALES-质检未完成被销售单占用 INVENTORY_SHORTAGE-库存不足 DOUBLE_FREEZE-重复冻结',
    sku_id VARCHAR(64) NOT NULL COMMENT 'SKU编码',
    batch_id VARCHAR(64) NOT NULL COMMENT '批次ID',
    batch_no VARCHAR(128) NOT NULL COMMENT '批次号',
    warehouse_code VARCHAR(64) NOT NULL COMMENT '仓库编码',
    related_order_no VARCHAR(128) COMMENT '关联单号（销售单号/冻结单号）',
    related_order_type VARCHAR(64) COMMENT '关联单类型',
    conflict_qty DECIMAL(18,4) COMMENT '冲突数量',
    quality_status VARCHAR(32) COMMENT '质检状态',
    conflict_detail TEXT COMMENT '冲突详情',
    handler VARCHAR(64) COMMENT '处理人',
    handle_time DATETIME COMMENT '处理时间',
    handle_remark TEXT COMMENT '处理备注',
    handle_result VARCHAR(32) DEFAULT 'PENDING' COMMENT '处理结果：PENDING-待处理 RESOLVED-已解决 IGNORED-已忽略',
    status VARCHAR(32) DEFAULT 'OPEN' COMMENT '状态：OPEN-打开 CLOSED-关闭',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_conflict_no (conflict_no),
    INDEX idx_conflict_type (conflict_type),
    INDEX idx_sku_id (sku_id),
    INDEX idx_batch_id (batch_id),
    INDEX idx_handle_result (handle_result),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='冲突记录表';

-- 8. 导入导出记录表
CREATE TABLE IF NOT EXISTS import_export_log (
    log_id VARCHAR(64) PRIMARY KEY COMMENT '日志ID',
    batch_no VARCHAR(128) NOT NULL UNIQUE COMMENT '导入导出批次号',
    operate_type VARCHAR(32) NOT NULL COMMENT '操作类型：IMPORT-导入 EXPORT-导出',
    business_type VARCHAR(64) NOT NULL COMMENT '业务类型：FREEZE-冻结 RELEASE-释放 INVENTORY-库存',
    file_name VARCHAR(255) COMMENT '文件名',
    file_path VARCHAR(512) COMMENT '文件路径',
    file_size BIGINT COMMENT '文件大小（字节）',
    total_count INT DEFAULT 0 COMMENT '总记录数',
    success_count INT DEFAULT 0 COMMENT '成功数',
    fail_count INT DEFAULT 0 COMMENT '失败数',
    error_details JSON COMMENT '错误详情（JSON数组）',
    operator VARCHAR(64) COMMENT '操作人',
    operate_time DATETIME COMMENT '操作时间',
    status VARCHAR(32) DEFAULT 'PROCESSING' COMMENT '状态：PROCESSING-处理中 COMPLETED-完成 FAILED-失败',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_batch_no (batch_no),
    INDEX idx_operate_type (operate_type),
    INDEX idx_business_type (business_type),
    INDEX idx_operate_time (operate_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='导入导出记录表';

-- 9. 操作历史表
CREATE TABLE IF NOT EXISTS operation_history (
    history_id VARCHAR(64) PRIMARY KEY COMMENT '历史ID',
    business_type VARCHAR(64) NOT NULL COMMENT '业务类型：FREEZE-冻结 RELEASE-释放 CONFLICT-冲突',
    business_id VARCHAR(64) NOT NULL COMMENT '业务ID',
    business_no VARCHAR(128) COMMENT '业务单号',
    action VARCHAR(64) NOT NULL COMMENT '操作动作',
    before_data JSON COMMENT '变更前数据',
    after_data JSON COMMENT '变更后数据',
    operator VARCHAR(64) COMMENT '操作人',
    operate_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    remark TEXT COMMENT '备注',
    INDEX idx_business (business_type, business_id),
    INDEX idx_business_no (business_no),
    INDEX idx_operate_time (operate_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作历史表';
