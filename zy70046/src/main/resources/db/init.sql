-- 外协加工入库验收服务 数据库初始化脚本
-- 
-- 重要说明：
-- 本项目使用 JPA 的 ddl-auto=update 配置，首次启动时会自动创建所有表结构。
-- 你有两种初始化方式：
-- 
-- 方式一（推荐）：先启动应用让 JPA 自动建表，然后再执行此脚本插入初始数据
-- 方式二：先执行 db/schema.sql 创建表，再执行本脚本插入数据
-- 
-- 本脚本仅包含数据插入语句，不包含建表语句。
-- 如需完整建表 + 数据初始化，请使用 db/schema_and_data.sql

USE outsourcing_inspection;

-- 初始化默认用户（密码: 123456，使用BCrypt加密）
-- 管理员账户: admin / 123456
-- 质检员账户: inspector / 123456
-- 采购员账户: purchaser / 123456
-- 财务账户: finance / 123456

INSERT INTO users (username, password, real_name, email, phone, role, enabled, created_at, updated_at) 
VALUES 
('admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', '系统管理员', 'admin@company.com', '13800138000', '管理员', 1, NOW(), NOW()),
('inspector', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', '张质检', 'inspector@company.com', '13800138001', '质检员', 1, NOW(), NOW()),
('purchaser', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', '李采购', 'purchaser@company.com', '13800138002', '采购员', 1, NOW(), NOW()),
('finance', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', '王财务', 'finance@company.com', '13800138003', '财务', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 初始化示例供应商
INSERT INTO suppliers (supplier_code, supplier_name, contact_person, contact_phone, address, remark, created_at, updated_at)
VALUES 
('SUP001', '精密机械加工厂', '王经理', '13900139001', '上海市浦东新区张江高科技园区', '长期合作供应商，加工精度可靠', NOW(), NOW()),
('SUP002', '华通五金制品有限公司', '李厂长', '13900139002', '苏州市工业园区', '主要提供五金配件加工', NOW(), NOW()),
('SUP003', '鑫源精密制造', '张总', '13900139003', '昆山市经济开发区', '新合作供应商，需重点监控质量', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 初始化扣款规则
INSERT INTO deduction_rules (rule_code, rule_name, supplier_id, defect_type, calculation_method, min_rate, max_rate, fixed_amount, threshold_quantity, description, is_active, created_at, updated_at)
VALUES 
('RULE001', '外观不良扣款规则', NULL, '外观不良', '按比例扣款', 5.0000, 20.0000, NULL, 10.00, '外观不良比例在5%-20%之间按实际比例扣款', 1, NOW(), NOW()),
('RULE002', '尺寸超差扣款规则', NULL, '尺寸超差', '按比例扣款', 10.0000, 50.0000, NULL, 5.00, '尺寸超差按10%-50%比例扣款', 1, NOW(), NOW()),
('RULE003', '功能缺陷扣款规则', NULL, '功能缺陷', '倍数扣款', 100.0000, 300.0000, NULL, 1.00, '功能缺陷按1-3倍货款扣款', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();
