-- ============================================
-- CRM 数据回滚脚本
-- 生成时间: 2026-05-01 19:14:49
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- 表: activities (回滚顺序)
-- 记录数: 5
-- ============================================

DELETE FROM activities WHERE id = 'ACT005';
DELETE FROM activities WHERE id = 'ACT004';
DELETE FROM activities WHERE id = 'ACT003';
DELETE FROM activities WHERE id = 'ACT002';
DELETE FROM activities WHERE id = 'ACT001';

-- ============================================
-- 表: contacts (回滚顺序)
-- 记录数: 5
-- ============================================

DELETE FROM contacts WHERE id = 'CON005';
DELETE FROM contacts WHERE id = 'CON004';
DELETE FROM contacts WHERE id = 'CON003';
DELETE FROM contacts WHERE id = 'CON002';
DELETE FROM contacts WHERE id = 'CON001';

-- ============================================
-- 表: accounts (回滚顺序)
-- 记录数: 5
-- ============================================

DELETE FROM accounts WHERE id = 'ACC005';
DELETE FROM accounts WHERE id = 'ACC004';
DELETE FROM accounts WHERE id = 'ACC003';
DELETE FROM accounts WHERE id = 'ACC002';
DELETE FROM accounts WHERE id = 'ACC001';

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- 回滚脚本结束
-- ============================================