const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../database');

function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

function normalizeEmail(email) {
  if (!email) return '';
  return email.toLowerCase().trim();
}

function calculateSimilarity(lead1, lead2) {
  let score = 0;
  let reasons = [];

  const phone1 = normalizePhone(lead1.phone);
  const phone2 = normalizePhone(lead2.phone);
  
  if (phone1 && phone2 && phone1 === phone2) {
    score += 50;
    reasons.push('手机号完全匹配');
  }

  const email1 = normalizeEmail(lead1.email);
  const email2 = normalizeEmail(lead2.email);
  
  if (email1 && email2 && email1 === email2) {
    score += 40;
    reasons.push('邮箱完全匹配');
  }

  if (lead1.name && lead2.name && lead1.name === lead2.name) {
    score += 20;
    reasons.push('姓名完全匹配');
  }

  if (lead1.company && lead2.company && lead1.company === lead2.company) {
    score += 15;
    reasons.push('公司完全匹配');
  }

  return { score, reasons: reasons.join(', ') };
}

function detectFieldConflicts(keepLead, mergeLead) {
  const conflicts = [];
  const fields = ['name', 'phone', 'email', 'company', 'source'];
  
  fields.forEach(field => {
    const val1 = keepLead[field];
    const val2 = mergeLead[field];
    
    if (val1 && val2 && val1 !== val2) {
      conflicts.push({
        field,
        keepValue: val1,
        mergeValue: val2,
        suggested: val1
      });
    }
  });

  return conflicts;
}

async function findDuplicates(newLead) {
  const candidates = [];
  const phone = normalizePhone(newLead.phone);
  const email = normalizeEmail(newLead.email);

  let query = `
    SELECT * FROM leads 
    WHERE id != ? 
    AND status NOT IN ('merged', 'rejected')
  `;
  const params = [newLead.id];

  if (phone || email) {
    query += ` AND (
      (phone IS NOT NULL AND REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') = ?)
      OR (email IS NOT NULL AND LOWER(email) = ?)
    )`;
    params.push(phone, email);
  }

  const existingLeads = await allQuery(query, params);

  for (const existing of existingLeads) {
    const { score, reasons } = calculateSimilarity(newLead, existing);
    if (score >= 30) {
      candidates.push({
        id: uuidv4(),
        leadId: newLead.id,
        duplicateLeadId: existing.id,
        similarityScore: score,
        matchReason: reasons,
        status: 'pending'
      });
    }
  }

  return candidates;
}

async function saveDuplicateCandidates(candidates) {
  for (const candidate of candidates) {
    await runQuery(
      `INSERT INTO duplicate_candidates (id, lead_id, duplicate_lead_id, similarity_score, match_reason, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [candidate.id, candidate.leadId, candidate.duplicateLeadId, candidate.similarityScore, candidate.matchReason, candidate.status]
    );
  }
}

async function createMergeSuggestion(duplicateCandidate, newLead, existingLead) {
  const keepLead = newLead.created_at > existingLead.created_at ? newLead : existingLead;
  const mergeLead = newLead.created_at > existingLead.created_at ? existingLead : newLead;
  
  const conflicts = detectFieldConflicts(keepLead, mergeLead);

  const suggestionId = uuidv4();
  await runQuery(
    `INSERT INTO merge_suggestions 
     (id, lead_id, candidate_id, keep_lead_id, merge_lead_id, field_conflicts, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      suggestionId,
      newLead.id,
      duplicateCandidate.id,
      keepLead.id,
      mergeLead.id,
      JSON.stringify(conflicts),
      'suggested'
    ]
  );

  return suggestionId;
}

async function processNewLead(leadData, requestId) {
  const existingRequest = await getQuery(
    `SELECT * FROM leads WHERE request_id = ?`,
    [requestId]
  );

  if (existingRequest) {
    return {
      isDuplicateRequest: true,
      lead: existingRequest,
      message: '重复请求，使用已有结果'
    };
  }

  const leadId = uuidv4();
  await runQuery(
    `INSERT INTO leads (id, request_id, name, phone, email, company, source, source_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      leadId,
      requestId,
      leadData.name,
      leadData.phone,
      leadData.email,
      leadData.company,
      leadData.source,
      leadData.source_id,
      'processing'
    ]
  );

  await addLog(leadId, 'import', 'processing', '开始导入线索', 'system');

  const newLead = await getQuery(`SELECT * FROM leads WHERE id = ?`, [leadId]);
  
  const duplicates = await findDuplicates(newLead);

  if (duplicates.length > 0) {
    await saveDuplicateCandidates(duplicates);
    
    for (const dup of duplicates) {
      const existingLead = await getQuery(`SELECT * FROM leads WHERE id = ?`, [dup.duplicateLeadId]);
      await createMergeSuggestion(dup, newLead, existingLead);
    }

    await runQuery(`UPDATE leads SET status = 'needs_review' WHERE id = ?`, [leadId]);
    await addLog(leadId, 'dedupe_check', 'needs_review', `发现 ${duplicates.length} 个重复线索`, 'system');

    return {
      isDuplicateRequest: false,
      lead: newLead,
      hasDuplicates: true,
      duplicateCount: duplicates.length,
      status: 'needs_review'
    };
  } else {
    await runQuery(`UPDATE leads SET status = 'accepted' WHERE id = ?`, [leadId]);
    await addLog(leadId, 'dedupe_check', 'accepted', '未发现重复，自动通过', 'system');

    return {
      isDuplicateRequest: false,
      lead: newLead,
      hasDuplicates: false,
      status: 'accepted'
    };
  }
}

async function addLog(leadId, action, status, details, operator) {
  const logId = uuidv4();
  await runQuery(
    `INSERT INTO processing_logs (id, lead_id, action, status, details, operator)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [logId, leadId, action, status, details, operator]
  );
}

async function approveMerge(suggestionId, resolvedFields, operator) {
  const suggestion = await getQuery(
    `SELECT * FROM merge_suggestions WHERE id = ?`,
    [suggestionId]
  );

  if (!suggestion) {
    throw new Error('合并建议不存在');
  }

  const keepLead = await getQuery(`SELECT * FROM leads WHERE id = ?`, [suggestion.keep_lead_id]);
  const mergeLead = await getQuery(`SELECT * FROM leads WHERE id = ?`, [suggestion.merge_lead_id]);

  if (resolvedFields) {
    const updates = [];
    const params = [];
    
    resolvedFields.forEach(field => {
      updates.push(`${field.field} = ?`);
      params.push(field.value);
    });
    
    params.push(keepLead.id);
    
    if (updates.length > 0) {
      await runQuery(
        `UPDATE leads SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params
      );
    }
  }

  await runQuery(`UPDATE leads SET status = 'merged' WHERE id = ?`, [mergeLead.id]);
  await runQuery(`UPDATE leads SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [keepLead.id]);
  
  await runQuery(
    `UPDATE merge_suggestions SET status = 'approved', resolved_fields = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [JSON.stringify(resolvedFields || []), suggestionId]
  );

  await runQuery(
    `UPDATE duplicate_candidates SET status = 'merged' WHERE id = ?`,
    [suggestion.candidate_id]
  );

  await addLog(keepLead.id, 'merge_approve', 'approved', `合并了线索 ${mergeLead.id}`, operator);
  await addLog(mergeLead.id, 'merged', 'merged', `被合并到线索 ${keepLead.id}`, operator);

  return { keepLeadId: keepLead.id, mergedLeadId: mergeLead.id };
}

async function rejectDuplicate(leadId, operator) {
  await runQuery(`UPDATE leads SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [leadId]);
  
  await runQuery(
    `UPDATE duplicate_candidates SET status = 'rejected' WHERE lead_id = ?`,
    [leadId]
  );
  
  await runQuery(
    `UPDATE merge_suggestions SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE lead_id = ?`,
    [leadId]
  );

  await addLog(leadId, 'reject_duplicate', 'accepted', '人工确认非重复', operator);

  return true;
}

async function getLeadDetails(leadId) {
  const lead = await getQuery(`SELECT * FROM leads WHERE id = ?`, [leadId]);
  if (!lead) return null;

  const duplicates = await allQuery(
    `SELECT dc.*, l.name as duplicate_name, l.phone as duplicate_phone, l.email as duplicate_email, l.company as duplicate_company, l.source as duplicate_source
     FROM duplicate_candidates dc
     JOIN leads l ON dc.duplicate_lead_id = l.id
     WHERE dc.lead_id = ?`,
    [leadId]
  );

  const suggestions = await allQuery(
    `SELECT ms.*, k.name as keep_name, m.name as merge_name
     FROM merge_suggestions ms
     JOIN leads k ON ms.keep_lead_id = k.id
     JOIN leads m ON ms.merge_lead_id = m.id
     WHERE ms.lead_id = ?`,
    [leadId]
  );

  const logs = await allQuery(
    `SELECT * FROM processing_logs WHERE lead_id = ? ORDER BY created_at DESC`,
    [leadId]
  );

  return {
    lead,
    duplicates: duplicates.map(d => ({
      ...d,
      similarity_score: d.similarity_score
    })),
    suggestions: suggestions.map(s => ({
      ...s,
      field_conflicts: s.field_conflicts ? JSON.parse(s.field_conflicts) : [],
      resolved_fields: s.resolved_fields ? JSON.parse(s.resolved_fields) : []
    })),
    logs
  };
}

module.exports = {
  processNewLead,
  approveMerge,
  rejectDuplicate,
  getLeadDetails,
  addLog,
  normalizePhone,
  normalizeEmail
};
