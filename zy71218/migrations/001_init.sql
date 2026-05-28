-- 用户表
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('risk_officer', 'collection_officer', 'supervisor', 'admin')),
  status TEXT NOT NULL DEFAULT 'active',
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 业务案件主表
CREATE TABLE IF NOT EXISTS business_case (
  id TEXT PRIMARY KEY,
  business_no TEXT UNIQUE NOT NULL,
  buyer_name TEXT NOT NULL,
  seller_name TEXT,
  total_amount DECIMAL(15,2) NOT NULL,
  financing_amount DECIMAL(15,2),
  current_status TEXT NOT NULL,
  overdue_days INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'medium',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_case_buyer ON business_case(buyer_name);
CREATE INDEX IF NOT EXISTS idx_case_status ON business_case(current_status);
CREATE INDEX IF NOT EXISTS idx_case_overdue ON business_case(overdue_days);

-- 发票表
CREATE TABLE IF NOT EXISTS invoice (
  id TEXT PRIMARY KEY,
  business_no TEXT NOT NULL REFERENCES business_case(business_no),
  invoice_no TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  tax_amount DECIMAL(15,2),
  goods_description TEXT,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_no, version)
);

-- 买方确认表
CREATE TABLE IF NOT EXISTS confirmation (
  id TEXT PRIMARY KEY,
  business_no TEXT NOT NULL REFERENCES business_case(business_no),
  confirm_date DATE,
  confirm_amount DECIMAL(15,2),
  goods_received BOOLEAN DEFAULT false,
  quality_issue BOOLEAN DEFAULT false,
  quality_issue_desc TEXT,
  confirmer TEXT,
  is_withdrawn BOOLEAN DEFAULT false,
  withdraw_reason TEXT,
  withdraw_date DATE,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_no, version)
);

-- 保理合同表
CREATE TABLE IF NOT EXISTS factoring_contract (
  id TEXT PRIMARY KEY,
  business_no TEXT NOT NULL REFERENCES business_case(business_no),
  contract_no TEXT NOT NULL,
  factoring_rate DECIMAL(5,4) NOT NULL,
  financing_amount DECIMAL(15,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_no, version)
);

-- 回款计划表
CREATE TABLE IF NOT EXISTS repayment_plan (
  id TEXT PRIMARY KEY,
  business_no TEXT NOT NULL REFERENCES business_case(business_no),
  instalment_no INTEGER NOT NULL,
  principal DECIMAL(15,2) NOT NULL,
  interest DECIMAL(15,2) NOT NULL,
  planned_date DATE NOT NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_no, instalment_no, version)
);

-- 催收记录表
CREATE TABLE IF NOT EXISTS collection_note (
  id TEXT PRIMARY KEY,
  business_no TEXT NOT NULL REFERENCES business_case(business_no),
  collection_date DATE NOT NULL,
  collector TEXT NOT NULL,
  collection_method TEXT NOT NULL CHECK (collection_method IN ('phone', 'email', 'visit', 'legal', 'other')),
  contact_person TEXT,
  contact_result TEXT,
  next_action TEXT,
  follow_up_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_collection_business ON collection_note(business_no);
CREATE INDEX IF NOT EXISTS idx_collection_followup ON collection_note(follow_up_date);

-- 风险报告表
CREATE TABLE IF NOT EXISTS risk_report (
  id TEXT PRIMARY KEY,
  business_no TEXT NOT NULL REFERENCES business_case(business_no),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  report_date DATE NOT NULL,
  analyst TEXT NOT NULL,
  key_findings TEXT,
  recommendations TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 状态流转表
CREATE TABLE IF NOT EXISTS state_transition (
  id TEXT PRIMARY KEY,
  business_no TEXT NOT NULL REFERENCES business_case(business_no),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  transition_type TEXT NOT NULL CHECK (transition_type IN ('normal', 'reverse', 'exception')),
  reason TEXT NOT NULL,
  impact_scope TEXT,
  next_step TEXT,
  operator_id TEXT NOT NULL REFERENCES user(id),
  operator_name TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transition_business ON state_transition(business_no);
CREATE INDEX IF NOT EXISTS idx_transition_type ON state_transition(transition_type);
CREATE INDEX IF NOT EXISTS idx_transition_time ON state_transition(timestamp);

-- 回款记录表
CREATE TABLE IF NOT EXISTS repayment (
  id TEXT PRIMARY KEY,
  business_no TEXT NOT NULL REFERENCES business_case(business_no),
  repayment_date DATE NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  principal_paid DECIMAL(15,2) DEFAULT 0,
  interest_paid DECIMAL(15,2) DEFAULT 0,
  penalty_paid DECIMAL(15,2) DEFAULT 0,
  payer TEXT,
  remark TEXT,
  write_off_status TEXT NOT NULL DEFAULT 'pending' CHECK (write_off_status IN ('pending', 'partial', 'full')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_repayment_business ON repayment(business_no);
CREATE INDEX IF NOT EXISTS idx_repayment_date ON repayment(repayment_date);
CREATE INDEX IF NOT EXISTS idx_repayment_status ON repayment(write_off_status);

-- 回款核销明细表
CREATE TABLE IF NOT EXISTS repayment_write_off (
  id TEXT PRIMARY KEY,
  repayment_id TEXT NOT NULL REFERENCES repayment(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 版本历史表
CREATE TABLE IF NOT EXISTS version_history (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  record_type TEXT NOT NULL,
  version INTEGER NOT NULL,
  before_data TEXT,
  after_data TEXT,
  changed_fields TEXT,
  operator_id TEXT NOT NULL REFERENCES user(id),
  operator_name TEXT NOT NULL,
  change_reason TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_version_record ON version_history(record_id, record_type);
CREATE INDEX IF NOT EXISTS idx_version_time ON version_history(timestamp);

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  detail TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(timestamp);

-- 业务关联表
CREATE TABLE IF NOT EXISTS business_link (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  link_type TEXT NOT NULL,
  confidence INTEGER DEFAULT 100,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_id, target_id, link_type)
);

-- 导出历史记录表
CREATE TABLE IF NOT EXISTS report_history (
  id TEXT PRIMARY KEY,
  report_id TEXT UNIQUE NOT NULL,
  template_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_format TEXT NOT NULL DEFAULT 'csv',
  record_count INTEGER DEFAULT 0,
  file_size INTEGER DEFAULT 0,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  filters TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_report_history_template ON report_history(template_id);
CREATE INDEX IF NOT EXISTS idx_report_history_operator ON report_history(operator_id);
CREATE INDEX IF NOT EXISTS idx_report_history_time ON report_history(created_at);

-- 初始化测试用户
INSERT OR IGNORE INTO user (id, username, name, role, status, password_hash) VALUES
('u001', 'risk01', '张明', 'risk_officer', 'active', '123456'),
('u002', 'coll01', '李华', 'collection_officer', 'active', '123456'),
('u003', 'super01', '王芳', 'supervisor', 'active', '123456'),
('u004', 'admin01', '系统管理员', 'admin', 'active', '123456');

-- 测试业务案件数据
INSERT OR IGNORE INTO business_case (id, business_no, buyer_name, seller_name, total_amount, financing_amount, current_status, overdue_days, risk_level) VALUES
('c001', 'BL202601001', '华润万家有限公司', '深圳市供应链科技有限公司', 5000000.00, 4000000.00, 'overdue', 45, 'high'),
('c002', 'BL202601002', '永辉超市股份有限公司', '广州市食品贸易有限公司', 3200000.00, 2560000.00, 'in_collection', 30, 'medium'),
('c003', 'BL202601003', '沃尔玛(中国)投资有限公司', '东莞市电子制造有限公司', 8500000.00, 6800000.00, 'confirmed', 0, 'low'),
('c004', 'BL202601004', '家乐福(中国)管理咨询服务有限公司', '佛山市建材有限公司', 1800000.00, 1440000.00, 'confirmation_withdrawn', 60, 'critical'),
('c005', 'BL202601005', '大润发流通事业股份有限公司', '中山市服装有限公司', 2600000.00, 2080000.00, 'in_negotiation', 25, 'medium'),
('c006', 'BL202601006', '永旺(中国)商业有限公司', '惠州市家电有限公司', 4100000.00, 3280000.00, 'in_repayment', 15, 'low'),
('c007', 'BL202601007', '北京京客隆商业集团股份有限公司', '珠海市化工有限公司', 950000.00, 760000.00, 'settled', 0, 'low'),
('c008', 'BL202601008', '联华超市股份有限公司', '江门市家具制造有限公司', 6700000.00, 5360000.00, 'overdue', 90, 'critical');

-- 测试发票数据
INSERT OR IGNORE INTO invoice (id, business_no, invoice_no, seller_name, amount, tax_amount, goods_description, issue_date, due_date, status, version) VALUES
('inv001', 'BL202601001', 'FP2026010001', '深圳市供应链科技有限公司', 5000000.00, 650000.00, '电子产品一批', '2026-01-15', '2026-04-15', 'issued', 1),
('inv002', 'BL202601002', 'FP2026010002', '广州市食品贸易有限公司', 3200000.00, 416000.00, '食品饮料一批', '2026-01-20', '2026-04-20', 'issued', 1),
('inv003', 'BL202601003', 'FP2026010003', '东莞市电子制造有限公司', 8500000.00, 1105000.00, '电子元器件', '2026-02-01', '2026-05-01', 'issued', 1),
('inv004', 'BL202601004', 'FP2026010004', '佛山市建材有限公司', 1800000.00, 234000.00, '建筑材料', '2026-01-10', '2026-04-10', 'issued', 1),
('inv005', 'BL202601005', 'FP2026010005', '中山市服装有限公司', 2600000.00, 338000.00, '服装', '2026-01-25', '2026-04-25', 'issued', 1),
('inv006', 'BL202601006', 'FP2026010006', '惠州市家电有限公司', 4100000.00, 533000.00, '家用电器', '2026-02-10', '2026-05-10', 'issued', 1),
('inv007', 'BL202601007', 'FP2026010007', '珠海市化工有限公司', 950000.00, 123500.00, '化工产品', '2026-01-05', '2026-04-05', 'issued', 1),
('inv008', 'BL202601008', 'FP2026010008', '江门市家具制造有限公司', 6700000.00, 871000.00, '办公家具', '2026-01-01', '2026-04-01', 'issued', 1);

-- 测试买方确认数据
INSERT OR IGNORE INTO confirmation (id, business_no, confirm_date, confirm_amount, goods_received, quality_issue, confirmer, is_withdrawn, withdraw_reason, status, version) VALUES
('conf001', 'BL202601001', '2026-01-18', 5000000.00, 1, 0, '张经理', 0, '', 'confirmed', 1),
('conf002', 'BL202601002', '2026-01-22', 3200000.00, 1, 0, '李主管', 0, '', 'confirmed', 1),
('conf003', 'BL202601003', '2026-02-03', 8500000.00, 1, 0, '王总监', 0, '', 'confirmed', 1),
('conf004', 'BL202601004', '2026-01-12', 1800000.00, 1, 1, '赵经理', 1, '发现质量问题，申请撤销确认', 'withdrawn', 2),
('conf005', 'BL202601005', '2026-01-28', 2600000.00, 1, 0, '刘经理', 0, '', 'confirmed', 1),
('conf006', 'BL202601006', '2026-02-12', 4100000.00, 1, 0, '陈主管', 0, '', 'confirmed', 1),
('conf007', 'BL202601007', '2026-01-08', 950000.00, 1, 0, '周经理', 0, '', 'confirmed', 1),
('conf008', 'BL202601008', '2026-01-03', 6700000.00, 1, 0, '吴总监', 0, '', 'confirmed', 1);

-- 测试保理合同数据
INSERT OR IGNORE INTO factoring_contract (id, business_no, contract_no, factoring_rate, financing_amount, start_date, end_date, status, version) VALUES
('cont001', 'BL202601001', 'HT202601001', 0.085, 4000000.00, '2026-01-20', '2026-04-20', 'active', 1),
('cont002', 'BL202601002', 'HT202601002', 0.080, 2560000.00, '2026-01-25', '2026-04-25', 'active', 1),
('cont003', 'BL202601003', 'HT202601003', 0.075, 6800000.00, '2026-02-05', '2026-05-05', 'active', 1),
('cont004', 'BL202601004', 'HT202601004', 0.090, 1440000.00, '2026-01-15', '2026-04-15', 'active', 1),
('cont005', 'BL202601005', 'HT202601005', 0.085, 2080000.00, '2026-01-30', '2026-04-30', 'active', 1),
('cont006', 'BL202601006', 'HT202601006', 0.078, 3280000.00, '2026-02-15', '2026-05-15', 'active', 1),
('cont007', 'BL202601007', 'HT202601007', 0.082, 760000.00, '2026-01-10', '2026-04-10', 'completed', 1),
('cont008', 'BL202601008', 'HT202601008', 0.095, 5360000.00, '2026-01-05', '2026-04-05', 'active', 1);

-- 测试回款计划数据
INSERT OR IGNORE INTO repayment_plan (id, business_no, instalment_no, principal, interest, planned_date, status, version) VALUES
('plan001', 'BL202601001', 1, 2000000.00, 170000.00, '2026-03-15', 'overdue', 1),
('plan001a', 'BL202601001', 2, 2000000.00, 170000.00, '2026-04-15', 'pending', 1),
('plan002', 'BL202601002', 1, 1280000.00, 102400.00, '2026-03-20', 'overdue', 1),
('plan002a', 'BL202601002', 2, 1280000.00, 102400.00, '2026-04-20', 'pending', 1),
('plan003', 'BL202601003', 1, 3400000.00, 255000.00, '2026-04-01', 'pending', 1),
('plan003a', 'BL202601003', 2, 3400000.00, 255000.00, '2026-05-01', 'pending', 1),
('plan004', 'BL202601004', 1, 720000.00, 64800.00, '2026-03-10', 'overdue', 1),
('plan004a', 'BL202601004', 2, 720000.00, 64800.00, '2026-04-10', 'pending', 1),
('plan005', 'BL202601005', 1, 1040000.00, 88400.00, '2026-03-25', 'overdue', 1),
('plan005a', 'BL202601005', 2, 1040000.00, 88400.00, '2026-04-25', 'pending', 1),
('plan006', 'BL202601006', 1, 1640000.00, 127920.00, '2026-04-10', 'pending', 1),
('plan006a', 'BL202601006', 2, 1640000.00, 127920.00, '2026-05-10', 'pending', 1),
('plan007', 'BL202601007', 1, 380000.00, 31160.00, '2026-03-05', 'paid', 1),
('plan007a', 'BL202601007', 2, 380000.00, 31160.00, '2026-04-05', 'paid', 1),
('plan008', 'BL202601008', 1, 2680000.00, 254600.00, '2026-03-01', 'overdue', 1),
('plan008a', 'BL202601008', 2, 2680000.00, 254600.00, '2026-04-01', 'overdue', 1);

-- 测试催收记录数据
INSERT OR IGNORE INTO collection_note (id, business_no, collection_date, collector, collection_method, contact_person, contact_result, next_action, follow_up_date) VALUES
('note001', 'BL202601001', '2026-04-20', '李华', 'phone', '张经理', '承诺本周内安排部分款项', '跟进付款进度', '2026-05-05'),
('note002', 'BL202601001', '2026-04-25', '李华', 'visit', '张经理', '现场沟通，对方表示资金紧张', '发正式催款函', '2026-05-10'),
('note003', 'BL202601002', '2026-04-22', '李华', 'email', '李主管', '已收到催款通知，正在走审批流程', '电话确认审批进度', '2026-05-03'),
('note004', 'BL202601004', '2026-04-15', '李华', 'legal', '公司法务', '质量争议已进入调解程序', '准备诉讼材料', '2026-05-20'),
('note005', 'BL202601005', '2026-04-28', '李华', 'phone', '刘经理', '协商分期还款方案', '提交方案供审批', '2026-05-08'),
('note006', 'BL202601008', '2026-04-10', '李华', 'visit', '吴总监', '对方承认欠款但无力支付', '启动法律程序', '2026-05-15');

-- 测试风险报告数据
INSERT OR IGNORE INTO risk_report (id, business_no, risk_level, report_date, analyst, key_findings, recommendations) VALUES
('risk001', 'BL202601001', 'high', '2026-04-30', '张明', '买方近期现金流紧张，已有3笔应付款逾期，累计逾期金额超过1200万', '建议增加担保措施，考虑债务重组'),
('risk002', 'BL202601004', 'critical', '2026-04-25', '张明', '买方撤销确认，存在质量争议，可能需要通过法律途径解决', '建议立即启动资产保全程序'),
('risk003', 'BL202601008', 'critical', '2026-04-28', '张明', '逾期超过90天，买方经营状况恶化，已出现拖欠供应商货款情况', '建议移交法务处理，启动坏账计提'),
('risk004', 'BL202601002', 'medium', '2026-04-30', '张明', '逾期30天，买方属于区域龙头企业，过往信用记录良好', '建议加大催收力度，保持沟通频率');

-- 测试状态流转数据
INSERT OR IGNORE INTO state_transition (id, business_no, from_status, to_status, transition_type, reason, impact_scope, next_step, operator_id, operator_name) VALUES
('trans001', 'BL202601001', 'confirmed', 'overdue', 'normal', '到期未收到款项', '该笔业务及关联的2笔保理融资', '启动催收程序', 'u002', '李华'),
('trans002', 'BL202601004', 'confirmed', 'confirmation_withdrawn', 'reverse', '买方以质量问题为由撤销确认', '涉及金额180万，可能影响后续确权流程', '启动质量鉴定，准备法律材料', 'u001', '张明'),
('trans003', 'BL202601002', 'overdue', 'in_collection', 'normal', '逾期超过15天', '单案影响，金额320万', '安排催收专员跟进', 'u002', '李华'),
('trans004', 'BL202601005', 'overdue', 'in_negotiation', 'normal', '买方提出分期还款方案', '单案影响，金额260万', '评估还款方案可行性', 'u003', '王芳'),
('trans005', 'BL202601008', 'overdue', 'in_collection', 'normal', '逾期超过60天', '单案影响，金额670万', '升级催收等级', 'u002', '李华'),
('trans006', 'BL202601007', 'in_repayment', 'settled', 'normal', '全额回款完成', '无影响', '归档结案', 'u003', '王芳');

-- 测试回款数据
INSERT OR IGNORE INTO repayment (id, business_no, repayment_date, total_amount, principal_paid, interest_paid, penalty_paid, payer, remark, write_off_status) VALUES
('pay001', 'BL202601006', '2026-04-20', 1500000.00, 1400000.00, 100000.00, 0.00, '永旺(中国)商业有限公司', '第一期部分回款', 'partial'),
('pay002', 'BL202601007', '2026-03-08', 411160.00, 380000.00, 31160.00, 0.00, '北京京客隆商业集团股份有限公司', '第一期回款', 'full'),
('pay003', 'BL202601007', '2026-04-08', 411160.00, 380000.00, 31160.00, 0.00, '北京京客隆商业集团股份有限公司', '第二期回款，已结清', 'full'),
('pay004', 'BL202601001', '2026-04-28', 500000.00, 450000.00, 50000.00, 0.00, '华润万家有限公司', '逾期后部分回款', 'partial'),
('pay005', 'BL202601002', '2026-04-30', 1000000.00, 950000.00, 50000.00, 0.00, '永辉超市股份有限公司', '部分回款', 'partial');

-- 测试版本历史数据
INSERT OR IGNORE INTO version_history (id, record_id, record_type, version, before_data, after_data, changed_fields, operator_id, operator_name, change_reason) VALUES
('vh001', 'conf004', 'confirmation', 2,
  '{"confirm_date":"2026-01-12","confirm_amount":1800000,"goods_received":true,"quality_issue":false,"confirmer":"赵经理","is_withdrawn":false,"status":"confirmed"}',
  '{"confirm_date":"2026-01-12","confirm_amount":1800000,"goods_received":true,"quality_issue":true,"quality_issue_desc":"部分货物存在质量问题","confirmer":"赵经理","is_withdrawn":true,"withdraw_reason":"发现质量问题，申请撤销确认","withdraw_date":"2026-03-10","status":"withdrawn"}',
  'quality_issue,quality_issue_desc,is_withdrawn,withdraw_reason,withdraw_date,status',
  'u001', '张明', '买方提出质量异议，撤销确认');

-- 测试审计日志数据
INSERT OR IGNORE INTO audit_log (id, user_id, user_name, action, target_type, target_id, ip_address, detail) VALUES
('log001', 'u001', '张明', 'import_data', 'invoice', 'inv001,inv002', '192.168.1.100', '批量导入发票数据8条'),
('log002', 'u001', '张明', 'import_data', 'confirmation', 'conf001-conf008', '192.168.1.100', '批量导入确权数据8条'),
('log003', 'u002', '李华', 'update_status', 'business_case', 'c001', '192.168.1.101', '案件状态变更: 已确权 -> 逾期'),
('log004', 'u001', '张明', 'update_status', 'business_case', 'c004', '192.168.1.100', '案件状态变更: 已确权 -> 已撤确认，原因: 买方提出质量异议'),
('log005', 'u002', '李华', 'add_collection_note', 'collection_note', 'note001', '192.168.1.101', '新增催收记录: 电话催收华润万家'),
('log006', 'u003', '王芳', 'generate_report', 'risk_report', 'risk001', '192.168.1.102', '生成风险评估报告');

-- 测试业务关联数据
INSERT OR IGNORE INTO business_link (id, source_id, source_type, target_id, target_type, link_type, confidence) VALUES
('link001', 'c001', 'case', 'inv001', 'invoice', 'has_invoice', 100),
('link002', 'c001', 'case', 'conf001', 'confirmation', 'has_confirmation', 100),
('link003', 'c001', 'case', 'cont001', 'contract', 'has_contract', 100),
('link004', 'inv001', 'invoice', 'conf001', 'confirmation', 'confirmed_by', 100),
('link005', 'conf001', 'confirmation', 'cont001', 'contract', 'financed_by', 100);
