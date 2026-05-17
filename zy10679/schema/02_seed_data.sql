-- ========================================
-- 种子数据：订阅人
-- ========================================
INSERT INTO subscribers (email, name, department, position, phone, company, is_active, email_verified, last_verified_at, created_by) VALUES
-- 销售部
('zhang.wei@techcorp.com', '张伟', '销售部', '销售总监', '13800138001', '科技创新有限公司', true, true, '2026-01-15 09:30:00', 'admin'),
('wang.fang@techcorp.com', '王芳', '销售部', '销售经理', '13800138002', '科技创新有限公司', true, true, '2026-01-15 09:35:00', 'admin'),
('li.ming@techcorp.com', '李明', '销售部', '销售代表', '13800138003', '科技创新有限公司', true, true, '2026-01-15 09:40:00', 'admin'),
('zhao.yun@techcorp.com', '赵云', '销售部', '销售代表', '13800138004', '科技创新有限公司', true, true, '2026-01-15 09:45:00', 'admin'),
-- 财务部
('chen.ying@techcorp.com', '陈颖', '财务部', '财务总监', '13800138005', '科技创新有限公司', true, true, '2026-01-15 10:00:00', 'admin'),
('liu.hong@techcorp.com', '刘红', '财务部', '会计主管', '13800138006', '科技创新有限公司', true, true, '2026-01-15 10:05:00', 'admin'),
('yang.liu@techcorp.com', '杨柳', '财务部', '出纳', '13800138007', '科技创新有限公司', true, true, '2026-01-15 10:10:00', 'admin'),
-- 人力资源部
('huang.li@techcorp.com', '黄丽', '人力资源部', 'HR总监', '13800138008', '科技创新有限公司', true, true, '2026-01-15 10:30:00', 'admin'),
('zhou.jie@techcorp.com', '周杰', '人力资源部', '招聘经理', '13800138009', '科技创新有限公司', true, true, '2026-01-15 10:35:00', 'admin'),
-- 运营部
('wu.hao@techcorp.com', '吴浩', '运营部', '运营总监', '13800138010', '科技创新有限公司', true, true, '2026-01-15 11:00:00', 'admin'),
('xu.na@techcorp.com', '徐娜', '运营部', '运营经理', '13800138011', '科技创新有限公司', true, true, '2026-01-15 11:05:00', 'admin'),
-- 已失效用户（用于测试）
('old.user@techcorp.com', '老用户', '销售部', '已离职', '13800138999', '科技创新有限公司', false, false, NULL, 'admin');

-- ========================================
-- 种子数据：报表
-- ========================================
INSERT INTO reports (report_code, report_name, report_type, description, frequency, schedule_time, template_path, export_format, is_active, owner_department, created_by) VALUES
-- 销售报表
('SALES_DAILY', '每日销售报表', 'SALES', '包含当日销售额、订单数、客户数等核心指标', 'DAILY', '08:00:00', '/templates/sales_daily.jasper', 'PDF', true, '销售部', 'admin'),
('SALES_WEEKLY', '每周销售报表', 'SALES', '包含周销售额对比、区域分析、销售排行等', 'WEEKLY', '09:00:00', '/templates/sales_weekly.jasper', 'EXCEL', true, '销售部', 'admin'),
('SALES_MONTHLY', '月度销售报表', 'SALES', '包含月度总结、季度对比、年度目标完成情况', 'MONTHLY', '10:00:00', '/templates/sales_monthly.jasper', 'PDF', true, '销售部', 'admin'),
-- 财务报表
('FINANCE_DAILY', '每日财务报表', 'FINANCE', '包含当日收支、现金流、应收账款等', 'DAILY', '08:30:00', '/templates/finance_daily.jasper', 'EXCEL', true, '财务部', 'admin'),
('FINANCE_MONTHLY', '月度财务报表', 'FINANCE', '包含月度利润表、资产负债表、现金流量表', 'MONTHLY', '09:30:00', '/templates/finance_monthly.jasper', 'PDF', true, '财务部', 'admin'),
-- HR报表
('HR_MONTHLY', '月度人力报表', 'HR', '包含人员变动、考勤统计、招聘进度等', 'MONTHLY', '10:30:00', '/templates/hr_monthly.jasper', 'PDF', true, '人力资源部', 'admin'),
('HR_WEEKLY', '每周考勤报表', 'HR', '包含周考勤汇总、异常考勤统计', 'WEEKLY', '08:00:00', '/templates/hr_weekly.jasper', 'EXCEL', true, '人力资源部', 'admin'),
-- 运营报表
('OPS_DAILY', '每日运营报表', 'OPERATIONS', '包含系统运行状态、用户活跃度、业务处理量', 'DAILY', '07:00:00', '/templates/ops_daily.jasper', 'PDF', true, '运营部', 'admin'),
('OPS_WEEKLY', '每周运营报表', 'OPERATIONS', '包含周运营数据汇总、问题分析、优化建议', 'WEEKLY', '09:00:00', '/templates/ops_weekly.jasper', 'EXCEL', true, '运营部', 'admin');

-- ========================================
-- 种子数据：报表订阅记录（基础订阅）
-- ========================================
INSERT INTO report_subscriptions (subscriber_id, report_id, email_subject, custom_message, status, last_sent_at, next_send_at, bounce_count, retry_count, created_by) VALUES
-- 张伟订阅所有销售报表
(1, 1, '【每日销售报表】{{date}}', '请查收今日销售数据，如有问题请联系销售部。', 'PENDING', NULL, '2026-05-19 08:00:00', 0, 0, 'admin'),
(1, 2, '【每周销售报表】{{week}}', '本周销售汇总，请查阅附件。', 'PENDING', '2026-05-16 09:00:00', '2026-05-23 09:00:00', 0, 0, 'admin'),
(1, 3, '【月度销售报表】{{month}}', '{{month}}月销售总结报告。', 'PENDING', '2026-04-30 10:00:00', '2026-05-31 10:00:00', 0, 0, 'admin'),
-- 王芳订阅销售日报和周报
(2, 1, '【每日销售报表】{{date}}', '每日销售数据，请查收。', 'PENDING', NULL, '2026-05-19 08:00:00', 0, 0, 'admin'),
(2, 2, '【每周销售报表】{{week}}', '周销售汇总。', 'PENDING', '2026-05-16 09:00:00', '2026-05-23 09:00:00', 0, 0, 'admin'),
-- 李明订阅销售日报
(3, 1, '【每日销售报表】{{date}}', '个人销售数据。', 'PENDING', NULL, '2026-05-19 08:00:00', 0, 0, 'admin'),
-- 陈颖订阅所有财务报表
(5, 4, '【每日财务报表】{{date}}', '每日财务数据汇总。', 'PENDING', NULL, '2026-05-19 08:30:00', 0, 0, 'admin'),
(5, 5, '【月度财务报表】{{month}}', '月度财务报告，请审阅。', 'PENDING', '2026-04-30 09:30:00', '2026-05-31 09:30:00', 0, 0, 'admin'),
-- 刘红订阅财务日报
(6, 4, '【每日财务报表】{{date}}', '财务日报。', 'PENDING', NULL, '2026-05-19 08:30:00', 0, 0, 'admin'),
-- 黄丽订阅所有HR报表
(8, 6, '【月度人力报表】{{month}}', '人力资源月度报告。', 'PENDING', '2026-04-30 10:30:00', '2026-05-31 10:30:00', 0, 0, 'admin'),
(8, 7, '【每周考勤报表】{{week}}', '周考勤汇总。', 'PENDING', '2026-05-16 08:00:00', '2026-05-23 08:00:00', 0, 0, 'admin'),
-- 吴浩订阅所有运营报表
(10, 8, '【每日运营报表】{{date}}', '系统运营日报。', 'PENDING', NULL, '2026-05-19 07:00:00', 0, 0, 'admin'),
(10, 9, '【每周运营报表】{{week}}', '周运营汇总。', 'PENDING', '2026-05-16 09:00:00', '2026-05-23 09:00:00', 0, 0, 'admin'),
-- 徐娜订阅运营日报
(11, 8, '【每日运营报表】{{date}}', '运营日报。', 'PENDING', NULL, '2026-05-19 07:00:00', 0, 0, 'admin');
