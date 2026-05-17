-- ========================================
-- 数据验收验证脚本
-- 执行后检查各部分数据是否完整
-- ========================================

-- 1. 基础数据统计
SELECT 
    '订阅人' as data_type, COUNT(*) as count FROM subscribers
UNION ALL
SELECT 
    '报表' as data_type, COUNT(*) as count FROM reports
UNION ALL
SELECT 
    '订阅记录' as data_type, COUNT(*) as count FROM report_subscriptions
UNION ALL
SELECT 
    '退回历史' as data_type, COUNT(*) as count FROM bounce_history
UNION ALL
SELECT 
    '审计日志' as data_type, COUNT(*) as count FROM subscription_audit_log
UNION ALL
SELECT 
    '导出记录' as data_type, COUNT(*) as count FROM export_records
UNION ALL
SELECT 
    '导入记录' as data_type, COUNT(*) as count FROM import_records
UNION ALL
SELECT 
    '导入坏行' as data_type, COUNT(*) as count FROM import_bad_rows;

-- 2. 订阅状态分布
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM report_subscriptions), 2) as percentage
FROM report_subscriptions
GROUP BY status
ORDER BY count DESC;

-- 3. 完整流转验证 - 赵云的销售日报订阅
SELECT 
    '赵云的销售日报订阅' as test_case,
    CASE WHEN COUNT(*) >= 9 THEN '✅ 通过' ELSE '❌ 失败' END as status,
    STRING_AGG(DISTINCT action, ', ' ORDER BY action) as actions_recorded
FROM subscription_audit_log
WHERE subscriber_id = 4 AND report_id = 1;

-- 4. 补发记录关联验证
SELECT 
    '补发记录关联验证' as test_case,
    CASE WHEN COUNT(DISTINCT original_history_id) = 3 THEN '✅ 通过' ELSE '❌ 失败' END as status,
    COUNT(*) as total_resend_records,
    COUNT(DISTINCT original_history_id) as linked_original_records
FROM bounce_history
WHERE is_resend = true
AND subscription_id = (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 4 AND report_id = 1);

-- 5. 冲突记录验证
SELECT 
    '冲突记录验证' as test_case,
    CASE WHEN duplicate_count > 1 THEN '✅ 通过' ELSE '❌ 失败' END as status,
    duplicate_count as duplicate_bounce_records
FROM (
    SELECT COUNT(*) as duplicate_count
    FROM bounce_history
    WHERE subscription_id = (SELECT subscription_id FROM report_subscriptions WHERE subscriber_id = 7 AND report_id = 4)
    GROUP BY sent_at, email_subject
    HAVING COUNT(*) > 1
    LIMIT 1
) t;

-- 6. 导出关联完整性验证
SELECT 
    '导出关联完整性验证' as test_case,
    CASE WHEN er.record_count = COUNT(esm.mapping_id) THEN '✅ 通过' ELSE '❌ 失败' END as status,
    er.record_count as export_declared_count,
    COUNT(esm.mapping_id) as actual_mapping_count
FROM export_records er
JOIN export_subscription_mapping esm ON er.export_id = esm.export_id
WHERE er.export_batch_id = 'EXP-20260518-001'
GROUP BY er.export_id, er.record_count;

-- 7. 导入坏行验证
SELECT 
    '导入坏行验证' as test_case,
    row_number,
    error_type,
    error_message,
    CASE WHEN is_resolved = false THEN '✅ 未处理（符合预期）' ELSE '⚠️  已处理' END as status
FROM import_bad_rows
ORDER BY row_number;

-- 8. 状态流转完整性检查 - 赵云的订阅
SELECT 
    log_id,
    action,
    action_timestamp,
    old_status,
    new_status,
    old_retry_count,
    new_retry_count,
    old_bounce_count,
    new_bounce_count,
    comments
FROM subscription_audit_log
WHERE subscriber_id = 4 AND report_id = 1
ORDER BY action_timestamp;
