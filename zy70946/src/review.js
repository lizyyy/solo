const db = require('./db').getDb();
const { getRecord } = require('./reconcile');

function recalc(record) {
  const expl = [];

  if (record.review_status === 'pass') {
    expl.push('【违规复查-通过】人工复核确认复查通过');
  } else if (record.review_status === 'recheck') {
    expl.push('【违规复查-未通过】人工复核标记需重新复查');
  }

  if (record.freeze_amount > 0) {
    expl.push(`【冻结金额】人工复核冻结 ${record.freeze_amount} 元`);
  } else {
    expl.push('【冻结金额】人工复核无冻结');
  }

  if (record.review_status !== 'pass') {
    expl.push('【退款审批-驳回】违规复查未通过，不予放款');
    record.refund_status = 'reject';
    record.refund_amount = 0;
  } else {
    const refund = Math.max(0, (record.deposit_amount || 0) - (record.freeze_amount || 0));
    record.refund_amount = refund;
    if (record.freeze_amount > 0) {
      record.refund_status = 'partial';
      expl.push(`【退款审批-部分】扣除冻结 ${record.freeze_amount} 元，拟退款 ${refund} 元`);
    } else {
      record.refund_status = 'approve';
      expl.push(`【退款审批-通过】全额退款 ${refund} 元`);
    }
  }

  record.diff_explanation = expl.join(' | ');
  return record;
}

function updateRecord(recordId, patch, operator) {
  const r = getRecord(recordId);
  if (!r) throw new Error('记录不存在');

  const allowed = ['review_status', 'review_note', 'freeze_amount', 'freeze_note', 'refund_status', 'refund_note'];
  const log = db.prepare(`
    INSERT INTO record_review_log(record_id,field,old_value,new_value,operator)
    VALUES (?,?,?,?,?)
  `);

  for (const key of allowed) {
    if (patch[key] !== undefined && String(patch[key]) !== String(r[key])) {
      log.run(recordId, key, String(r[key]), String(patch[key]), operator || 'system');
      r[key] = patch[key];
    }
  }

  const updated = recalc(r);

  db.prepare(`
    UPDATE record SET
      review_status = ?,
      review_note = ?,
      freeze_amount = ?,
      freeze_note = ?,
      refund_status = ?,
      refund_amount = ?,
      refund_note = ?,
      diff_explanation = ?,
      updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    updated.review_status,
    updated.review_note,
    updated.freeze_amount,
    updated.freeze_note,
    updated.refund_status,
    updated.refund_amount,
    updated.refund_note,
    updated.diff_explanation,
    recordId
  );

  return getRecord(recordId);
}

function listLogs(recordId) {
  return db
    .prepare('SELECT * FROM record_review_log WHERE record_id = ? ORDER BY id DESC')
    .all(recordId);
}

module.exports = { updateRecord, listLogs, recalc };
