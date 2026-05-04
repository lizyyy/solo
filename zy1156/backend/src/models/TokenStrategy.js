const { v4: uuidv4 } = require('uuid');
const { runQuery } = require('../config/database');

class TokenStrategy {
  constructor({ 
    id, 
    name, 
    description, 
    max_tokens, 
    priority_rules, 
    is_default 
  }) {
    this.id = id || uuidv4();
    this.name = name;
    this.description = description || '';
    this.maxTokens = max_tokens;
    this.priorityRules = priority_rules ? 
      (typeof priority_rules === 'string' ? JSON.parse(priority_rules) : priority_rules) : {};
    this.isDefault = is_default === 1 || is_default === true;
  }

  static create({ name, description, maxTokens, priorityRules, isDefault = false }) {
    const strategy = new TokenStrategy({
      name,
      description,
      max_tokens: maxTokens,
      priority_rules: JSON.stringify(priorityRules || {}),
      is_default: isDefault ? 1 : 0
    });

    if (isDefault) {
      runQuery('UPDATE token_strategies SET is_default = 0 WHERE is_default = 1');
    }

    runQuery(
      `INSERT INTO token_strategies (
        id, name, description, max_tokens, priority_rules, is_default
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        strategy.id,
        strategy.name,
        strategy.description,
        strategy.maxTokens,
        JSON.stringify(strategy.priorityRules),
        strategy.isDefault ? 1 : 0
      ]
    );

    return strategy;
  }

  static findById(id) {
    const results = runQuery('SELECT * FROM token_strategies WHERE id = ?', [id]);
    if (results.length === 0) return null;
    return new TokenStrategy(results[0]);
  }

  static findDefault() {
    const results = runQuery('SELECT * FROM token_strategies WHERE is_default = 1 LIMIT 1');
    if (results.length === 0) {
      const all = this.findAll();
      return all[0] || null;
    }
    return new TokenStrategy(results[0]);
  }

  static findAll() {
    const results = runQuery('SELECT * FROM token_strategies ORDER BY is_default DESC, name ASC');
    return results.map(row => new TokenStrategy(row));
  }

  static initDefaultStrategies() {
    const existing = this.findAll();
    if (existing.length > 0) return existing;

    const strategies = [
      {
        name: 'GPT-3.5 Turbo (4K)',
        description: 'Standard 4K token context window for GPT-3.5 Turbo',
        maxTokens: 4096,
        priorityRules: {
          budget: 100,
          systemPrompt: 90,
          recentMessages: 80,
          toolResults: 70,
          docs: 60,
          oldMessages: 50
        },
        isDefault: true
      },
      {
        name: 'GPT-3.5 Turbo (16K)',
        description: 'Extended 16K token context window for GPT-3.5 Turbo',
        maxTokens: 16384,
        priorityRules: {
          budget: 100,
          systemPrompt: 90,
          recentMessages: 80,
          toolResults: 70,
          docs: 60,
          oldMessages: 50
        },
        isDefault: false
      },
      {
        name: 'GPT-4 (8K)',
        description: 'Standard 8K token context window for GPT-4',
        maxTokens: 8192,
        priorityRules: {
          budget: 100,
          systemPrompt: 95,
          recentMessages: 85,
          toolResults: 75,
          docs: 70,
          oldMessages: 50
        },
        isDefault: false
      },
      {
        name: 'GPT-4 Turbo (128K)',
        description: 'Large 128K token context window for GPT-4 Turbo',
        maxTokens: 131072,
        priorityRules: {
          budget: 100,
          systemPrompt: 95,
          recentMessages: 90,
          toolResults: 85,
          docs: 80,
          oldMessages: 70
        },
        isDefault: false
      },
      {
        name: 'Strict Budget (2K)',
        description: 'Very strict 2K token limit for cost optimization',
        maxTokens: 2048,
        priorityRules: {
          budget: 100,
          systemPrompt: 90,
          recentMessages: 80,
          toolResults: 60,
          docs: 40,
          oldMessages: 20
        },
        isDefault: false
      }
    ];

    const created = [];
    for (const s of strategies) {
      created.push(this.create(s));
    }

    return created;
  }

  update({ name, description, maxTokens, priorityRules, isDefault }) {
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
      this.name = name;
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
      this.description = description;
    }
    if (maxTokens !== undefined) {
      updates.push('max_tokens = ?');
      values.push(maxTokens);
      this.maxTokens = maxTokens;
    }
    if (priorityRules !== undefined) {
      updates.push('priority_rules = ?');
      values.push(JSON.stringify(priorityRules));
      this.priorityRules = priorityRules;
    }
    if (isDefault !== undefined) {
      if (isDefault && !this.isDefault) {
        runQuery('UPDATE token_strategies SET is_default = 0 WHERE is_default = 1');
      }
      updates.push('is_default = ?');
      values.push(isDefault ? 1 : 0);
      this.isDefault = isDefault;
    }

    if (updates.length === 0) return this;

    values.push(this.id);

    runQuery(
      `UPDATE token_strategies SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this;
  }

  delete() {
    runQuery('DELETE FROM token_strategies WHERE id = ?', [this.id]);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      maxTokens: this.maxTokens,
      priorityRules: this.priorityRules,
      isDefault: this.isDefault
    };
  }
}

module.exports = TokenStrategy;
