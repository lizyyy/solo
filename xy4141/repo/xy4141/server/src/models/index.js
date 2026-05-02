const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const Plugin = {
  findAll: function() {
    return db.prepare('SELECT * FROM plugins ORDER BY created_at DESC').all();
  },

  findById: function(id) {
    return db.prepare('SELECT * FROM plugins WHERE id = ?').get(id);
  },

  findByNameAndVersion: function(name, version) {
    return db.prepare('SELECT * FROM plugins WHERE name = ? AND version = ?').get(name, version);
  },

  create: function(data) {
    const id = uuidv4();
    const now = dayjs().toISOString();
    const result = db.prepare(`
      INSERT INTO plugins (
        id, name, version, vendor, description, manifest, wasm_path,
        input_schema, output_schema, error_codes, max_memory_mb,
        max_timeout_ms, performance_threshold_ms, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.name, data.version, data.vendor, data.description,
      JSON.stringify(data.manifest), data.wasm_path,
      data.input_schema ? JSON.stringify(data.input_schema) : null,
      data.output_schema ? JSON.stringify(data.output_schema) : null,
      data.error_codes ? JSON.stringify(data.error_codes) : null,
      data.max_memory_mb || 64,
      data.max_timeout_ms || 5000,
      data.performance_threshold_ms || 1000,
      now, now
    );
    return this.findById(id);
  },

  delete: function(id) {
    const result = db.prepare('DELETE FROM plugins WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

const Batch = {
  findAll: function() {
    return db.prepare(`
      SELECT b.*, p.name as plugin_name, p.version as plugin_version
      FROM batches b
      JOIN plugins p ON b.plugin_id = p.id
      ORDER BY b.created_at DESC
    `).all();
  },

  findById: function(id) {
    return db.prepare(`
      SELECT b.*, p.name as plugin_name, p.version as plugin_version
      FROM batches b
      JOIN plugins p ON b.plugin_id = p.id
      WHERE b.id = ?
    `).get(id);
  },

  findByPluginId: function(pluginId) {
    return db.prepare(`
      SELECT * FROM batches WHERE plugin_id = ? ORDER BY created_at DESC
    `).all(pluginId);
  },

  create: function(data) {
    const id = uuidv4();
    const now = dayjs().toISOString();
    const result = db.prepare(`
      INSERT INTO batches (id, plugin_id, name, description, sample_count, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.plugin_id, data.name, data.description,
      data.sample_count || 0, 'pending', now, now
    );
    return this.findById(id);
  },

  update: function(id, updates) {
    const fields = [];
    const values = [];
    
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.sample_count !== undefined) {
      fields.push('sample_count = ?');
      values.push(updates.sample_count);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    
    if (fields.length === 0) return null;
    
    fields.push('updated_at = ?');
    values.push(dayjs().toISOString());
    values.push(id);
    
    db.prepare(`UPDATE batches SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  delete: function(id) {
    const result = db.prepare('DELETE FROM batches WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

const Sample = {
  findAll: function(batchId) {
    return db.prepare('SELECT * FROM samples WHERE batch_id = ? ORDER BY order_index').all(batchId);
  },

  findById: function(id) {
    return db.prepare('SELECT * FROM samples WHERE id = ?').get(id);
  },

  create: function(data) {
    const id = uuidv4();
    const now = dayjs().toISOString();
    const result = db.prepare(`
      INSERT INTO samples (id, batch_id, input_data, expected_output, order_index, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id, data.batch_id,
      typeof data.input_data === 'string' ? data.input_data : JSON.stringify(data.input_data),
      data.expected_output ? (typeof data.expected_output === 'string' ? data.expected_output : JSON.stringify(data.expected_output)) : null,
      data.order_index || 0,
      now
    );
    return this.findById(id);
  },

  delete: function(id) {
    const result = db.prepare('DELETE FROM samples WHERE id = ?').run(id);
    return result.changes > 0;
  },

  deleteByBatchId: function(batchId) {
    const result = db.prepare('DELETE FROM samples WHERE batch_id = ?').run(batchId);
    return result.changes > 0;
  }
};

const Run = {
  findAll: function(batchId) {
    return db.prepare(`
      SELECT r.*, s.order_index
      FROM runs r
      JOIN samples s ON r.sample_id = s.id
      WHERE r.batch_id = ?
      ORDER BY s.order_index
    `).all(batchId);
  },

  findById: function(id) {
    return db.prepare('SELECT * FROM runs WHERE id = ?').get(id);
  },

  create: function(data) {
    const id = uuidv4();
    const now = dayjs().toISOString();
    const result = db.prepare(`
      INSERT INTO runs (
        id, batch_id, sample_id, plugin_id, input_data, output_data,
        execution_time_ms, memory_usage_mb, status, error_message, error_code,
        schema_validation_passed, schema_errors, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.batch_id, data.sample_id, data.plugin_id,
      typeof data.input_data === 'string' ? data.input_data : JSON.stringify(data.input_data),
      data.output_data ? (typeof data.output_data === 'string' ? data.output_data : JSON.stringify(data.output_data)) : null,
      data.execution_time_ms, data.memory_usage_mb,
      data.status || 'pending',
      data.error_message, data.error_code,
      data.schema_validation_passed,
      data.schema_errors ? JSON.stringify(data.schema_errors) : null,
      now
    );
    return this.findById(id);
  },

  update: function(id, updates) {
    const fields = [];
    const values = [];
    
    if (updates.output_data !== undefined) {
      fields.push('output_data = ?');
      values.push(typeof updates.output_data === 'string' ? updates.output_data : JSON.stringify(updates.output_data));
    }
    if (updates.execution_time_ms !== undefined) {
      fields.push('execution_time_ms = ?');
      values.push(updates.execution_time_ms);
    }
    if (updates.memory_usage_mb !== undefined) {
      fields.push('memory_usage_mb = ?');
      values.push(updates.memory_usage_mb);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.error_message !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.error_message);
    }
    if (updates.error_code !== undefined) {
      fields.push('error_code = ?');
      values.push(updates.error_code);
    }
    if (updates.schema_validation_passed !== undefined) {
      fields.push('schema_validation_passed = ?');
      values.push(updates.schema_validation_passed);
    }
    if (updates.schema_errors !== undefined) {
      fields.push('schema_errors = ?');
      values.push(JSON.stringify(updates.schema_errors));
    }
    
    if (fields.length === 0) return null;
    
    values.push(id);
    db.prepare(`UPDATE runs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  getStats: function(batchId) {
    return db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
        SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeouts,
        SUM(CASE WHEN schema_validation_passed = 1 THEN 1 ELSE 0 END) as schema_passed,
        SUM(CASE WHEN schema_validation_passed = 0 THEN 1 ELSE 0 END) as schema_failed,
        AVG(execution_time_ms) as avg_execution_time_ms,
        MAX(execution_time_ms) as max_execution_time_ms
      FROM runs
      WHERE batch_id = ?
    `).get(batchId);
  }
};

const Review = {
  findByRunId: function(runId) {
    return db.prepare('SELECT * FROM reviews WHERE run_id = ?').get(runId);
  },

  findAll: function(batchId) {
    return db.prepare(`
      SELECT r.*, rv.*
      FROM reviews rv
      JOIN runs r ON rv.run_id = r.id
      WHERE r.batch_id = ?
      ORDER BY rv.created_at DESC
    `).all(batchId);
  },

  create: function(data) {
    const id = uuidv4();
    const now = dayjs().toISOString();
    const result = db.prepare(`
      INSERT INTO reviews (id, run_id, reviewer, conclusion, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id, data.run_id, data.reviewer, data.conclusion, data.notes, now
    );
    return this.findByRunId(data.run_id);
  },

  update: function(runId, updates) {
    const fields = [];
    const values = [];
    
    if (updates.reviewer !== undefined) {
      fields.push('reviewer = ?');
      values.push(updates.reviewer);
    }
    if (updates.conclusion !== undefined) {
      fields.push('conclusion = ?');
      values.push(updates.conclusion);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }
    
    if (fields.length === 0) return null;
    
    values.push(runId);
    db.prepare(`UPDATE reviews SET ${fields.join(', ')} WHERE run_id = ?`).run(...values);
    return this.findByRunId(runId);
  }
};

module.exports = {
  Plugin,
  Batch,
  Sample,
  Run,
  Review
};
