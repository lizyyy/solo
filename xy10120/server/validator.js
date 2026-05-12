const { db } = require('./database');
const { v4: uuidv4 } = require('uuid');

const VALIDATION_STATUS = {
  VALID: 'valid',
  MISSING_REFERENCE: 'missing_reference',
  WRONG_DOCUMENT: 'wrong_document',
  CONTENT_MISMATCH: 'content_mismatch',
  PARTIAL_MATCH: 'partial_match',
  PENDING_REVIEW: 'pending_review',
  REVIEWED_VALID: 'reviewed_valid',
  REVIEWED_INVALID: 'reviewed_invalid'
};

function getNGrams(str, n = 2) {
  const grams = new Set();
  const normalized = str.toLowerCase().trim();
  
  if (normalized.length < n) {
    if (normalized.length > 0) grams.add(normalized);
    return grams;
  }
  
  for (let i = 0; i <= normalized.length - n; i++) {
    grams.add(normalized.substring(i, i + n));
  }
  
  return grams;
}

function calculateTextSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const grams1 = getNGrams(s1, 2);
  const grams2 = getNGrams(s2, 2);
  
  if (grams1.size === 0 || grams2.size === 0) return 0;
  
  let intersection = 0;
  grams1.forEach(gram => {
    if (grams2.has(gram)) intersection++;
  });
  
  const union = grams1.size + grams2.size - intersection;
  if (union === 0) return 0;
  
  return intersection / union;
}

function extractCitationsFromAnswer(answer) {
  const citations = [];
  
  const bracketPattern = /\[\s*(\d+)\s*\]/g;
  let match;
  let position = 0;
  
  while ((match = bracketPattern.exec(answer)) !== null) {
    citations.push({
      type: 'bracket',
      reference: match[1],
      position: position++
    });
  }
  
  const linkPattern = /(?:来源|引用|参考|出自)[：:]\s*([^\n，。,；;]+)/gi;
  while ((match = linkPattern.exec(answer)) !== null) {
    citations.push({
      type: 'text_reference',
      reference: match[1].trim(),
      position: position++
    });
  }
  
  return citations;
}

const SIMILARITY_THRESHOLDS = {
  CONTENT_MISMATCH: 0.4,
  PARTIAL_MATCH: 0.55
};

function validateCitation(citation, qaRecordId) {
  const hasKbId = !!citation.knowledge_base_id;
  const hasDocId = !!citation.document_id;
  const hasCitedText = !!citation.cited_text;

  if (!hasCitedText || (!hasKbId && !hasDocId)) {
    return [{
      id: uuidv4(),
      qa_record_id: qaRecordId,
      citation_id: citation.id,
      status: VALIDATION_STATUS.MISSING_REFERENCE,
      score: 0,
      reason: '引用缺少必要信息：需要提供引用文本，以及知识库ID或文档ID'
    }];
  }

  if (hasKbId) {
    const kbEntry = db.prepare(`
      SELECT * FROM knowledge_base WHERE id = ?
    `).get(citation.knowledge_base_id);

    if (kbEntry) {
      const similarity = calculateTextSimilarity(citation.cited_text, kbEntry.content);
      
      if (similarity < SIMILARITY_THRESHOLDS.CONTENT_MISMATCH) {
        return [{
          id: uuidv4(),
          qa_record_id: qaRecordId,
          citation_id: citation.id,
          status: VALIDATION_STATUS.CONTENT_MISMATCH,
          score: similarity,
          reason: `引用文本与知识库条目 "${kbEntry.title}" 内容匹配度过低 (${(similarity * 100).toFixed(1)}%)`
        }];
      } else if (similarity < SIMILARITY_THRESHOLDS.PARTIAL_MATCH) {
        return [{
          id: uuidv4(),
          qa_record_id: qaRecordId,
          citation_id: citation.id,
          status: VALIDATION_STATUS.PARTIAL_MATCH,
          score: similarity,
          reason: `引用文本与知识库条目 "${kbEntry.title}" 部分匹配 (${(similarity * 100).toFixed(1)}%)，建议人工复核`
        }];
      } else {
        return [{
          id: uuidv4(),
          qa_record_id: qaRecordId,
          citation_id: citation.id,
          status: VALIDATION_STATUS.VALID,
          score: similarity,
          reason: `引用有效，与 "${kbEntry.title}" 匹配度 ${(similarity * 100).toFixed(1)}%`
        }];
      }
    }
  }

  if (hasDocId) {
    const docEntries = db.prepare(`
      SELECT * FROM knowledge_base WHERE document_id = ?
    `).all(citation.document_id);

    if (docEntries.length === 0) {
      return [{
        id: uuidv4(),
        qa_record_id: qaRecordId,
        citation_id: citation.id,
        status: VALIDATION_STATUS.WRONG_DOCUMENT,
        score: 0,
        reason: `文档ID "${citation.document_id}" 在知识库中不存在`
      }];
    }

    let bestMatch = null;
    let bestScore = 0;
    
    docEntries.forEach(entry => {
      const score = calculateTextSimilarity(citation.cited_text, entry.content);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    });

    if (bestScore < SIMILARITY_THRESHOLDS.CONTENT_MISMATCH) {
      return [{
        id: uuidv4(),
        qa_record_id: qaRecordId,
        citation_id: citation.id,
        status: VALIDATION_STATUS.CONTENT_MISMATCH,
        score: bestScore,
        reason: `引用文本与文档 "${citation.document_id}" 中内容匹配度过低 (${(bestScore * 100).toFixed(1)}%)`
      }];
    } else if (bestScore < SIMILARITY_THRESHOLDS.PARTIAL_MATCH) {
      return [{
        id: uuidv4(),
        qa_record_id: qaRecordId,
        citation_id: citation.id,
        status: VALIDATION_STATUS.PARTIAL_MATCH,
        score: bestScore,
        reason: `引用文本与文档 "${citation.document_id}"（${bestMatch.title}）部分匹配 (${(bestScore * 100).toFixed(1)}%)，建议人工复核`
      }];
    } else {
      return [{
        id: uuidv4(),
        qa_record_id: qaRecordId,
        citation_id: citation.id,
        status: VALIDATION_STATUS.VALID,
        score: bestScore,
        reason: `引用有效，与文档 "${citation.document_id}"（${bestMatch.title}）匹配度 ${(bestScore * 100).toFixed(1)}%`
      }];
    }
  }

  return [{
    id: uuidv4(),
    qa_record_id: qaRecordId,
    citation_id: citation.id,
    status: VALIDATION_STATUS.MISSING_REFERENCE,
    score: 0,
    reason: '无法定位引用来源'
  }];
}

function validateQARecord(qaRecordId) {
  const qaRecord = db.prepare(`
    SELECT * FROM qa_records WHERE id = ?
  `).get(qaRecordId);
  
  if (!qaRecord) {
    throw new Error(`问答记录不存在: ${qaRecordId}`);
  }
  
  const citations = db.prepare(`
    SELECT * FROM citations WHERE qa_record_id = ?
  `).all(qaRecordId);
  
  if (citations.length === 0) {
    return [{
      id: uuidv4(),
      qa_record_id: qaRecordId,
      citation_id: null,
      status: VALIDATION_STATUS.MISSING_REFERENCE,
      score: 0,
      reason: '回答中未找到任何引用'
    }];
  }
  
  const allResults = [];
  
  citations.forEach(citation => {
    const results = validateCitation(citation, qaRecordId);
    allResults.push(...results);
  });
  
  const insertStmt = db.prepare(`
    INSERT INTO validation_results (id, qa_record_id, citation_id, status, score, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const insertVersion = db.prepare(`
    INSERT INTO version_history (id, entity_type, entity_id, action, data)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction((results) => {
    results.forEach(result => {
      insertStmt.run(
        result.id,
        result.qa_record_id,
        result.citation_id,
        result.status,
        result.score,
        result.reason
      );
      
      insertVersion.run(
        uuidv4(),
        'validation_result',
        result.id,
        'create',
        JSON.stringify(result)
      );
    });
  });
  
  transaction(allResults);
  
  return allResults;
}

function validateAll() {
  const qaRecords = db.prepare(`
    SELECT id FROM qa_records
  `).all();
  
  const allResults = [];
  
  qaRecords.forEach(record => {
    const results = validateQARecord(record.id);
    allResults.push(...results);
  });
  
  return allResults;
}

module.exports = {
  VALIDATION_STATUS,
  validateQARecord,
  validateAll,
  calculateTextSimilarity,
  extractCitationsFromAnswer
};
