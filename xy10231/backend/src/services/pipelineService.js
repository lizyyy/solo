import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { cleanLostItem, cleanFoundItem, tokenize } from './textCleaner.js';
import { matchItems, getProcessingSuggestion, determineConfidence } from './matcher.js';

const PIPELINE_STAGES = [
  'data_import',
  'text_cleaning',
  'feature_extraction',
  'match_processing',
  'candidate_ranking',
  'human_review',
  'completed'
];

function createPipelineStatus(pipelineName, totalCount) {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO pipeline_status (id, pipeline_name, status, current_stage, total_count, started_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, pipelineName, 'running', 'data_import', totalCount, new Date().toISOString());
  return id;
}

function updatePipelineStatus(pipelineId, stage, processedCount, status = 'running', errorMessage = null) {
  db.prepare(`
    UPDATE pipeline_status 
    SET current_stage = ?, processed_count = ?, status = ?, error_message = ?, updated_at = ?
    WHERE id = ?
  `).run(stage, processedCount, status, errorMessage, new Date().toISOString(), pipelineId);
  
  if (status === 'completed' || status === 'failed') {
    db.prepare(`
      UPDATE pipeline_status SET finished_at = ? WHERE id = ?
    `).run(new Date().toISOString(), pipelineId);
  }
}

function getCurrentPipeline() {
  return db.prepare(`
    SELECT * FROM pipeline_status 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get();
}

function getPipelineHistory(limit = 10) {
  return db.prepare(`
    SELECT * FROM pipeline_status 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(limit);
}

function getStatistics() {
  const lostStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
    FROM lost_items
  `).get();
  
  const foundStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
    FROM found_items
  `).get();
  
  const matchStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'candidate' THEN 1 ELSE 0 END) as candidate,
      SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) as pending_review,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      AVG(match_score) as avg_score
    FROM matches
  `).get();
  
  return {
    lost_items: lostStats,
    found_items: foundStats,
    matches: matchStats,
    current_pipeline: getCurrentPipeline()
  };
}

function importLostItems(items, pipelineId) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO lost_items 
    (id, source_id, description, status, raw_data, created_at, updated_at)
    VALUES (?, ?, ?, 'pending', ?, ?, ?)
  `);
  
  const transaction = db.transaction((itemsList) => {
    const now = new Date().toISOString();
    for (const item of itemsList) {
      const id = item.id || uuidv4();
      stmt.run(
        id,
        item.source_id || null,
        item.description,
        JSON.stringify(item),
        now,
        now
      );
    }
  });
  
  transaction(items);
  updatePipelineStatus(pipelineId, 'text_cleaning', items.length);
  return items.length;
}

function importFoundItems(items, pipelineId) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO found_items 
    (id, source_id, description, finder, status, raw_data, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
  `);
  
  const transaction = db.transaction((itemsList) => {
    const now = new Date().toISOString();
    for (const item of itemsList) {
      const id = item.id || uuidv4();
      stmt.run(
        id,
        item.source_id || null,
        item.description,
        item.finder || null,
        JSON.stringify(item),
        now,
        now
      );
    }
  });
  
  transaction(items);
  return items.length;
}

function processTextCleaning(pipelineId) {
  const lostItems = db.prepare('SELECT * FROM lost_items WHERE status = ?').all('pending');
  const foundItems = db.prepare('SELECT * FROM found_items WHERE status = ?').all('pending');
  
  const updateLostStmt = db.prepare(`
    UPDATE lost_items SET
      cleaned_description = ?,
      item_category = ?,
      item_color = ?,
      item_features = ?,
      lost_line = ?,
      lost_station = ?,
      lost_date = ?,
      lost_time = ?,
      status = 'cleaned',
      updated_at = ?
    WHERE id = ?
  `);
  
  const updateFoundStmt = db.prepare(`
    UPDATE found_items SET
      cleaned_description = ?,
      item_category = ?,
      item_color = ?,
      item_features = ?,
      found_line = ?,
      found_station = ?,
      found_date = ?,
      found_time = ?,
      status = 'cleaned',
      updated_at = ?
    WHERE id = ?
  `);
  
  const transaction = db.transaction(() => {
    const now = new Date().toISOString();
    
    for (const item of lostItems) {
      const cleaned = cleanLostItem({
        id: item.id,
        description: item.description
      });
      
      updateLostStmt.run(
        cleaned.cleaned_description,
        cleaned.item_category,
        cleaned.item_color,
        cleaned.item_features,
        cleaned.lost_line,
        cleaned.lost_station,
        cleaned.lost_date,
        cleaned.lost_time,
        now,
        item.id
      );
    }
    
    for (const item of foundItems) {
      const cleaned = cleanFoundItem({
        id: item.id,
        description: item.description
      });
      
      updateFoundStmt.run(
        cleaned.cleaned_description,
        cleaned.item_category,
        cleaned.item_color,
        cleaned.item_features,
        cleaned.found_line,
        cleaned.found_station,
        cleaned.found_date,
        cleaned.found_time,
        now,
        item.id
      );
    }
  });
  
  transaction();
  updatePipelineStatus(pipelineId, 'feature_extraction', lostItems.length + foundItems.length);
  
  return {
    lost_processed: lostItems.length,
    found_processed: foundItems.length
  };
}

function processMatching(pipelineId) {
  const lostItems = db.prepare(`
    SELECT * FROM lost_items WHERE status = 'cleaned' OR status = 'featured'
  `).all();
  
  const foundItems = db.prepare(`
    SELECT * FROM found_items WHERE status = 'cleaned' OR status = 'featured'
  `).all();
  
  const lostWithTokens = lostItems.map(item => ({
    ...item,
    tokens: tokenize(item.cleaned_description || item.description)
  }));
  
  const foundWithTokens = foundItems.map(item => ({
    ...item,
    tokens: tokenize(item.cleaned_description || item.description)
  }));
  
  const matchResults = matchItems(lostWithTokens, foundWithTokens, { minScore: 20, topN: 10 });
  
  const insertMatchStmt = db.prepare(`
    INSERT INTO matches (id, lost_id, found_id, match_score, match_stage, confidence, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'initial_matching', ?, 'candidate', ?, ?)
  `);
  
  const deleteOldMatchesStmt = db.prepare(`
    DELETE FROM matches WHERE match_stage = 'initial_matching' AND status = 'candidate'
  `);
  
  const transaction = db.transaction(() => {
    deleteOldMatchesStmt.run();
    
    const now = new Date().toISOString();
    
    for (const result of matchResults) {
      for (const match of result.matches) {
        insertMatchStmt.run(
          uuidv4(),
          match.lost_id,
          match.found_id,
          match.score,
          match.confidence,
          now,
          now
        );
      }
    }
  });
  
  transaction();
  
  const matchCount = db.prepare('SELECT COUNT(*) as count FROM matches WHERE match_stage = ?').get('initial_matching').count;
  
  updatePipelineStatus(pipelineId, 'candidate_ranking', matchCount);
  
  return {
    lost_items: lostItems.length,
    found_items: foundItems.length,
    matches_created: matchCount
  };
}

function processCandidateRanking(pipelineId) {
  const candidates = db.prepare(`
    SELECT m.*, 
           l.description as lost_description,
           f.description as found_description,
           l.item_category as lost_category,
           f.item_category as found_category,
           l.cleaned_description as lost_cleaned,
           f.cleaned_description as found_cleaned,
           l.lost_line, l.lost_station, l.lost_date, l.lost_time,
           f.found_line, f.found_station, f.found_date, f.found_time,
           l.item_color as lost_color, f.item_color as found_color
    FROM matches m
    JOIN lost_items l ON m.lost_id = l.id
    JOIN found_items f ON m.found_id = f.id
    WHERE m.status = 'candidate'
  `).all();
  
  const updateStmt = db.prepare(`
    UPDATE matches SET 
      status = 'pending_review',
      match_stage = 'candidate_ranking',
      updated_at = ?
    WHERE id = ?
  `);
  
  const transaction = db.transaction(() => {
    const now = new Date().toISOString();
    for (const candidate of candidates) {
      updateStmt.run(now, candidate.id);
    }
  });
  
  transaction();
  
  const rankedCount = db.prepare(`
    SELECT COUNT(*) as count FROM matches WHERE status = 'pending_review'
  `).get().count;
  
  updatePipelineStatus(pipelineId, 'human_review', rankedCount);
  
  return {
    candidates_ranked: rankedCount
  };
}

function runFullPipeline(lostData, foundData) {
  const totalCount = (lostData?.length || 0) + (foundData?.length || 0);
  const pipelineId = createPipelineStatus('full_matching', totalCount);
  
  try {
    if (lostData && lostData.length > 0) {
      importLostItems(lostData, pipelineId);
    }
    
    if (foundData && foundData.length > 0) {
      importFoundItems(foundData, pipelineId);
    }
    
    updatePipelineStatus(pipelineId, 'text_cleaning', totalCount);
    processTextCleaning(pipelineId);
    
    updatePipelineStatus(pipelineId, 'feature_extraction', totalCount);
    
    updatePipelineStatus(pipelineId, 'match_processing', 0);
    const matchResult = processMatching(pipelineId);
    
    const rankResult = processCandidateRanking(pipelineId);
    
    updatePipelineStatus(pipelineId, 'human_review', rankResult.candidates_ranked, 'completed');
    
    return {
      success: true,
      pipeline_id: pipelineId,
      statistics: getStatistics(),
      match_summary: matchResult,
      rank_summary: rankResult
    };
  } catch (error) {
    updatePipelineStatus(pipelineId, 'failed', 0, 'failed', error.message);
    throw error;
  }
}

function submitFeedback(matchId, feedbackType, feedbackNote, operator = 'system') {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match) {
    throw new Error('Match not found');
  }
  
  const feedbackId = uuidv4();
  
  db.prepare(`
    INSERT INTO feedback (id, match_id, feedback_type, feedback_note, operator, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(feedbackId, matchId, feedbackType, feedbackNote, operator, new Date().toISOString());
  
  let newStatus = match.status;
  if (feedbackType === 'confirm') {
    newStatus = 'confirmed';
    db.prepare("UPDATE lost_items SET status = 'matched', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), match.lost_id);
    db.prepare("UPDATE found_items SET status = 'matched', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), match.found_id);
  } else if (feedbackType === 'reject') {
    newStatus = 'rejected';
  }
  
  db.prepare(`
    UPDATE matches SET status = ?, updated_at = ? WHERE id = ?
  `).run(newStatus, new Date().toISOString(), matchId);
  
  logChange('matches', matchId, 'status', match.status, newStatus, operator);
  
  return {
    feedback_id: feedbackId,
    match_id: matchId,
    new_status: newStatus
  };
}

function logChange(entityType, entityId, fieldName, oldValue, newValue, operator = 'system') {
  db.prepare(`
    INSERT INTO change_logs (id, entity_type, entity_id, field_name, old_value, new_value, operator, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    entityType,
    entityId,
    fieldName,
    oldValue ? String(oldValue) : null,
    newValue ? String(newValue) : null,
    operator,
    new Date().toISOString()
  );
}

function getMatchDetails(matchId) {
  return db.prepare(`
    SELECT m.*,
           l.*,
           f.*,
           l.id as lost_id, f.id as found_id,
           l.description as lost_description,
           f.description as found_description
    FROM matches m
    JOIN lost_items l ON m.lost_id = l.id
    JOIN found_items f ON m.found_id = f.id
    WHERE m.id = ?
  `).get(matchId);
}

function getPendingReviews(limit = 100) {
  return db.prepare(`
    SELECT m.*,
           l.description as lost_description,
           f.description as found_description,
           l.item_category as lost_category,
           f.item_category as found_category,
           l.lost_line, l.lost_station,
           f.found_line, f.found_station,
           l.lost_date, f.found_date
    FROM matches m
    JOIN lost_items l ON m.lost_id = l.id
    JOIN found_items f ON m.found_id = f.id
    WHERE m.status = 'pending_review'
    ORDER BY m.match_score DESC
    LIMIT ?
  `).all(limit);
}

function getChangeLogs(entityType = null, entityId = null, limit = 50) {
  let query = 'SELECT * FROM change_logs WHERE 1=1';
  const params = [];
  
  if (entityType) {
    query += ' AND entity_type = ?';
    params.push(entityType);
  }
  if (entityId) {
    query += ' AND entity_id = ?';
    params.push(entityId);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  return db.prepare(query).all(...params);
}

function getFeedbackForMatch(matchId) {
  return db.prepare(`
    SELECT * FROM feedback WHERE match_id = ? ORDER BY created_at DESC
  `).all(matchId);
}

export {
  PIPELINE_STAGES,
  createPipelineStatus,
  updatePipelineStatus,
  getCurrentPipeline,
  getPipelineHistory,
  getStatistics,
  importLostItems,
  importFoundItems,
  processTextCleaning,
  processMatching,
  processCandidateRanking,
  runFullPipeline,
  submitFeedback,
  logChange,
  getMatchDetails,
  getPendingReviews,
  getChangeLogs,
  getFeedbackForMatch
};
