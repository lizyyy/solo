const { parse: csvParse } = require('csv-parse/sync');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');

function md5File(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}

function upsertQaItem(importId, row, rawPayload) {
  const callId = row.call_id || row.callId || row.通话ID || '';
  const agentId = row.agent_id || row.agentId || row.坐席工号 || '';
  const agentName = row.agent_name || row.agentName || row.坐席姓名 || '';
  const team = row.team || row.班组 || '';
  const callDate = row.call_date || row.callDate || row.通话日期 || '';
  const scoreTotal = Number(row.score_total || row.总分 || 0);

  const stmt = db.prepare(`
    INSERT INTO qa_items (import_id, call_id, agent_id, agent_name, team, call_date, score_total, score_final, raw_payload)
    VALUES (@importId, @callId, @agentId, @agentName, @team, @callDate, @scoreTotal, @scoreTotal, @rawPayload)
    ON CONFLICT(call_id) DO UPDATE SET
      import_id = excluded.import_id,
      agent_id = excluded.agent_id,
      agent_name = excluded.agent_name,
      team = excluded.team,
      call_date = excluded.call_date,
      score_total = excluded.score_total,
      raw_payload = excluded.raw_payload,
      updated_at = datetime('now')
  `);

  const info = stmt.run({ importId, callId, agentId, agentName, team, callDate, scoreTotal, rawPayload: JSON.stringify(rawPayload || row) });
  const qaItemId = info.lastInsertRowid || db.prepare('SELECT id FROM qa_items WHERE call_id = ?').get(callId).id;
  return qaItemId;
}

function insertDeductions(qaItemId, row) {
  const del = db.prepare('DELETE FROM deductions WHERE qa_item_id = ?').run(qaItemId);
  const ins = db.prepare(`
    INSERT INTO deductions (qa_item_id, rule_code, rule_name, category, points_deducted, reviewer, evidence)
    VALUES (@qaItemId, @ruleCode, @ruleName, @category, @pointsDeducted, @reviewer, @evidence)
  `);
  const keys = Object.keys(row);
  const deductionKeys = keys.filter(k => /^扣分_|^deduction_/i.test(k));
  for (const k of deductionKeys) {
    const val = row[k];
    if (!val) continue;
    const parts = String(val).split('|');
    ins.run({
      qaItemId,
      ruleCode: k,
      ruleName: parts[0] || k,
      category: parts[1] || '',
      pointsDeducted: Number(parts[2] || 0),
      reviewer: row.reviewer || row.质检员 || '',
      evidence: row.evidence || row.质检依据 || ''
    });
  }

  if (deductionKeys.length === 0 && row.rule_code) {
    ins.run({
      qaItemId,
      ruleCode: row.rule_code,
      ruleName: row.rule_name || '',
      category: row.category || '',
      pointsDeducted: Number(row.points_deducted || 0),
      reviewer: row.reviewer || '',
      evidence: row.evidence || ''
    });
  }
}

function importQaCsv(buffer, fileName, importedBy) {
  const hash = md5File(buffer);
  const records = csvParse(buffer, { columns: true, skip_empty_lines: true });
  const tx = db.transaction((rows) => {
    const importId = db.prepare(`
      INSERT INTO imports (source_type, file_name, file_hash, record_count, imported_by)
      VALUES (?, ?, ?, ?, ?)
    `).run('qa_csv', fileName, hash, rows.length, importedBy).lastInsertRowid;

    const byCall = new Map();
    for (const row of rows) {
      const callId = row.call_id || row.callId || row.通话ID || '';
      if (!callId) continue;
      if (!byCall.has(callId)) byCall.set(callId, { master: row, deductions: [] });
      if (row.rule_code) byCall.get(callId).deductions.push(row);
    }

    const del = db.prepare('DELETE FROM deductions WHERE qa_item_id = ?');
    const ins = db.prepare(`
      INSERT INTO deductions (qa_item_id, rule_code, rule_name, category, points_deducted, reviewer, evidence)
      VALUES (@qaItemId, @ruleCode, @ruleName, @category, @pointsDeducted, @reviewer, @evidence)
    `);

    const calcStmt = db.prepare(`
      UPDATE qa_items SET score_final = MAX(0, MIN(100, score_total - COALESCE((SELECT SUM(points_deducted) FROM deductions WHERE qa_item_id = ? AND is_revoked = 0), 0))) WHERE id = ?
    `);

    for (const [callId, group] of byCall) {
      const qaItemId = upsertQaItem(importId, group.master, group.master);
      del.run(qaItemId);
      if (group.deductions.length > 0) {
        for (const d of group.deductions) {
          ins.run({
            qaItemId,
            ruleCode: d.rule_code,
            ruleName: d.rule_name || '',
            category: d.category || '',
            pointsDeducted: Number(d.points_deducted || 0),
            reviewer: d.reviewer || '',
            evidence: d.evidence || ''
          });
        }
      } else {
        insertDeductions(qaItemId, group.master);
      }
      calcStmt.run(qaItemId, qaItemId);
    }
    return importId;
  });
  const importId = tx(records);
  return { importId, count: records.length, distinct_calls: new Set(records.map(r => r.call_id || r.callId || r.通话ID || '')).size };
}

function importSummaryJson(buffer, fileName, importedBy) {
  const hash = md5File(buffer);
  const data = JSON.parse(buffer.toString('utf8'));
  const list = Array.isArray(data) ? data : data.calls || data.list || [data];
  const tx = db.transaction((items) => {
    const importId = db.prepare(`
      INSERT INTO imports (source_type, file_name, file_hash, record_count, imported_by)
      VALUES (?, ?, ?, ?, ?)
    `).run('summary_json', fileName, hash, items.length, importedBy).lastInsertRowid;

    const upsert = db.prepare(`
      INSERT INTO call_summaries (import_id, call_id, summary, emotion, keywords, duration_sec, raw_payload)
      VALUES (@importId, @callId, @summary, @emotion, @keywords, @durationSec, @rawPayload)
      ON CONFLICT(call_id) DO UPDATE SET
        import_id = excluded.import_id,
        summary = excluded.summary,
        emotion = excluded.emotion,
        keywords = excluded.keywords,
        duration_sec = excluded.duration_sec,
        raw_payload = excluded.raw_payload
    `);
    for (const item of items) {
      const callId = item.call_id || item.callId || item.通话ID || '';
      upsert.run({
        importId,
        callId,
        summary: item.summary || item.摘要 || '',
        emotion: item.emotion || item.情绪 || '',
        keywords: Array.isArray(item.keywords) ? item.keywords.join(',') : (item.关键词 || ''),
        durationSec: Number(item.duration_sec || item.时长 || 0),
        rawPayload: JSON.stringify(item)
      });
    }
    return importId;
  });
  const importId = tx(list);
  return { importId, count: list.length };
}

function importAppealCsv(buffer, fileName, importedBy) {
  const hash = md5File(buffer);
  const records = csvParse(buffer, { columns: true, skip_empty_lines: true });
  const tx = db.transaction((rows) => {
    const importId = db.prepare(`
      INSERT INTO imports (source_type, file_name, file_hash, record_count, imported_by)
      VALUES (?, ?, ?, ?, ?)
    `).run('appeal_csv', fileName, hash, rows.length, importedBy).lastInsertRowid;

    for (const row of rows) {
      const callId = row.call_id || row.通话ID || '';
      const qa = db.prepare('SELECT id FROM qa_items WHERE call_id = ?').get(callId);
      if (!qa) continue;
      const ruleCode = row.rule_code || row.申诉扣分项 || '';
      const deduction = db.prepare('SELECT id FROM deductions WHERE qa_item_id = ? AND rule_code = ?').get(qa.id, ruleCode);
      db.prepare(`
        INSERT INTO appeals (qa_item_id, deduction_id, appellant, reason, status)
        VALUES (?, ?, ?, ?, 'pending')
      `).run(qa.id, deduction?.id || null, row.appellant || row.申诉人 || '', row.reason || row.申诉理由 || '');
      db.prepare("UPDATE qa_items SET status = 'appealed', updated_at = datetime('now') WHERE id = ?").run(qa.id);
    }
    return importId;
  });
  const importId = tx(records);
  return { importId, count: records.length };
}

function autoMatchSummaries() {
  const unmatched = db.prepare(`
    SELECT q.id AS qa_item_id, q.call_id, q.agent_id, q.call_date, q.score_total, q.score_final, q.status
    FROM qa_items q
    LEFT JOIN call_summaries s ON q.call_id = s.call_id
    WHERE s.id IS NULL
  `).all();

  const matched = db.prepare(`
    SELECT q.id AS qa_item_id, q.call_id, s.summary, s.emotion, s.keywords, s.duration_sec
    FROM qa_items q
    JOIN call_summaries s ON q.call_id = s.call_id
  `).all();

  const mismatches = [];
  for (const m of matched) {
    const scoreFromSummary = estimateScoreFromSummary(m);
    if (Math.abs(scoreFromSummary - m.score_final) > 10) {
      mismatches.push({ qa_item_id: m.qa_item_id, call_id: m.call_id, score_final: m.score_final, score_from_summary: scoreFromSummary, note: '分数差异超过10分，建议人工复核' });
    }
  }

  return { unmatched_count: unmatched.length, matched_count: matched.length, mismatches, unmatched };
}

function estimateScoreFromSummary(summaryRow) {
  const text = (summaryRow.summary || '') + ' ' + (summaryRow.keywords || '');
  let score = 100;
  if (/投诉|不满|生气|愤怒|推诿|拒绝|错误|违规/.test(text)) score -= 20;
  if (/表扬|感谢|满意|解决/.test(text)) score += 5;
  if (/打断|抢话|沉默/.test(text)) score -= 10;
  return Math.max(0, Math.min(100, score));
}

module.exports = { importQaCsv, importSummaryJson, importAppealCsv, autoMatchSummaries };
