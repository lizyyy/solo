-- 灰度发布回滚系统数据库 Schema

CREATE DATABASE IF NOT EXISTS rollback_system DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE rollback_system;

-- 发布记录表
CREATE TABLE IF NOT EXISTS releases (
    id VARCHAR(36) PRIMARY KEY,
    service_name VARCHAR(255) NOT NULL,
    current_version VARCHAR(100) NOT NULL,
    target_version VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    total_instances INT NOT NULL DEFAULT 0,
    updated_instances INT NOT NULL DEFAULT 0,
    rollback_checkpoint TEXT,
    error_message TEXT,
    metadata TEXT,
    created_at DATETIME NOT NULL,
    started_at DATETIME,
    completed_at DATETIME,
    failed_at DATETIME,
    version BIGINT NOT NULL DEFAULT 0,
    INDEX idx_release_status (status),
    INDEX idx_service_name (service_name),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    operation_id VARCHAR(36) NOT NULL UNIQUE,
    release_id VARCHAR(36) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    before_state TEXT,
    after_state TEXT,
    status_before VARCHAR(50),
    status_after VARCHAR(50),
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    operator VARCHAR(255) NOT NULL,
    request_details TEXT,
    duration_ms BIGINT,
    created_at DATETIME NOT NULL,
    INDEX idx_log_release_id (release_id),
    INDEX idx_log_operation_type (operation_type),
    INDEX idx_log_created_at (created_at),
    INDEX idx_log_operation_id (operation_id),
    FOREIGN KEY (release_id) REFERENCES releases(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 幂等记录表
CREATE TABLE IF NOT EXISTS idempotent_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    idempotent_key VARCHAR(255) NOT NULL UNIQUE,
    release_id VARCHAR(36) NOT NULL,
    operation_type VARCHAR(100) NOT NULL,
    request_hash VARCHAR(255),
    response_data TEXT,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    expires_at DATETIME,
    INDEX idx_idempotent_key (idempotent_key),
    INDEX idx_idempotent_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
