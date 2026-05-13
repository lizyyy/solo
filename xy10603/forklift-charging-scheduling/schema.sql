CREATE DATABASE IF NOT EXISTS forklift_charging DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE forklift_charging;

-- 充电桩表
CREATE TABLE IF NOT EXISTS charging_stations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    station_code VARCHAR(50) NOT NULL UNIQUE,
    station_name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    max_power INT NOT NULL DEFAULT 60,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    current_task_id BIGINT,
    health_score INT DEFAULT 100,
    last_maintenance_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 电池表
CREATE TABLE IF NOT EXISTS batteries (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    battery_code VARCHAR(50) NOT NULL UNIQUE,
    forklift_code VARCHAR(50),
    battery_type VARCHAR(50) DEFAULT 'LITHIUM',
    capacity_kwh DECIMAL(10,2) NOT NULL DEFAULT 80.00,
    current_soc INT NOT NULL DEFAULT 80,
    min_soc INT DEFAULT 20,
    health_status VARCHAR(20) NOT NULL DEFAULT 'GOOD',
    health_score INT DEFAULT 95,
    cycle_count INT DEFAULT 0,
    last_charge_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 作业波次表
CREATE TABLE IF NOT EXISTS work_waves (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    wave_code VARCHAR(50) NOT NULL UNIQUE,
    wave_name VARCHAR(100) NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    priority INT DEFAULT 5,
    status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    required_forklifts INT DEFAULT 5,
    actual_forklifts INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 充电任务表
CREATE TABLE IF NOT EXISTS charging_tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_code VARCHAR(50) NOT NULL UNIQUE,
    battery_id BIGINT NOT NULL,
    station_id BIGINT,
    wave_id BIGINT,
    priority INT DEFAULT 5,
    is_urgent BOOLEAN DEFAULT FALSE,
    target_soc INT DEFAULT 100,
    current_soc INT,
    estimated_start_time DATETIME,
    actual_start_time DATETIME,
    estimated_end_time DATETIME,
    actual_end_time DATETIME,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    assigned_operator VARCHAR(50),
    remarks VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 异常记录表
CREATE TABLE IF NOT EXISTS anomaly_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    anomaly_type VARCHAR(50) NOT NULL,
    anomaly_code VARCHAR(50),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    source VARCHAR(50),
    source_id BIGINT,
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    assigned_to VARCHAR(50),
    handled_at DATETIME,
    handled_by VARCHAR(50),
    handling_notes VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 变更历史表（用于记录修改前后值）
CREATE TABLE IF NOT EXISTS change_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    operation VARCHAR(20) NOT NULL,
    operator VARCHAR(50),
    remarks VARCHAR(200),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_operator (operator),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 导入批次表
CREATE TABLE IF NOT EXISTS import_batches (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_code VARCHAR(50) NOT NULL UNIQUE,
    file_name VARCHAR(200) NOT NULL,
    file_type VARCHAR(50),
    total_records INT DEFAULT 0,
    success_count INT DEFAULT 0,
    fail_count INT DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
    error_log TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    operation_type VARCHAR(50) NOT NULL,
    module VARCHAR(50),
    description VARCHAR(500),
    operator VARCHAR(50),
    ip_address VARCHAR(50),
    request_params TEXT,
    response_result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_operator (operator),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
