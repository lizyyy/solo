-- 连锁门店临期调拨系统数据库模型

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    full_name VARCHAR(100),
    phone VARCHAR(20),
    store_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Stores table (门店)
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'store',
    address VARCHAR(300),
    phone VARCHAR(20),
    manager VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Products table (商品)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    bar_code VARCHAR(50),
    category VARCHAR(100),
    unit VARCHAR(20),
    spec VARCHAR(100),
    brand VARCHAR(100),
    original_price DECIMAL(10,2) DEFAULT 0,
    cost_price DECIMAL(10,2) DEFAULT 0,
    min_stock_level INTEGER DEFAULT 0,
    max_stock_level INTEGER DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1
);

-- Inventory Batches (库存批次 - 支持临期管理)
CREATE TABLE IF NOT EXISTS inventory_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    batch_no VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER NOT NULL DEFAULT 0,
    locked_quantity INTEGER DEFAULT 0,
    production_date DATE,
    expiry_date DATE,
    inbound_date DATE,
    supplier VARCHAR(100),
    purchase_price DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1,
    UNIQUE(store_id, product_id, batch_no)
);

-- Store Inventory (门店库存汇总)
CREATE TABLE IF NOT EXISTS store_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    total_quantity INTEGER DEFAULT 0,
    available_quantity INTEGER DEFAULT 0,
    locked_quantity INTEGER DEFAULT 0,
    expiring_soon_quantity INTEGER DEFAULT 0,
    expired_quantity INTEGER DEFAULT 0,
    last_inbound_date DATE,
    last_outbound_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1,
    UNIQUE(store_id, product_id)
);

-- Transfer Orders (调拨单)
CREATE TABLE IF NOT EXISTS transfer_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_no VARCHAR(50) UNIQUE NOT NULL,
    from_store_id UUID REFERENCES stores(id),
    to_store_id UUID REFERENCES stores(id),
    status VARCHAR(20) DEFAULT 'draft',
    priority VARCHAR(20) DEFAULT 'normal',
    transfer_type VARCHAR(20) DEFAULT 'normal',
    reason TEXT,
    remark TEXT,
    total_quantity INTEGER DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    shipped_by UUID REFERENCES users(id),
    shipped_at TIMESTAMP,
    received_by UUID REFERENCES users(id),
    received_at TIMESTAMP,
    rejected_by UUID REFERENCES users(id),
    rejected_at TIMESTAMP,
    reject_reason TEXT,
    cancelled_by UUID REFERENCES users(id),
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1
);

-- Transfer Order Items (调拨单明细)
CREATE TABLE IF NOT EXISTS transfer_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES transfer_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    batch_id UUID REFERENCES inventory_batches(id),
    requested_quantity INTEGER NOT NULL,
    shipped_quantity INTEGER DEFAULT 0,
    received_quantity INTEGER DEFAULT 0,
    rejected_quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(10,2) DEFAULT 0,
    amount DECIMAL(12,2) DEFAULT 0,
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock Lock Records (库存锁定记录)
CREATE TABLE IF NOT EXISTS stock_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id),
    product_id UUID REFERENCES products(id),
    batch_id UUID REFERENCES inventory_batches(id),
    quantity INTEGER NOT NULL,
    lock_type VARCHAR(20) NOT NULL,
    reference_type VARCHAR(20),
    reference_id UUID,
    reason TEXT,
    locked_by UUID REFERENCES users(id),
    unlocked_by UUID REFERENCES users(id),
    unlocked_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'locked',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Damage Reports (报损单)
CREATE TABLE IF NOT EXISTS damage_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_no VARCHAR(50) UNIQUE NOT NULL,
    store_id UUID REFERENCES stores(id),
    status VARCHAR(20) DEFAULT 'pending',
    total_quantity INTEGER DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    damage_type VARCHAR(20) DEFAULT 'normal',
    reason TEXT,
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    approved_status VARCHAR(20),
    approve_remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1
);

-- Damage Report Items (报损单明细)
CREATE TABLE IF NOT EXISTS damage_report_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES damage_reports(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    batch_id UUID REFERENCES inventory_batches(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) DEFAULT 0,
    amount DECIMAL(12,2) DEFAULT 0,
    damage_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discount Sales (折扣售卖)
CREATE TABLE IF NOT EXISTS discount_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_no VARCHAR(50) UNIQUE NOT NULL,
    store_id UUID REFERENCES stores(id),
    status VARCHAR(20) DEFAULT 'active',
    discount_type VARCHAR(20) DEFAULT 'percentage',
    discount_value DECIMAL(5,2) NOT NULL,
    min_quantity INTEGER DEFAULT 1,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discount Sale Items (折扣售卖商品)
CREATE TABLE IF NOT EXISTS discount_sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES discount_sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    batch_id UUID REFERENCES inventory_batches(id),
    original_price DECIMAL(10,2),
    discount_price DECIMAL(10,2),
    limit_quantity INTEGER DEFAULT 0,
    sold_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory tasks table (盘点任务 - 保留)
CREATE TABLE IF NOT EXISTS inventory_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'normal',
    created_by UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    scheduled_date DATE,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1
);

-- Inventory task items
CREATE TABLE IF NOT EXISTS inventory_task_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES inventory_tasks(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    batch_id UUID REFERENCES inventory_batches(id),
    expected_quantity INTEGER,
    actual_quantity INTEGER,
    difference INTEGER GENERATED ALWAYS AS (COALESCE(actual_quantity, 0) - COALESCE(expected_quantity, 0)) STORED,
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    counted_by UUID REFERENCES users(id),
    counted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Operation logs table (for audit trail)
CREATE TABLE IF NOT EXISTS operation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    store_id UUID,
    operation_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    before_data JSONB,
    after_data JSONB,
    request_id UUID,
    client_id UUID,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT
);

-- Synchronization queue table
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    operation_type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    error_message TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_operation_logs_timestamp ON operation_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_operation_logs_user_id ON operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_store_id ON operation_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_resource ON operation_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_store ON inventory_batches(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_product ON inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON inventory_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_status ON inventory_batches(status);

CREATE INDEX IF NOT EXISTS idx_store_inventory_store ON store_inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_store_inventory_product ON store_inventory(product_id);

CREATE INDEX IF NOT EXISTS idx_transfer_orders_from ON transfer_orders(from_store_id);
CREATE INDEX IF NOT EXISTS idx_transfer_orders_to ON transfer_orders(to_store_id);
CREATE INDEX IF NOT EXISTS idx_transfer_orders_status ON transfer_orders(status);
CREATE INDEX IF NOT EXISTS idx_transfer_orders_created ON transfer_orders(created_at);

CREATE INDEX IF NOT EXISTS idx_damage_reports_store ON damage_reports(store_id);
CREATE INDEX IF NOT EXISTS idx_damage_reports_status ON damage_reports(status);

CREATE INDEX IF NOT EXISTS idx_stock_locks_store ON stock_locks(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_locks_status ON stock_locks(status);
CREATE INDEX IF NOT EXISTS idx_stock_locks_reference ON stock_locks(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_discount_sales_store ON discount_sales(store_id);
CREATE INDEX IF NOT EXISTS idx_discount_sales_status ON discount_sales(status);
CREATE INDEX IF NOT EXISTS idx_discount_sales_dates ON discount_sales(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_inventory_tasks_status ON inventory_tasks(status);
CREATE INDEX IF NOT EXISTS idx_inventory_tasks_store ON inventory_tasks(store_id);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_batches_updated_at BEFORE UPDATE ON inventory_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_inventory_updated_at BEFORE UPDATE ON store_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transfer_orders_updated_at BEFORE UPDATE ON transfer_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_damage_reports_updated_at BEFORE UPDATE ON damage_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_tasks_updated_at BEFORE UPDATE ON inventory_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discount_sales_updated_at BEFORE UPDATE ON discount_sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-update batch status based on expiry date
CREATE OR REPLACE FUNCTION update_batch_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiry_date IS NOT NULL THEN
        IF NEW.expiry_date < CURRENT_DATE THEN
            NEW.status = 'expired';
        ELSIF (NEW.expiry_date - CURRENT_DATE) <= 30 THEN
            NEW.status = 'expiring_soon';
        ELSE
            NEW.status = 'normal';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_batch_status_trigger BEFORE INSERT OR UPDATE ON inventory_batches
    FOR EACH ROW EXECUTE FUNCTION update_batch_status();
