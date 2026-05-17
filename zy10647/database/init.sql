-- 在线考试服务补考资格恢复 - 数据库初始化脚本

-- 考生表
CREATE TABLE IF NOT EXISTS examinees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    examinee_no VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    id_card VARCHAR(18) UNIQUE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    department VARCHAR(200),
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 考试表
CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_code VARCHAR(50) UNIQUE NOT NULL,
    exam_name VARCHAR(200) NOT NULL,
    exam_date DATE NOT NULL,
    exam_time_start TIME NOT NULL,
    exam_time_end TIME NOT NULL,
    exam_duration INTEGER NOT NULL,
    total_score DECIMAL(5,2) DEFAULT 100.00,
    pass_score DECIMAL(5,2) DEFAULT 60.00,
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 考生考试报名表（关联考生和考试）
CREATE TABLE IF NOT EXISTS exam_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    examinee_id INTEGER NOT NULL,
    exam_id INTEGER NOT NULL,
    registration_no VARCHAR(50) UNIQUE NOT NULL,
    exam_status TINYINT DEFAULT 0,
    actual_score DECIMAL(5,2),
    is_pass TINYINT DEFAULT 0,
    is_absent TINYINT DEFAULT 0,
    has_retaken TINYINT DEFAULT 0,
    retake_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (examinee_id) REFERENCES examinees(id),
    FOREIGN KEY (exam_id) REFERENCES exams(id),
    UNIQUE(examinee_id, exam_id)
);

-- 缺考原因字典表
CREATE TABLE IF NOT EXISTS absence_reasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reason_code VARCHAR(50) UNIQUE NOT NULL,
    reason_name VARCHAR(200) NOT NULL,
    description TEXT,
    need_proof TINYINT DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 补考资格恢复申请表
CREATE TABLE IF NOT EXISTS recovery_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_no VARCHAR(50) UNIQUE NOT NULL,
    registration_id INTEGER NOT NULL,
    examinee_id INTEGER NOT NULL,
    exam_id INTEGER NOT NULL,
    absence_reason_id INTEGER NOT NULL,
    reason_detail TEXT,
    status TINYINT DEFAULT 0,
    applicant_remark TEXT,
    reviewer_id INTEGER,
    reviewer_remark TEXT,
    review_time DATETIME,
    expire_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (registration_id) REFERENCES exam_registrations(id),
    FOREIGN KEY (examinee_id) REFERENCES examinees(id),
    FOREIGN KEY (exam_id) REFERENCES exams(id),
    FOREIGN KEY (absence_reason_id) REFERENCES absence_reasons(id)
);

-- 证明材料表
CREATE TABLE IF NOT EXISTS proof_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    material_name VARCHAR(200) NOT NULL,
    material_type VARCHAR(50),
    file_path VARCHAR(500),
    file_size INTEGER,
    upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES recovery_applications(id)
);

-- 操作历史表
CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    operator_type TINYINT NOT NULL,
    operator_id INTEGER,
    operator_name VARCHAR(100),
    operation_type VARCHAR(50) NOT NULL,
    old_status TINYINT,
    new_status TINYINT,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES recovery_applications(id)
);

-- 导入错误记录表
CREATE TABLE IF NOT EXISTS import_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no VARCHAR(50) NOT NULL,
    row_number INTEGER NOT NULL,
    row_data TEXT,
    error_message VARCHAR(500) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_registration_examinee ON exam_registrations(examinee_id);
CREATE INDEX IF NOT EXISTS idx_registration_exam ON exam_registrations(exam_id);
CREATE INDEX IF NOT EXISTS idx_application_registration ON recovery_applications(registration_id);
CREATE INDEX IF NOT EXISTS idx_application_status ON recovery_applications(status);
CREATE INDEX IF NOT EXISTS idx_application_examinee ON recovery_applications(examinee_id);
CREATE INDEX IF NOT EXISTS idx_logs_application ON operation_logs(application_id);

-- 插入缺考原因初始数据
INSERT INTO absence_reasons (reason_code, reason_name, description, need_proof, sort_order) VALUES
('HEALTH', '身体健康原因', '因突发疾病或身体健康问题无法参加考试', 1, 1),
('FAMILY', '家庭突发情况', '直系亲属重病、离世等家庭紧急情况', 1, 2),
('WORK', '工作紧急任务', '单位安排的紧急工作任务冲突', 1, 3),
('TRANSPORT', '交通意外', '公共交通延误或交通事故', 1, 4),
('OTHER', '其他特殊情况', '其他经认定的特殊原因', 1, 99);
