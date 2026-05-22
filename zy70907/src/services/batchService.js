const { v4: uuidv4 } = require("uuid");
const db = require("../database");

class BatchService {
  static async createBatch(batchData) {
    const batchId = uuidv4();
    const batchNo = "BATCH-" + Date.now();
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO batches (id, batch_no, store_code, store_name, operator, remark) VALUES (?, ?, ?, ?, ?, ?)",
        [batchId, batchNo, batchData.store_code, batchData.store_name, batchData.operator, batchData.remark || ""],
        (err) => {
          if (err) reject(err);
          else resolve({ id: batchId, batch_no: batchNo, ...batchData });
        }
      );
    });
  }

  static async getBatchById(batchId) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM batches WHERE id = ?", [batchId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getBatchList(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM batches ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [pageSize, offset],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async updateBatchStats(batchId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT COUNT(*) as total, SUM(CASE WHEN status = \"normal\" THEN 1 ELSE 0 END) as success, SUM(CASE WHEN status = \"pending\" THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN status = \"blocked\" THEN 1 ELSE 0 END) as blocked FROM point_details WHERE batch_id = ?",
        [batchId],
        (err, stats) => {
          if (err) reject(err);
          db.run(
            "UPDATE batches SET total_count = ?, success_count = ?, pending_count = ?, blocked_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [stats.total || 0, stats.success || 0, stats.pending || 0, stats.blocked || 0, batchId],
            (updateErr) => {
              if (updateErr) reject(updateErr);
              else resolve(stats);
            }
          );
        }
      );
    });
  }

  static async updateBatchStatus(batchId, status) {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [status, batchId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}

module.exports = BatchService;
