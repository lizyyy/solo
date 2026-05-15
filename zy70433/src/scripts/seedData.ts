import { v4 as uuidv4 } from 'uuid';
import { runExecute, db } from '../database/db';

const departments = [
  { id: uuidv4(), name: '金融科技部', code: 'FIN-TECH-001' },
  { id: uuidv4(), name: '零售业务部', code: 'RETAIL-002' },
  { id: uuidv4(), name: '公司业务部', code: 'CORP-003' },
  { id: uuidv4(), name: '风险管理部', code: 'RISK-004' },
  { id: uuidv4(), name: '运营管理部', code: 'OPS-005' },
];

const ruleVersions = [
  {
    version: 'v1.0.0',
    description: '初始版本：基础配额算法，按部门历史发放记录加权',
    effective_date: '2024-01-01 00:00:00',
  },
  {
    version: 'v1.1.0',
    description: '优化版本：增加临时白名单权重系数1.2',
    effective_date: '2024-03-15 00:00:00',
  },
  {
    version: 'v2.0.0',
    description: '重大变更：引入合同补充页作为审批依据',
    effective_date: '2024-06-01 00:00:00',
  },
];

const offlineContracts = [
  {
    id: uuidv4(),
    department_id: departments[0].id,
    contract_no: 'HT-2024-JRKJ-001',
    supplement_page_no: '补-003',
    content: '关于2024年度金融科技部系统升级项目专项配额补充协议。经双方协商，同意在原合同基础上增加专项配额500万元，用于核心系统分布式改造。补充条款：1. 专项配额须专款专用；2. 按季度提交使用报告；3. 有效期至2024年12月31日。',
    status: 'approved',
  },
  {
    id: uuidv4(),
    department_id: departments[1].id,
    contract_no: 'HT-2024-LSYW-007',
    supplement_page_no: '补-012',
    content: '零售业务部2024年普惠金融专项额度补充协议。新增小额信贷专项配额300万元，用于支持小微企业融资。审批条件：单笔额度不超过50万元，综合年化利率不超过6%。',
    status: 'approved',
  },
  {
    id: uuidv4(),
    department_id: departments[2].id,
    contract_no: 'HT-2024-GSYW-015',
    supplement_page_no: null,
    content: '公司业务部年度常规配额申请。根据2023年完成情况，申请2024年度基础配额800万元。',
    status: 'pending',
  },
];

const temporaryWhitelist = [
  {
    id: uuidv4(),
    department_id: departments[0].id,
    applicant: '张三',
    reason: '核心系统紧急升级，需临时增加资源配额用于压力测试',
    quota_amount: 2000000,
    is_revoked: 0,
    effective_date: '2024-05-01 00:00:00',
    expiry_date: '2024-08-01 23:59:59',
  },
  {
    id: uuidv4(),
    department_id: departments[1].id,
    applicant: '李四',
    reason: '季度营销活动临时配额',
    quota_amount: 500000,
    is_revoked: 1,
    effective_date: '2024-04-01 00:00:00',
    expiry_date: '2024-04-30 23:59:59',
  },
  {
    id: uuidv4(),
    department_id: departments[3].id,
    applicant: '王五',
    reason: '风险模型训练专项临时配额-未撤销-复核专用',
    quota_amount: 1500000,
    is_revoked: 0,
    effective_date: '2024-05-10 00:00:00',
    expiry_date: '2024-11-10 23:59:59',
  },
];

const paymentReceipts = [
  {
    id: uuidv4(),
    channel_code: 'ALIPAY-001',
    transaction_id: 'TXN-20240501-0001',
    amount: 500000,
    manual_remark: '金融科技部首笔款项，已核对发票',
    caller_id: 'SYS-ADMIN-001',
  },
  {
    id: uuidv4(),
    channel_code: 'WECHAT-002',
    transaction_id: 'TXN-20240502-0003',
    amount: 300000,
    manual_remark: '零售业务部活动经费，财务复核通过',
    caller_id: 'FIN-USER-002',
  },
];

async function seedData() {
  console.log('开始导入演示数据...');

  for (const dept of departments) {
    await runExecute(
      'INSERT INTO departments (id, name, code) VALUES (?, ?, ?)',
      [dept.id, dept.name, dept.code]
    );
  }
  console.log('✓ 部门数据导入完成');

  for (const rule of ruleVersions) {
    await runExecute(
      'INSERT INTO rule_versions (version, description, effective_date) VALUES (?, ?, ?)',
      [rule.version, rule.description, rule.effective_date]
    );
  }
  console.log('✓ 规则版本数据导入完成');

  for (const contract of offlineContracts) {
    await runExecute(
      'INSERT INTO offline_contracts (id, department_id, contract_no, supplement_page_no, content, status) VALUES (?, ?, ?, ?, ?, ?)',
      [contract.id, contract.department_id, contract.contract_no, contract.supplement_page_no, contract.content, contract.status]
    );
  }
  console.log('✓ 离线合同补充页数据导入完成');

  for (const item of temporaryWhitelist) {
    await runExecute(
      'INSERT INTO temporary_whitelist (id, department_id, applicant, reason, quota_amount, is_revoked, effective_date, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [item.id, item.department_id, item.applicant, item.reason, item.quota_amount, item.is_revoked, item.effective_date, item.expiry_date]
    );
  }
  console.log('✓ 临时白名单数据导入完成（含复核专用未撤销记录）');

  for (const receipt of paymentReceipts) {
    await runExecute(
      'INSERT INTO payment_receipts (id, channel_code, transaction_id, amount, manual_remark, caller_id) VALUES (?, ?, ?, ?, ?, ?)',
      [receipt.id, receipt.channel_code, receipt.transaction_id, receipt.amount, receipt.manual_remark, receipt.caller_id]
    );
  }
  console.log('✓ 支付渠道回执数据导入完成');

  console.log('\n演示数据导入成功！');
  console.log('特别说明：风险管理部的白名单记录(is_revoked=0)专门用于复核验证');
  
  db.close();
}

seedData().catch(console.error);
