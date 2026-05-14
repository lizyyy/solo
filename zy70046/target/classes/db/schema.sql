-- 外协加工入库验收服务 数据库建表脚本
-- 适用于需要手动建表的场景
-- 执行顺序：先执行本脚本建表，再执行 init.sql 插入初始数据

CREATE DATABASE IF NOT EXISTS outsourcing_inspection 
    DEFAULT CHARACTER SET utf8mb4 
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE outsourcing_inspection;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    real_name VARCHAR(50) NOT NULL,
    email VARCHAR(50),
    phone VARCHAR(20),
    role VARCHAR(20),
    enabled BIT(1) NOT NULL DEFAULT b'1',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 供应商表
CREATE TABLE IF NOT EXISTS suppliers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    supplier_code VARCHAR(50) NOT NULL UNIQUE,
    supplier_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(20),
    contact_phone VARCHAR(20),
    address VARCHAR(500),
    remark TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_suppliers_code (supplier_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 外协订单表
CREATE TABLE IF NOT EXISTS outsourcing_orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(50) NOT NULL UNIQUE,
    supplier_id BIGINT NOT NULL,
    product_code VARCHAR(100) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    order_quantity DECIMAL(18,2) NOT NULL,
    unit_price DECIMAL(18,4) NOT NULL,
    total_amount DECIMAL(20,2) NOT NULL,
    order_date DATE NOT NULL,
    delivery_deadline DATE,
    order_status VARCHAR(20),
    remark TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    delivered_quantity DECIMAL(18,2) DEFAULT 0.00,
    qualified_quantity DECIMAL(18,2) DEFAULT 0.00,
    unqualified_quantity DECIMAL(18,2) DEFAULT 0.00,
    replenishment_quantity DECIMAL(18,2) DEFAULT 0.00,
    deduction_amount DECIMAL(20,2) DEFAULT 0.00,
    INDEX idx_orders_no (order_no),
    INDEX idx_orders_supplier (supplier_id),
    INDEX idx_orders_status (order_status),
    CONSTRAINT fk_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 到货批次表
CREATE TABLE IF NOT EXISTS delivery_batches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_no VARCHAR(50) NOT NULL UNIQUE,
    order_id BIGINT NOT NULL,
    delivery_quantity DECIMAL(18,2) NOT NULL,
    delivery_date DATE NOT NULL,
    delivery_person VARCHAR(100),
    waybill_no VARCHAR(50),
    batch_status VARCHAR(20),
    remark TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    qualified_quantity DECIMAL(18,2) DEFAULT 0.00,
    unqualified_quantity DECIMAL(18,2) DEFAULT 0.00,
    deduction_amount DECIMAL(20,2) DEFAULT 0.00,
    replenishment_quantity DECIMAL(18,2) DEFAULT 0.00,
    process_description VARCHAR(500),
    INDEX idx_batches_no (batch_no),
    INDEX idx_batches_order (order_id),
    INDEX idx_batches_status (batch_status),
    CONSTRAINT fk_batches_order FOREIGN KEY (order_id) REFERENCES outsourcing_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 验收结果表
CREATE TABLE IF NOT EXISTS inspection_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    result_no VARCHAR(50) NOT NULL UNIQUE,
    batch_id BIGINT NOT NULL,
    inspector VARCHAR(50) NOT NULL,
    inspection_time DATETIME NOT NULL,
    sample_quantity DECIMAL(18,2),
    qualified_sample DECIMAL(18,2),
    qualified_quantity DECIMAL(18,2),
    unqualified_quantity DECIMAL(18,2),
    inspection_conclusion VARCHAR(20),
    defect_description TEXT,
    inspection_remark TEXT,
    processing_suggestion VARCHAR(20),
    result_status VARCHAR(20),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    compensation_step VARCHAR(50),
    compensation_error TEXT,
    compensation_retry_count INT DEFAULT 0,
    INDEX idx_inspection_no (result_no),
    INDEX idx_inspection_batch (batch_id),
    INDEX idx_inspection_status (result_status),
    INDEX idx_compensation_step (compensation_step),
    CONSTRAINT fk_inspection_batch FOREIGN KEY (batch_id) REFERENCES delivery_batches(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 扣款规则表
CREATE TABLE IF NOT EXISTS deduction_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_code VARCHAR(50) NOT NULL,
    rule_name VARCHAR(200) NOT NULL,
    supplier_id BIGINT,
    defect_type VARCHAR(20),
    calculation_method VARCHAR(20),
    min_rate DECIMAL(18,4),
    max_rate DECIMAL(18,4),
    fixed_amount DECIMAL(20,2),
    threshold_quantity DECIMAL(18,2),
    description TEXT,
    is_active BIT(1) NOT NULL DEFAULT b'1',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_rules_code (rule_code),
    INDEX idx_rules_supplier (supplier_id),
    INDEX idx_rules_active (is_active),
    CONSTRAINT fk_rules_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 扣款记录表
CREATE TABLE IF NOT EXISTS deduction_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    record_no VARCHAR(50) NOT NULL UNIQUE,
    inspection_id BIGINT NOT NULL,
    rule_id BIGINT,
    order_id BIGINT NOT NULL,
    batch_id BIGINT NOT NULL,
    supplier_id BIGINT NOT NULL,
    defect_type VARCHAR(20),
    defective_quantity DECIMAL(18,2),
    deduction_amount DECIMAL(20,2) NOT NULL,
    deduction_method VARCHAR(20),
    deduction_reason TEXT,
    record_status VARCHAR(20),
    approval_remark TEXT,
    approver VARCHAR(50),
    approved_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    failure_reason TEXT,
    retry_description TEXT,
    retry_count INT DEFAULT 0,
    INDEX idx_deduction_no (record_no),
    INDEX idx_deduction_inspection (inspection_id),
    INDEX idx_deduction_order (order_id),
    INDEX idx_deduction_batch (batch_id),
    INDEX idx_deduction_supplier (supplier_id),
    INDEX idx_deduction_status (record_status),
    CONSTRAINT fk_deduction_inspection FOREIGN KEY (inspection_id) REFERENCES inspection_results(id),
    CONSTRAINT fk_deduction_rule FOREIGN KEY (rule_id) REFERENCES deduction_rules(id),
    CONSTRAINT fk_deduction_order FOREIGN KEY (order_id) REFERENCES outsourcing_orders(id),
    CONSTRAINT fk_deduction_batch FOREIGN KEY (batch_id) REFERENCES delivery_batches(id),
    CONSTRAINT fk_deduction_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 补货任务表
CREATE TABLE IF NOT EXISTS replenishment_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_no VARCHAR(50) NOT NULL UNIQUE,
    order_id BIGINT NOT NULL,
    batch_id BIGINT NOT NULL,
    inspection_id BIGINT NOT NULL,
    supplier_id BIGINT NOT NULL,
    required_quantity DECIMAL(18,2) NOT NULL,
    received_quantity DECIMAL(18,2) DEFAULT 0.00,
    remaining_quantity DECIMAL(18,2),
    required_date DATE,
    actual_delivery_date DATE,
    task_status VARCHAR(20),
    handler VARCHAR(50),
    task_description TEXT,
    supplier_response TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    failure_reason TEXT,
    retry_description TEXT,
    retry_count INT DEFAULT 0,
    INDEX idx_replenishment_no (task_no),
    INDEX idx_replenishment_order (order_id),
    INDEX idx_replenishment_batch (batch_id),
    INDEX idx_replenishment_inspection (inspection_id),
    INDEX idx_replenishment_supplier (supplier_id),
    INDEX idx_replenishment_status (task_status),
    CONSTRAINT fk_replenishment_order FOREIGN KEY (order_id) REFERENCES outsourcing_orders(id),
    CONSTRAINT fk_replenishment_batch FOREIGN KEY (batch_id) REFERENCES delivery_batches(id),
    CONSTRAINT fk_replenishment_inspection FOREIGN KEY (inspection_id) REFERENCES inspection_results(id),
    CONSTRAINT fk_replenishment_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NOT NULL,
    entity_no VARCHAR(100),
    operator VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    from_status VARCHAR(20),
    to_status VARCHAR(20),
    detail TEXT,
    summary VARCHAR(200),
    success BIT(1) NOT NULL,
    error_message TEXT,
    before_data LONGTEXT,
    after_data LONGTEXT,
    created_at DATETIME NOT NULL,
    request_trace VARCHAR(500),
    INDEX idx_log_entity (entity_type, entity_id),
    INDEX idx_log_entity_no (entity_no),
    INDEX idx_log_operator (operator),
    INDEX idx_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
