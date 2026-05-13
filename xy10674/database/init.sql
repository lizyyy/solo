-- 托盘循环押金赔付系统数据库初始化脚本

CREATE DATABASE IF NOT EXISTS pallet_deposit DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE pallet_deposit;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 托盘编码表
CREATE TABLE IF NOT EXISTS pallet_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pallet_code VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    type VARCHAR(50) NOT NULL,
    batch_no VARCHAR(50),
    deposit_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 供应商表
CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_code VARCHAR(50) NOT NULL UNIQUE,
    supplier_name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(50),
    contact_phone VARCHAR(20),
    address VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 门店表
CREATE TABLE IF NOT EXISTS stores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_code VARCHAR(50) NOT NULL UNIQUE,
    store_name VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    contact_person VARCHAR(50),
    contact_phone VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 供应商交接表
CREATE TABLE IF NOT EXISTS supplier_handovers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    handover_no VARCHAR(50) NOT NULL UNIQUE,
    supplier_id INT NOT NULL,
    pallet_code_id INT NOT NULL,
    handover_date DATE NOT NULL,
    handover_quantity INT NOT NULL,
    handover_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    deposit_amount DECIMAL(10, 2) NOT NULL,
    verified_by INT,
    verified_at TIMESTAMP NULL,
    remark TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (pallet_code_id) REFERENCES pallet_codes(id),
    FOREIGN KEY (verified_by) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 门店回收表
CREATE TABLE IF NOT EXISTS store_collections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    collection_no VARCHAR(50) NOT NULL UNIQUE,
    store_id INT NOT NULL,
    pallet_code_id INT NOT NULL,
    collection_date DATE NOT NULL,
    collection_quantity INT NOT NULL,
    damaged_quantity INT NOT NULL DEFAULT 0,
    collection_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    verified_by INT,
    verified_at TIMESTAMP NULL,
    remark TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (pallet_code_id) REFERENCES pallet_codes(id),
    FOREIGN KEY (verified_by) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 破损照片表
CREATE TABLE IF NOT EXISTS damage_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_collection_id INT NOT NULL,
    photo_url VARCHAR(255) NOT NULL,
    photo_description TEXT,
    damage_level VARCHAR(20) NOT NULL,
    reviewed_by INT,
    review_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    review_comment TEXT,
    reviewed_at TIMESTAMP NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (store_collection_id) REFERENCES store_collections(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 押金流水表
CREATE TABLE IF NOT EXISTS deposit_flows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    flow_no VARCHAR(50) NOT NULL UNIQUE,
    flow_type VARCHAR(20) NOT NULL,
    related_type VARCHAR(50) NOT NULL,
    related_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    flow_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    blocked_reason TEXT,
    processed_by INT,
    processed_at TIMESTAMP NULL,
    remark TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (processed_by) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_related (related_type, related_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 回收任务表
CREATE TABLE IF NOT EXISTS collection_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_no VARCHAR(50) NOT NULL UNIQUE,
    store_id INT NOT NULL,
    pallet_code_id INT NOT NULL,
    target_quantity INT NOT NULL,
    completed_quantity INT NOT NULL DEFAULT 0,
    task_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    assigned_to INT,
    due_date DATE,
    completed_at TIMESTAMP NULL,
    remark TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (pallet_code_id) REFERENCES pallet_codes(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 修改历史表
CREATE TABLE IF NOT EXISTS modification_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INT NOT NULL,
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    modified_by INT NOT NULL,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    operation_type VARCHAR(20) NOT NULL,
    reason TEXT,
    FOREIGN KEY (modified_by) REFERENCES users(id),
    INDEX idx_record (table_name, record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    operation VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL,
    record_id INT,
    detail TEXT,
    ip_address VARCHAR(50),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 初始化测试数据
INSERT INTO users (username, name, role, password_hash) VALUES
('admin', '系统管理员', 'admin', '$2b$10$example_hash'),
('operator1', '操作员张三', 'operator', '$2b$10$example_hash'),
('reviewer1', '审核员李四', 'reviewer', '$2b$10$example_hash'),
('finance1', '财务王五', 'finance', '$2b$10$example_hash');

INSERT INTO suppliers (supplier_code, supplier_name, contact_person, contact_phone) VALUES
('SUP001', '托盘供应商A', '张经理', '13800138001'),
('SUP002', '托盘供应商B', '李经理', '13800138002');

INSERT INTO stores (store_code, store_name, address, contact_person, contact_phone) VALUES
('STORE001', '朝阳门店', '北京市朝阳区', '王店长', '13900139001'),
('STORE002', '海淀门店', '北京市海淀区', '赵店长', '13900139002');

INSERT INTO pallet_codes (pallet_code, status, type, batch_no, deposit_amount, created_by) VALUES
('PAL001', 'active', '标准托盘', 'BATCH202401', 50.00, 1),
('PAL002', 'active', '重型托盘', 'BATCH202401', 80.00, 1),
('PAL003', 'active', '轻型托盘', 'BATCH202402', 30.00, 1);
