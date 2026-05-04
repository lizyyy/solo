const { v4: uuidv4 } = require('uuid');
const { runQuery } = require('../config/database');

class Evaluation {
  constructor({ 
    id, 
    context_package_id, 
    strategy_id, 
    result_json, 
    retained_tokens, 
    lost_tokens, 
    risk_level, 
    notes,
    created_at 
  }) {
    this.id = id || uuidv4();
    this.contextPackageId = context_package_id;
    this.strategyId = strategy_id;
    this.resultJson = result_json;
    this.retainedTokens = retained_tokens || 0;
    this.lostTokens = lost_tokens || 0;
    this.riskLevel = risk_level || 'low';
    this.notes = notes || '';
    this.createdAt = created_at;
  }

  static create({ contextPackageId, strategyId, result, notes = '' }) {
    const resultJson = JSON.stringify(result);
    
    let riskLevel = 'low';
    const lostRatio = result.statistics.totalLostTokens / result.statistics.totalOriginalTokens;
    if (lostRatio > 0.5) {
      riskLevel = 'high';
    } else if (lostRatio > 0.3) {
      riskLevel = 'medium';
    }

    if (result.lost.conversations && result.lost.conversations.length > 0) {
      const hasLostSystemMessages = result.lost.conversations.some(m => m.role === 'system');
      if (hasLostSystemMessages) {
        riskLevel = 'high';
      }
    }

    const evaluation = new Evaluation({
      context_package_id: contextPackageId,
      strategy_id: strategyId,
      result_json: resultJson,
      retained_tokens: result.statistics.totalRetainedTokens,
      lost_tokens: result.statistics.totalLostTokens,
      risk_level: riskLevel,
      notes
    });

    runQuery(
      `INSERT INTO evaluations (
        id, context_package_id, strategy_id, result_json, retained_tokens, lost_tokens, risk_level, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        evaluation.id,
        evaluation.contextPackageId,
        evaluation.strategyId,
        evaluation.resultJson,
        evaluation.retainedTokens,
        evaluation.lostTokens,
        evaluation.riskLevel,
        evaluation.notes
      ]
    );

    return evaluation;
  }

  static findById(id) {
    const results = runQuery('SELECT * FROM evaluations WHERE id = ?', [id]);
    if (results.length === 0) return null;
    return new Evaluation(results[0]);
  }

  static findByContextPackageId(contextPackageId, limit = 20, offset = 0) {
    const results = runQuery(
      'SELECT * FROM evaluations WHERE context_package_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [contextPackageId, limit, offset]
    );
    return results.map(row => new Evaluation(row));
  }

  static findAll(limit = 50, offset = 0) {
    const results = runQuery(
      'SELECT * FROM evaluations ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return results.map(row => new Evaluation(row));
  }

  static findByRiskLevel(riskLevel, limit = 50, offset = 0) {
    const results = runQuery(
      'SELECT * FROM evaluations WHERE risk_level = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [riskLevel, limit, offset]
    );
    return results.map(row => new Evaluation(row));
  }

  getResult() {
    if (!this.resultJson) return null;
    try {
      return JSON.parse(this.resultJson);
    } catch (e) {
      console.error('Error parsing evaluation result:', e);
      return null;
    }
  }

  update({ riskLevel, notes }) {
    const updates = [];
    const values = [];

    if (riskLevel !== undefined) {
      updates.push('risk_level = ?');
      values.push(riskLevel);
      this.riskLevel = riskLevel;
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
      this.notes = notes;
    }

    if (updates.length === 0) return this;

    values.push(this.id);

    runQuery(
      `UPDATE evaluations SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this;
  }

  delete() {
    runQuery('DELETE FROM evaluations WHERE id = ?', [this.id]);
  }

  toJSON() {
    return {
      id: this.id,
      contextPackageId: this.contextPackageId,
      strategyId: this.strategyId,
      result: this.getResult(),
      retainedTokens: this.retainedTokens,
      lostTokens: this.lostTokens,
      riskLevel: this.riskLevel,
      notes: this.notes,
      createdAt: this.createdAt
    };
  }
}

module.exports = Evaluation;
