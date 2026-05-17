-- ========================================
-- 积分商城库存预占释放系统 - 验收测试数据
-- ========================================

-- 场景1: 完整流转记录 - 预占 -> 支付 -> 兑换
-- 预占单: RES202605180001
INSERT INTO stock_reservations (reservation_no, product_id, product_code, member_id, member_no, quantity, points_amount, status, expired_at, created_at) VALUES
('RES202605180001', 1, 'P001', 1, 'M001', 1, 50000, 40, DATE_ADD(NOW(), INTERVAL 30 MINUTE), DATE_SUB(NOW(), INTERVAL 15 MINUTE));

-- 操作日志 - 完整流转
INSERT INTO stock_reservation_logs (reservation_id, reservation_no, operation_type, operation_desc, before_status, after_status, before_stock, after_stock, remark, operator, created_at) VALUES
(1, 'RES202605180001', 'CREATE', '创建预占单', NULL, 10, 
'{"total_stock": 100, "available_stock": 100, "reserved_stock": 0, "sold_stock": 0}', 
'{"total_stock": 100, "available_stock": 100, "reserved_stock": 0, "sold_stock": 0}', 
'用户发起兑换请求', 'system', DATE_SUB(NOW(), INTERVAL 15 MINUTE)),
(1, 'RES202605180001', 'RESERVE', '库存预占成功', 10, 20, 
'{"total_stock": 100, "available_stock": 100, "reserved_stock": 0, "sold_stock": 0}', 
'{"total_stock": 100, "available_stock": 99, "reserved_stock": 1, "sold_stock": 0}', 
'预占库存1件，有效期30分钟', 'system', DATE_SUB(NOW(), INTERVAL 14 MINUTE)),
(1, 'RES202605180001', 'EXCHANGE', '兑换成功', 20, 40, 
'{"total_stock": 100, "available_stock": 99, "reserved_stock": 1, "sold_stock": 0}', 
'{"total_stock": 100, "available_stock": 99, "reserved_stock": 0, "sold_stock": 1}', 
'支付成功，完成兑换', 'system', DATE_SUB(NOW(), INTERVAL 10 MINUTE));

-- 更新商品库存
UPDATE products SET available_stock = 99, reserved_stock = 0, sold_stock = 1 WHERE id = 1;

-- 创建兑换订单
INSERT INTO exchange_orders (order_no, reservation_id, reservation_no, product_id, product_code, member_id, member_no, quantity, points_amount, pay_status, pay_time, status, created_at) VALUES
('ORD202605180001', 1, 'RES202605180001', 1, 'P001', 1, 'M001', 1, 50000, 30, DATE_SUB(NOW(), INTERVAL 10 MINUTE), 30, DATE_SUB(NOW(), INTERVAL 10 MINUTE));

-- 更新会员积分
UPDATE members SET points_balance = 50000 WHERE id = 1;

-- =================================================================

-- 场景2: 冲突记录 - 支付失败网络异常，待人工处理
-- 预占单: RES202605180002
INSERT INTO stock_reservations (reservation_no, product_id, product_code, member_id, member_no, quantity, points_amount, status, release_reason_id, release_reason_code, release_remark, operator, expired_at, created_at) VALUES
('RES202605180002', 2, 'P002', 2, 'M002', 1, 15000, 50, 4, 'PAY_FAILED_NETWORK', '支付网关超时，扣款状态未知，请人工核实交易流水', 'system', DATE_ADD(NOW(), INTERVAL 25 MINUTE), DATE_SUB(NOW(), INTERVAL 5 MINUTE));

-- 操作日志 - 冲突记录
INSERT INTO stock_reservation_logs (reservation_id, reservation_no, operation_type, operation_desc, before_status, after_status, before_stock, after_stock, release_reason_id, release_reason_code, remark, operator, created_at) VALUES
(2, 'RES202605180002', 'CREATE', '创建预占单', NULL, 10, 
'{"total_stock": 200, "available_stock": 200, "reserved_stock": 0, "sold_stock": 0}', 
'{"total_stock": 200, "available_stock": 200, "reserved_stock": 0, "sold_stock": 0}', 
'用户发起兑换请求', 'system', DATE_SUB(NOW(), INTERVAL 5 MINUTE)),
(2, 'RES202605180002', 'RESERVE', '库存预占成功', 10, 20, 
'{"total_stock": 200, "available_stock": 200, "reserved_stock": 0, "sold_stock": 0}', 
'{"total_stock": 200, "available_stock": 199, "reserved_stock": 1, "sold_stock": 0}', 
'预占库存1件，有效期30分钟', 'system', DATE_SUB(NOW(), INTERVAL 4 MINUTE)),
(2, 'RES202605180002', 'RELEASE', '支付失败-网络异常', 20, 50, 
'{"total_stock": 200, "available_stock": 199, "reserved_stock": 1, "sold_stock": 0}', 
'{"total_stock": 200, "available_stock": 199, "reserved_stock": 1, "sold_stock": 0}', 
4, 'PAY_FAILED_NETWORK', 
'支付网关响应超时，交易状态不确定，转入人工处理队列。请联系支付方核实流水号:PAY20260518XXXX', 'system', DATE_SUB(NOW(), INTERVAL 2 MINUTE));

-- 商品库存保持预占状态（因为不确定支付是否成功）
UPDATE products SET available_stock = 199, reserved_stock = 1 WHERE id = 2;

-- 创建支付失败的订单
INSERT INTO exchange_orders (order_no, reservation_id, reservation_no, product_id, product_code, member_id, member_no, quantity, points_amount, pay_status, pay_fail_reason, status, created_at) VALUES
('ORD202605180002', 2, 'RES202605180002', 2, 'P002', 2, 'M002', 1, 15000, 20, '支付网关超时，响应码:504', 20, DATE_SUB(NOW(), INTERVAL 2 MINUTE));

-- =================================================================

-- 场景3: 导入坏行 - 重复预占检测
-- 预占单: RES202605180003 (正常预占)
INSERT INTO stock_reservations (reservation_no, product_id, product_code, member_id, member_no, quantity, points_amount, status, expired_at, created_at) VALUES
('RES202605180003', 3, 'P003', 3, 'M003', 1, 30000, 20, DATE_ADD(NOW(), INTERVAL 28 MINUTE), DATE_SUB(NOW(), INTERVAL 2 MINUTE));

-- 预占单: RES202605180004 (重复预占 - 同一会员同一商品短时间内多次预占)
INSERT INTO stock_reservations (reservation_no, product_id, product_code, member_id, member_no, quantity, points_amount, status, release_reason_id, release_reason_code, release_remark, operator, expired_at, created_at) VALUES
('RES202605180004', 3, 'P003', 3, 'M003', 1, 30000, 50, 9, 'DUPLICATE_RESERVATION', '检测到同一会员同一商品在1分钟内重复预占2次，请人工核实是否为误操作或系统异常', 'system', DATE_ADD(NOW(), INTERVAL 28 MINUTE), DATE_SUB(NOW(), INTERVAL 1 MINUTE));

-- 操作日志 - 重复预占
INSERT INTO stock_reservation_logs (reservation_id, reservation_no, operation_type, operation_desc, before_status, after_status, before_stock, after_stock, release_reason_id, release_reason_code, remark, operator, created_at) VALUES
(3, 'RES202605180003', 'CREATE', '创建预占单', NULL, 10, 
'{"total_stock": 50, "available_stock": 50, "reserved_stock": 0, "sold_stock": 0}', 
'{"total_stock": 50, "available_stock": 50, "reserved_stock": 0, "sold_stock": 0}', 
'用户发起兑换请求', 'system', DATE_SUB(NOW(), INTERVAL 2 MINUTE)),
(3, 'RES202605180003', 'RESERVE', '库存预占成功', 10, 20, 
'{"total_stock": 50, "available_stock": 50, "reserved_stock": 0, "sold_stock": 0}', 
'{"total_stock": 50, "available_stock": 49, "reserved_stock": 1, "sold_stock": 0}', 
'预占库存1件，有效期30分钟', 'system', DATE_SUB(NOW(), INTERVAL 2 MINUTE)),
(4, 'RES202605180004', 'CREATE', '创建预占单', NULL, 10, 
'{"total_stock": 50, "available_stock": 49, "reserved_stock": 1, "sold_stock": 0}', 
'{"total_stock": 50, "available_stock": 49, "reserved_stock": 1, "sold_stock": 0}', 
'用户发起兑换请求（重复请求）', 'system', DATE_SUB(NOW(), INTERVAL 1 MINUTE)),
(4, 'RES202605180004', 'RESERVE', '库存预占成功（重复）', 10, 20, 
'{"total_stock": 50, "available_stock": 49, "reserved_stock": 1, "sold_stock": 0}', 
'{"total_stock": 50, "available_stock": 48, "reserved_stock": 2, "sold_stock": 0}', 
'预占库存1件，有效期30分钟', 'system', DATE_SUB(NOW(), INTERVAL 1 MINUTE)),
(4, 'RES202605180004', 'RELEASE', '重复预占检测', 20, 50, 
'{"total_stock": 50, "available_stock": 48, "reserved_stock": 2, "sold_stock": 0}', 
'{"total_stock": 50, "available_stock": 48, "reserved_stock": 2, "sold_stock": 0}', 
9, 'DUPLICATE_RESERVATION', 
'检测到会员M003在60秒内对商品P003发起2次预占请求，疑似重复提交。首次预占单号:RES202605180003', 'system', DATE_SUB(NOW(), INTERVAL 30 SECOND));

-- 商品库存 - 重复预占导致多扣了1件
UPDATE products SET available_stock = 48, reserved_stock = 2 WHERE id = 3;

-- =================================================================

-- 场景4: 已释放记录（用于列表展示）
INSERT INTO stock_reservations (reservation_no, product_id, product_code, member_id, member_no, quantity, points_amount, status, release_reason_id, release_reason_code, release_remark, operator, expired_at, released_at, created_at) VALUES
('RES202605180005', 4, 'P004', 4, 'M004', 1, 25000, 30, 1, 'USER_CANCEL', '用户主动取消兑换', 'M004', DATE_ADD(NOW(), INTERVAL 20 MINUTE), DATE_SUB(NOW(), INTERVAL 1 MINUTE), DATE_SUB(NOW(), INTERVAL 8 MINUTE));

INSERT INTO stock_reservation_logs (reservation_id, reservation_no, operation_type, operation_desc, before_status, after_status, before_stock, after_stock, release_reason_id, release_reason_code, remark, operator, created_at) VALUES
(5, 'RES202605180005', 'CREATE', '创建预占单', NULL, 10, 
'{"total_stock": 80, "available_stock": 80, "reserved_stock": 0, "sold_stock": 0}', 
'{"total_stock": 80, "available_stock": 80, "reserved_stock": 0, "sold_stock": 0}', 
'用户发起兑换请求', 'system', DATE_SUB(NOW(), INTERVAL 8 MINUTE)),
(5, 'RES202605180005', 'RESERVE', '库存预占成功', 10, 20, 
'{"total_stock": 80, "available_stock": 80, "reserved_stock": 0, "sold_stock": 0}', 
'{"total_stock": 80, "available_stock": 79, "reserved_stock": 1, "sold_stock": 0}', 
'预占库存1件，有效期30分钟', 'system', DATE_SUB(NOW(), INTERVAL 7 MINUTE)),
(5, 'RES202605180005', 'RELEASE', '用户取消兑换', 20, 30, 
'{"total_stock": 80, "available_stock": 79, "reserved_stock": 1, "sold_stock": 0}', 
'{"total_stock": 80, "available_stock": 80, "reserved_stock": 0, "sold_stock": 0}', 
1, 'USER_CANCEL', '用户在个人中心主动取消兑换', 'M004', DATE_SUB(NOW(), INTERVAL 1 MINUTE));

UPDATE products SET available_stock = 80, reserved_stock = 0 WHERE id = 4;
