const fs = require('fs');
const path = require('path');
const { db, initSchema } = require('./db');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

initSchema();

const SEED_STUDENTS = [
  { id: '20230101', name: '张三', type: '困难补助', monthly: 300, daily: 15 },
  { id: '20230102', name: '李四', type: '普通助学金', monthly: 200, daily: 10 },
  { id: '20230103', name: '王五', type: '特困补助', monthly: 400, daily: 20 },
  { id: '20230104', name: '赵六', type: '普通助学金', monthly: 200, daily: 10 },
  { id: '20230105', name: '钱七', type: '困难补助', monthly: 300, daily: 15 },
  { id: '20230106', name: '孙八', type: '无', monthly: 0, daily: 0 },
];

const SEED_BATCH = {
  batch_no: 'BATCH-202605-001',
  subsidy_month: '2026-05',
  operator: '后勤管理-张主任'
};

const SEED_CARD_CSV = [
  'student_id,student_name,meal_date,meal_type,amount,card_time',
  '20230101,张三,2026-05-01,早餐,5.00,07:32:15',
  '20230101,张三,2026-05-01,午餐,12.00,12:15:48',
  '20230101,张三,2026-05-02,午餐,14.50,12:08:33',
  '20230102,李四,2026-05-01,午餐,8.00,12:22:10',
  '20230102,李四,2026-05-02,晚餐,9.50,18:45:20',
  '20230103,王五,2026-05-01,早餐,4.50,07:45:00',
  '20230103,王五,2026-05-01,午餐,18.00,12:10:05',
  '20230104,赵六,2026-05-03,午餐,11.00,12:30:00',
  '20230105,钱七,2026-05-01,午餐,13.00,12:18:00',
  '20230105,钱七,2026-05-01,午餐,13.00,12:25:00',
  '20230106,孙八,2026-05-01,午餐,15.00,12:05:00',
  '20230101,张三,2026-05-15,午餐,0.00,12:00:00',
  '20230201,未知学生,2026-05-01,午餐,20.00,12:00:00',
  '20230103,王五,2026-05-10,午餐,25.00,12:15:00',
  '20230104,赵六,2026-05-05,早餐,3.00,07:50:00',
].join('\n');

const SEED_SUBSIDY_JSON = [
  { student_id: '20230101', student_name: '张三', subsidy_type: '困难补助', monthly_limit: 300, daily_limit: 15 },
  { student_id: '20230102', student_name: '李四', subsidy_type: '普通助学金', monthly_limit: 200, daily_limit: 10 },
  { student_id: '20230103', student_name: '王五', subsidy_type: '特困补助', monthly_limit: 400, daily_limit: 20 },
  { student_id: '20230104', student_name: '赵六', subsidy_type: '普通助学金', monthly_limit: 200, daily_limit: 10 },
  { student_id: '20230105', student_name: '钱七', subsidy_type: '困难补助', monthly_limit: 300, daily_limit: 15 },
];

const SEED_REFUND_CSV = [
  'student_id,student_name,refund_date,refund_amount,refund_reason',
  '20230101,张三,2026-05-02,14.50,菜品质量问题退餐',
  '20230103,王五,2026-05-10,25.00,当日未就餐',
].join('\n');

function seed() {
  console.log('=== 开始生成样例数据 ===');

  db.prepare('DELETE FROM operation_logs').run();
  db.prepare('DELETE FROM processed_records').run();
  db.prepare('DELETE FROM refund_records').run();
  db.prepare('DELETE FROM subsidy_lists').run();
  db.prepare('DELETE FROM card_records').run();
  db.prepare('DELETE FROM batches').run();

  const batchService = require('./batchService');
  const dataParser = require('./dataParser');

  const batchId = batchService.createBatch(
    SEED_BATCH.batch_no,
    SEED_BATCH.subsidy_month,
    SEED_BATCH.operator,
    '2026年5月餐饮补贴批次 - 样例数据'
  );
  console.log(`[1] 创建批次: ID=${batchId}, 批次号=${SEED_BATCH.batch_no}`);

  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const cardPath = path.join(uploadsDir, 'sample_cards.csv');
  fs.writeFileSync(cardPath, SEED_CARD_CSV);
  const rawCards = dataParser.parseCardCSV(cardPath);
  const normCards = rawCards.map(dataParser.normalizeCardRecord);
  const cardResult = batchService.importCardRecords(batchId, normCards, SEED_BATCH.operator);
  console.log(`[2] 导入刷卡记录: 新增=${cardResult.added}, 更新=${cardResult.updated}, 总=${cardResult.total}`);

  const subsResult = batchService.importSubsidyList(batchId, SEED_SUBSIDY_JSON, SEED_BATCH.operator);
  console.log(`[3] 导入补贴名单: 新增=${subsResult.added}, 总=${subsResult.total}`);

  const refundPath = path.join(uploadsDir, 'sample_refunds.csv');
  fs.writeFileSync(refundPath, SEED_REFUND_CSV);
  const rawRefunds = dataParser.parseRefundCSV(refundPath);
  const normRefunds = rawRefunds.map(dataParser.normalizeRefundRecord);
  const refResult = batchService.importRefundRecords(batchId, normRefunds, SEED_BATCH.operator);
  console.log(`[4] 导入退款记录: 新增=${refResult.added}`);

  console.log('\n=== 开始模拟人工审核流程 ===\n');

  const allCards = db.prepare('SELECT * FROM card_records WHERE batch_id = ? ORDER BY id').all(batchId);

  allCards.forEach(card => {
    console.log(`记录 #${card.id}: ${card.student_id} ${card.student_name} ${card.meal_date} ${card.meal_type} ${card.amount}元`);

    const issues = [];

    if (!card.student_id || card.student_id === '未知学生') {
      issues.push('学号无效或学生不存在');
    }

    if (card.amount === 0) {
      issues.push('金额为零，疑似记录异常');
    }

    const dup = db.prepare(
      'SELECT id FROM card_records WHERE batch_id = ? AND student_id = ? AND meal_date = ? AND meal_type = ? AND id < ?'
    ).get(batchId, card.student_id, card.meal_date, card.meal_type, card.id);
    if (dup) {
      issues.push('重复领取：同日同餐存在多条记录');
    }

    const subsidy = db.prepare('SELECT * FROM subsidy_lists WHERE student_id = ?').get(card.student_id);
    if (subsidy) {
      if (subsidy.daily_limit > 0 && card.amount > subsidy.daily_limit) {
        issues.push(`超出单日补贴上限${subsidy.daily_limit}元`);
      }
    } else if (card.student_id !== '未知学生' && card.student_id !== '20230106') {
      issues.push('学生不在补贴名单中');
    }

    if (issues.length > 0) {
      console.log(`  ⚠ 问题: ${issues.join('; ')}`);
    } else {
      console.log(`  ✓ 无异常`);
    }
  });

  console.log('\n=== 模拟处理结果 ===\n');

  const processCard = (cardId, action, reason, finalAmount, operator) => {
    const card = db.prepare('SELECT * FROM card_records WHERE id = ?').get(cardId);
    const result = batchService.processCardRecord(cardId, operator, action, reason, finalAmount);
    const statusText = action === 'approve' ? '通过' : action === 'reject' ? '拒绝' : action === 'return' ? '退回' : '重置';
    console.log(`  记录#${cardId} [${card.student_id} ${card.meal_date} ${card.meal_type}] → ${statusText} | 原因: ${reason}`);
    return result;
  };

  const OPERATOR = '审核员-王老师';

  processCard(1, 'approve', '正常刷卡，补贴内', 5.0, OPERATOR);
  processCard(2, 'approve', '正常刷卡，补贴内', 12.0, OPERATOR);
  processCard(3, 'return', '金额异常偏高，请核实当日菜品', null, OPERATOR);
  processCard(4, 'approve', '正常刷卡', 8.0, OPERATOR);
  processCard(5, 'approve', '正常刷卡', 9.5, OPERATOR);
  processCard(6, 'approve', '正常刷卡', 4.5, OPERATOR);
  processCard(7, 'approve', '正常刷卡，补贴内', 18.0, OPERATOR);
  processCard(8, 'approve', '正常刷卡', 11.0, OPERATOR);
  processCard(9, 'approve', '正常刷卡', 13.0, OPERATOR);
  processCard(10, 'reject', '重复领取：同日同餐已存在记录#9', null, OPERATOR);
  processCard(11, 'reject', '学生不在补贴名单中，不予补贴', null, OPERATOR);
  processCard(12, 'return', '金额为零，疑似系统故障或测试记录，请核实', null, OPERATOR);
  processCard(13, 'reject', '学号无效，无法匹配学生信息', null, OPERATOR);
  processCard(14, 'return', '超出单日补贴上限20元，需特殊审批', null, OPERATOR);
  processCard(15, 'approve', '正常刷卡', 3.0, OPERATOR);

  console.log('\n=== 模拟退款处理 ===\n');

  const refunds = db.prepare('SELECT * FROM refund_records WHERE batch_id = ?').all(batchId);
  refunds.forEach(refund => {
    const result = batchService.processRefundRecord(refund.id, OPERATOR, 'match', `退款原因: ${refund.refund_reason}`);
    if (result.success) {
      console.log(`  退款#${refund.id} [${refund.student_id} ${refund.refund_date} ${refund.refund_amount}元] → 匹配刷卡记录#${result.matchedCardId}`);
    } else {
      console.log(`  退款#${refund.id} [${refund.student_id}] → 匹配失败: ${result.error}`);
    }
  });

  console.log('\n=== 样例数据生成完成 ===');
  console.log(`\n提示: 运行 npm start 启动服务后，可通过以下接口查看数据:`);
  console.log(`  GET http://localhost:3000/api/batches/${batchId}  - 批次详情`);
  console.log(`  GET http://localhost:3000/api/history?student_id=20230101  - 张三历史记录`);
  console.log(`  GET http://localhost:3000/api/history?subsidy_month=2026-05  - 5月全部记录`);
  console.log(`  GET http://localhost:3000/api/students/20230101  - 张三完整档案`);
  console.log(`  GET http://localhost:3000/api/operation-logs?batch_id=${batchId}  - 操作日志`);
  console.log(`  GET http://localhost:3000/api/card-records?batch_id=${batchId}&check_result=returned  - 待修改记录`);
}

seed();
