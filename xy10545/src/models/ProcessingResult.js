const db = require('../database/db');

class ProcessingResult {
  static create({ id, conversation_id, agent_handler_id, resolution, category = null, follow_up_needed = 0, satisfaction_score = null, idempotency_key = null }) {
    const result = {
      id,
      conversation_id,
      agent_handler_id,
      resolution,
      category,
      follow_up_needed,
      satisfaction_score,
      completed_at: db.now(),
      idempotency_key
    };
    db.prepare('processing_results').run(result);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('processing_results').get(p => p.id === id);
  }

  static findByIdempotencyKey(key) {
    return db.prepare('processing_results').get(p => p.idempotency_key === key);
  }

  static findByConversation(conversation_id) {
    return db.prepare('processing_results')
      .all(p => p.conversation_id === conversation_id)
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
  }

  static getStats() {
    const all = db.prepare('processing_results').all();
    if (all.length === 0) {
      return { total_results: 0, follow_up_count: 0, avg_satisfaction: 0 };
    }
    
    const withScore = all.filter(r => r.satisfaction_score !== null);
    const avg = withScore.length > 0 
      ? withScore.reduce((sum, r) => sum + r.satisfaction_score, 0) / withScore.length 
      : 0;
    
    return {
      total_results: all.length,
      follow_up_count: all.filter(r => r.follow_up_needed === 1).length,
      avg_satisfaction: avg
    };
  }
}

module.exports = ProcessingResult;
