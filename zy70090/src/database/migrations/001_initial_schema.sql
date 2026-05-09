-- 初始数据库表结构设计
-- 核心设计原则：
-- 1. 所有操作都有日志记录
-- 2. 所有状态变更都有时间戳
-- 3. 数量和照片都有校验机制
-- 4. 支持幂等操作和重试

-- 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 操作人员表
CREATE TABLE IF NOT EXISTS operators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    real_name VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'operator', -- operator, supervisor, admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_operators_username ON operators(username);
CREATE INDEX IF NOT EXISTS idx_operators_department ON operators(department);

-- 扣押清单表（核心业务表）
CREATE TABLE IF NOT EXISTS seized_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number VARCHAR(50) UNIQUE NOT NULL, -- 案件编号
    case_name VARCHAR(200) NOT NULL, -- 案件名称
    seized_date TIMESTAMP WITH TIME ZONE NOT NULL, -- 扣押日期
    item_name VARCHAR(200) NOT NULL, -- 物品名称
    item_description TEXT, -- 物品描述
    quantity INTEGER NOT NULL CHECK (quantity > 0), -- 数量（核心字段
    unit VARCHAR(20), -- 单位
    estimated_value NUMERIC(15,2), -- 估值
    seized_location VARCHAR(500), -- 扣押地点
    seized_by VARCHAR(100) NOT NULL, -- 扣押人
    seized_department VARCHAR(100), -- 扣押部门
    item_owner_name VARCHAR(100), -- 物品所有人
    item_owner_id_card VARCHAR(50), -- 所有人身份证号
    item_owner_phone VARCHAR(20), -- 所有人电话
    item_owner_address TEXT, -- 所有人地址
    current_status VARCHAR(20) NOT NULL DEFAULT 'seized', -- seized(扣押中, sealed(封存), transferred(已移交), returned(已退还), returned_pending(待审批退还)
    is_photo_verified BOOLEAN DEFAULT FALSE, -- 照片是否已校验
    photo_required INTEGER DEFAULT 0, -- 需要的照片数量
    photo_uploaded INTEGER DEFAULT 0, -- 已上传照片数量
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES operators(id),
    last_updated_by UUID REFERENCES operators(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_seized_items_case_number ON seized_items(case_number);
CREATE INDEX IF NOT EXISTS idx_seized_items_current_status ON seized_items(current_status);
CREATE INDEX IF NOT EXISTS idx_seized_items_seized_date ON seized_items(seized_date);
CREATE INDEX IF NOT EXISTS idx_seized_items_item_owner_name ON seized_items(item_owner_name);

-- 物品照片表
CREATE TABLE IF NOT EXISTS item_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seized_item_id UUID NOT NULL REFERENCES seized_items(id) ON DELETE CASCADE,
    photo_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    photo_type VARCHAR(20) NOT NULL, -- seized(扣押时), sealed(封存时), transferred(移交时), returned(退还时)
    upload_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    uploaded_by UUID REFERENCES operators(id),
    is_verified BOOLEAN DEFAULT FALSE, -- 是否通过校验
    verification_time TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES operators(id),
    verification_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_item_photos_seized_item ON item_photos(seized_item_id);
CREATE INDEX IF NOT EXISTS idx_item_photos_upload_time ON item_photos(upload_time);

-- 封存记录表
CREATE TABLE IF NOT EXISTS seal_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seized_item_id UUID NOT NULL REFERENCES seized_items(id) ON DELETE CASCADE,
    seal_number VARCHAR(50) UNIQUE NOT NULL, -- 封条编号
    seal_date TIMESTAMP WITH TIME ZONE NOT NULL,
    seal_location VARCHAR(500), -- 封存地点
    sealed_by UUID REFERENCES operators(id),
    sealed_department VARCHAR(100),
    seal_quantity INTEGER NOT NULL CHECK (seal_quantity > 0), -- 封存数量
    seal_status VARCHAR(20) NOT NULL DEFAULT 'sealed', -- sealed(已封存), unsealed(已解封)
    unseal_date TIMESTAMP WITH TIME ZONE,
    unsealed_by UUID REFERENCES operators(id),
    unseal_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seal_records_seized_item ON seal_records(seized_item_id);
CREATE INDEX IF NOT EXISTS idx_seal_records_seal_number ON seal_records(seal_number);
CREATE INDEX IF NOT EXISTS idx_seal_records_status ON seal_records(seal_status);

-- 移交记录表
CREATE TABLE IF NOT EXISTS transfer_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seized_item_id UUID NOT NULL REFERENCES seized_items(id) ON DELETE CASCADE,
    transfer_number VARCHAR(50) UNIQUE NOT NULL, -- 移交编号
    transfer_date TIMESTAMP WITH TIME ZONE NOT NULL,
    transfer_quantity INTEGER NOT NULL CHECK (transfer_quantity > 0), -- 移交数量
    from_department VARCHAR(100) NOT NULL, -- 移交部门
    from_operator UUID REFERENCES operators(id), -- 移交人
    to_department VARCHAR(100) NOT NULL, -- 接收部门
    to_operator UUID REFERENCES operators(id), -- 接收人
    transfer_reason TEXT,
    transfer_status VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- in_progress(进行中), completed(已完成), failed(失败), cancelled(已取消)
    confirmation_time TIMESTAMP WITH TIME ZONE,
    confirmed_by UUID REFERENCES operators(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfer_records_seized_item ON transfer_records(seized_item_id);
CREATE INDEX IF NOT EXISTS idx_transfer_records_transfer_number ON transfer_records(transfer_number);
CREATE INDEX IF NOT EXISTS idx_transfer_records_status ON transfer_records(transfer_status);

-- 退还审批表
CREATE TABLE IF NOT EXISTS return_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seized_item_id UUID NOT NULL REFERENCES seized_items(id) ON DELETE CASCADE,
    approval_number VARCHAR(50) UNIQUE NOT NULL, -- 审批编号
    application_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    applicant UUID REFERENCES operators(id), -- 申请人
    return_quantity INTEGER NOT NULL CHECK (return_quantity > 0), -- 退还数量
    return_reason TEXT NOT NULL,
    recipient_name VARCHAR(100) NOT NULL,
    recipient_id_card VARCHAR(50),
    recipient_phone VARCHAR(20),
    approval_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending(待审批), approved(已批准), rejected(已拒绝), returned(已退还)
    approver UUID REFERENCES operators(id), -- 审批人
    approval_time TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,
    rejection_reason TEXT,
    actual_return_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_return_approvals_seized_item ON return_approvals(seized_item_id);
CREATE INDEX IF NOT EXISTS idx_return_approvals_status ON return_approvals(approval_status);
CREATE INDEX IF NOT EXISTS idx_return_approvals_application_date ON return_approvals(application_date);

-- 操作日志表（记录所有关键操作）
CREATE TABLE IF NOT EXISTS operation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operator_id UUID REFERENCES operators(id),
    operator_name VARCHAR(100),
    operation_type VARCHAR(50) NOT NULL, -- create, update, delete, seal, unseal, transfer, approve, reject, upload_photo, verify_photo, export
    target_type VARCHAR(50) NOT NULL, -- seized_item, seal_record, transfer_record, return_approval, photo
    target_id UUID,
    old_value JSONB,
    new_value JSONB,
    operation_notes TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_operator ON operation_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_operation_type ON operation_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_operation_logs_target ON operation_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at);

-- 后台任务队列表
CREATE TABLE IF NOT EXISTS background_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type VARCHAR(50) NOT NULL,
    job_name VARCHAR(200) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
    priority INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 5,
    error_message TEXT,
    last_run_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_created_at ON background_jobs(created_at);

-- 导入导出记录表
CREATE TABLE IF NOT EXISTS export_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    export_type VARCHAR(50) NOT NULL, -- ledger(台账), photos(照片汇总
    export_format VARCHAR(10) NOT NULL, -- csv, excel, pdf
    export_criteria JSONB,
    file_path VARCHAR(500),
    file_size BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'processing', -- processing, completed, failed
    error_message TEXT,
    requested_by UUID REFERENCES operators(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_export_records_status ON export_records(status);
CREATE INDEX IF NOT EXISTS idx_export_records_created_at ON export_records(created_at);

-- 照片校验记录表
CREATE TABLE IF NOT EXISTS photo_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seized_item_id UUID NOT NULL REFERENCES seized_items(id) ON DELETE CASCADE,
    photo_id UUID REFERENCES item_photos(id),
    verification_type VARCHAR(20) NOT NULL, -- quantity(数量校验), content(内容校验), consistency(一致性校验)
    verification_result VARCHAR(20) NOT NULL, -- passed, failed, warning
    verification_notes TEXT,
    verified_by UUID REFERENCES operators(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_photo_verifications_seized_item ON photo_verifications(seized_item_id);
CREATE INDEX IF NOT EXISTS idx_photo_verifications_result ON photo_verifications(verification_result);

-- 幂等请求记录表（防止重复请求
CREATE TABLE IF NOT EXISTS idempotent_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_key VARCHAR(100) UNIQUE NOT NULL,
    request_type VARCHAR(50) NOT NULL,
    request_body JSONB,
    response_body JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    operator_id UUID REFERENCES operators(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_idempotent_requests_key ON idempotent_requests(request_key);
CREATE INDEX IF NOT EXISTS idx_idempotent_requests_expires ON idempotent_requests(expires_at);
