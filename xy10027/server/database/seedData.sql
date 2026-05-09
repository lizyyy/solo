-- 测试数据初始化脚本
-- 密码: password123 (bcrypt哈希)

-- 创建默认用户
INSERT INTO users (id, username, password, email, full_name, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    '$2a$10$EixZaY3s7vjRjMRC/.R6/.wG8x1Q5ZJz4YWK5jR5eK5eK5eK5eK5e',
    'admin@example.com',
    '系统管理员',
    'admin'
) ON CONFLICT (username) DO NOTHING;

INSERT INTO users (id, username, password, email, full_name, role)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'user1',
    '$2a$10$EixZaY3s7vjRjMRC/.R6/.wG8x1Q5ZJz4YWK5jR5eK5eK5eK5eK5e',
    'user1@example.com',
    '盘点员张三',
    'user'
) ON CONFLICT (username) DO NOTHING;

INSERT INTO users (id, username, password, email, full_name, role)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    'user2',
    '$2a$10$EixZaY3s7vjRjMRC/.R6/.wG8x1Q5ZJz4YWK5jR5eK5eK5eK5eK5e',
    'user2@example.com',
    '盘点员李四',
    'user'
) ON CONFLICT (username) DO NOTHING;

-- 创建仓库
INSERT INTO warehouses (id, name, location, description, created_by)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    '主仓库A',
    '北京市朝阳区建国路88号',
    '公司主要存储仓库',
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

INSERT INTO warehouses (id, name, location, description, created_by)
VALUES (
    '10000000-0000-0000-0000-000000000002',
    '分仓库B',
    '上海市浦东新区张江高科',
    '华东地区分发中心',
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- 创建库存商品
INSERT INTO inventory_items (id, sku, name, description, category, unit, min_stock_level, max_stock_level)
VALUES 
(
    '20000000-0000-0000-0000-000000000001',
    'SKU001',
    '笔记本电脑',
    '15.6寸商务笔记本',
    '电子产品',
    '台',
    10,
    100
) ON CONFLICT DO NOTHING;

INSERT INTO inventory_items (id, sku, name, description, category, unit, min_stock_level, max_stock_level)
VALUES 
(
    '20000000-0000-0000-0000-000000000002',
    'SKU002',
    '无线鼠标',
    '蓝牙无线办公鼠标',
    '电子产品',
    '个',
    50,
    500
) ON CONFLICT DO NOTHING;

INSERT INTO inventory_items (id, sku, name, description, category, unit, min_stock_level, max_stock_level)
VALUES 
(
    '20000000-0000-0000-0000-000000000003',
    'SKU003',
    '机械键盘',
    '青轴机械键盘',
    '电子产品',
    '个',
    20,
    200
) ON CONFLICT DO NOTHING;

INSERT INTO inventory_items (id, sku, name, description, category, unit, min_stock_level, max_stock_level)
VALUES 
(
    '20000000-0000-0000-0000-000000000004',
    'SKU004',
    '显示器',
    '27寸4K显示器',
    '电子产品',
    '台',
    15,
    150
) ON CONFLICT DO NOTHING;

INSERT INTO inventory_items (id, sku, name, description, category, unit, min_stock_level, max_stock_level)
VALUES 
(
    '20000000-0000-0000-0000-000000000005',
    'SKU005',
    'USB集线器',
    '4口USB3.0集线器',
    '电子产品',
    '个',
    100,
    1000
) ON CONFLICT DO NOTHING;

-- 创建库存位置
INSERT INTO inventory_locations (warehouse_id, item_id, location_code, quantity)
VALUES 
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'A-01-01', 45)
ON CONFLICT DO NOTHING;

INSERT INTO inventory_locations (warehouse_id, item_id, location_code, quantity)
VALUES 
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'A-01-02', 234)
ON CONFLICT DO NOTHING;

INSERT INTO inventory_locations (warehouse_id, item_id, location_code, quantity)
VALUES 
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'A-02-01', 89)
ON CONFLICT DO NOTHING;

INSERT INTO inventory_locations (warehouse_id, item_id, location_code, quantity)
VALUES 
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'A-02-02', 56)
ON CONFLICT DO NOTHING;

INSERT INTO inventory_locations (warehouse_id, item_id, location_code, quantity)
VALUES 
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', 'A-03-01', 567)
ON CONFLICT DO NOTHING;

-- 创建示例盘点任务
INSERT INTO inventory_tasks (id, warehouse_id, name, description, status, priority, created_by, assigned_to, scheduled_date)
VALUES (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '2024年11月月度盘点',
    '主仓库A月度例行盘点',
    'pending',
    'high',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    CURRENT_DATE
) ON CONFLICT DO NOTHING;

-- 创建盘点任务项
INSERT INTO inventory_task_items (task_id, item_id, expected_quantity, status)
VALUES 
('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 45, 'pending'),
('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 234, 'pending'),
('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 89, 'pending'),
('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 56, 'pending'),
('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', 567, 'pending')
ON CONFLICT DO NOTHING;
