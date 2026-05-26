const { getDb } = require('../db');

const db = getDb();

const BatchModel = {
  create(name, createdBy, nodeCsvPath, photoJsonPath, rectFormPath, remark) {
    const stmt = db.prepare(`
      INSERT INTO batches (name, created_by, node_csv_path, photo_json_path, rectification_form_path, remark)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, createdBy, nodeCsvPath || null, photoJsonPath || null, rectFormPath || null, remark || null);
    return result.lastInsertRowid;
  },

  findById(id) {
    return db.prepare('SELECT * FROM batches WHERE id = ?').get(id);
  },

  findAll() {
    return db.prepare('SELECT * FROM batches ORDER BY created_at DESC').all();
  },

  updateStatus(id, status) {
    return db.prepare('UPDATE batches SET status = ? WHERE id = ?').run(status, id);
  }
};

const RecordModel = {
  create(batchId, siteNode, supervisorSignature, rawData, photoList, rectForm) {
    const stmt = db.prepare(`
      INSERT INTO records (batch_id, site_node, supervisor_signature, raw_data, photo_list, rectification_form)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      batchId,
      siteNode,
      supervisorSignature || null,
      rawData ? JSON.stringify(rawData) : null,
      photoList ? JSON.stringify(photoList) : null,
      rectForm ? JSON.stringify(rectForm) : null
    );
    return result.lastInsertRowid;
  },

  findById(id) {
    return db.prepare('SELECT * FROM records WHERE id = ?').get(id);
  },

  findByBatch(batchId) {
    return db.prepare('SELECT * FROM records WHERE batch_id = ? ORDER BY id').all(batchId);
  },

  updateStatus(id, status, remark) {
    return db.prepare(`
      UPDATE records SET status = ?, current_remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(status, remark || null, id);
  },

  incrementRectificationCount(id) {
    return db.prepare(`
      UPDATE records SET rectification_count = rectification_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id);
  },

  setRectificationCount(id, count) {
    return db.prepare(`
      UPDATE records SET rectification_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(count, id);
  },

  query(filters) {
    let sql = 'SELECT * FROM records WHERE 1=1';
    const params = [];

    if (filters.site_node) {
      sql += ' AND site_node = ?';
      params.push(filters.site_node);
    }
    if (filters.supervisor_signature) {
      sql += ' AND supervisor_signature = ?';
      params.push(filters.supervisor_signature);
    }
    if (filters.rectification_count_min !== undefined) {
      sql += ' AND rectification_count >= ?';
      params.push(filters.rectification_count_min);
    }
    if (filters.rectification_count_max !== undefined) {
      sql += ' AND rectification_count <= ?';
      params.push(filters.rectification_count_max);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.batch_id) {
      sql += ' AND batch_id = ?';
      params.push(filters.batch_id);
    }

    sql += ' ORDER BY id';
    return db.prepare(sql).all(...params);
  }
};

const AuditLogModel = {
  create(recordId, action, reason, handler, details) {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (record_id, action, reason, handler, details)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(recordId, action, reason || null, handler, details ? JSON.stringify(details) : null);
    return result.lastInsertRowid;
  },

  findByRecord(recordId) {
    return db.prepare('SELECT * FROM audit_logs WHERE record_id = ? ORDER BY timestamp ASC').all(recordId);
  },

  findByRecords(recordIds) {
    if (!recordIds || recordIds.length === 0) return [];
    const placeholders = recordIds.map(() => '?').join(',');
    return db.prepare(`SELECT * FROM audit_logs WHERE record_id IN (${placeholders}) ORDER BY record_id, timestamp ASC`).all(...recordIds);
  }
};

const ExceptionModel = {
  create(recordId, type, reason, handler) {
    const stmt = db.prepare(`
      INSERT INTO exceptions (record_id, type, reason, handler)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(recordId, type, reason || null, handler).lastInsertRowid;
  },

  findByRecord(recordId) {
    return db.prepare('SELECT * FROM exceptions WHERE record_id = ? ORDER BY timestamp ASC').all(recordId);
  },

  resolve(id, resolvedBy) {
    return db.prepare(`
      UPDATE exceptions SET resolved = 1, resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ?
    `).run(resolvedBy, id);
  }
};

const RectificationModel = {
  create(recordId, rectificationNo, rectificationCount, rectFormData, sourceRectificationId, sourceRecordId, handler) {
    const stmt = db.prepare(`
      INSERT INTO rectifications (record_id, rectification_no, rectification_count, rectification_form_data, source_rectification_id, source_record_id, handler)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      recordId,
      rectificationNo || null,
      rectificationCount,
      rectFormData ? JSON.stringify(rectFormData) : null,
      sourceRectificationId || null,
      sourceRecordId || null,
      handler || null
    ).lastInsertRowid;
  },

  findByRecord(recordId) {
    return db.prepare('SELECT * FROM rectifications WHERE record_id = ? ORDER BY rectification_count ASC').all(recordId);
  },

  findBySource(sourceRecordId) {
    return db.prepare('SELECT * FROM rectifications WHERE source_record_id = ? ORDER BY rectification_count ASC').all(sourceRecordId);
  },

  findBySourceRectification(sourceRectificationId) {
    return db.prepare('SELECT * FROM rectifications WHERE source_rectification_id = ? ORDER BY rectification_count ASC').all(sourceRectificationId);
  },

  getTraceChain(recordId) {
    const rects = db.prepare('SELECT * FROM rectifications WHERE record_id = ? ORDER BY rectification_count ASC').all(recordId);
    return rects;
  },

  getFullTraceChain(recordId) {
    const rects = db.prepare('SELECT * FROM rectifications WHERE record_id = ? ORDER BY rectification_count ASC').all(recordId);
    const visitedRecords = new Set([recordId]);
    const result = rects.slice();

    for (const rect of rects) {
      if (rect.source_record_id && !visitedRecords.has(rect.source_record_id)) {
        visitedRecords.add(rect.source_record_id);
        const crossRects = db.prepare('SELECT * FROM rectifications WHERE record_id = ? ORDER BY rectification_count ASC').all(rect.source_record_id);
        result.push(...crossRects);
      }
    }

    return result;
  }
};

module.exports = { BatchModel, RecordModel, AuditLogModel, ExceptionModel, RectificationModel };