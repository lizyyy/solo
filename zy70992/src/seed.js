const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'uploads');
[dataDir, uploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const { db, initSchema } = require('./db');
initSchema();

const SEED_BATCH = { batch_no: 'SUBSIDY-2026-05', subsidy_month: '2026-05', operator: '系统管理员' };

const SEED_CARD_CSV = [
  'student_id,student_name,meal_date,meal_type,amount,card_time',
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
  '20230104,赵六,2026-05-05,早餐,3.00,07:50:00'
].join('\n');

const SEED_SUBSIDY_JSON = [
  { student_id: '20230101', student_name: '张三', subsidy_type: '困难补助', monthly_limit: 300, daily_limit: 15, meal_limit: 3 },
  { student_id: '20230102', student_name: '李四', subsidy_type: '普通助学金', monthly_limit: 200, daily_limit: 10, meal_limit: 2 },
  { student_id: '20230103', student_name: '王五', subsidy_type: '特困补助', monthly_limit: 400, daily_limit: 20, meal_limit: 3 },
  { student_id: '20230104', student_name: '赵六', subsidy_type: '普通助学金', monthly_limit: 200, daily_limit: 10, meal_limit: 2 },
  { student_id: '20230105', student_name: '钱七', subsidy_type: '困难补助', monthly_limit: 300, daily_limit: 15, meal_limit: 3 }
];

const SEED_REFUND_CSV = [
  'student_id,student_name,refund_date,refund_amount,refund_reason',
  '20230101,张三,2026-05-02,14.50,菜品质量问题退餐',
  '20230103,王五,2026-05-10,25.00,当日未就餐'
].join('\n');

function seed() {
  console.log('=== 开始生成样例数据 ===\n');

  db.prepare('DELETE FROM operation_logs').run();
  db.prepare('DELETE FROM processed_records').run();
  db.prepare('DELETE FROM refund_records').run();
  db.prepare('DELETE FROM subsidy_lists').run();
  db.prepare('DELETE FROM card_records').run();
  db.prepare('DELETE FROM batches').run();

  var batchService = require('./batchService');
  var dataParser = require('./dataParser');

  var batchId = batchService.createBatch(
    SEED_BATCH.batch_no, SEED_BATCH.subsidy_month, SEED_BATCH.operator, '2026年5月餐饮补贴批次 - 样例数据'
  );
  console.log('[1] 创建批次: ID=' + batchId + ', 批次号=' + SEED_BATCH.batch_no);

  var subsResult = batchService.importSubsidyList(batchId, SEED_SUBSIDY_JSON, SEED_BATCH.operator);
  console.log('[2] 导入补贴名单: 新增=' + subsResult.added);

  var cardPath = path.join(uploadsDir, 'sample_cards.csv');
  fs.writeFileSync(cardPath, SEED_CARD_CSV);
  var rawCards = dataParser.parseCardCSV(cardPath);
  var normCards = rawCards.map(dataParser.normalizeCardRecord);
  var cardResult = batchService.importCardRecords(batchId, normCards, SEED_BATCH.operator);
  console.log('[3] 导入刷卡记录: 新增=' + cardResult.added);
  console.log('    校验结果: returned=' + cardResult.validation_summary.returned + ', warning=' + cardResult.validation_summary.warning + ', pending=' + cardResult.validation_summary.pending);

  var refundPath = path.join(uploadsDir, 'sample_refunds.csv');
  fs.writeFileSync(refundPath, SEED_REFUND_CSV);
  var rawRefunds = dataParser.parseRefundCSV(refundPath);
  var normRefunds = rawRefunds.map(dataParser.normalizeRefundRecord);
  var refResult = batchService.importRefundRecords(batchId, normRefunds, SEED_BATCH.operator);
  console.log('[4] 导入退款记录: 新增=' + refResult.added);

  console.log('\n=== 导入校验结果 ===\n');
  var allCards = db.prepare('SELECT * FROM card_records WHERE batch_id = ? ORDER BY id').all(batchId);
  allCards.forEach(function(card) {
    var tag = card.check_result === 'pending' ? '?' : card.check_result === 'warning' ? 'WARN' : card.check_result === 'returned' ? 'RET' : 'OK';
    console.log(tag + ' #' + card.id + ' ' + card.student_id + ' ' + card.student_name + ' ' + card.meal_date + ' ' + card.meal_type + ' ' + card.amount);
    if (card.check_reason) console.log('     原因: ' + card.check_reason);
  });

  console.log('\n=== 模拟人工审核 ===\n');
  var cards = db.prepare('SELECT * FROM card_records WHERE batch_id = ? ORDER BY id').all(batchId);
  var OPERATOR = '审核员-王老师';
  cards.forEach(function(card) {
    var action, reason;
    if (card.check_result === 'returned') {
      if (card.check_reason && card.check_reason.indexOf('重复') >= 0) { action = 'reject'; reason = '重复领取，不予补贴'; }
      else if (card.check_reason && card.check_reason.indexOf('上限') >= 0) { action = 'return'; reason = '超出上限，需特殊审批'; }
      else if (card.check_reason && card.check_reason.indexOf('无效') >= 0) { action = 'reject'; reason = '记录无效'; }
      else { action = 'return'; reason = '需人工核实'; }
    } else if (card.check_result === 'warning') {
      if (card.check_reason && card.check_reason.indexOf('不在') >= 0) { action = 'reject'; reason = '不在补贴名单'; }
      else { action = 'approve'; reason = '警告后通过'; }
    } else {
      action = 'approve'; reason = '审核通过';
    }
    batchService.processCardRecord(card.id, OPERATOR, action, reason, null);
    console.log('  #' + card.id + ' [' + card.student_id + '] -> ' + (action === 'approve' ? '通过' : action === 'reject' ? '拒绝' : '退回') + ' | ' + reason);
  });

  console.log('\n=== 模拟退款处理 ===\n');
  var refunds = db.prepare('SELECT * FROM refund_records WHERE batch_id = ?').all(batchId);
  refunds.forEach(function(refund) {
    var result = batchService.processRefundRecord(refund.id, OPERATOR, 'match', '退款原因: ' + refund.refund_reason);
    if (result.success) {
      console.log('  退款#' + refund.id + ' [' + refund.student_id + '] -> 匹配刷卡#' + result.matchedCardId + ' | ' + refund.refund_amount + '元');
    } else {
      console.log('  退款#' + refund.id + ' [' + refund.student_id + '] -> 匹配失败: ' + result.error);
    }
  });

  console.log('\n=== 样例数据生成完成 ===');
  console.log('\n提示: 运行 npm start 启动服务后，可通过以下接口查看数据:');
  console.log('  GET http://localhost:3000/api/batches/' + batchId);
  console.log('  GET http://localhost:3000/api/history?student_id=20230101');
  console.log('  GET http://localhost:3000/api/students/20230101');
  console.log('  GET http://localhost:3000/api/operation-logs?batch_id=' + batchId);
}

seed();
