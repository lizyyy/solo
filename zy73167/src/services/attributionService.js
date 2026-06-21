const db = require('../db');
const { normalizeName, namesSimilar, hashRequest, parseScoreNoteContent, now } = require('../utils/helpers');

function findQuestionByAnyName(name) {
  const all = db.prepare('SELECT id, canonical_name, display_names FROM questions').all();
  for (const q of all) {
    const displayNames = JSON.parse(q.display_names || '[]');
    if (namesSimilar(name, q.canonical_name)) return q;
    for (const dn of displayNames) {
      if (namesSimilar(name, dn)) return q;
    }
  }
  return null;
}

function findOrCreateQuestion(displayName, opts = {}) {
  const existing = findQuestionByAnyName(displayName);
  if (existing) {
    const displayNames = JSON.parse(existing.display_names || '[]');
    const alreadyHas = displayNames.some(d => d === displayName);
    if (!alreadyHas) {
      displayNames.push(displayName);
      db.prepare('UPDATE questions SET display_names = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(displayNames), now(), existing.id);
      existing.display_names = JSON.stringify(displayNames);
    }
    return { question: existing, created: false };
  }
  const canonical = normalizeName(displayName) || displayName;
  const info = db.prepare(`
    INSERT INTO questions (canonical_name, display_names, description, subject, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    canonical,
    JSON.stringify([displayName]),
    opts.description || null,
    opts.subject || null,
    now(),
    now()
  );
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(info.lastInsertRowid);
  return { question, created: true };
}

function addAnswerVersion(questionId, versionTag, answerContent, opts = {}) {
  const existing = db.prepare(`
    SELECT * FROM answer_versions
    WHERE question_id = ? AND version_tag = ? AND answer_content = ?
  `).get(questionId, versionTag, answerContent);
  if (existing) return { version: existing, created: false };

  const info = db.prepare(`
    INSERT INTO answer_versions (question_id, version_tag, answer_content, confidence, source, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(
    questionId,
    versionTag,
    answerContent,
    opts.confidence ?? 1.0,
    opts.source || null,
    now()
  );
  const version = db.prepare('SELECT * FROM answer_versions WHERE id = ?').get(info.lastInsertRowid);
  return { version, created: true };
}

function addScoreNote(questionId, content, opts = {}) {
  const requestHash = opts.requestHash || hashRequest({ question_id: questionId, content, scorer: opts.scorer });
  const existing = db.prepare('SELECT * FROM score_notes WHERE request_hash = ?').get(requestHash);
  if (existing) return { note: existing, duplicate: true };

  const parsed = parseScoreNoteContent(content);
  const info = db.prepare(`
    INSERT INTO score_notes (question_id, content, scorer, score, max_score, tags, submitted_at, request_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    questionId,
    content,
    opts.scorer || null,
    opts.score ?? null,
    opts.maxScore ?? null,
    JSON.stringify(parsed.tags),
    now(),
    requestHash
  );
  const note = db.prepare('SELECT * FROM score_notes WHERE id = ?').get(info.lastInsertRowid);
  note.parsed = parsed;
  return { note, duplicate: false };
}

function addSupplement(questionId, name, content, opts = {}) {
  let existing = db.prepare(`
    SELECT * FROM supplements WHERE question_id = ? AND name = ?
  `).get(questionId, name);

  let renamed = false;

  if (!existing) {
    const sameContent = db.prepare(`
      SELECT * FROM supplements WHERE question_id = ? AND content = ? AND name != ?
    `).get(questionId, content, name);
    if (sameContent) {
      existing = sameContent;
      renamed = true;
    }
  }

  if (existing) {
    const contentChanged = existing.content !== content;
    const unitChanged = existing.unit !== (opts.unit || null);
    const threshChanged = existing.threshold !== (opts.threshold ?? null);
    const nameChanged = existing.name !== name;

    const prevName = (contentChanged || unitChanged || threshChanged || nameChanged)
      ? existing.name : existing.prev_name;

    db.prepare(`
      UPDATE supplements
      SET name = ?, content = ?, type = ?, unit = ?, threshold = ?, updated_at = ?, prev_name = ?
      WHERE id = ?
    `).run(
      name,
      content,
      opts.type || null,
      opts.unit || null,
      opts.threshold ?? null,
      now(),
      prevName,
      existing.id
    );
    const updated = db.prepare('SELECT * FROM supplements WHERE id = ?').get(existing.id);
    return { supplement: updated, updated: true, renamed: renamed || nameChanged };
  }

  const info = db.prepare(`
    INSERT INTO supplements (question_id, name, content, type, unit, threshold, created_at, updated_at, prev_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    questionId,
    name,
    content,
    opts.type || null,
    opts.unit || null,
    opts.threshold ?? null,
    now(),
    now(),
    null
  );
  const supplement = db.prepare('SELECT * FROM supplements WHERE id = ?').get(info.lastInsertRowid);
  return { supplement, updated: false, renamed: false };
}

function addConfirmation(questionId, decision, opts = {}) {
  const info = db.prepare(`
    INSERT INTO confirmations (question_id, operator, decision, reason, before_state, after_state, confirmed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    questionId,
    opts.operator || null,
    decision,
    opts.reason || null,
    opts.beforeState || null,
    opts.afterState || null,
    now()
  );
  return db.prepare('SELECT * FROM confirmations WHERE id = ?').get(info.lastInsertRowid);
}

function detectVersionCoverage(questionId) {
  const versions = db.prepare(`
    SELECT * FROM answer_versions WHERE question_id = ? AND is_active = 1
    ORDER BY created_at ASC
  `).all(questionId);

  const notes = db.prepare('SELECT * FROM score_notes WHERE question_id = ? ORDER BY submitted_at ASC').all(questionId);

  const coverage = {
    hasMultipleVersions: versions.length >= 2,
    versions: versions.map(v => ({
      id: v.id,
      version_tag: v.version_tag,
      confidence: v.confidence,
      source: v.source,
    })),
    coverageEvidence: [],
    coveredByNotes: [],
  };

  if (versions.length >= 2) {
    notes.forEach(note => {
      const parsed = parseScoreNoteContent(note.content);
      if (parsed.mentionsCoverage || parsed.mentionsVersions.length >= 1) {
        coverage.coverageEvidence.push({
          note_id: note.id,
          content: note.content,
          versions_mentioned: parsed.mentionsVersions,
          has_coverage_mention: parsed.mentionsCoverage,
        });
        coverage.coveredByNotes.push(note.id);
      }
    });
  }

  return coverage;
}

function detectExtrapolationIssues(questionId) {
  const notes = db.prepare('SELECT * FROM score_notes WHERE question_id = ?').all(questionId);
  const supplements = db.prepare('SELECT * FROM supplements WHERE question_id = ?').all(questionId);

  const issues = [];

  notes.forEach(note => {
    const parsed = parseScoreNoteContent(note.content);
    if (parsed.tags.includes('extrapolation')) {
      issues.push({
        source: 'score_note',
        source_id: note.id,
        description: '评分备注中提到外推/越界问题',
        detail: note.content,
        suggestions: generateExtrapolationSuggestions(note.content),
      });
    }
  });

  supplements.forEach(sup => {
    if (sup.threshold !== null && sup.threshold !== undefined) {
      try {
        const val = parseFloat(sup.content);
        if (!isNaN(val) && Math.abs(val) > Math.abs(sup.threshold) * 1.5) {
          issues.push({
            source: 'supplement',
            source_id: sup.id,
            description: `补充材料"${sup.name}"数值 ${val} 超出阈值 ${sup.threshold} 的 1.5 倍`,
            detail: `单位: ${sup.unit || '未指定'}, 阈值: ${sup.threshold}`,
            suggestions: generateExtrapolationSuggestions(sup.name, sup.unit, sup.threshold),
          });
        }
      } catch (e) {}
    }
  });

  return {
    hasIssues: issues.length > 0,
    issues,
  };
}

function generateExtrapolationSuggestions(context, unit, threshold) {
  const suggestions = [
    '检查拟合曲线的有效定义域，确认外推范围是否超出训练数据边界',
    '核实题目数据的单位是否统一，避免单位换算导致的越界假象',
    '确认阈值设定是否合理，是否需要根据新版本答案调整判定标准',
    '如属合理外推，请在补充材料中添加外推依据说明；如属异常，请在人工确认中标记',
  ];
  if (unit) {
    suggestions.push(`当前单位为 ${unit}，请核对是否与阈值单位一致`);
  }
  if (threshold !== null && threshold !== undefined) {
    suggestions.push(`当前阈值为 ${threshold}，可考虑放宽阈值或分段设置阈值`);
  }
  return suggestions;
}

function detectSuddenChange(questionId) {
  const snapshots = db.prepare(`
    SELECT * FROM report_snapshots WHERE question_id = ? ORDER BY created_at DESC LIMIT 2
  `).all(questionId);

  const supplements = db.prepare('SELECT * FROM supplements WHERE question_id = ?').all(questionId);
  const notes = db.prepare('SELECT * FROM score_notes WHERE question_id = ? ORDER BY submitted_at DESC LIMIT 5').all(questionId);
  const versions = db.prepare('SELECT * FROM answer_versions WHERE question_id = ? ORDER BY created_at DESC').all(questionId);

  const analysis = {
    hasSuddenChange: false,
    possibleCauses: [],
    details: {},
  };

  if (snapshots.length >= 2) {
    try {
      const latest = JSON.parse(snapshots[0].snapshot_data);
      const prev = JSON.parse(snapshots[1].snapshot_data);
      const confDelta = Math.abs((latest.confidence || 0) - (prev.confidence || 0));
      if (confDelta > 0.2) {
        analysis.hasSuddenChange = true;
        analysis.details.confidenceDelta = confDelta;
      }
      if (latest.attributionReason !== prev.attributionReason) {
        analysis.hasSuddenChange = true;
        analysis.details.reasonChanged = true;
      }
    } catch (e) {}
  }

  supplements.forEach(sup => {
    if (sup.prev_name) {
      analysis.possibleCauses.push({
        type: 'supplement_rename',
        description: `补充材料从"${sup.prev_name}"改名为"${sup.name}"`,
        evidence: sup.id,
      });
    }
  });

  notes.forEach(note => {
    const parsed = parseScoreNoteContent(note.content);
    if (parsed.tags.includes('threshold')) {
      analysis.possibleCauses.push({
        type: 'threshold_change',
        description: `评分备注提及阈值变化`,
        evidence: note.content,
      });
    }
    if (parsed.tags.includes('unit')) {
      analysis.possibleCauses.push({
        type: 'unit_inconsistency',
        description: `评分备注提及单位问题`,
        evidence: note.content,
      });
    }
  });

  if (versions.length >= 2) {
    analysis.possibleCauses.push({
      type: 'multiple_versions',
      description: `存在 ${versions.length} 个答案版本，版本切换可能导致结果跳变`,
      evidence: versions.map(v => v.version_tag),
    });
  }

  if (analysis.possibleCauses.length === 0) {
    analysis.possibleCauses.push({
      type: 'unknown',
      description: '暂未检测到明确的跳变原因，建议人工复核补充材料和评分备注',
    });
  }

  return analysis;
}

function generateReport(questionId) {
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  if (!question) return null;

  const displayNames = JSON.parse(question.display_names || '[]');
  const versions = db.prepare('SELECT * FROM answer_versions WHERE question_id = ?').all(questionId);
  const notes = db.prepare('SELECT * FROM score_notes WHERE question_id = ? ORDER BY submitted_at ASC').all(questionId);
  const supplements = db.prepare('SELECT * FROM supplements WHERE question_id = ?').all(questionId);
  const confirmations = db.prepare('SELECT * FROM confirmations WHERE question_id = ? ORDER BY confirmed_at ASC').all(questionId);

  const coverage = detectVersionCoverage(questionId);
  const extrapolation = detectExtrapolationIssues(questionId);
  const suddenChange = detectSuddenChange(questionId);

  let confidence = 0.5;
  let attributionReason = '信息不足，待补充';
  let needManualConfirm = false;

  if (versions.length >= 2) {
    confidence -= 0.2;
    attributionReason = '存在多版本答案，需确认适用版本';
    needManualConfirm = true;
  }

  if (coverage.coverageEvidence.length > 0) {
    confidence += 0.1;
    attributionReason = '评分备注已确认存在版本覆盖，需核对评分标准';
  }

  notes.forEach(note => {
    const parsed = parseScoreNoteContent(note.content);
    if (parsed.mentionsConfidence !== null) {
      confidence = parsed.mentionsConfidence;
    }
    if (parsed.mentionsNeedConfirm) {
      needManualConfirm = true;
    }
  });

  if (extrapolation.hasIssues) {
    confidence = Math.max(0.1, confidence - 0.15);
    attributionReason = '存在外推越界问题，影响归因可信度';
    needManualConfirm = true;
  }

  confidence = Math.max(0, Math.min(1, confidence));

  let noteImpact = null;
  if (notes.length >= 2) {
    const lastNote = notes[notes.length - 1];
    const prevNotes = notes.slice(0, -1);
    const parsedLast = parseScoreNoteContent(lastNote.content);
    const prevMentionCoverage = prevNotes.some(n => parseScoreNoteContent(n.content).mentionsCoverage);
    const prevNeedConfirm = prevNotes.some(n => parseScoreNoteContent(n.content).mentionsNeedConfirm);

    noteImpact = {
      latest_note_id: lastNote.id,
      changes: [],
    };
    if (!prevMentionCoverage && parsedLast.mentionsCoverage) {
      noteImpact.changes.push({ field: '版本覆盖关系', before: '未确认覆盖', after: '已确认存在版本覆盖' });
    }
    if (!prevNeedConfirm && parsedLast.mentionsNeedConfirm) {
      noteImpact.changes.push({ field: '人工确认', before: '无需确认', after: '需要人工确认' });
    }
    if (parsedLast.mentionsConfidence !== null) {
      noteImpact.changes.push({
        field: '置信度',
        before: '默认/上一版',
        after: `${(parsedLast.mentionsConfidence * 100).toFixed(0)}%`,
      });
    }
    if (parsedLast.tags.includes('extrapolation')) {
      noteImpact.changes.push({ field: '外推越界', before: '未检测', after: '检测到外推越界问题' });
    }
    if (noteImpact.changes.length === 0) {
      noteImpact.changes.push({ field: '评分备注', before: '上一版备注', after: '新增备注内容' });
    }
  }

  let confirmationDiff = null;
  if (confirmations.length > 0) {
    const lastConfirm = confirmations[confirmations.length - 1];
    let beforeState = null;
    let afterState = null;
    try {
      if (lastConfirm.before_state) beforeState = JSON.parse(lastConfirm.before_state);
      if (lastConfirm.after_state) afterState = JSON.parse(lastConfirm.after_state);
    } catch (e) {}

    confirmationDiff = {
      last_confirmation_id: lastConfirm.id,
      decision: lastConfirm.decision,
      reason: lastConfirm.reason,
      operator: lastConfirm.operator,
      confirmed_at: lastConfirm.confirmed_at,
      before_state: beforeState,
      after_state: afterState,
    };
  }

  const report = {
    question_id: question.id,
    canonical_name: question.canonical_name,
    display_names: displayNames,
    description: question.description,
    subject: question.subject,
    generated_at: now(),
    summary: {
      attribution_reason: attributionReason,
      confidence: Number(confidence.toFixed(3)),
      need_manual_confirm: needManualConfirm,
      answer_version_count: versions.length,
      score_note_count: notes.length,
      supplement_count: supplements.length,
      confirmation_count: confirmations.length,
    },
    version_coverage: coverage,
    extrapolation: extrapolation,
    sudden_change: suddenChange,
    latest_note_impact: noteImpact,
    confirmation_diff: confirmationDiff,
    details: {
      answer_versions: versions,
      score_notes: notes,
      supplements: supplements.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        unit: s.unit,
        threshold: s.threshold,
        prev_name: s.prev_name,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
      confirmations: confirmations,
    },
  };

  const snapshotHash = hashRequest({ q: questionId, v: versions.length, n: notes.length, s: supplements.length });
  const existingSnapshot = db.prepare('SELECT * FROM report_snapshots WHERE question_id = ? AND snapshot_hash = ?')
    .get(questionId, snapshotHash);
  if (!existingSnapshot) {
    db.prepare(`
      INSERT INTO report_snapshots (question_id, snapshot_hash, snapshot_data, created_at)
      VALUES (?, ?, ?, ?)
    `).run(questionId, snapshotHash, JSON.stringify(report), now());
  }

  return report;
}

function listQuestions() {
  return db.prepare('SELECT * FROM questions ORDER BY updated_at DESC').all().map(q => ({
    ...q,
    display_names: JSON.parse(q.display_names || '[]'),
  }));
}

function getQuestionById(id) {
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
  if (q) q.display_names = JSON.parse(q.display_names || '[]');
  return q;
}

module.exports = {
  findQuestionByAnyName,
  findOrCreateQuestion,
  addAnswerVersion,
  addScoreNote,
  addSupplement,
  addConfirmation,
  generateReport,
  listQuestions,
  getQuestionById,
  detectVersionCoverage,
  detectExtrapolationIssues,
  detectSuddenChange,
};
