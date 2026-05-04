const { v4: uuidv4 } = require('uuid');
const { runQuery } = require('../config/database');
const tokenService = require('../services/tokenService');

class ContextPackage {
  constructor({ 
    id, 
    task_id, 
    conversations_jsonl, 
    docs_md, 
    tool_results_json, 
    budget_yaml, 
    total_tokens,
    created_at 
  }) {
    this.id = id || uuidv4();
    this.taskId = task_id;
    this.conversationsJsonl = conversations_jsonl;
    this.docsMd = docs_md;
    this.toolResultsJson = tool_results_json;
    this.budgetYaml = budget_yaml;
    this.totalTokens = total_tokens || 0;
    this.createdAt = created_at;
  }

  static create({ taskId, conversations, docs, toolResults, budget }) {
    const conversationsJsonl = conversations ? 
      conversations.map(c => JSON.stringify(c)).join('\n') : null;
    const toolResultsJson = toolResults ? JSON.stringify(toolResults) : null;
    const budgetYaml = budget ? 
      (typeof budget === 'string' ? budget : JSON.stringify(budget)) : null;

    let totalTokens = 0;
    try {
      totalTokens = tokenService.estimateContextTokens({
        conversations: conversations || [],
        docs: docs || '',
        toolResults: toolResults || null,
        budgetYaml: budgetYaml || ''
      });
    } catch (e) {
      console.error('Token estimation error:', e);
    }

    const contextPackage = new ContextPackage({
      task_id: taskId,
      conversations_jsonl: conversationsJsonl,
      docs_md: docs,
      tool_results_json: toolResultsJson,
      budget_yaml: budgetYaml,
      total_tokens: totalTokens
    });

    runQuery(
      `INSERT INTO context_packages (
        id, task_id, conversations_jsonl, docs_md, tool_results_json, budget_yaml, total_tokens, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        contextPackage.id,
        contextPackage.taskId,
        contextPackage.conversationsJsonl,
        contextPackage.docsMd,
        contextPackage.toolResultsJson,
        contextPackage.budgetYaml,
        contextPackage.totalTokens
      ]
    );

    return contextPackage;
  }

  static findById(id) {
    const results = runQuery('SELECT * FROM context_packages WHERE id = ?', [id]);
    if (results.length === 0) return null;
    return new ContextPackage(results[0]);
  }

  static findByTaskId(taskId, limit = 20, offset = 0) {
    const results = runQuery(
      'SELECT * FROM context_packages WHERE task_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [taskId, limit, offset]
    );
    return results.map(row => new ContextPackage(row));
  }

  static findAll(limit = 50, offset = 0) {
    const results = runQuery(
      'SELECT * FROM context_packages ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return results.map(row => new ContextPackage(row));
  }

  getConversations() {
    if (!this.conversationsJsonl) return [];
    try {
      const lines = this.conversationsJsonl.trim().split('\n');
      return lines.map(line => JSON.parse(line));
    } catch (e) {
      console.error('Error parsing conversations:', e);
      return [];
    }
  }

  getToolResults() {
    if (!this.toolResultsJson) return null;
    try {
      return JSON.parse(this.toolResultsJson);
    } catch (e) {
      console.error('Error parsing tool results:', e);
      return null;
    }
  }

  getBudget() {
    if (!this.budgetYaml) return {};
    try {
      if (this.budgetYaml.trim().startsWith('{')) {
        return JSON.parse(this.budgetYaml);
      }
      const yaml = require('js-yaml');
      return yaml.load(this.budgetYaml) || {};
    } catch (e) {
      console.error('Error parsing budget:', e);
      return {};
    }
  }

  toContextData() {
    return {
      conversations: this.getConversations(),
      docs: this.docsMd || '',
      toolResults: this.getToolResults(),
      budgetConstraints: this.getBudget()
    };
  }

  delete() {
    runQuery('DELETE FROM context_packages WHERE id = ?', [this.id]);
  }

  toJSON() {
    return {
      id: this.id,
      taskId: this.taskId,
      conversations: this.getConversations(),
      docs: this.docsMd,
      toolResults: this.getToolResults(),
      budget: this.getBudget(),
      totalTokens: this.totalTokens,
      createdAt: this.createdAt
    };
  }
}

module.exports = ContextPackage;
