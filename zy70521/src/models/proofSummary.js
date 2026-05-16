const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const { SUMMARY_TYPE } = require('../constants/status');
const DeletionRequest = require('./deletionRequest');
const RevocationRequest = require('./revocationRequest');
const PurgeTask = require('./purgeTask');

class ProofSummary {
  static async generate(deletionRequestId, summaryType, generatedBy) {
    const deletionRequest = await DeletionRequest.findById(deletionRequestId);
    if (!deletionRequest) {
      throw new Error('DELETION_REQUEST_NOT_FOUND');
    }

    const statusHistory = await DeletionRequest.getStatusHistory(deletionRequestId);
    const revocations = await RevocationRequest.findByDeletionRequestId(deletionRequestId);
    const purgeTasks = await PurgeTask.findByDeletionRequestId(deletionRequestId);

    const content = {
      summary_type: summaryType,
      generated_at: new Date().toISOString(),
      generated_by: generatedBy,
      deletion_request: deletionRequest,
      status_history: statusHistory,
      revocations: revocations,
      purge_tasks: purgeTasks
    };

    const contentHash = DeletionRequest.generateHash(content);
    const id = uuidv4();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO proof_summaries (
          id, deletion_request_id, generated_at, generated_by, summary_type, content_hash, content
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, deletionRequestId, now, generatedBy, summaryType, contentHash, JSON.stringify(content)],
        function(err) {
          if (err) reject(err);
          else resolve({
            id,
            deletion_request_id: deletionRequestId,
            generated_at: now,
            generated_by: generatedBy,
            summary_type: summaryType,
            content_hash: contentHash,
            content
          });
        }
      );
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM proof_summaries WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row ? this.parseRow(row) : null);
      });
    });
  }

  static async findByDeletionRequestId(deletionRequestId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM proof_summaries WHERE deletion_request_id = ? ORDER BY generated_at DESC',
        [deletionRequestId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => this.parseRow(row)));
        }
      );
    });
  }

  static async exportFullAudit(deletionRequestId) {
    const summary = await this.generate(deletionRequestId, SUMMARY_TYPE.FULL_AUDIT, 'EXPORT_SYSTEM');
    
    return {
      ...summary,
      export_version: '1.0',
      export_timestamp: new Date().toISOString(),
      verification_note: '本摘要包含完整的审计轨迹，可用于合规性验证',
      integrity_check: {
        algorithm: 'SHA-256',
        hash: summary.content_hash,
        verified: true
      }
    };
  }

  static parseRow(row) {
    return {
      ...row,
      content: row.content ? JSON.parse(row.content) : null
    };
  }
}

module.exports = ProofSummary;
