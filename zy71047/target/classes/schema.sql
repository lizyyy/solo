CREATE TABLE IF NOT EXISTS farm (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    farm_code VARCHAR(50) NOT NULL UNIQUE,
    farm_name VARCHAR(200) NOT NULL,
    address VARCHAR(500),
    contact_person VARCHAR(100),
    contact_phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ear_tag (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tag_no VARCHAR(100) NOT NULL UNIQUE,
    cattle_type VARCHAR(50),
    breed VARCHAR(100),
    gender VARCHAR(10),
    birth_date DATE,
    origin_farm_id BIGINT,
    current_farm_id BIGINT,
    status VARCHAR(50) DEFAULT 'NORMAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (origin_farm_id) REFERENCES farm(id),
    FOREIGN KEY (current_farm_id) REFERENCES farm(id)
);

CREATE TABLE IF NOT EXISTS quarantine_certificate (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    certificate_no VARCHAR(100) NOT NULL UNIQUE,
    issuing_authority VARCHAR(200),
    issue_date DATE NOT NULL,
    expire_date DATE NOT NULL,
    farm_id BIGINT,
    cattle_count INT NOT NULL,
    status VARCHAR(50) DEFAULT 'VALID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farm_id) REFERENCES farm(id)
);

CREATE TABLE IF NOT EXISTS transport_vehicle (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    plate_no VARCHAR(50) NOT NULL UNIQUE,
    driver_name VARCHAR(100),
    driver_phone VARCHAR(50),
    vehicle_type VARCHAR(100),
    capacity INT,
    status VARCHAR(50) DEFAULT 'AVAILABLE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transfer_order (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transfer_no VARCHAR(100) NOT NULL UNIQUE,
    source_farm_id BIGINT NOT NULL,
    target_farm_id BIGINT NOT NULL,
    certificate_id BIGINT,
    vehicle_id BIGINT,
    planned_quantity INT NOT NULL,
    actual_quantity INT,
    transfer_date DATE,
    status VARCHAR(50) DEFAULT 'DRAFT',
    remark VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    FOREIGN KEY (source_farm_id) REFERENCES farm(id),
    FOREIGN KEY (target_farm_id) REFERENCES farm(id),
    FOREIGN KEY (certificate_id) REFERENCES quarantine_certificate(id),
    FOREIGN KEY (vehicle_id) REFERENCES transport_vehicle(id)
);

CREATE TABLE IF NOT EXISTS transfer_ear_tag (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transfer_id BIGINT NOT NULL,
    ear_tag_id BIGINT NOT NULL,
    tag_no VARCHAR(100) NOT NULL,
    is_duplicate BOOLEAN DEFAULT FALSE,
    duplicate_within_order BOOLEAN DEFAULT FALSE,
    duplicate_across_order BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transfer_id) REFERENCES transfer_order(id),
    FOREIGN KEY (ear_tag_id) REFERENCES ear_tag(id)
);

CREATE TABLE IF NOT EXISTS transfer_validation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transfer_id BIGINT NOT NULL,
    validation_type VARCHAR(100),
    validation_result VARCHAR(50),
    message VARCHAR(1000),
    suggestion VARCHAR(1000),
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(100),
    resolution_note VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transfer_id) REFERENCES transfer_order(id)
);

CREATE TABLE IF NOT EXISTS acceptance_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transfer_id BIGINT NOT NULL,
    acceptance_no VARCHAR(100) NOT NULL UNIQUE,
    acceptance_time TIMESTAMP NOT NULL,
    accepted_quantity INT NOT NULL,
    difference_quantity INT,
    difference_reason VARCHAR(1000),
    status VARCHAR(50) DEFAULT 'PENDING',
    acceptor VARCHAR(100),
    remark VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transfer_id) REFERENCES transfer_order(id)
);

CREATE TABLE IF NOT EXISTS acceptance_tag (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    acceptance_id BIGINT NOT NULL,
    transfer_ear_tag_id BIGINT,
    tag_no VARCHAR(100) NOT NULL,
    is_matched BOOLEAN DEFAULT FALSE,
    is_extra BOOLEAN DEFAULT FALSE,
    is_missing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (acceptance_id) REFERENCES acceptance_record(id),
    FOREIGN KEY (transfer_ear_tag_id) REFERENCES transfer_ear_tag(id)
);

CREATE TABLE IF NOT EXISTS operation_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transfer_id BIGINT,
    operator VARCHAR(100),
    operation VARCHAR(200),
    old_value TEXT,
    new_value TEXT,
    remark VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transfer_id) REFERENCES transfer_order(id)
);

CREATE TABLE IF NOT EXISTS transfer_report (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_no VARCHAR(100) NOT NULL UNIQUE,
    transfer_id BIGINT NOT NULL,
    report_type VARCHAR(50),
    report_content TEXT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by VARCHAR(100),
    FOREIGN KEY (transfer_id) REFERENCES transfer_order(id)
);
