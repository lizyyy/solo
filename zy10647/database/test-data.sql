-- 测试数据脚本

-- 插入测试考生
INSERT INTO examinees (examinee_no, name, id_card, phone, email, department) VALUES
('KS2024001', '张三', '110101199001011234', '13800138001', 'zhangsan@example.com', '技术部'),
('KS2024002', '李四', '110101199001011235', '13800138002', 'lisi@example.com', '市场部'),
('KS2024003', '王五', '110101199001011236', '13800138003', 'wangwu@example.com', '财务部'),
('KS2024004', '赵六', '110101199001011237', '13800138004', 'zhaoliu@example.com', '人事部'),
('KS2024005', '钱七', '110101199001011238', '13800138005', 'qianqi@example.com', '运营部');

-- 插入测试考试
INSERT INTO exams (exam_code, exam_name, exam_date, exam_time_start, exam_time_end, exam_duration) VALUES
('EXAM2024001', '2024年技术资质认证考试', '2024-06-15', '09:00:00', '11:00:00', 120),
('EXAM2024002', '2024年安全知识考试', '2024-06-20', '14:00:00', '15:30:00', 90),
('EXAM2024003', '2024年管理能力测评', '2024-06-25', '10:00:00', '12:00:00', 120);

-- 插入考试报名记录
INSERT INTO exam_registrations (examinee_id, exam_id, registration_no, exam_status, is_absent, has_retaken, retake_count) VALUES
(1, 1, 'REG202400101', 1, 1, 0, 0),
(2, 1, 'REG202400102', 2, 0, 0, 0),
(3, 1, 'REG202400103', 1, 1, 1, 1),
(4, 1, 'REG202400104', 1, 1, 0, 0),
(5, 1, 'REG202400105', 1, 1, 0, 0),
(1, 2, 'REG202400201', 0, 0, 0, 0),
(2, 2, 'REG202400202', 1, 1, 0, 0),
(3, 2, 'REG202400203', 1, 1, 0, 0),
(4, 2, 'REG202400204', 1, 1, 0, 0),
(5, 2, 'REG202400205', 1, 1, 0, 0),
(1, 3, 'REG202400301', 1, 1, 0, 0),
(2, 3, 'REG202400302', 1, 1, 0, 0);

-- 插入补考资格恢复申请（测试数据）
-- 状态说明: 0=草稿, 1=已提交待审核, 2=审核通过已恢复, 3=审核拒绝, 4=已撤回, 5=已失效
INSERT INTO recovery_applications (application_no, registration_id, examinee_id, exam_id, absence_reason_id, reason_detail, status, applicant_remark, reviewer_remark, review_time, expire_time) VALUES
('APP2024001', 1, 1, 1, 1, '因急性肠胃炎住院治疗，无法参加考试', 1, '希望能尽快安排补考', NULL, NULL, NULL),
('APP2024002', 4, 4, 1, 2, '家人突发重病需陪护', 2, '情况特殊，请予以批准', '情况属实，同意恢复资格', '2024-06-16 10:30:00', '2024-12-31 23:59:59'),
('APP2024003', 5, 5, 1, 3, '公司安排紧急出差', 4, '撤回申请', NULL, NULL, NULL);

-- 插入证明材料
INSERT INTO proof_materials (application_id, material_name, material_type, file_path, file_size) VALUES
(1, '医院诊断证明.pdf', 'application/pdf', '/uploads/proof/20240615/diagnosis.pdf', 1024000),
(1, '住院缴费凭证.jpg', 'image/jpeg', '/uploads/proof/20240615/payment.jpg', 2048000),
(2, '医院病危通知书.pdf', 'application/pdf', '/uploads/proof/20240616/critical.pdf', 1536000);

-- 插入操作历史
INSERT INTO operation_logs (application_id, operator_type, operator_id, operator_name, operation_type, old_status, new_status, remark) VALUES
(1, 1, 1, '张三', 'CREATE', NULL, 0, '创建申请'),
(1, 1, 1, '张三', 'SUBMIT', 0, 1, '提交申请'),
(2, 1, 4, '赵六', 'CREATE', NULL, 0, '创建申请'),
(2, 1, 4, '赵六', 'SUBMIT', 0, 1, '提交申请'),
(2, 2, 100, '管理员', 'REVIEW', 1, 2, '审核通过'),
(3, 1, 5, '钱七', 'CREATE', NULL, 0, '创建申请'),
(3, 1, 5, '钱七', 'SUBMIT', 0, 1, '提交申请'),
(3, 1, 5, '钱七', 'WITHDRAW', 1, 4, '撤回申请');
