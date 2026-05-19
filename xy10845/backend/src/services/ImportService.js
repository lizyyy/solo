const ContentModel = require('../models/ContentModel');
const AppealModel = require('../models/AppealModel');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ImportService {
  static async batchImportAppeals(records, operatorId, operatorName) {
    const results = {
      success: [],
      failed: [],
      total: records.length
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        const contentId = uuidv4();
        
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO content_items (id, content_type, content_text, author_id, author_name, block_time, content_status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              contentId,
              record.content_type || 'post',
              record.content_text || '',
              record.author_id || 'imported',
              record.author_name || '导入用户',
              record.block_time || new Date().toISOString(),
              'blocked'
            ],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        if (record.tag_code && record.tag_name) {
          await new Promise((resolve) => {
            db.run(
              `INSERT INTO audit_tags (content_id, tag_code, tag_name, confidence) VALUES (?, ?, ?, ?)`,
              [contentId, record.tag_code, record.tag_name, record.confidence || 0.8],
              () => resolve()
            );
          });
        }

        if (record.reason_code && record.reason_detail) {
          await new Promise((resolve) => {
            db.run(
              `INSERT INTO model_reasons (content_id, model_version, reason_code, reason_detail, risk_level)
               VALUES (?, ?, ?, ?, ?)`,
              [contentId, record.model_version || 'v1.0', record.reason_code, record.reason_detail, record.risk_level || 'medium'],
              () => resolve()
            );
          });
        }

        const appealId = uuidv4();
        
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO appeals (id, content_id, submitter_id, submitter_name, submitter_contact, appeal_reason, evidence_materials, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              appealId,
              contentId,
              record.submitter_id || 'imported',
              record.submitter_name || '导入申诉人',
              record.submitter_contact || '',
              record.appeal_reason || '批量导入申诉',
              record.evidence_materials || '',
              'pending'
            ],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        await new Promise((resolve) => {
          db.run(
            `INSERT INTO audit_trail (appeal_id, action, operator_id, operator_name, remark, new_status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [appealId, 'create', operatorId, operatorName, '批量导入申诉', 'pending'],
            () => resolve()
          );
        });

        results.success.push({
          row: i + 1,
          contentId,
          appealId
        });
      } catch (error) {
        results.failed.push({
          row: i + 1,
          error: error.message,
          data: record
        });
      }
    }

    return results;
  }

  static parseCSVRow(row) {
    const mapping = {
      '内容类型': 'content_type',
      '内容摘要': 'content_text',
      '作者': 'author_name',
      '作者ID': 'author_id',
      '拦截时间': 'block_time',
      '标签代码': 'tag_code',
      '标签名称': 'tag_name',
      '置信度': 'confidence',
      '原因代码': 'reason_code',
      '原因详情': 'reason_detail',
      '风险等级': 'risk_level',
      '模型版本': 'model_version',
      '申诉人': 'submitter_name',
      '申诉人ID': 'submitter_id',
      '联系方式': 'submitter_contact',
      '申诉理由': 'appeal_reason',
      '证据材料': 'evidence_materials'
    };

    const parsed = {};
    for (const [key, value] of Object.entries(row)) {
      if (mapping[key]) {
        parsed[mapping[key]] = value;
      } else {
        parsed[key] = value;
      }
    }
    return parsed;
  }
}

module.exports = ImportService;
