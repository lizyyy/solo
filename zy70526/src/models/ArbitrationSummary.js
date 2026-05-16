const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const RiskSample = require('./RiskSample');

class ArbitrationSummary {
  static async generate(dataset_id) {
    return new Promise(async (resolve, reject) => {
      try {
        const samples = await RiskSample.findByDatasetId(dataset_id);
        
        const summary = {
          total_samples: samples.length,
          high_risk_count: samples.filter(s => s.risk_level === 'high').length,
          medium_risk_count: samples.filter(s => s.risk_level === 'medium').length,
          low_risk_count: samples.filter(s => s.risk_level === 'low').length,
          approved_count: samples.filter(s => s.status === 'approved').length,
          rejected_count: samples.filter(s => s.status === 'rejected').length,
          need_reprocess_count: samples.filter(s => s.status === 'need_reprocess').length
        };
        
        const summaryText = ArbitrationSummary.generateSummaryText(summary);
        
        db.get(
          'SELECT id FROM arbitration_summaries WHERE dataset_id = ?',
          [dataset_id],
          (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            
            if (row) {
              db.run(
                `UPDATE arbitration_summaries 
                 SET total_samples = ?, high_risk_count = ?, medium_risk_count = ?, low_risk_count = ?,
                     approved_count = ?, rejected_count = ?, need_reprocess_count = ?, summary = ?
                 WHERE id = ?`,
                [summary.total_samples, summary.high_risk_count, summary.medium_risk_count, summary.low_risk_count,
                 summary.approved_count, summary.rejected_count, summary.need_reprocess_count, summaryText, row.id],
                function(err) {
                  if (err) reject(err);
                  else resolve({ id: row.id, dataset_id, ...summary, summary: summaryText });
                }
              );
            } else {
              const id = uuidv4();
              db.run(
                `INSERT INTO arbitration_summaries 
                 (id, dataset_id, total_samples, high_risk_count, medium_risk_count, low_risk_count,
                  approved_count, rejected_count, need_reprocess_count, summary)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, dataset_id, summary.total_samples, summary.high_risk_count, summary.medium_risk_count, 
                 summary.low_risk_count, summary.approved_count, summary.rejected_count, 
                 summary.need_reprocess_count, summaryText],
                function(err) {
                  if (err) reject(err);
                  else resolve({ id, dataset_id, ...summary, summary: summaryText });
                }
              );
            }
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  static generateSummaryText(stats) {
    const lines = [];
    lines.push(`总样本数: ${stats.total_samples}`);
    lines.push(`高风险: ${stats.high_risk_count}, 中风险: ${stats.medium_risk_count}, 低风险: ${stats.low_risk_count}`);
    lines.push(`已批准: ${stats.approved_count}, 已拒绝: ${stats.rejected_count}, 需重处理: ${stats.need_reprocess_count}`);
    
    if (stats.high_risk_count > 0 && stats.need_reprocess_count === 0) {
      lines.push('警告: 存在高风险样本但未安排重处理');
    }
    
    return lines.join('\n');
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM arbitration_summaries WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findByDatasetId(dataset_id) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM arbitration_summaries WHERE dataset_id = ? ORDER BY created_at DESC',
        [dataset_id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static markExported(id) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE arbitration_summaries SET exported_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM arbitration_summaries ORDER BY created_at DESC',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = ArbitrationSummary;