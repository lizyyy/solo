const { getDatabase, runQuery } = require('./init');
const crypto = require('crypto');

function generateId() {
  return crypto.randomUUID();
}

function now() {
  return Date.now();
}

function getQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

class BatchRepository {
  static async create(batchName, operator, riskType = null, notes = null) {
    const db = getDatabase();
    const id = generateId();
    await runQuery(db, `
      INSERT INTO batches (id, batch_name, operator, created_at, status, risk_type, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, batchName, operator, now(), 'pending', riskType, notes]);
    db.close();
    return id;
  }

  static async getById(id) {
    const db = getDatabase();
    const result = await getQuery(db, 'SELECT * FROM batches WHERE id = ?', [id]);
    db.close();
    return result;
  }

  static async getAll(filters = {}) {
    const db = getDatabase();
    let query = 'SELECT * FROM batches WHERE 1=1';
    const params = [];

    if (filters.operator) {
      query += ' AND operator = ?';
      params.push(filters.operator);
    }
    if (filters.riskType) {
      query += ' AND risk_type = ?';
      params.push(filters.riskType);
    }
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC';

    const results = await allQuery(db, query, params);
    db.close();
    return results;
  }

  static async updateStatus(id, status) {
    const db = getDatabase();
    await runQuery(db, 'UPDATE batches SET status = ? WHERE id = ?', [status, id]);
    db.close();
  }
}

class MaterialRepository {
  static async create(batchId, fileName, fileHash, fileSummary, materialType, downloadUrl = null) {
    const db = getDatabase();
    const id = generateId();
    await runQuery(db, `
      INSERT INTO materials (id, batch_id, file_name, file_hash, file_summary, material_type, download_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, batchId, fileName, fileHash, fileSummary, materialType, downloadUrl, now()]);
    db.close();
    return id;
  }

  static async getByHash(fileHash) {
    const db = getDatabase();
    const result = await getQuery(db, 'SELECT * FROM materials WHERE file_hash = ?', [fileHash]);
    db.close();
    return result;
  }

  static async getByBatchId(batchId) {
    const db = getDatabase();
    const results = await allQuery(db, 'SELECT * FROM materials WHERE batch_id = ?', [batchId]);
    db.close();
    return results;
  }

  static async getBySummary(summaryKeyword) {
    const db = getDatabase();
    const results = await allQuery(db, 'SELECT * FROM materials WHERE file_summary LIKE ?', [`%${summaryKeyword}%`]);
    db.close();
    return results;
  }
}

class ValidationResultRepository {
  static async create(materialId, batchId, status, riskLevel, failureReason = null, desensitizationDetails = null, validatedBy = null, requiresManualConfirm = false) {
    const db = getDatabase();
    const id = generateId();
    await runQuery(db, `
      INSERT INTO validation_results (
        id, material_id, batch_id, status, risk_level, failure_reason, 
        desensitization_details, validated_at, validated_by, requires_manual_confirm, manually_confirmed
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [id, materialId, batchId, status, riskLevel, failureReason, 
         JSON.stringify(desensitizationDetails), now(), validatedBy, requiresManualConfirm ? 1 : 0]);
    db.close();
    return id;
  }

  static async getByBatchId(batchId) {
    const db = getDatabase();
    const results = await allQuery(db, `
      SELECT vr.*, m.file_name, m.file_summary
      FROM validation_results vr
      JOIN materials m ON vr.material_id = m.id
      WHERE vr.batch_id = ?
    `, [batchId]);
    db.close();
    return results;
  }

  static async getByMaterialId(materialId) {
    const db = getDatabase();
    const results = await allQuery(db, 'SELECT * FROM validation_results WHERE material_id = ?', [materialId]);
    db.close();
    return results;
  }

  static async confirmManual(id, confirmedBy) {
    const db = getDatabase();
    await runQuery(db, `
      UPDATE validation_results 
      SET manually_confirmed = 1, confirmed_by = ?, confirmed_at = ?
      WHERE id = ?
    `, [confirmedBy, now(), id]);
    db.close();
  }

  static async getPendingManualConfirm() {
    const db = getDatabase();
    const results = await allQuery(db, `
      SELECT vr.*, m.file_name, m.file_summary
      FROM validation_results vr
      JOIN materials m ON vr.material_id = m.id
      WHERE vr.requires_manual_confirm = 1 AND vr.manually_confirmed = 0
    `);
    db.close();
    return results;
  }
}

class CandidateListRepository {
  static async create(batchId, actionType, candidates, createdBy) {
    const db = getDatabase();
    const id = generateId();
    await runQuery(db, `
      INSERT INTO candidate_lists (id, batch_id, action_type, candidates, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, batchId, actionType, JSON.stringify(candidates), now(), createdBy]);
    db.close();
    return id;
  }

  static async getById(id) {
    const db = getDatabase();
    const result = await getQuery(db, 'SELECT * FROM candidate_lists WHERE id = ?', [id]);
    if (result) {
      result.candidates = JSON.parse(result.candidates);
    }
    db.close();
    return result;
  }

  static async getByBatchId(batchId) {
    const db = getDatabase();
    const results = await allQuery(db, 'SELECT * FROM candidate_lists WHERE batch_id = ?', [batchId]);
    results.forEach(r => r.candidates = JSON.parse(r.candidates));
    db.close();
    return results;
  }

  static async markExecuted(id) {
    const db = getDatabase();
    await runQuery(db, 'UPDATE candidate_lists SET executed = 1, executed_at = ? WHERE id = ?', [now(), id]);
    db.close();
  }
}

module.exports = {
  BatchRepository,
  MaterialRepository,
  ValidationResultRepository,
  CandidateListRepository,
  generateId,
  now
};
