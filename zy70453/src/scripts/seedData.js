const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { runQuery, getQuery, allQuery } = require('../config/database');

const MEMBER_NAMES = [
  '张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十',
  '郑一', '王二', '冯三', '陈四', '褚五', '卫六', '蒋七', '沈八'
];

const SAMPLE_TYPES = ['血液检测', '尿液检测', '基因检测', '影像检查', '生化分析'];

async function generateMembers() {
  console.log('生成会员数据...');
  const members = [];
  
  for (let i = 0; i < 15; i++) {
    const member = {
      id: uuidv4(),
      name: MEMBER_NAMES[i],
      phone: `138${String(10000000 + i).slice(0, 8)}`,
      email: `user${i + 1}@example.com`,
      membership_type: i % 3 === 0 ? 'premium' : i % 3 === 1 ? 'standard' : 'basic',
      status: i < 12 ? 'active' : 'inactive',
      expire_date: moment().add(i + 1, 'months').format('YYYY-MM-DD')
    };
    members.push(member);
    
    await runQuery(
      `INSERT INTO members (id, name, phone, email, membership_type, status, expire_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [member.id, member.name, member.phone, member.email, 
       member.membership_type, member.status, member.expire_date]
    );
  }
  
  console.log(`生成 ${members.length} 条会员记录`);
  return members;
}

async function generateRenewalTransactions(members) {
  console.log('生成续费流水数据...');
  const transactions = [];
  
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const count = i % 3 + 1;
    
    for (let j = 0; j < count; j++) {
      const transaction = {
        id: uuidv4(),
        member_id: member.id,
        amount: (300 + Math.random() * 700).toFixed(2),
        plan_months: [1, 3, 6, 12][Math.floor(Math.random() * 4)],
        payment_method: ['现金', '转账', '微信', '支付宝'][Math.floor(Math.random() * 4)],
        status: j === count - 1 && i === members.length - 2 ? 'rolled_back' : 
                Math.random() > 0.1 ? 'completed' : 'pending',
        rollback_evidence: null,
        boundary_input: Math.random() > 0.7 ? JSON.stringify({ 
          edgeCase: ['expired_just_now', 'near_expire', 'grace_period'][Math.floor(Math.random() * 3)],
          boundaryValue: Math.random() * 100
        }) : null,
        processed_result: null,
        operator_id: `OP${String(Math.floor(Math.random() * 100)).padStart(3, '0')}`,
        operator_name: ['管理员A', '管理员B', '管理员C'][Math.floor(Math.random() * 3)],
        remark: j === 0 ? '首次续费优惠' : ''
      };
      
      if (j === count - 1 && i === members.length - 2) {
        transaction.remark = '回滚无证据记录 - 用于复核测试';
        transaction.rollback_evidence = null;
        transaction.processed_result = JSON.stringify({
          reviewRequired: true,
          missingEvidence: true,
          suggestedAction: 'manual_verification',
          boundaryFlag: 'ROLLBACK_NO_EVIDENCE'
        });
      }
      
      transactions.push(transaction);
      
      await runQuery(
        `INSERT INTO renewal_transactions 
         (id, member_id, amount, plan_months, payment_method, status, 
          rollback_evidence, boundary_input, processed_result, 
          operator_id, operator_name, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [transaction.id, transaction.member_id, transaction.amount, 
         transaction.plan_months, transaction.payment_method, transaction.status,
         transaction.rollback_evidence, transaction.boundary_input, 
         transaction.processed_result, transaction.operator_id, 
         transaction.operator_name, transaction.remark]
      );
    }
  }
  
  console.log(`生成 ${transactions.length} 条续费流水记录`);
  console.log('已创建1条特殊回滚无证据记录用于复核');
  return transactions;
}

async function generateLabSamples(members) {
  console.log('生成实验室样本数据...');
  const samples = [];
  
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    if (Math.random() > 0.4) {
      const sample = {
        id: uuidv4(),
        member_id: member.id,
        sample_type: SAMPLE_TYPES[Math.floor(Math.random() * SAMPLE_TYPES.length)],
        sample_no: `LAB${moment().format('YYYYMMDD')}${String(i + 1000).padStart(4, '0')}`,
        manual_remark: i % 4 === 0 ? `人工备注：样本${i + 1}需要特别关注，检测指标异常` : null,
        status: ['pending', 'processing', 'completed'][Math.floor(Math.random() * 3)],
        operator_id: `LAB${String(Math.floor(Math.random() * 50)).padStart(3, '0')}`
      };
      samples.push(sample);
      
      await runQuery(
        `INSERT INTO lab_samples 
         (id, member_id, sample_type, sample_no, manual_remark, status, operator_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sample.id, sample.member_id, sample.sample_type, 
         sample.sample_no, sample.manual_remark, sample.status, sample.operator_id]
      );
    }
  }
  
  console.log(`生成 ${samples.length} 条实验室样本记录`);
  return samples;
}

async function initSystemSettings() {
  console.log('初始化系统设置...');
  
  const settings = [
    { key: 'batch_disable_switch', value: 'true', description: '批量禁用开关' },
    { key: 'auto_rollback_enabled', value: 'false', description: '自动回滚开关' },
    { key: 'review_required_threshold', value: '3', description: '复核阈值' },
    { key: 'export_format_default', value: 'json', description: '默认导出格式' }
  ];
  
  for (const setting of settings) {
    await runQuery(
      `INSERT OR REPLACE INTO system_settings (key, value, description) VALUES (?, ?, ?)`,
      [setting.key, setting.value, setting.description]
    );
  }
  
  console.log('系统设置初始化完成');
}

async function seedAll() {
  try {
    console.log('=== 开始生成演示数据 ===\n');
    
    const members = await generateMembers();
    await generateRenewalTransactions(members);
    await generateLabSamples(members);
    await initSystemSettings();
    
    console.log('\n=== 演示数据生成完成 ===');
    console.log('\n数据说明：');
    console.log('1. 包含15条会员记录');
    console.log('2. 包含多条续费流水，其中1条为回滚无证据的特殊记录');
    console.log('3. 部分样本包含人工备注');
    console.log('4. 系统设置已初始化，批量禁用开关已开启');
    console.log('5. 边界输入处理结果已预留，可直接定位复核');
    
  } catch (error) {
    console.error('生成演示数据失败:', error);
    throw error;
  }
}

if (require.main === module) {
  seedAll().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { seedAll };