const db = require('../db');

function recalcQaItem(qaItemId, meta = {}) {
  const qa = db.prepare('SELECT score_total FROM qa_items WHERE id = ?').get(qaItemId);
  if (!qa) throw new Error('质检记录不存在');

  const deductions = db.prepare('SELECT points_deducted, is_revoked FROM deductions WHERE qa_item_id = ?').all(qaItemId);
  const sumDeducted = deductions.filter(d => !d.is_revoked).reduce((s, d) => s + Number(d.points_deducted || 0), 0);

  const reviews = db.prepare('SELECT adjustment_points FROM reviews WHERE qa_item_id = ?').all(qaItemId);
  const sumAdjusted = reviews.reduce((s, r) => s + Number(r.adjustment_points || 0), 0);

  const before = db.prepare('SELECT score_final FROM qa_items WHERE id = ?').get(qaItemId).score_final;
  const after = Math.max(0, Math.min(100, qa.score_total - sumDeducted + sumAdjusted));
  const delta = after - before;

  db.prepare('UPDATE qa_items SET score_final = ?, updated_at = datetime(?) WHERE id = ?').run(after, 'now', qaItemId);

  if (delta !== 0 || meta.sourceEvent) {
    db.prepare(`
      INSERT INTO score_snapshots (qa_item_id, score_before, score_after, delta, reason, source_event, source_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(qaItemId, before, after, delta, meta.reason || '', meta.sourceEvent || 'recalc', meta.sourceId || null);
  }

  return { before, after, delta, sumDeducted, sumAdjusted };
}

function recalcAll() {
  const ids = db.prepare('SELECT id FROM qa_items').pluck().all();
  const results = [];
  for (const id of ids) {
    results.push({ qa_item_id: id, ...recalcQaItem(id) });
  }
  return { recalculated: ids.length, details: results };
}

module.exports = { recalcQaItem, recalcAll };
