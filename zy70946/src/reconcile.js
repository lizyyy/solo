const db = require('./db').getDb();
const { getRule } = require('./rules');
const { getApplication } = require('./applications');
const { getInspectionsByApply } = require('./inspections');

function createBatch(name, note) {
  const res = db
    .prepare('INSERT INTO batch(name,status,note) VALUES (?,?,?)')
    .run(name, 'draft', note || '');
  return res.lastInsertRowid;
}

function listBatches() {
  return db.prepare('SELECT * FROM batch ORDER BY id DESC').all();
}

function getBatch(id) {
  return db.prepare('SELECT * FROM batch WHERE id = ?').get(id);
}

function analyzeViolations(applyNo) {
  const inspections = getInspectionsByApply(applyNo);
  const violations = [];
  const ruleStatus = {};

  for (const insp of inspections) {
    const rule = getRule(insp.rule_code);
    const key = insp.rule_code;

    if (!ruleStatus[key]) {
      ruleStatus[key] = {
        rule_code: insp.rule_code,
        rule_name: rule ? rule.name : insp.rule_code,
        category: rule ? rule.category : '未知',
        amount: rule ? rule.amount : 0,
        requires_review: rule ? rule.requires_review : 0,
        found: true,
        found_detail: insp.detail,
        found_date: insp.inspect_date,
        fixed: false,
        fixed_date: null,
        review_count: 0,
        review_pass: false,
      };
    }

    if (insp.detail && (insp.detail.includes('已整改') || insp.detail.includes('整改完成') || insp.detail.includes('复验通过'))) {
      ruleStatus[key].fixed = true;
      ruleStatus[key].fixed_date = insp.inspect_date;
    }

    if (insp.detail && insp.detail.includes('复查')) {
      ruleStatus[key].review_count++;
      if (insp.detail.includes('复查通过') || insp.detail.includes('复验通过')) {
        ruleStatus[key].review_pass = true;
      }
    }
  }

  for (const key of Object.keys(ruleStatus)) {
    violations.push(ruleStatus[key]);
  }

  return violations;
}

function calculateThreeStages(applyNo) {
  const app = getApplication(applyNo);
  if (!app) {
    return { error: '未找到装修申请' };
  }

  const violations = analyzeViolations(applyNo);
  const explanation = [];
  let reviewStatus = 'pass';
  let freezeAmount = 0;
  let refundStatus = 'pending';
  let refundAmount = app.deposit_amount;

  const needReviewItems = violations.filter((v) => v.requires_review);
  const pendingReview = needReviewItems.filter((v) => !v.review_pass);
  const unfixedViolations = violations.filter((v) => !v.fixed);

  if (pendingReview.length > 0) {
    reviewStatus = 'recheck';
    explanation.push(
      `【违规复查-未通过】${pendingReview.length} 项需复验的违规未通过：${pendingReview.map((v) => v.rule_name).join('、')}`
    );
  } else if (needReviewItems.length > 0) {
    explanation.push(
      `【违规复查-通过】${needReviewItems.length} 项需复验违规均已通过：${needReviewItems.map((v) => v.rule_name).join('、')}`
    );
  } else {
    explanation.push('【违规复查-通过】无需要复验的违规项');
  }

  if (unfixedViolations.length > 0) {
    for (const v of unfixedViolations) {
      freezeAmount += v.amount;
    }
    explanation.push(
      `【冻结金额】共 ${unfixedViolations.length} 项未整改违规，冻结 ${freezeAmount} 元：${unfixedViolations.map((v) => `${v.rule_name}(${v.amount})`).join('、')}`
    );
  } else {
    explanation.push('【冻结金额】无未整改违规，冻结 0 元');
  }

  if (reviewStatus !== 'pass') {
    refundStatus = 'reject';
    refundAmount = 0;
    explanation.push('【退款审批-驳回】违规复查未通过，不予放款');
  } else if (freezeAmount > 0) {
    refundStatus = 'partial';
    refundAmount = Math.max(0, app.deposit_amount - freezeAmount);
    explanation.push(
      `【退款审批-部分】扣除冻结 ${freezeAmount} 元，拟退款 ${refundAmount} 元（原押金 ${app.deposit_amount} 元）`
    );
  } else {
    refundStatus = 'approve';
    refundAmount = app.deposit_amount;
    explanation.push(`【退款审批-通过】全额退款 ${refundAmount} 元`);
  }

  return {
    apply_no: applyNo,
    owner_name: app.owner_name,
    room_no: app.room_no,
    deposit_amount: app.deposit_amount,
    review_status: reviewStatus,
    freeze_amount: freezeAmount,
    refund_status: refundStatus,
    refund_amount: refundAmount,
    violations,
    explanation: explanation.join(' | '),
  };
}

function runBatch(batchId) {
  const batch = getBatch(batchId);
  if (!batch) throw new Error('批次不存在');

  const apps = db.prepare('SELECT apply_no FROM application').all();
  const insRecord = db.prepare(`
    INSERT INTO record(
      batch_id,apply_no,owner_name,room_no,deposit_amount,
      review_status,freeze_amount,refund_status,refund_amount,
      raw_violations,diff_explanation
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `);
  const del = db.prepare('DELETE FROM record WHERE batch_id = ?');
  del.run(batchId);

  const tx = db.transaction((list) => {
    for (const item of list) {
      insRecord.run(
        batchId,
        item.apply_no,
        item.owner_name,
        item.room_no,
        item.deposit_amount,
        item.review_status,
        item.freeze_amount,
        item.refund_status,
        item.refund_amount,
        JSON.stringify(item.violations),
        item.explanation
      );
    }
    return list.length;
  });

  const results = [];
  for (const a of apps) {
    const r = calculateThreeStages(a.apply_no);
    if (!r.error) results.push(r);
  }

  const count = tx(results);
  db.prepare('UPDATE batch SET status = ? WHERE id = ?').run('done', batchId);
  return { count, batch_id: batchId };
}

function listRecords(batchId) {
  return db.prepare('SELECT * FROM record WHERE batch_id = ? ORDER BY apply_no').all(batchId);
}

function getRecord(id) {
  return db.prepare('SELECT * FROM record WHERE id = ?').get(id);
}

function getSummary(batchId) {
  const rows = listRecords(batchId);
  const total = rows.length;
  const reviewPass = rows.filter((r) => r.review_status === 'pass').length;
  const reviewRecheck = rows.filter((r) => r.review_status === 'recheck').length;
  const totalDeposit = rows.reduce((s, r) => s + (r.deposit_amount || 0), 0);
  const totalFreeze = rows.reduce((s, r) => s + (r.freeze_amount || 0), 0);
  const totalRefund = rows.reduce((s, r) => s + (r.refund_amount || 0), 0);
  const approve = rows.filter((r) => r.refund_status === 'approve').length;
  const partial = rows.filter((r) => r.refund_status === 'partial').length;
  const reject = rows.filter((r) => r.refund_status === 'reject').length;

  return {
    total,
    review: { pass: reviewPass, recheck: reviewRecheck },
    amounts: { total_deposit: totalDeposit, total_freeze: totalFreeze, total_refund: totalRefund },
    refund: { approve, partial, reject },
  };
}

module.exports = {
  createBatch,
  listBatches,
  getBatch,
  analyzeViolations,
  calculateThreeStages,
  runBatch,
  listRecords,
  getRecord,
  getSummary,
};
