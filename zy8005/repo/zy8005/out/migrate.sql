-- ============================================
-- CRM 数据迁移脚本
-- 生成时间: 2026-05-01 19:14:49
-- ============================================

-- ============================================
-- ⚠️ 警告：此脚本包含错误的草稿版本
-- 预检发现阻断迁移的错误，不建议直接执行
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- 表: accounts
-- 记录数: 5
-- ============================================

INSERT INTO accounts (id, name, website, industry, status, created_at, description) VALUES ('ACC001', '科技创新有限公司', 'www.techcorp.com', 'technology', 'active', '2023-01-15', '专注于人工智能研发的高科技公司
在多个城市设有分公司'); -- 源文件: accounts.csv | 行号: 2 | 自然键: id=ACC001
INSERT INTO accounts (id, name, website, industry, status, created_at, description) VALUES ('ACC002', '绿色能源集团', 'www.greenenergy.cn', 'energy', 'active', '2022-06-20', '致力于可持续能源发展'); -- 源文件: accounts.csv | 行号: 3 | 自然键: id=ACC002
INSERT INTO accounts (id, name, website, industry, status, created_at, description) VALUES ('ACC003', '环球贸易有限公司', 'www.globaltrade.com', 'retail', 'inactive', '2021-03-10', '进出口贸易业务'); -- 源文件: accounts.csv | 行号: 4 | 自然键: id=ACC003
INSERT INTO accounts (id, name, website, industry, status, created_at, description) VALUES ('ACC004', '创新科技', NULL, 'technology', 'active', '2023-05-01', '缺少网站信息'); -- 源文件: accounts.csv | 行号: 5 | 自然键: id=ACC004
INSERT INTO accounts (id, name, website, industry, status, created_at, description) VALUES ('ACC005', '测试科技公司', 'www.test.com', 'unknown', 'active', '2023-06-01', '行业不在枚举列表中'); -- 源文件: accounts.csv | 行号: 6 | 自然键: id=ACC005

-- ============================================
-- 表: contacts
-- 记录数: 5
-- ============================================

INSERT INTO contacts (id, account_id, first_name, last_name, email, phone, position, is_primary) VALUES ('CON001', 'ACC001', '张', '明', 'zhangming@techcorp.com', '13800138001', '技术总监', TRUE); -- 源文件: contacts.csv | 行号: 2 | 自然键: id=CON001
INSERT INTO contacts (id, account_id, first_name, last_name, email, phone, position, is_primary) VALUES ('CON002', 'ACC001', '李', '华', 'lihua@techcorp.com', '01088888888', '产品经理', FALSE); -- 源文件: contacts.csv | 行号: 3 | 自然键: id=CON002
INSERT INTO contacts (id, account_id, first_name, last_name, email, phone, position, is_primary) VALUES ('CON003', 'ACC002', '王', '强', 'wangqiang.greenenergy.cn', '13900139002', '销售经理', TRUE); -- 源文件: contacts.csv | 行号: 4 | 自然键: id=CON003
INSERT INTO contacts (id, account_id, first_name, last_name, email, phone, position, is_primary) VALUES ('CON004', 'ACC999', '赵', '伟', 'zhaowei@example.com', '13700137004', '市场总监', TRUE); -- 源文件: contacts.csv | 行号: 5 | 自然键: id=CON004
INSERT INTO contacts (id, account_id, first_name, last_name, email, phone, position, is_primary) VALUES ('CON005', 'ACC003', NULL, '丽', 'chenli@globaltrade.com', '13600136005', '财务经理', TRUE); -- 源文件: contacts.csv | 行号: 6 | 自然键: id=CON005

-- ============================================
-- 表: activities
-- 记录数: 5
-- ============================================

INSERT INTO activities (id, account_id, contact_id, activity_type, activity_date, subject, duration_minutes, status) VALUES ('ACT001', 'ACC001', 'CON001', 'meeting', '2023-10-15 00:00:00', '产品需求讨论会', 60, 'completed'); -- 源文件: activities.csv | 行号: 2 | 自然键: id=ACT001
INSERT INTO activities (id, account_id, contact_id, activity_type, activity_date, subject, duration_minutes, status) VALUES ('ACT002', 'ACC001', 'CON002', 'call', '2023-10-16 14:30:00', '跟进项目进展', 30, 'completed'); -- 源文件: activities.csv | 行号: 3 | 自然键: id=ACT002
INSERT INTO activities (id, account_id, contact_id, activity_type, activity_date, subject, duration_minutes, status) VALUES ('ACT003', 'ACC002', 'CON003', 'email', '2023-10-17 00:00:00', '发送报价单', NULL, 'completed'); -- 源文件: activities.csv | 行号: 4 | 自然键: id=ACT003
INSERT INTO activities (id, account_id, contact_id, activity_type, activity_date, subject, duration_minutes, status) VALUES ('ACT004', 'ACC999', 'CON004', 'meeting', '2023-10-18 00:00:00', '商务洽谈', 90, 'scheduled'); -- 源文件: activities.csv | 行号: 5 | 自然键: id=ACT004
INSERT INTO activities (id, account_id, contact_id, activity_type, activity_date, subject, duration_minutes, status) VALUES ('ACT005', 'ACC003', NULL, 'call', '2023-10-19 00:00:00', '回访客户', NULL, 'planned'); -- 源文件: activities.csv | 行号: 6 | 自然键: id=ACT005

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- 迁移脚本结束
-- ============================================