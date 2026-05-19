const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ContentModel {
  static createContent(data) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { contentType, contentText, contentUrl, authorId, authorName, blockTime, contentStatus } = data;
      
      db.run(
        `INSERT INTO content_items (id, content_type, content_text, content_url, author_id, author_name, block_time, content_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, contentType, contentText, contentUrl, authorId, authorName, blockTime, contentStatus || 'blocked'],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }

  static getContentById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM content_items WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static updateContentStatus(id, status) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE content_items SET content_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  static addAuditTag(contentId, tagCode, tagName, confidence) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO audit_tags (content_id, tag_code, tag_name, confidence) VALUES (?, ?, ?, ?)`,
        [contentId, tagCode, tagName, confidence],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  static getAuditTags(contentId) {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM audit_tags WHERE content_id = ?`, [contentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static addModelReason(contentId, modelVersion, reasonCode, reasonDetail, riskLevel, evidenceSnippets) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO model_reasons (content_id, model_version, reason_code, reason_detail, risk_level, evidence_snippets)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [contentId, modelVersion, reasonCode, reasonDetail, riskLevel, evidenceSnippets],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  static getModelReasons(contentId) {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM model_reasons WHERE content_id = ?`, [contentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getAllForExport(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          c.id as content_id,
          c.content_type,
          c.content_text,
          c.author_name,
          c.block_time,
          c.content_status,
          a.id as appeal_id,
          a.status as appeal_status,
          a.submitter_name,
          a.appeal_reason,
          a.disposal_type,
          a.disposal_note,
          a.assignee_name,
          a.created_at as appeal_created_at
        FROM content_items c
        LEFT JOIN appeals a ON c.id = a.content_id
        WHERE 1=1
      `;
      const params = [];

      if (filters.appealStatus) {
        query += ` AND a.status = ?`;
        params.push(filters.appealStatus);
      }

      query += ` ORDER BY c.block_time DESC`;

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = ContentModel;
