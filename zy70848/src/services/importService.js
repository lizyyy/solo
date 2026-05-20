const fs = require('fs');
const csv = require('csv-parser');
const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

class ImportService {
  async createBatch(batchName, materialVersion, handler) {
    return new Promise((resolve, reject) => {
      const batchNo = `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      db.run(
        `INSERT INTO batches (batch_no, batch_name, material_version, handler, status) 
         VALUES (?, ?, ?, ?, 'pending')`,
        [batchNo, batchName, materialVersion, handler],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, batchNo });
        }
      );
    });
  }

  async parseMaterialCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async parsePolicyJSON(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) reject(err);
        else resolve(JSON.parse(data));
      });
    });
  }

  async importClaimRecords(batchId, materialData, policyData) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        const stmt = db.prepare(`
          INSERT INTO claim_records 
          (batch_id, case_no, policy_no, claimant_name, id_card, claim_amount, 
           material_list, policy_data, has_invoice, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `);

        let count = 0;
        materialData.forEach((item, index) => {
          const policy = policyData.find(p => p.policyNo === item.policyNo || p.policy_no === item.policyNo) || {};
          const hasInvoice = item.hasInvoice === '是' || item.has_invoice === 'true' || item.hasInvoice === '1' ? 1 : 0;
          
          stmt.run(
            batchId,
            item.caseNo || item.case_no || `CASE-${Date.now()}-${index}`,
            item.policyNo || item.policy_no || '',
            item.claimantName || item.claimant_name || '',
            item.idCard || item.id_card || '',
            parseFloat(item.claimAmount || item.claim_amount || 0),
            JSON.stringify(item),
            JSON.stringify(policy),
            hasInvoice
          );
          count++;
        });

        stmt.finalize((err) => {
          if (err) {
            reject(err);
            return;
          }

          db.run(
            `UPDATE batches SET total_count = ?, status = 'imported' WHERE id = ?`,
            [count, batchId],
            (err) => {
              if (err) reject(err);
              else resolve({ importedCount: count });
            }
          );
        });
      });
    });
  }

  async addProcessingLog(recordId, action, reason, handler, previousStatus, newStatus) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO processing_logs (record_id, action, reason, handler, previous_status, new_status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [recordId, action, reason, handler, previousStatus, newStatus],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  }
}

module.exports = new ImportService();
