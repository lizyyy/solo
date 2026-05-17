-- ========================================
-- 验收测试数据
-- 包含：1. 完整流转记录  2. 冲突记录  3. 导入坏行
-- ========================================

-- ========================================
-- 1. 完整流转记录：赵云的销售日报订阅
-- 流程：PENDING -> SEND -> BOUNCE -> RETRY -> BOUNCE -> SUSPEND -> RESUME -> MANUAL_RESEND
-- ========================================

-- 先创建赵云的订阅记录（状态：退回中，已有2次退回）
INSERT INTO report_subscriptions (
    subscriber_id, report_id, email_subject, custom_message, 
    status, last_sent_at, next_send_at, 
    bounce_count, last_bounce_at, last_bounce_reason, retry_count,
    suspended_at, suspended_by, suspend_reason,
    created_by
) VALUES (
    4, 1, '【每日销售报表】{{date}}', '赵云的个人销售数据报表',
    'BOUNCING', '2026-05-16 08:00:00', '2026-05-18 08:00:00',
    2, '2026-05-17 08:15:00', 'MAILBOX_FULL', 2,
    NULL, NULL, NULL,
    'admin'
);

-- 退回历史记录
INSERT INTO bounce_history (
    subscription_id, bounce_reason, bounce_details, bounce_timestamp,
    sent_at, email_subject, smtp_status_code, smtp_response,
    action_taken, retry_scheduled_at, processed_at, processed_by,
    original_history_id, is_resend, resend_count
) VALUES
-- 第一次发送和退回
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1), 
 'MAILBOX_FULL', '收件人邮箱容量已满，无法接收新邮件', '2026-05-15 08:10:00',
 '2026-05-15 08:00:00', '【每日销售报表】2026-05-15', '552', '552 5.2.2 Mailbox full',
 'RETRY', '2026-05-16 08:00:00', '2026-05-15 08:15:00', 'system',
 NULL, false, 0),

-- 第二次发送（重试）和退回
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1),
 'MAILBOX_FULL', '收件人邮箱仍然已满', '2026-05-16 08:12:00',
 '2026-05-16 08:00:00', '【每日销售报表】2026-05-16', '552', '552 5.2.2 Mailbox full (quota exceeded)',
 'RETRY', '2026-05-17 08:00:00', '2026-05-16 08:15:00', 'system',
 (SELECT history_id FROM bounce_history WHERE subscription_id = (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1) LIMIT 1), 
 true, 1),

-- 第三次发送（再重试）和退回
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1),
 'MAILBOX_FULL', '收件人邮箱已满，已达最大重试次数', '2026-05-17 08:15:00',
 '2026-05-17 08:00:00', '【每日销售报表】2026-05-17', '552', '552 5.2.2 Mailbox full (permanent failure)',
 NULL, NULL, NULL, NULL,
 (SELECT history_id FROM bounce_history WHERE subscription_id = (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1) LIMIT 1 OFFSET 1),
 true, 2);

-- 操作审计日志
INSERT INTO subscription_audit_log (
    subscription_id, subscriber_id, report_id,
    action, action_by, action_timestamp,
    old_status, new_status,
    old_retry_count, new_retry_count,
    old_bounce_count, new_bounce_count,
    comments
) VALUES
-- 第一次发送
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1), 4, 1,
 'SEND', 'system', '2026-05-15 08:00:00',
 'PENDING', 'PENDING',
 0, 0, 0, 0,
 '定时任务发送销售日报 2026-05-15'),

-- 第一次退回
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1), 4, 1,
 'BOUNCE', 'system', '2026-05-15 08:15:00',
 'PENDING', 'BOUNCING',
 0, 1, 0, 1,
 '邮件退回，原因：邮箱已满，计划24小时后重试'),

-- 第一次重试发送
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1), 4, 1,
 'RETRY', 'system', '2026-05-16 08:00:00',
 'BOUNCING', 'BOUNCING',
 1, 2, 1, 1,
 '重试发送销售日报 2026-05-16'),

-- 第二次退回
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1), 4, 1,
 'BOUNCE', 'system', '2026-05-16 08:15:00',
 'BOUNCING', 'BOUNCING',
 2, 2, 1, 2,
 '邮件再次退回，原因：邮箱已满，计划24小时后再次重试'),

-- 第二次重试发送
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1), 4, 1,
 'RETRY', 'system', '2026-05-17 08:00:00',
 'BOUNCING', 'BOUNCING',
 2, 3, 2, 2,
 '再次重试发送销售日报 2026-05-17'),

-- 第三次退回
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1), 4, 1,
 'BOUNCE', 'system', '2026-05-17 08:15:00',
 'BOUNCING', 'BOUNCING',
 3, 3, 2, 3,
 '邮件第三次退回，原因：邮箱已满，已达最大重试次数，需要人工介入');

-- ========================================
-- 2. 冲突记录：杨柳的财务日报订阅（模拟重复点击）
-- ========================================

-- 杨柳的订阅记录（状态：暂停）
INSERT INTO report_subscriptions (
    subscriber_id, report_id, email_subject, custom_message,
    status, last_sent_at, next_send_at,
    bounce_count, last_bounce_at, last_bounce_reason, retry_count,
    suspended_at, suspended_by, suspend_reason,
    created_by
) VALUES (
    7, 4, '【每日财务报表】{{date}}', '杨柳的财务日报',
    'SUSPENDED', '2026-05-15 08:30:00', NULL,
    1, '2026-05-15 09:00:00', 'INVALID_RECIPIENT', 1,
    '2026-05-16 10:00:00', 'admin', '邮箱地址无效，已暂停订阅，等待用户更新邮箱',
    'admin'
);

-- 退回历史（有多条重复记录，模拟重复点击）
INSERT INTO bounce_history (
    subscription_id, bounce_reason, bounce_details, bounce_timestamp,
    sent_at, email_subject, smtp_status_code, smtp_response,
    action_taken, processed_at, processed_by
) VALUES
-- 原始退回
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 7 AND report_id = 4),
 'INVALID_RECIPIENT', '收件人邮箱地址不存在', '2026-05-15 09:00:00',
 '2026-05-15 08:30:00', '【每日财务报表】2026-05-15', '550', '550 5.1.1 User unknown',
 'SUSPEND', '2026-05-15 09:05:00', 'system'),

-- 重复点击产生的冲突记录1（异步回调重复处理）
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 7 AND report_id = 4),
 'INVALID_RECIPIENT', '收件人邮箱地址不存在（重复处理）', '2026-05-15 09:00:01',
 '2026-05-15 08:30:00', '【每日财务报表】2026-05-15', '550', '550 5.1.1 User unknown',
 NULL, NULL, NULL),

-- 重复点击产生的冲突记录2（人工补录重复）
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 7 AND report_id = 4),
 'INVALID_RECIPIENT', '收件人邮箱地址不存在（人工补录）', '2026-05-15 09:05:00',
 '2026-05-15 08:30:00', '【每日财务报表】2026-05-15', '550', '550 5.1.1 User unknown',
 NULL, '2026-05-15 09:10:00', 'operator_li');

-- 操作审计日志（包含重复操作）
INSERT INTO subscription_audit_log (
    subscription_id, subscriber_id, report_id,
    action, action_by, action_timestamp,
    old_status, new_status,
    old_retry_count, new_retry_count,
    old_bounce_count, new_bounce_count,
    comments, ip_address
) VALUES
-- 发送
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 7 AND report_id = 4), 7, 4,
 'SEND', 'system', '2026-05-15 08:30:00',
 'PENDING', 'PENDING', 0, 0, 0, 0,
 '发送财务日报', NULL),

-- 第一次退回处理
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 7 AND report_id = 4), 7, 4,
 'BOUNCE', 'system', '2026-05-15 09:05:00',
 'PENDING', 'BOUNCING', 0, 1, 0, 1,
 '邮件退回，原因：收件人不存在', NULL),

-- 重复处理1（异步回调重复）
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 7 AND report_id = 4), 7, 4,
 'BOUNCE', 'system', '2026-05-15 09:05:01',
 'BOUNCING', 'BOUNCING', 1, 1, 1, 1,
 '【重复处理】邮件退回，可能是异步回调重复', NULL),

-- 暂停订阅
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 7 AND report_id = 4), 7, 4,
 'SUSPEND', 'admin', '2026-05-16 10:00:00',
 'BOUNCING', 'SUSPENDED', 1, 1, 1, 1,
 '人工暂停订阅，等待用户更新邮箱', '192.168.1.100'),

-- 重复暂停操作（模拟重复点击暂停按钮）
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 7 AND report_id = 4), 7, 4,
 'SUSPEND', 'admin', '2026-05-16 10:00:02',
 'SUSPENDED', 'SUSPENDED', 1, 1, 1, 1,
 '【重复操作】重复点击暂停按钮', '192.168.1.100');

-- ========================================
-- 3. 导入坏行记录
-- ========================================

-- 导入记录
INSERT INTO import_records (
    import_batch_id, import_type, file_name, file_path,
    total_rows, success_count, failed_count,
    imported_by, imported_at, completed_at, import_status
) VALUES (
    'IMP-20260515-001', 'SUBSCRIPTIONS', '批量订阅导入_20260515.xlsx', '/imports/20260515/批量订阅导入_20260515.xlsx',
    10, 8, 2,
    'operator_wang', '2026-05-15 14:00:00', '2026-05-15 14:05:00', 'PARTIAL'
);

-- 导入坏行1：邮箱格式错误
INSERT INTO import_bad_rows (
    import_id, row_number, row_data, raw_row_data,
    error_type, error_message, error_details
) VALUES (
    (SELECT import_id FROM import_records WHERE import_batch_id = 'IMP-20260515-001'),
    5,
    '{"email": "bad-email", "name": "测试用户1", "report_code": "SALES_DAILY", "department": "测试部"}',
    'bad-email,测试用户1,SALES_DAILY,测试部',
    'VALIDATION_ERROR',
    '邮箱格式不正确',
    '{"field": "email", "value": "bad-email", "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"}'
);

-- 导入坏行2：报表不存在
INSERT INTO import_bad_rows (
    import_id, row_number, row_data, raw_row_data,
    error_type, error_message, error_details
) VALUES (
    (SELECT import_id FROM import_records WHERE import_batch_id = 'IMP-20260515-001'),
    8,
    '{"email": "test.user2@techcorp.com", "name": "测试用户2", "report_code": "NON_EXISTENT_REPORT", "department": "测试部"}',
    'test.user2@techcorp.com,测试用户2,NON_EXISTENT_REPORT,测试部',
    'REFERENCE_ERROR',
    '报表编码不存在',
    '{"field": "report_code", "value": "NON_EXISTENT_REPORT", "existing_reports": ["SALES_DAILY", "SALES_WEEKLY", "SALES_MONTHLY", "FINANCE_DAILY", "FINANCE_MONTHLY"]}'
);

-- ========================================
-- 4. 导出记录（模拟历史退回补发后的导出）
-- ========================================

-- 先模拟：邮箱恢复后，历史退回任务重复补发
-- 赵云更新邮箱后恢复订阅并补发历史报表

-- 更新订阅状态为已恢复
UPDATE report_subscriptions 
SET 
    status = 'RESUMED',
    resumed_at = '2026-05-18 09:00:00',
    resumed_by = 'admin',
    bounce_count = 2,
    retry_count = 0,
    next_send_at = '2026-05-19 08:00:00'
WHERE subscriber_id = 4 AND report_id = 1;

-- 记录恢复操作
INSERT INTO subscription_audit_log (
    subscription_id, subscriber_id, report_id,
    action, action_by, action_timestamp,
    old_status, new_status, comments
) VALUES (
    (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1), 4, 1,
    'RESUME', 'admin', '2026-05-18 09:00:00',
    'BOUNCING', 'RESUMED', '用户邮箱已清理，恢复订阅'
);

-- 补发历史退回的报表（人工补发）
INSERT INTO bounce_history (
    subscription_id, bounce_reason, bounce_details, bounce_timestamp,
    sent_at, email_subject, smtp_status_code, smtp_response,
    action_taken, processed_at, processed_by,
    original_history_id, is_resend, resend_count
) VALUES
-- 补发2026-05-15报表
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1),
 'MAILBOX_FULL', '补发历史退回报表', '2026-05-15 08:10:00',
 '2026-05-18 09:10:00', '【补发】【每日销售报表】2026-05-15', '250', '250 2.0.0 OK',
 'MANUAL_RESEND', '2026-05-18 09:15:00', 'admin',
 (SELECT history_id FROM bounce_history WHERE subscription_id = (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1) ORDER BY history_id LIMIT 1),
 true, 1),

-- 补发2026-05-16报表
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1),
 'MAILBOX_FULL', '补发历史退回报表', '2026-05-16 08:12:00',
 '2026-05-18 09:12:00', '【补发】【每日销售报表】2026-05-16', '250', '250 2.0.0 OK',
 'MANUAL_RESEND', '2026-05-18 09:15:00', 'admin',
 (SELECT history_id FROM bounce_history WHERE subscription_id = (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1) ORDER BY history_id LIMIT 1 OFFSET 1),
 true, 1),

-- 补发2026-05-17报表
((SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1),
 'MAILBOX_FULL', '补发历史退回报表', '2026-05-17 08:15:00',
 '2026-05-18 09:15:00', '【补发】【每日销售报表】2026-05-17', '250', '250 2.0.0 OK',
 'MANUAL_RESEND', '2026-05-18 09:20:00', 'admin',
 (SELECT history_id FROM bounce_history WHERE subscription_id = (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1) ORDER BY history_id LIMIT 1 OFFSET 2),
 true, 1);

-- 记录人工补发操作
INSERT INTO subscription_audit_log (
    subscription_id, subscriber_id, report_id,
    action, action_by, action_timestamp,
    old_status, new_status, comments
) VALUES (
    (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1), 4, 1,
    'MANUAL_RESEND', 'admin', '2026-05-18 09:15:00',
    'RESUMED', 'RESUMED', '人工补发历史退回的3份报表（2026-05-15、16、17）'
);

-- 导出记录：导出5月退回报表
INSERT INTO export_records (
    export_batch_id, export_type, export_format, export_status,
    start_date, end_date,
    file_name, file_path, file_size_bytes, record_count,
    exported_by, exported_at, completed_at
) VALUES (
    'EXP-20260518-001', 'BOUNCE_LIST', 'EXCEL', 'COMPLETED',
    '2026-05-01 00:00:00', '2026-05-31 23:59:59',
    '5月退回报表汇总_20260518.xlsx', '/exports/20260518/5月退回报表汇总_20260518.xlsx',
    15360, 6,
    'admin', '2026-05-18 10:00:00', '2026-05-18 10:00:30'
);

-- 导出-订阅关联：记录导出包含的所有退回记录
INSERT INTO export_subscription_mapping (
    export_id, subscription_id, history_id, export_row_number
) VALUES
-- 赵云的3条原始退回记录
((SELECT export_id FROM export_records WHERE export_batch_id = 'EXP-20260518-001'),
 (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1),
 (SELECT history_id FROM bounce_history WHERE subscription_id = (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1) ORDER BY history_id LIMIT 1),
 1),
((SELECT export_id FROM export_records WHERE export_batch_id = 'EXP-20260518-001'),
 (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1),
 (SELECT history_id FROM bounce_history WHERE subscription_id = (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1) ORDER BY history_id LIMIT 1 OFFSET 1),
 2),
((SELECT export_id FROM export_records WHERE export_batch_id = 'EXP-20260518-001'),
 (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1),
 (SELECT history_id FROM bounce_history WHERE subscription_id = (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1) ORDER BY history_id LIMIT 1 OFFSET 2),
 3),
-- 赵云的3条补发记录
((SELECT export_id FROM export_records WHERE export_batch_id = 'EXP-20260518-001'),
 (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1),
 (SELECT history_id FROM bounce_history WHERE subscription_id = (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1) ORDER BY history_id LIMIT 1 OFFSET 3),
 4),
((SELECT export_id FROM export_records WHERE export_batch_id = 'EXP-20260518-001'),
 (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1),
 (SELECT history_id FROM bounce_history WHERE subscription_id = (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1) ORDER BY history_id LIMIT 1 OFFSET 4),
 5),
((SELECT export_id FROM export_records WHERE export_batch_id = 'EXP-20260518-001'),
 (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1),
 (SELECT history_id FROM bounce_history WHERE subscription_id = (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1) ORDER BY history_id LIMIT 1 OFFSET 5),
 6);
