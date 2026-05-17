-- ============ 测试数据脚本 ============
-- 包含：1.完整流转测试 2.冲突记录测试 3.导入坏行测试

-- ============ 1. 基础数据 ============

-- 插入主播数据
INSERT INTO anchors (anchor_id, anchor_name, anchor_phone, room_id, room_name, platform) VALUES
('a0000000-0000-0000-0000-000000000001', '李佳琪', '13800000001', 'ROOM001', '李佳琪直播间', 'douyin'),
('a0000000-0000-0000-0000-000000000002', '薇娅', '13800000002', 'ROOM002', '薇娅直播间', 'douyin'),
('a0000000-0000-0000-0000-000000000003', '辛巴', '13800000003', 'ROOM003', '辛巴直播间', 'kuaishou');

-- 插入撤回原因
INSERT INTO withdraw_reasons (reason_code, reason_name, reason_desc, sort_order) VALUES
('PRICE_ERROR', '价格设置错误', '优惠券面额或使用门槛设置错误', 1),
('INVENTORY_SHORTAGE', '库存不足', '商品库存不足无法兑现', 2),
('ACTIVITY_CANCELLED', '活动取消', '直播活动临时取消', 3),
('RULE_VIOLATION', '违规使用', '发现用户违规领券', 4),
('OTHER', '其他原因', '其他需要撤回的情况', 99);

-- ============ 2. 完整流转测试场景 ============
-- 批次BATCH001：待发放 -> 已发放 -> 撤回中 -> 已失效
-- 包含：用户已领券但主播要求整批撤回的边界场景

-- 插入优惠券批次（待发放状态）
INSERT INTO coupon_batches (
    batch_id, batch_no, batch_name, anchor_id,
    coupon_type, coupon_value, min_spend,
    total_count, distributed_count, used_count, withdrawn_count,
    valid_start_time, valid_end_time,
    status, scope_type, remark, created_by
) VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'BATCH001',
    '618直播间专属满减券-完整流转测试',
    'a0000000-0000-0000-0000-000000000001',
    'reduce', 50.00, 299.00,
    100, 50, 5, 0,
    '2024-06-01 00:00:00', '2024-06-30 23:59:59',
    'distributed', 'all_users',
    '完整流转测试批次：已发放50张，已使用5张',
    'admin'
);

-- 插入发放范围
INSERT INTO distribution_scopes (batch_id, scope_type, target_count) VALUES
('b0000000-0000-0000-0000-000000000001', 'all_users', 100);

-- 插入优惠券记录（50张已发放，其中5张已使用）
INSERT INTO coupon_records (record_id, batch_id, coupon_code, user_id, user_phone, user_nickname, status, distribute_time, use_time, order_no)
SELECT 
    'r0000000-0000-0000-0000-' || LPAD(i::text, 12, '0'),
    'b0000000-0000-0000-0000-000000000001',
    'BATCH001-' || LPAD(i::text, 6, '0'),
    'USER' || LPAD(i::text, 4, '0'),
    '138' || LPAD(i::text, 8, '0'),
    '用户' || i,
    CASE WHEN i <= 5 THEN 'used' ELSE 'distributed' END,
    '2024-06-05 10:00:00'::timestamp + (i * interval '1 minute'),
    CASE WHEN i <= 5 THEN '2024-06-10 15:00:00'::timestamp + (i * interval '5 minute') ELSE NULL END,
    CASE WHEN i <= 5 THEN 'ORDER' || LPAD(i::text, 8, '0') ELSE NULL END
FROM generate_series(1, 50) i;

-- 插入50张待发放的优惠券记录
INSERT INTO coupon_records (record_id, batch_id, coupon_code, status)
SELECT 
    'r0000000-0000-0000-0001-' || LPAD(i::text, 11, '0'),
    'b0000000-0000-0000-0000-000000000001',
    'BATCH001-' || LPAD((i + 50)::text, 6, '0'),
    'pending'
FROM generate_series(1, 50) i;

-- 模拟撤回操作：整批撤回（包含已使用的冲突场景）
INSERT INTO withdraw_operations (
    operation_id, batch_id, reason_id, reason_remark,
    operator, operator_name, status,
    total_count, success_count, fail_count,
    fail_details, started_at, completed_at
) VALUES (
    'w0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    (SELECT reason_id FROM withdraw_reasons WHERE reason_code = 'PRICE_ERROR'),
    '面额设置错误，原本应该是满299减30，实际设置成了减50',
    'admin', '系统管理员',
    'partial',
    100, 95, 5,
    '[{"record_id": "r0000000-0000-0000-0000-000000000001", "coupon_code": "BATCH001-000001", "user_id": "USER0001", "reason": "优惠券已使用，无法撤回"}, {"record_id": "r0000000-0000-0000-0000-000000000002", "coupon_code": "BATCH001-000002", "user_id": "USER0002", "reason": "优惠券已使用，无法撤回"}, {"record_id": "r0000000-0000-0000-0000-000000000003", "coupon_code": "BATCH001-000003", "user_id": "USER0003", "reason": "优惠券已使用，无法撤回"}, {"record_id": "r0000000-0000-0000-0000-000000000004", "coupon_code": "BATCH001-000004", "user_id": "USER0004", "reason": "优惠券已使用，无法撤回"}, {"record_id": "r0000000-0000-0000-0000-000000000005", "coupon_code": "BATCH001-000005", "user_id": "USER0005", "reason": "优惠券已使用，无法撤回"}]'::jsonb,
    '2024-06-15 09:00:00',
    '2024-06-15 09:05:00'
);

-- 更新批次状态为撤回中
UPDATE coupon_batches SET status = 'withdrawing', withdrawn_count = 95, updated_by = 'admin'
WHERE batch_id = 'b0000000-0000-0000-0000-000000000001';

-- 更新可撤回的优惠券状态为已撤回
UPDATE coupon_records 
SET status = 'withdrawn', withdraw_time = '2024-06-15 09:05:00'
WHERE batch_id = 'b0000000-0000-0000-0000-000000000001' 
  AND status IN ('pending', 'distributed');

-- 插入操作日志
INSERT INTO operation_logs (operation_type, batch_id, operator, operator_name, before_status, after_status, remark) VALUES
('batch_create', 'b0000000-0000-0000-0000-000000000001', 'admin', '系统管理员', NULL, 'pending', '创建优惠券批次'),
('batch_distribute', 'b0000000-0000-0000-0000-000000000001', 'admin', '系统管理员', 'pending', 'distributed', '发放优惠券50张'),
('batch_withdraw', 'b0000000-0000-0000-0000-000000000001', 'admin', '系统管理员', 'distributed', 'withdrawing', '发起整批撤回，成功95张，失败5张（已使用）');

-- ============ 3. 冲突记录测试场景 ============
-- 批次BATCH002：演示撤回冲突 - 同一张券被多次撤回请求

INSERT INTO coupon_batches (
    batch_id, batch_no, batch_name, anchor_id,
    coupon_type, coupon_value, min_spend,
    total_count, distributed_count, used_count, withdrawn_count,
    valid_start_time, valid_end_time,
    status, scope_type, remark, created_by
) VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'BATCH002',
    '双11专属折扣券-冲突测试',
    'a0000000-0000-0000-0000-000000000002',
    'discount', 0.80, 0.00,
    500, 200, 0, 0,
    '2024-11-01 00:00:00', '2024-11-11 23:59:59',
    'distributed', 'new_users',
    '冲突测试批次：演示并发撤回冲突',
    'operator01'
);

INSERT INTO distribution_scopes (batch_id, scope_type, target_count) VALUES
('b0000000-0000-0000-0000-000000000002', 'new_users', 500);

-- 插入已发放的优惠券
INSERT INTO coupon_records (record_id, batch_id, coupon_code, user_id, user_phone, user_nickname, status, distribute_time)
SELECT 
    'r0000000-0000-0000-0002-' || LPAD(i::text, 11, '0'),
    'b0000000-0000-0000-0000-000000000002',
    'BATCH002-' || LPAD(i::text, 6, '0'),
    'NEWUSER' || LPAD(i::text, 4, '0'),
    '139' || LPAD(i::text, 8, '0'),
    '新用户' || i,
    'distributed',
    '2024-11-01 12:00:00'::timestamp + (i * interval '30 second')
FROM generate_series(1, 200) i;

-- 第一次撤回操作（部分成功）
INSERT INTO withdraw_operations (
    operation_id, batch_id, reason_id, reason_remark,
    operator, operator_name, status,
    total_count, success_count, fail_count,
    fail_details, started_at, completed_at
) VALUES (
    'w0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    (SELECT reason_id FROM withdraw_reasons WHERE reason_code = 'ACTIVITY_CANCELLED'),
    '直播活动临时取消',
    'operator01', '运营小王',
    'processing',
    200, 100, 0,
    NULL,
    '2024-11-02 10:00:00',
    NULL
);

-- 模拟：在第一次撤回处理中，第二次撤回请求到达（冲突场景）
INSERT INTO withdraw_operations (
    operation_id, batch_id, reason_id, reason_remark,
    operator, operator_name, status,
    total_count, success_count, fail_count,
    fail_details, started_at, completed_at
) VALUES (
    'w0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000002',
    (SELECT reason_id FROM withdraw_reasons WHERE reason_code = 'RULE_VIOLATION'),
    '发现刷单用户批量领券',
    'operator02', '运营小李',
    'failed',
    200, 0, 200,
    '[{"error": "BATCH_WITHDRAW_IN_PROGRESS", "message": "该批次正在撤回中，请等待当前操作完成后再试"}]'::jsonb,
    '2024-11-02 10:02:00',
    '2024-11-02 10:02:01'
);

-- ============ 4. 导入坏行测试场景 ============
-- 批次BATCH003：导入的坏数据示例（用于导入验证测试）

INSERT INTO coupon_batches (
    batch_id, batch_no, batch_name, anchor_id,
    coupon_type, coupon_value, min_spend,
    total_count, distributed_count, used_count, withdrawn_count,
    valid_start_time, valid_end_time,
    status, scope_type, remark, created_by
) VALUES (
    'b0000000-0000-0000-0000-000000000003',
    'BATCH003',
    '年货节优惠券-导入测试',
    'a0000000-0000-0000-0000-000000000003',
    'free_shipping', 0.00, 99.00,
    1000, 0, 0, 0,
    '2024-01-10 00:00:00', '2024-02-10 23:59:59',
    'pending', 'specified_users',
    '导入测试批次：包含各种导入坏行',
    'import_system'
);

-- 导入失败记录（模拟导入校验失败的坏行数据，存储在JSON中便于测试验证）
-- 这些数据不直接入库，而是作为测试预期数据
-- 坏行类型：
-- 1. 优惠券码重复
-- 2. 用户ID格式错误
-- 3. 手机号格式错误
-- 4. 面额超出范围
-- 5. 有效期开始时间大于结束时间
-- 6. 必填字段为空

-- ============ 5. 已失效批次参考 ============
INSERT INTO coupon_batches (
    batch_id, batch_no, batch_name, anchor_id,
    coupon_type, coupon_value, min_spend,
    total_count, distributed_count, used_count, withdrawn_count,
    valid_start_time, valid_end_time,
    status, scope_type, remark, created_by
) VALUES (
    'b0000000-0000-0000-0000-000000000004',
    'BATCH004',
    '已过期测试批次-参考',
    'a0000000-0000-0000-0000-000000000001',
    'reduce', 10.00, 50.00,
    100, 100, 80, 20,
    '2023-01-01 00:00:00', '2023-01-31 23:59:59',
    'invalid', 'all_users',
    '已过期的历史批次，状态已失效',
    'admin'
);

-- ============ 查询验证语句 ============

-- 1. 列表查询：查看所有批次状态
-- SELECT * FROM v_coupon_batch_stats ORDER BY created_at DESC;

-- 2. 详情查询：查看BATCH001的优惠券分布
-- SELECT status, COUNT(*) as count FROM coupon_records WHERE batch_id = 'b0000000-0000-0000-0000-000000000001' GROUP BY status;

-- 3. 历史查询：查看BATCH001的撤回操作历史
-- SELECT * FROM v_withdraw_operation_details WHERE batch_id = 'b0000000-0000-0000-0000-000000000001';

-- 4. 导出验证：查询BATCH001所有优惠券记录（含状态）
-- SELECT coupon_code, user_id, user_nickname, status, distribute_time, withdraw_time FROM coupon_records WHERE batch_id = 'b0000000-0000-0000-0000-000000000001' ORDER BY coupon_code;

-- 5. 冲突验证：查看BATCH002的撤回操作（应该显示正在处理中，第二次请求失败）
-- SELECT * FROM withdraw_operations WHERE batch_id = 'b0000000-0000-0000-0000-000000000002' ORDER BY created_at;
