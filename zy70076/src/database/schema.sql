CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    total_budget DECIMAL(15, 2) NOT NULL DEFAULT 0,
    used_budget DECIMAL(15, 2) NOT NULL DEFAULT 0,
    locked_budget DECIMAL(15, 2) NOT NULL DEFAULT 0,
    available_budget DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id),
    position VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS travel_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    department_id UUID NOT NULL REFERENCES departments(id),
    purpose TEXT NOT NULL,
    destination VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    estimated_amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL',
    approval_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    exceeds_budget BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS budget_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    travel_request_id UUID NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id),
    locked_amount DECIMAL(15, 2) NOT NULL,
    lock_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP,
    UNIQUE (travel_request_id, lock_type)
);

CREATE TABLE IF NOT EXISTS travel_modifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    travel_request_id UUID NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
    original_estimated_amount DECIMAL(15, 2) NOT NULL,
    new_estimated_amount DECIMAL(15, 2) NOT NULL,
    amount_difference DECIMAL(15, 2) NOT NULL,
    change_reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reimbursements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    travel_request_id UUID NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id),
    department_id UUID NOT NULL REFERENCES departments(id),
    estimated_amount DECIMAL(15, 2) NOT NULL,
    actual_amount DECIMAL(15, 2) NOT NULL,
    amount_difference DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budget_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID NOT NULL REFERENCES departments(id),
    related_request_id UUID,
    operation_type VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    before_total_budget DECIMAL(15, 2),
    after_total_budget DECIMAL(15, 2),
    before_used_budget DECIMAL(15, 2),
    after_used_budget DECIMAL(15, 2),
    before_locked_budget DECIMAL(15, 2),
    after_locked_budget DECIMAL(15, 2),
    before_available_budget DECIMAL(15, 2),
    after_available_budget DECIMAL(15, 2),
    operation_result VARCHAR(50) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    operator_id UUID,
    operator_name VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_travel_requests_status ON travel_requests(status);
CREATE INDEX IF NOT EXISTS idx_budget_locks_request ON budget_locks(travel_request_id);
CREATE INDEX IF NOT EXISTS idx_budget_operations_department ON budget_operations(department_id);
CREATE INDEX IF NOT EXISTS idx_budget_operations_request ON budget_operations(related_request_id);

CREATE OR REPLACE FUNCTION update_department_budget_versions()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.version = OLD.version + 1;
    NEW.available_budget = NEW.total_budget - NEW.used_budget - NEW.locked_budget;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_department_budget ON departments;
CREATE TRIGGER trigger_update_department_budget
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_department_budget_versions();

CREATE OR REPLACE FUNCTION update_travel_request_versions()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_travel_request ON travel_requests;
CREATE TRIGGER trigger_update_travel_request
    BEFORE UPDATE ON travel_requests
    FOR EACH ROW EXECUTE FUNCTION update_travel_request_versions();
