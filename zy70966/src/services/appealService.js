const db = require('../db');
const { recalcQaItem } = require('./recalcEngine');

function logAudit({ qaItemId, appealId, reviewId, actor, action, detail, diff }) {
  db.prepare(`
    INSERT INTO audit_log (qa_item_id, appeal_id, review_id, actor, action, detail, diff)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(qaItemId || null, appealId || null, reviewId || null, actor, action, detail || '', diff ? JSON.stringify(diff) : null);
}

function submitAppeal({ qaItemId, deductionId, appellant, reason }) {
  const qa = db.prepare('SELECT id, status FROM qa_items WHERE id = ?').get(qaItemId);
  if (!qa) throw new Error('质检记录不存在');

  const info = db.prepare(`
    INSERT INTO appeals (qa_item_id, deduction_id, appellant, reason, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(qaItemId, deductionId || null, appellant || '', reason || '');

  db.prepare("UPDATE qa_items SET status = 'appealed', updated_at = datetime('now') WHERE id = ?").run(qaItemId);
  logAudit({ qaItemId, appealId: info.lastInsertRowid, actor: appellant, action: 'submit_appeal', detail: reason });
  return { appealId: info.lastInsertRowid };
}

function processReview({ appealId, reviewer, decision, comment, adjustmentPoints, revokeDeduction }) {
  const appeal = db.prepare('SELECT * FROM appeals WHERE id = ?').get(appealId);
  if (!appeal) throw new Error('申诉单不存在');
  if (appeal.status === 'upheld' || appeal.status === 'overruled') {
    const secondary = db.prepare('SELECT COUNT(*) AS c FROM reviews WHERE appeal_id = ? AND is_secondary = 1').get(appealId);
    if (secondary.c >= 1) throw new Error('该申诉已完成二次复核，不可再修改');
  }

  const tx = db.transaction(() => {
    const existingReviews = db.prepare('SELECT COUNT(*) AS c FROM reviews WHERE appeal_id = ?').get(appealId).c;
    const isSecondary = existingReviews >= 1 ? 1 : 0;

    const info = db.prepare(`
      INSERT INTO reviews (appeal_id, qa_item_id, deduction_id, reviewer, decision, comment, adjustment_points, is_secondary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(appealId, appeal.qa_item_id, appeal.deduction_id, reviewer || '', decision, comment || '', Number(adjustmentPoints || 0), isSecondary);

    let newStatus = decision;
    if (isSecondary) newStatus = decision === 'upheld' ? 'upheld' : 'overruled';
    db.prepare("UPDATE appeals SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, appealId);

    if (revokeDeduction && appeal.deduction_id) {
      db.prepare(`
        UPDATE deductions
        SET is_revoked = 1, revoked_reason = ?, revoked_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(comment || '复核撤销', appeal.deduction_id);
    }

    const qaBefore = db.prepare('SELECT score_final FROM qa_items WHERE id = ?').get(appeal.qa_item_id);
    recalcQaItem(appeal.qa_item_id, { sourceEvent: 'review', sourceId: info.lastInsertRowid, reason: comment, actor: reviewer });
    const qaAfter = db.prepare('SELECT score_final FROM qa_items WHERE id = ?').get(appeal.qa_item_id);

    db.prepare("UPDATE qa_items SET status = 'revised', updated_at = datetime('now') WHERE id = ?").run(appeal.qa_item_id);

    logAudit({
      qaItemId: appeal.qa_item_id,
      appealId,
      reviewId: info.lastInsertRowid,
      actor: reviewer,
      action: isSecondary ? 'secondary_review' : 'first_review',
      detail: `decision=${decision}, revoke=${!!revokeDeduction}`,
      diff: { score_before: qaBefore.score_final, score_after: qaAfter.score_final }
    });

    return { reviewId: info.lastInsertRowid, isSecondary, scoreBefore: qaBefore.score_final, scoreAfter: qaAfter.score_final };
  });

  return tx();
}

function getAppealDetail(appealId) {
  const appeal = db.prepare('SELECT * FROM appeals WHERE id = ?').get(appealId);
  if (!appeal) return null;
  const reviews = db.prepare('SELECT * FROM reviews WHERE appeal_id = ? ORDER BY created_at').all(appealId);
  const qa = db.prepare('SELECT * FROM qa_items WHERE id = ?').get(appeal.qa_item_id);
  const deductions = db.prepare('SELECT * FROM deductions WHERE qa_item_id = ?').all(appeal.qa_item_id);
  return { appeal, reviews, qa, deductions };
}

function explainDifferences(qaItemId) {
  const qa = db.prepare('SELECT id, call_id, score_total, score_final, status FROM qa_items WHERE id = ?').get(qaItemId);
  if (!qa) return null;
  const snapshots = db.prepare('SELECT * FROM score_snapshots WHERE qa_item_id = ? ORDER BY created_at').all(qaItemId);
  const reviews = db.prepare(`
    SELECT r.*, a.id AS appeal_id, a.reason AS appeal_reason
    FROM reviews r LEFT JOIN appeals a ON a.id = r.appeal_id
    WHERE r.qa_item_id = ? ORDER BY r.created_at
  `).all(qaItemId);
  const deductions = db.prepare('SELECT * FROM deductions WHERE qa_item_id = ?').all(qaItemId);
  const revoked = deductions.filter(d => d.is_revoked);
  const active = deductions.filter(d => !d.is_revoked);

  return {
    qa,
    delta: qa.score_final - qa.score_total,
    score_total: qa.score_total,
    score_final: qa.score_final,
    active_deductions: active,
    revoked_deductions: revoked,
    reviews: reviews.map(r => ({
      id: r.id, decision: r.decision, is_secondary: !!r.is_secondary,
      comment: r.comment, adjustment_points: r.adjustment_points, appeal_reason: r.appeal_reason
    })),
    snapshots: snapshots.map(s => ({
      id: s.id, score_before: s.score_before, score_after: s.score_after,
      delta: s.delta, reason: s.reason, source_event: s.source_event, created_at: s.created_at
    }))
  };
}

module.exports = { submitAppeal, processReview, getAppealDetail, explainDifferences, logAudit };
