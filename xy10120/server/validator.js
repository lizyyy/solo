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

function calculateTextSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const tokens1 = new Set(s1.split(/\s+/).filter(t => t.length > 1));
  const tokens2 = new Set(s2.split(/\s+/).filter(t => t.length > 1));
  
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  let intersection = 0;
  tokens1.forEach(token => {
    if (tokens2.has(token)) intersection++;
  });
  
  const union = tokens1.size + tokens2.size - intersection;
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

function validateCitation(citation, qaRecordId) {
  const results = [];
  
  if (!citation.knowledge_base_id || !citation.cited_text) {
    return [{
      id: uuidv4(),
      qa_record_id: qaRecordId,
      citation_id: citation.id,
      status: VALIDATION_STATUS.MISSING_REFERENCE,
      score: 0,
      reason: '引用缺少必要信息：知识库ID或引用文本为空'
    }];
  }
  
  const kbEntry = db.prepare(`
    SELECT * FROM knowledge_base WHERE id = ?
  `).get(citation.knowledge_base_id);
  
  if (!kbEntry) {
    if (citation.document_id) {
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
      } else {
        let bestMatch = null;
        let bestScore = 0;
        
        docEntries.forEach(entry => {
          const score = calculateTextSimilarity(citation.cited_text, entry.content);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = entry;
          }
        });
        
        if (bestScore < 0.3) {
          return [{
            id: uuidv4(),
            qa_record_id: qaRecordId,
            citation_id: citation.id,
            status: VALIDATION_STATUS.CONTENT_MISMATCH,
            score: bestScore,
            reason: `引用文本与文档 "${citation.document_id}" 中内容匹配度过低 (${(bestScore * 100).toFixed(1)}%)`
          }];
        } else if (bestScore < 0.6) {
          return [{
            id: uuidv4(),
            qa_record_id: qaRecordId,
            citation_id: citation.id,
            status: VALIDATION_STATUS.PARTIAL_MATCH,
            score: bestScore,
            reason: `引用文本与文档 "${citation.document_id}" 部分匹配 (${(bestScore * 100).toFixed(1)}%)，建议人工复核`
          }];
        } else {
          return [{
            id: uuidv4(),
            qa_record_id: qaRecordId,
            citation_id: citation.id,
            status: VALIDATION_STATUS.VALID,
            score: bestScore,
            reason: `引用有效，匹配度 ${(bestScore * 100).toFixed(1)}%`
          }];
        }
      }
    } else {
      return [{
        id: uuidv4(),
        qa_record_id: qaRecordId,
        citation_id: citation.id,
        status: VALIDATION_STATUS.MISSING_REFERENCE,
        score: 0,
        reason: '引用的知识库条目不存在，且未提供文档ID'
      }];
    }
  }
  
  const similarity = calculateTextSimilarity(citation.cited_text, kbEntry.content);
  
  if (similarity < 0.3) {
    results.push({
      id: uuidv4(),
      qa_record_id: qaRecordId,
      citation_id: citation.id,
      status: VALIDATION_STATUS.CONTENT_MISMATCH,
      score: similarity,
      reason: `引用文本与知识库条目 "${kbEntry.title}" 内容匹配度过低 (${(similarity * 100).toFixed(1)}%)`
    });
  } else if (similarity < 0.6) {
    results.push({
      id: uuidv4(),
      qa_record_id: qaRecordId,
      citation_id: citation.id,
      status: VALIDATION_STATUS.PARTIAL_MATCH,
      score: similarity,
      reason: `引用文本与知识库条目 "${kbEntry.title}" 部分匹配 (${(similarity * 100).toFixed(1)}%)，建议人工复核`
    });
  } else {
    results.push({
      id: uuidv4(),
      qa_record_id: qaRecordId,
      citation_id: citation.id,
      status: VALIDATION_STATUS.VALID,
      score: similarity,
      reason: `引用有效，与 "${kbEntry.title}" 匹配度 ${(similarity * 100).toFixed(1)}%`
    });
  }
  
  return results;
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
