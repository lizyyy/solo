-- ========================================
-- 积分商城库存预占释放系统 - 初始化数据
-- ========================================

-- 1. 插入商品数据
INSERT INTO products (product_code, product_name, points_price, total_stock, available_stock, reserved_stock, sold_stock, status) VALUES
('P001', 'iPhone 15 Pro 256G', 50000, 100, 100, 0, 0, 1),
('P002', 'AirPods Pro 2', 15000, 200, 200, 0, 0, 1),
('P003', 'Apple Watch Series 9', 30000, 50, 50, 0, 0, 1),
('P004', 'iPad 10.9寸 64G', 25000, 80, 80, 0, 0, 1),
('P005', 'MacBook Air M2', 80000, 30, 30, 0, 0, 1),
('P006', '限定版蓝牙耳机', 5000, 0, 0, 0, 0, 1),
('P007', '限量纪念徽章', 1000, 10, 10, 0, 0, 1);

-- 2. 插入会员数据
INSERT INTO members (member_no, member_name, phone, points_balance, status) VALUES
('M001', '张三', '13800138001', 100000, 1),
('M002', '李四', '13800138002', 50000, 1),
('M003', '王五', '13800138003', 20000, 1),
('M004', '赵六', '13800138004', 80000, 1),
('M005', '测试用户', '13800138999', 0, 1);

-- 3. 插入释放原因数据
INSERT INTO release_reasons (reason_code, reason_name, reason_type, need_manual, description, sort_order, status) VALUES
('USER_CANCEL', '用户主动取消', 2, 0, '用户在有效期内主动取消预约', 1, 1),
('PAY_TIMEOUT', '支付超时', 1, 0, '用户未在规定时间内完成支付', 2, 1),
('PAY_FAILED_INSUFFICIENT', '支付失败-积分不足', 3, 0, '会员积分余额不足以支付订单', 3, 1),
('PAY_FAILED_NETWORK', '支付失败-网络异常', 3, 1, '支付过程中发生网络异常，状态未知，需要人工核实', 4, 1),
('PAY_FAILED_SYSTEM', '支付失败-系统错误', 3, 1, '支付系统内部错误，需要人工处理', 5, 1),
('EXPIRED_AUTO', '过期自动释放', 1, 0, '预占单超过有效期自动释放', 6, 1),
('MANUAL_RELEASE', '人工释放', 4, 0, '客服手动释放库存', 7, 1),
('INVENTORY_DISPUTE', '库存争议', 4, 1, '库存数量不一致，需要人工核对', 8, 1),
('DUPLICATE_RESERVATION', '重复预占', 3, 1, '检测到重复预占记录，需要人工处理', 9, 1);
