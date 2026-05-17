-- ============================================
-- 仓储WMS接口批次库存冻结释放系统
-- 初始化基础数据
-- ============================================

-- 初始化冻结原因
INSERT INTO freeze_reason (reason_code, reason_name, reason_type, description, sort_order) VALUES
('QUALITY_001', '待质检冻结', 'QUALITY', '商品到货待质检，临时冻结库存', 1),
('QUALITY_002', '质量问题复检', 'QUALITY', '发现质量问题，需要复检确认', 2),
('AUDIT_001', '审计抽查', 'AUDIT', '财务审计抽查冻结', 3),
('AUDIT_002', '库存盘点', 'AUDIT', '年度/月度库存盘点冻结', 4),
('ADJUST_001', '库存调整', 'ADJUST', '系统库存与实际库存差异调整', 5),
('EMERGENCY_001', '紧急召回', 'EMERGENCY', '产品安全问题紧急召回冻结', 6),
('EMERGENCY_002', '客户投诉', 'EMERGENCY', '重大客户投诉冻结相关批次', 7)
ON DUPLICATE KEY UPDATE reason_name = VALUES(reason_name);

-- 初始化SKU数据
INSERT INTO sku (sku_id, sku_name, category, unit, spec) VALUES
('SKU001', '华为Mate 60 Pro', '手机数码', '台', '12GB+512GB 雅川青'),
('SKU002', 'iPhone 15 Pro Max', '手机数码', '台', '256GB 原色钛金属'),
('SKU003', '小米14 Ultra', '手机数码', '台', '16GB+1TB 黑色'),
('SKU004', '农夫山泉天然水', '食品饮料', '箱', '550ml*24瓶'),
('SKU005', '蒙牛纯牛奶', '食品饮料', '箱', '250ml*16盒')
ON DUPLICATE KEY UPDATE sku_name = VALUES(sku_name);

-- 初始化批次库存数据
INSERT INTO batch_inventory (
    batch_id, sku_id, batch_no, warehouse_code, warehouse_name, location_code,
    production_date, expiry_date, supplier_code, supplier_name,
    total_qty, available_qty, frozen_qty, released_qty,
    quality_status, inventory_status
) VALUES
(
    'BATCH001', 'SKU001', 'B20240501001', 'WH001', '上海中心仓', 'A-01-01',
    '2024-05-01', '2026-04-30', 'SUP001', '华为科技有限公司',
    1000, 1000, 0, 0, 'PASSED', 'AVAILABLE'
),
(
    'BATCH002', 'SKU002', 'B20240502001', 'WH001', '上海中心仓', 'A-01-02',
    '2024-05-02', '2026-05-01', 'SUP002', '苹果中国有限公司',
    800, 800, 0, 0, 'PASSED', 'AVAILABLE'
),
(
    'BATCH003', 'SKU003', 'B20240503001', 'WH002', '北京顺义仓', 'B-02-03',
    '2024-05-03', '2026-05-02', 'SUP003', '小米科技有限公司',
    500, 500, 0, 0, 'PENDING', 'AVAILABLE'
),
(
    'BATCH004', 'SKU004', 'B20240504001', 'WH001', '上海中心仓', 'C-03-01',
    '2024-05-04', '2025-05-03', 'SUP004', '农夫山泉股份有限公司',
    2000, 2000, 0, 0, 'PASSED', 'AVAILABLE'
),
(
    'BATCH005', 'SKU005', 'B20240505001', 'WH002', '北京顺义仓', 'C-03-02',
    '2024-05-05', '2024-11-04', 'SUP005', '内蒙古蒙牛乳业集团',
    1500, 1500, 0, 0, 'PENDING', 'AVAILABLE'
)
ON DUPLICATE KEY UPDATE total_qty = VALUES(total_qty);
