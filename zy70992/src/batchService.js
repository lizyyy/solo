const { db, updateTimestamps } = require('./db');

function logOperation(opts) {
  db.prepare(`
    INSERT INTO operation_logs (batch_id, card_record_id, refund_record_id, action, operator, reason, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    opts.batch_id || null,
    opts.card_record_id || null,
    opts.refund_record_id || null,
    opts.action,
    opts.operator,
    opts.reason || null,
    opts.detail || null
  );
}

function getBatchById(id) {
  return db.prepare('SELECT * FROM batches WHERE id = ?').get(id);
}

function createBatch(batchNo, subsidyMonth, operator, remark) {
  const result = db.prepare(`
    INSERT INTO batches (batch_no, subsidy_month, created_by, remark)
    VALUES (?, ?, ?, ?)
  `).run(batchNo, subsidyMonth, operator, remark || '');
  logOperation({
    batch_id: result.lastInsertRowid,
    action: 'create_batch',
    operator,
    reason: `创建批次 ${batchNo}`,
    detail: `补贴月份: ${subsidyMonth}`
  });
  return result.lastInsertRowid;
}

function importCardRecords(batchId, records, operator) {
  const insert = db.prepare(`
    INSERT INTO card_records 
    (batch_id, student_id, student_name, meal_date, meal_type, amount, card_time, raw_data, check_result, check_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const upsert = db.prepare(`
    INSERT INTO card_records 
    (batch_id, student_id, student_name, meal_date, meal_type, amount, card_time, raw_data, check_result, check_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO UPDATE SET 
      student_name = excluded.student_name,
      amount = excluded.amount,
      card_time = excluded.card_time,
      raw_data = excluded.raw_data,
      check_result = 'updated',
      check_reason = '批次更新'
  `);

  let added = 0;
  let updated = 0;
  const issues = [];

  const tx = db.transaction((records) => {
    for (const record of records) {
      try {
        const existing = db.prepare(`
          SELECT id FROM card_records 
          WHERE batch_id = ? AND student_id = ? AND meal_date = ? AND meal_type = ?
        `).get(batchId, record.student_id, record.meal_date, record.meal_type);

        if (existing) {
          upsert.run(
            batchId, record.student_id, record.student_name, record.meal_date,
            record.meal_type, record.amount, record.card_time, record.raw_data,
            'updated', '批次更新'
          );
          updated++;
        } else {
          insert.run(
            batchId, record.student_id, record.student_name, record.meal_date,
            record.meal_type, record.amount, record.card_time, record.raw_data,
            'pending', null
          );
          added++;
        }
      } catch (e) {
        issues.push({ record, error: e.message });
      }
    }
  });

  tx(records);

  const total = added + updated;
  db.prepare('UPDATE batches SET total_records = total_records + ? WHERE id = ?').run(total, batchId);
  logOperation({
    batch_id: batchId,
    action: 'import_cards',
    operator,
    reason: `导入刷卡记录 ${total} 条（新增 ${added}，更新 ${updated}）`,
    detail: issues.length > 0 ? `异常: ${JSON.stringify(issues.slice(0, 5))}` : null
  });

  return { added, updated, total, issues };
}

function importSubsidyList(batchId, records, operator) {
  const insert = db.prepare(`
    INSERT INTO subsidy_lists (batch_id, student_id, student_name, subsidy_type, monthly_limit, daily_limit, meal_limit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const upsert = db.prepare(`
    INSERT INTO subsidy_lists (batch_id, student_id, student_name, subsidy_type, monthly_limit, daily_limit, meal_limit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO UPDATE SET 
      student_name = excluded.student_name,
      subsidy_type = excluded.subsidy_type,
      monthly_limit = excluded.monthly_limit,
      daily_limit = excluded.daily_limit,
      meal_limit = excluded.meal_limit
  `);

  let added = 0;
  let updated = 0;

  const tx = db.transaction((records) => {
    for (const record of records) {
      const existing = db.prepare(`
        SELECT id FROM subsidy_lists WHERE batch_id = ? AND student_id = ?
      `).get(batchId, record.student_id);

      if (existing) {
        upsert.run(
          batchId, record.student_id, record.student_name, record.subsidy_type,
          record.monthly_limit, record.daily_limit, record.meal_limit
        );
        updated++;
      } else {
        insert.run(
          batchId, record.student_id, record.student_name, record.subsidy_type,
          record.monthly_limit, record.daily_limit, record.meal_limit
        );
        added++;
      }
    }
  });

  tx(records);

  logOperation({
    batch_id: batchId,
    action: 'import_subsidy',
    operator,
    reason: `导入补贴名单 ${added + updated} 条（新增 ${added}，更新 ${updated}）`
  });

  return { added, updated, total: added + updated };
}

function importRefundRecords(batchId, records, operator) {
  const insert = db.prepare(`
    INSERT INTO refund_records 
    (batch_id, student_id, student_name, refund_date, refund_amount, refund_reason, card_record_id, matched)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let added = 0;
  const issues = [];

  const tx = db.transaction((records) => {
    for (const record of records) {
      try {
        insert.run(
          batchId, record.student_id, record.student_name, record.refund_date,
          record.refund_amount, record.refund_reason, null, 0
        );
        added++;
      } catch (e) {
        issues.push({ record, error: e.message });
      }
    }
  });

  tx(records);

  logOperation({
    batch_id: batchId,
    action: 'import_refunds',
    operator,
    reason: `导入退款记录 ${added} 条`
  });

  return { added, issues };
}

function processCardRecord(cardRecordId, operator, action, reason, finalAmount) {
  const card = db.prepare('SELECT * FROM card_records WHERE id = ?').get(cardRecordId);
  if (!card) return { success: false, error: '记录不存在' };

  const batch = getBatchById(card.batch_id);
  if (!batch) return { success: false, error: '批次不存在' };

  if (action === 'approve') {
    const subsidy = db.prepare('SELECT * FROM subsidy_lists WHERE student_id = ?').get(card.student_id);
    const subsidyType = subsidy ? subsidy.subsidy_type : '无';
    const subsidyUsed = subsidy ? (finalAmount || card.amount) : 0;

    db.prepare(`
      INSERT INTO processed_records 
      (batch_id, student_id, student_name, meal_date, meal_type, original_amount, final_amount, 
       status, reject_reason, subsidy_type, subsidy_used, refund_applied, operator, remark, card_record_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      card.batch_id, card.student_id, card.student_name, card.meal_date, card.meal_type,
      card.amount, finalAmount || card.amount, 'approved', null, subsidyType, subsidyUsed, 0,
      operator, reason || '', cardRecordId
    );

    db.prepare("UPDATE card_records SET check_result = 'approved', check_reason = ? WHERE id = ?")
      .run(reason || '审核通过', cardRecordId);

    db.prepare('UPDATE batches SET processed_count = processed_count + 1 WHERE id = ?')
      .run(card.batch_id);

    logOperation({
      batch_id: card.batch_id,
      card_record_id: cardRecordId,
      action: 'approve',
      operator,
      reason: reason || '审核通过',
      detail: `学生${card.student_id} ${card.meal_date} ${card.meal_type} ${card.amount}元`
    });

    return { success: true, status: 'approved', cardRecordId };

  } else if (action === 'reject') {
    db.prepare(`
      INSERT INTO processed_records 
      (batch_id, student_id, student_name, meal_date, meal_type, original_amount, final_amount, 
       status, reject_reason, subsidy_type, subsidy_used, refund_applied, operator, remark, card_record_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      card.batch_id, card.student_id, card.student_name, card.meal_date, card.meal_type,
      card.amount, 0, 'rejected', reason || '', '无', 0, 0,
      operator, '审核拒绝', cardRecordId
    );

    db.prepare("UPDATE card_records SET check_result = 'rejected', check_reason = ? WHERE id = ?")
      .run(reason || '审核拒绝', cardRecordId);

    logOperation({
      batch_id: card.batch_id,
      card_record_id: cardRecordId,
      action: 'reject',
      operator,
      reason: reason || '审核拒绝',
      detail: `学生${card.student_id} ${card.meal_date} ${card.meal_type} ${card.amount}元`
    });

    return { success: true, status: 'rejected', cardRecordId };

  } else if (action === 'return') {
    db.prepare("UPDATE card_records SET check_result = 'returned', check_reason = ? WHERE id = ?")
      .run(reason || '退回修改', cardRecordId);

    logOperation({
      batch_id: card.batch_id,
      card_record_id: cardRecordId,
      action: 'return',
      operator,
      reason: reason || '退回修改',
      detail: `学生${card.student_id} ${card.meal_date} ${card.meal_type}`
    });

    return { success: true, status: 'returned', cardRecordId };

  } else if (action === 'pending') {
    db.prepare("UPDATE card_records SET check_result = 'pending', check_reason = ? WHERE id = ?")
      .run(reason || null, cardRecordId);

    db.prepare('DELETE FROM processed_records WHERE card_record_id = ?').run(cardRecordId);

    logOperation({
      batch_id: card.batch_id,
      card_record_id: cardRecordId,
      action: 'reset',
      operator,
      reason: reason || '重置状态',
      detail: `学生${card.student_id}`
    });

    return { success: true, status: 'pending', cardRecordId };
  }

  return { success: false, error: '无效操作' };
}

function processRefundRecord(refundRecordId, operator, action, reason) {
  const refund = db.prepare('SELECT * FROM refund_records WHERE id = ?').get(refundRecordId);
  if (!refund) return { success: false, error: '退款记录不存在' };

  if (action === 'match') {
    const cards = db.prepare(`
      SELECT * FROM card_records 
      WHERE student_id = ? AND meal_date = ? AND check_result != 'rejected'
      ORDER BY id ASC
    `).all(refund.student_id, refund.refund_date);

    const existingRefund = db.prepare(`
      SELECT card_record_id FROM refund_records WHERE id = ?
    `).get(refundRecordId);

    const existingProcessed = db.prepare(`
      SELECT card_record_id FROM processed_records WHERE refund_applied > 0 AND batch_id = ? AND student_id = ?
    `).all(refund.batch_id, refund.student_id);

    const usedCardIds = new Set();
    if (existingRefund && existingRefund.card_record_id) usedCardIds.add(existingRefund.card_record_id);
    existingProcessed.forEach(r => usedCardIds.add(r.card_record_id));

    const available = cards.filter(c => !usedCardIds.has(c.id));

    if (available.length === 0) {
      return { success: false, error: '没有可匹配的刷卡记录' };
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
      batch_id: refund.batch_id,
      refund_record_id: refundRecordId,
      card_record_id: matched.id,
      action: 'match_refund',
      operator,
      reason: reason || '匹配退款',
      detail: `退款${refund.refund_amount}元 匹配刷卡记录ID:${matched.id}`
    });

    return { success: true, matchedCardId: matched.id, refundAmount: refund.refund_amount };
  }

  return { success: false, error: '无效操作' };
}

function finalizeBatch(batchId, operator) {
  const batch = getBatchById(batchId);
  if (!batch) return { success: false, error: '批次不存在' };

  const pending = db.prepare(
    "SELECT COUNT(*) as cnt FROM card_records WHERE batch_id = ? AND check_result = 'pending'"
  ).get(batchId).cnt;

  if (pending > 0) {
    return { success: false, error: `还有 ${pending} 条记录待处理` };
  }

  db.prepare("UPDATE batches SET status = 'completed', updated_at = datetime('now', 'localtime') WHERE id = ?")
    .run(batchId);

  logOperation({
    batch_id: batchId,
    action: 'finalize_batch',
    operator,
    reason: `批次 ${batch.batch_no} 处理完成`
  });

  return { success: true, batchId };
}

module.exports = {
  getBatchById,
  createBatch,
  importCardRecords,
  importSubsidyList,
  importRefundRecords,
  processCardRecord,
  processRefundRecord,
  finalizeBatch,
  logOperation
};
