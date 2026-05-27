const { db, updateTimestamps } = require('./db');
const dataParser = require('./dataParser');

function logOperation(opts) {
  db.prepare(
    'INSERT INTO operation_logs (batch_id, card_record_id, refund_record_id, action, operator, reason, detail) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    opts.batch_id || null, opts.card_record_id || null, opts.refund_record_id || null,
    opts.action, opts.operator, opts.reason || null, opts.detail || null
  );
}

function getBatchById(id) {
  return db.prepare('SELECT * FROM batches WHERE id = ?').get(id);
}

function createBatch(batchNo, subsidyMonth, operator, remark) {
  const result = db.prepare(
    'INSERT INTO batches (batch_no, subsidy_month, created_by, remark) VALUES (?, ?, ?, ?)'
  ).run(batchNo, subsidyMonth, operator, remark || '');
  logOperation({
    batch_id: result.lastInsertRowid, action: 'create_batch', operator,
    reason: 'Create batch ' + batchNo, detail: 'Subsidy month: ' + subsidyMonth
  });
  return result.lastInsertRowid;
}

function validateAndCheckRecord(record, batchId, subsidyMonth, existingInBatch) {
  const issues = [];
  const warnings = [];
  try {
    const v = dataParser.validateCardRecord(record);
    if (v.length > 0) issues.push.apply(issues, v);
  } catch(e) {}
  if (record.amount <= 0) warnings.push('Amount <= 0');
  const dupInBatch = existingInBatch.filter(function(r) {
    return r.student_id === record.student_id && r.meal_date === record.meal_date && r.meal_type === record.meal_type;
  });
  if (dupInBatch.length > 0) issues.push('Duplicate in batch');
  if (record.student_id) {
    const dupInDb = db.prepare(
      'SELECT id FROM card_records WHERE batch_id = ? AND student_id = ? AND meal_date = ? AND meal_type = ?'
    ).get(batchId, record.student_id, record.meal_date, record.meal_type);
    if (dupInDb) issues.push('Duplicate in database');
  }
  if (record.student_id) {
    const s = db.prepare('SELECT * FROM subsidy_lists WHERE student_id = ?').get(record.student_id);
    if (!s) warnings.push('Student not in subsidy list');
    else {
      if (s.daily_limit > 0 && record.amount > s.daily_limit) {
        issues.push('Exceed daily limit ' + s.daily_limit);
      }
      if (s.monthly_limit > 0 && subsidyMonth) {
        const monthStart = subsidyMonth + '-01';
        const used = db.prepare(
          'SELECT SUM(final_amount) as total FROM processed_records WHERE student_id = ? AND meal_date >= ? AND meal_date < date(?, \'+1 month\')'
        ).get(record.student_id, monthStart, monthStart);
        const monthTotal = (used.total || 0) + record.amount;
        if (monthTotal > s.monthly_limit) {
          issues.push('Exceed monthly limit ' + s.monthly_limit + ' (used ' + (used.total || 0) + ')');
        }
      }
    }
  }
  let cr = 'pending', reason = null;
  if (issues.length > 0) { cr = 'returned'; reason = issues.join('; '); }
  else if (warnings.length > 0) { cr = 'warning'; reason = warnings.join('; '); }
  return { check_result: cr, check_reason: reason, issues: issues, warnings: warnings };
}

function importCardRecords(batchId, records, operator) {
  const batch = getBatchById(batchId);
  const subsidyMonth = batch ? batch.subsidy_month : null;
  const insert = db.prepare(
    'INSERT INTO card_records (batch_id, student_id, student_name, meal_date, meal_type, amount, card_time, raw_data, check_result, check_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  let added = 0;
  const issues = [];
  const vs = { returned: 0, warning: 0, pending: 0 };
  const processed = [];
  const tx = db.transaction(function(recs) {
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i];
      try {
        const v = validateAndCheckRecord(r, batchId, subsidyMonth, processed);
        insert.run(batchId, r.student_id, r.student_name, r.meal_date, r.meal_type,
          r.amount, r.card_time, r.raw_data, v.check_result, v.check_reason);
        added++;
        if (v.check_result === 'returned') vs.returned++;
        else if (v.check_result === 'warning') vs.warning++;
        else vs.pending++;
        processed.push(r);
      } catch (e) { issues.push({ record_index: i, error: e.message }); }
    }
  });
  tx(records);
  db.prepare('UPDATE batches SET total_records = total_records + ? WHERE id = ?').run(added, batchId);
  logOperation({
    batch_id: batchId, action: 'import_cards', operator,
    reason: 'Import ' + added + ' records', detail: 'Validation: ' + JSON.stringify(vs)
  });
  return { added: added, updated: 0, total: added, issues: issues, validation_summary: vs };
}

function importSubsidyList(batchId, records, operator) {
  const insert = db.prepare(
    'INSERT INTO subsidy_lists (batch_id, student_id, student_name, subsidy_type, monthly_limit, daily_limit, meal_limit) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  let added = 0;
  const tx = db.transaction(function(records) {
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      insert.run(batchId, r.student_id, r.student_name, r.subsidy_type,
        r.monthly_limit, r.daily_limit, r.meal_limit);
      added++;
    }
  });
  tx(records);
  logOperation({
    batch_id: batchId, action: 'import_subsidy', operator,
    reason: 'Import subsidy list ' + added + ' records'
  });
  return { added: added, updated: 0, total: added };
}

function importRefundRecords(batchId, records, operator) {
  const insert = db.prepare(
    'INSERT INTO refund_records (batch_id, student_id, student_name, refund_date, refund_amount, refund_reason, card_record_id, matched) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  let added = 0;
  const issues = [];
  const tx = db.transaction(function(records) {
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      try {
        insert.run(batchId, r.student_id, r.student_name, r.refund_date,
          r.refund_amount, r.refund_reason, null, 0);
        added++;
      } catch (e) { issues.push({ record_index: i, error: e.message }); }
    }
  });
  tx(records);
  logOperation({
    batch_id: batchId, action: 'import_refunds', operator,
    reason: 'Import refund records ' + added + ' records'
  });
  return { added: added, issues: issues };
}

function processCardRecord(cardRecordId, operator, action, reason, finalAmount) {
  const card = db.prepare('SELECT * FROM card_records WHERE id = ?').get(cardRecordId);
  if (!card) return { success: false, error: 'Record not found' };
  const batch = getBatchById(card.batch_id);
  if (!batch) return { success: false, error: 'Batch not found' };

  if (action === 'approve') {
    const subsidy = db.prepare('SELECT * FROM subsidy_lists WHERE student_id = ?').get(card.student_id);
    const subsidyType = subsidy ? subsidy.subsidy_type : 'none';
    const subsidyUsed = subsidy ? (finalAmount || card.amount) : 0;
    db.prepare(
      'INSERT INTO processed_records (batch_id, student_id, student_name, meal_date, meal_type, original_amount, final_amount, status, reject_reason, subsidy_type, subsidy_used, refund_applied, operator, remark, card_record_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(card.batch_id, card.student_id, card.student_name, card.meal_date, card.meal_type,
      card.amount, finalAmount || card.amount, 'approved', null, subsidyType, subsidyUsed, 0,
      operator, reason || '', cardRecordId);
    db.prepare('UPDATE card_records SET check_result = ? , check_reason = ? WHERE id = ?')
      .run('approved', reason || 'Approved', cardRecordId);
    db.prepare('UPDATE batches SET processed_count = processed_count + 1 WHERE id = ?')
      .run(card.batch_id);
    logOperation({
      batch_id: card.batch_id, card_record_id: cardRecordId, action: 'approve', operator,
      reason: reason || 'Approved',
      detail: 'Student ' + card.student_id + ' ' + card.meal_date + ' ' + card.meal_type + ' ' + card.amount + ' yuan'
    });
    return { success: true, status: 'approved', cardRecordId };
  } else if (action === 'reject') {
    db.prepare(
      'INSERT INTO processed_records (batch_id, student_id, student_name, meal_date, meal_type, original_amount, final_amount, status, reject_reason, subsidy_type, subsidy_used, refund_applied, operator, remark, card_record_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(card.batch_id, card.student_id, card.student_name, card.meal_date, card.meal_type,
      card.amount, 0, 'rejected', reason || '', 'none', 0, 0, operator, 'Rejected', cardRecordId);
    db.prepare('UPDATE card_records SET check_result = ? , check_reason = ? WHERE id = ?')
      .run('rejected', reason || 'Rejected', cardRecordId);
    logOperation({
      batch_id: card.batch_id, card_record_id: cardRecordId, action: 'reject', operator,
      reason: reason || 'Rejected',
      detail: 'Student ' + card.student_id + ' ' + card.meal_date + ' ' + card.meal_type + ' ' + card.amount + ' yuan'
    });
    return { success: true, status: 'rejected', cardRecordId };
  } else if (action === 'return') {
    db.prepare('UPDATE card_records SET check_result = ? , check_reason = ? WHERE id = ?')
      .run('returned', reason || 'Returned', cardRecordId);
    logOperation({
      batch_id: card.batch_id, card_record_id: cardRecordId, action: 'return', operator,
      reason: reason || 'Returned',
      detail: 'Student ' + card.student_id + ' ' + card.meal_date + ' ' + card.meal_type
    });
    return { success: true, status: 'returned', cardRecordId };
  } else if (action === 'pending') {
    db.prepare('UPDATE card_records SET check_result = ? , check_reason = ? WHERE id = ?')
      .run('pending', reason || null, cardRecordId);
    db.prepare('DELETE FROM processed_records WHERE card_record_id = ?').run(cardRecordId);
    logOperation({
      batch_id: card.batch_id, card_record_id: cardRecordId, action: 'reset', operator,
      reason: reason || 'Reset status', detail: 'Student ' + card.student_id
    });
    return { success: true, status: 'pending', cardRecordId };
  }
  return { success: false, error: 'Invalid action' };
}

function processRefundRecord(refundRecordId, operator, action, reason) {
  const refund = db.prepare('SELECT * FROM refund_records WHERE id = ?').get(refundRecordId);
  if (!refund) return { success: false, error: 'Refund record not found' };
  if (action === 'match') {
    const cards = db.prepare(
      'SELECT * FROM card_records WHERE student_id = ? AND meal_date = ? AND check_result != ? ORDER BY id ASC'
    ).all(refund.student_id, refund.refund_date, 'rejected');
    const existingProcessed = db.prepare(
      'SELECT card_record_id FROM processed_records WHERE refund_applied > 0 AND batch_id = ? AND student_id = ?'
    ).all(refund.batch_id, refund.student_id);
    const usedCardIds = new Set();
    existingProcessed.forEach(function(r) { usedCardIds.add(r.card_record_id); });
    const available = cards.filter(function(c) { return !usedCardIds.has(c.id); });
    if (available.length === 0) {
      return { success: false, error: 'No matching card records' };
    }
    const matched = available[0];
    db.prepare('UPDATE refund_records SET card_record_id = ?, matched = 1 WHERE id = ?')
      .run(matched.id, refundRecordId);
    const processed = db.prepare('SELECT * FROM processed_records WHERE card_record_id = ?').get(matched.id);
    if (processed) {
      db.prepare('UPDATE processed_records SET refund_applied = ? WHERE card_record_id = ?')
        .run(refund.refund_amount, matched.id);
    }
    logOperation({
      batch_id: refund.batch_id, refund_record_id: refundRecordId, card_record_id: matched.id,
      action: 'match_refund', operator, reason: reason || 'Match refund',
      detail: 'Refund ' + refund.refund_amount + ' yuan matched to card record ID: ' + matched.id
    });
    return { success: true, matchedCardId: matched.id, refundAmount: refund.refund_amount };
  }
  return { success: false, error: 'Invalid action' };
}

function finalizeBatch(batchId, operator) {
  const batch = getBatchById(batchId);
  if (!batch) return { success: false, error: 'Batch not found' };
  const pending = db.prepare(
    'SELECT COUNT(*) as cnt FROM card_records WHERE batch_id = ? AND check_result = ?'
  ).get(batchId, 'pending').cnt;
  if (pending > 0) {
    return { success: false, error: 'Still ' + pending + ' records pending' };
  }
  db.prepare('UPDATE batches SET status = ? , updated_at = datetime(?) WHERE id = ?')
    .run('completed', 'now', 'localtime', batchId);
  logOperation({
    batch_id: batchId, action: 'finalize_batch', operator,
    reason: 'Batch ' + batch.batch_no + ' completed'
  });
  return { success: true, batchId: batchId };
}

module.exports = {
  getBatchById, createBatch, importCardRecords, importSubsidyList,
  importRefundRecords, processCardRecord, processRefundRecord, finalizeBatch, logOperation
};
