CREATE TABLE IF NOT EXISTS business_process (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    process_id VARCHAR(64) NOT NULL UNIQUE,
    process_name VARCHAR(128) NOT NULL,
    service_name VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    total_nodes INT DEFAULT 0,
    failed_nodes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS failed_node (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    process_id VARCHAR(64) NOT NULL,
    node_id VARCHAR(64) NOT NULL,
    node_name VARCHAR(128) NOT NULL,
    service_name VARCHAR(64) NOT NULL,
    error_code VARCHAR(64),
    error_message TEXT,
    failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(32) NOT NULL,
    UNIQUE KEY uk_process_node (process_id, node_id)
);

CREATE TABLE IF NOT EXISTS compensation_instruction (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    instruction_id VARCHAR(64) NOT NULL UNIQUE,
    process_id VARCHAR(64) NOT NULL,
    node_id VARCHAR(64) NOT NULL,
    instruction_type VARCHAR(32) NOT NULL,
    instruction_content TEXT NOT NULL,
    execution_order INT NOT NULL,
    require_manual_confirm BOOLEAN DEFAULT FALSE,
    status VARCHAR(32) NOT NULL,
    retry_count INT DEFAULT 0,
    max_retry INT DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compensation_execution (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    instruction_id VARCHAR(64) NOT NULL,
    execution_id VARCHAR(64) NOT NULL UNIQUE,
    executor VARCHAR(64),
    executed_at TIMESTAMP,
    execution_result VARCHAR(32),
    result_detail TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compensation_summary (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    process_id VARCHAR(64) NOT NULL UNIQUE,
    total_instructions INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    pending_count INT DEFAULT 0,
    manual_confirmed_count INT DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    overall_status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
