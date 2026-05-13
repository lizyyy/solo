const db = require('../database/db');
const moment = require('moment');

const PRICE_DROP_THRESHOLD = 0.2;

class ValuationService {
  static generateOrderNo() {
    const date = moment().format('YYYYMM');
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM valuations WHERE strftime('%Y%m', created_at) = ?`,
        [moment().format('YYYYMM')],
        (err, row) => {
          if (err) reject(err);
          const seq = String(row.count + 1).padStart(3, '0');
          resolve(`VAL${date}${seq}`);
        }
      );
    });
  }

  static checkDuplicateSubmission(customerPhone, applianceBrand, applianceModel) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM valuations 
         WHERE customer_phone = ? 
         AND appliance_brand = ? 
         AND appliance_model = ?
         AND status NOT IN ('completed', 'cancelled')
         AND created_at > datetime('now', '-24 hours')`,
        [customerPhone, applianceBrand, applianceModel],
        (err, row) => {
          if (err) reject(err);
          resolve(!!row);
        }
      );
    });
  }

  static async createValuation(data) {
    const isDuplicate = await this.checkDuplicateSubmission(
      data.customer_phone,
      data.appliance_brand,
      data.appliance_model
    );

    if (isDuplicate) {
      throw new Error('DUPLICATE_SUBMISSION: 24小时内已提交过相同家电的估价申请');
    }

    const orderNo = await this.generateOrderNo();

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO valuations (
          order_no, customer_name, customer_phone, appliance_brand,
          appliance_model, appliance_type, purchase_year, online_valuation, operator
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderNo, data.customer_name, data.customer_phone, data.appliance_brand,
          data.appliance_model, data.appliance_type, data.purchase_year,
          data.online_valuation, data.operator || '系统'
        ],
        function(err) {
          if (err) reject(err);
          const id = this.lastID;

          db.run(
            `INSERT INTO flow_records (valuation_id, action, operator, previous_status, new_status, remark)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, 'create_valuation', data.operator || '系统', null, 'pending', '创建估价单'],
            (flowErr) => {
              if (flowErr) console.error('记录流转失败:', flowErr);
              resolve({ id, order_no: orderNo });
            }
          );
        }
      );
    });
  }

  static getValuationById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM valuations WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
  }

  static getValuations(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM valuations WHERE 1=1`;
      const params = [];

      if (filters.keyword) {
        query += ` AND (order_no LIKE ? OR customer_name LIKE ? OR appliance_brand LIKE ?)`;
        params.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`);
      }

      if (filters.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }

      if (filters.appliance_type) {
        query += ` AND appliance_type = ?`;
        params.push(filters.appliance_type);
      }

      if (filters.appliance_brand) {
        query += ` AND appliance_brand = ?`;
        params.push(filters.appliance_brand);
      }

      if (filters.is_anomaly !== undefined) {
        query += ` AND is_anomaly = ?`;
        params.push(filters.is_anomaly ? 1 : 0);
      }

      if (filters.operator) {
        query += ` AND operator = ?`;
        params.push(filters.operator);
      }

      if (filters.start_date) {
        query += ` AND created_at >= ?`;
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        query += ` AND created_at <= ?`;
        params.push(filters.end_date);
      }

      query += ` ORDER BY created_at DESC`;

      if (filters.limit) {
        query += ` LIMIT ?`;
        params.push(filters.limit);
      }

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
  }

  static async updateOnsiteValuation(id, data) {
    const valuation = await this.getValuationById(id);
    if (!valuation) throw new Error('估价单不存在');

    const priceDrop = (valuation.online_valuation - data.onsite_valuation) / valuation.online_valuation;
    const isAnomaly = priceDrop > PRICE_DROP_THRESHOLD;

    if (isAnomaly && !data.price_change_reason) {
      throw new Error('PRICE_CHANGE_REASON_REQUIRED: 降价超过20%，必须填写改价原因');
    }

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `UPDATE valuations 
           SET onsite_valuation = ?, final_price = ?, status = ?, 
               price_change_reason = ?, is_anomaly = ?, anomaly_type = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            data.onsite_valuation, data.onsite_valuation,
            isAnomaly ? 'price_changed' : 'pending_review',
            data.price_change_reason,
            isAnomaly ? 1 : 0,
            isAnomaly ? 'price_drop_exceed' : null,
            id
          ],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            db.run(
              `INSERT INTO change_history (valuation_id, field_name, old_value, new_value, operator, reason)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                id, 'onsite_valuation', valuation.online_valuation.toString(),
                data.onsite_valuation.toString(), data.operator, '上门检测估价'
              ],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                db.run(
                  `INSERT INTO flow_records (valuation_id, action, operator, previous_status, new_status, remark)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [
                    id, 'onsite_valuation', data.operator, valuation.status,
                    isAnomaly ? 'price_changed' : 'pending_review',
                    `上门检测估价：${valuation.online_valuation} -> ${data.onsite_valuation}`
                  ],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return reject(err);
                    }

                    db.run('COMMIT', (err) => {
                      if (err) reject(err);
                      else resolve({ success: true, is_anomaly: isAnomaly });
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  static async cancelValuation(id, data) {
    const valuation = await this.getValuationById(id);
    if (!valuation) throw new Error('估价单不存在');

    const needReview = valuation.onsite_valuation !== null;

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const newStatus = needReview ? 'cancelled_pending_review' : 'cancelled';
        const isAnomaly = needReview ? 1 : 0;

        db.run(
          `UPDATE valuations 
           SET status = ?, cancel_reason = ?, reviewer = ?, is_anomaly = ?, anomaly_type = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            newStatus, data.cancel_reason, data.reviewer,
            isAnomaly, needReview ? 'cancelled_after_onsite' : null, id
          ],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            db.run(
              `INSERT INTO flow_records (valuation_id, action, operator, previous_status, new_status, remark)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                id, 'cancel_valuation', data.operator, valuation.status, newStatus,
                `取消原因：${data.cancel_reason}`
              ],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                db.run('COMMIT', (err) => {
                  if (err) reject(err);
                  else resolve({ success: true, need_review: needReview });
                });
              }
            );
          }
        );
      });
    });
  }

  static async reviewCancellation(id, data) {
    const valuation = await this.getValuationById(id);
    if (!valuation) throw new Error('估价单不存在');

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE valuations SET status = 'cancelled', reviewer = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [data.reviewer, id],
        (err) => {
          if (err) reject(err);

          db.run(
            `INSERT INTO flow_records (valuation_id, action, operator, previous_status, new_status, remark)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              id, 'review_cancellation', data.reviewer, valuation.status, 'cancelled',
              `复核通过，取消确认：${data.remark || ''}`
            ],
            (err) => {
              if (err) reject(err);
              resolve({ success: true });
            }
          );
        }
      );
    });
  }

  static getFlowRecords(valuationId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM flow_records WHERE valuation_id = ? ORDER BY created_at DESC`,
        [valuationId],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });
  }

  static getChangeHistory(valuationId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM change_history WHERE valuation_id = ? ORDER BY created_at DESC`,
        [valuationId],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });
  }

  static getStatistics() {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'pending_onsite' THEN 1 ELSE 0 END) as pending_onsite,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
          SUM(CASE WHEN is_anomaly = 1 THEN 1 ELSE 0 END) as anomalies
        FROM valuations`,
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });
  }

  static getAnomalyList() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM valuations WHERE is_anomaly = 1 ORDER BY created_at DESC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });
  }

  static exportReport(filters = {}) {
    return this.getValuations(filters);
  }

  static getOperators() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT operator as name FROM valuations WHERE operator IS NOT NULL UNION SELECT DISTINCT reviewer as name FROM valuations WHERE reviewer IS NOT NULL`,
        [],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows.map(r => r.name).filter(n => n));
        }
      );
    });
  }

  static getBrands() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT appliance_brand as brand FROM valuations WHERE appliance_brand IS NOT NULL`,
        [],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows.map(r => r.brand));
        }
      );
    });
  }
}

module.exports = ValuationService;
