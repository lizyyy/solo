const db = require('../config/database');

class CompensationModel {
  static async create(compensationData, items) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const checkStmt = db.prepare('SELECT compensation_no FROM compensation_records WHERE compensation_no = ?');
        checkStmt.get(compensationData.compensation_no, (err, existing) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          if (existing) {
            db.run('ROLLBACK');
            reject({ type: 'DUPLICATE_RECORD', message: `赔付单号 ${compensationData.compensation_no} 已存在，不能静默覆盖` });
            return;
          }

          const compStmt = db.prepare(`INSERT INTO compensation_records 
            (compensation_no, order_no, customer_name, customer_phone, tent_model, 
             return_date, check_person, main_component_damage, main_damage_level,
             main_damage_description, main_compensation_amount, accessory_missing,
             missing_accessory_list, accessory_compensation_amount, 
             total_compensation_amount, compensation_status, remarks, version) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`);

          compStmt.run(
            compensationData.compensation_no, compensationData.order_no, 
            compensationData.customer_name, compensationData.customer_phone,
            compensationData.tent_model, compensationData.return_date,
            compensationData.check_person, compensationData.main_component_damage,
            compensationData.main_damage_level, compensationData.main_damage_description,
            compensationData.main_compensation_amount, compensationData.accessory_missing,
            compensationData.missing_accessory_list, compensationData.accessory_compensation_amount,
            compensationData.total_compensation_amount, compensationData.compensation_status || 'pending',
            compensationData.remarks || '',
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                reject(err);
                return;
              }

              if (items && items.length > 0) {
                const itemStmt = db.prepare(`INSERT INTO compensation_items 
                  (compensation_no, item_type, item_name, quantity, unit_price, subtotal, reason) 
                  VALUES (?, ?, ?, ?, ?, ?, ?)`);

                let completed = 0;
                items.forEach(item => {
                  itemStmt.run(
                    compensationData.compensation_no, item.item_type,
                    item.item_name, item.quantity, item.unit_price,
                    item.subtotal, item.reason,
                    (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        reject(err);
                        return;
                      }
                      completed++;
                      if (completed === items.length) {
                        itemStmt.finalize();
                        db.run('COMMIT');
                        resolve(compensationData.compensation_no);
                      }
                    }
                  );
                });
              } else {
                db.run('COMMIT');
                resolve(compensationData.compensation_no);
              }
            }
          );
          compStmt.finalize();
        });
        checkStmt.finalize();
      });
    });
  }

  static async findByNo(compensation_no) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM compensation_records WHERE compensation_no = ?', 
        [compensation_no], (err, record) => {
          if (err) reject(err);
          else resolve(record);
        }
      );
    });
  }

  static async getItems(compensation_no) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM compensation_items WHERE compensation_no = ?', 
        [compensation_no], (err, items) => {
          if (err) reject(err);
          else resolve(items);
        }
      );
    });
  }

  static async findAll(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM compensation_records ORDER BY created_at DESC LIMIT ? OFFSET ?', 
        [limit, offset], (err, records) => {
          if (err) reject(err);
          else {
            db.get('SELECT COUNT(*) as total FROM compensation_records', (err, countResult) => {
              if (err) reject(err);
              else resolve({ records, total: countResult.total, page, limit });
            });
          }
        }
      );
    });
  }

  static async update(compensation_no, updateData, items) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.get('SELECT version FROM compensation_records WHERE compensation_no = ?', 
          [compensation_no], (err, existing) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            if (!existing) {
              db.run('ROLLBACK');
              reject({ type: 'NOT_FOUND', message: `赔付单号 ${compensation_no} 不存在` });
              return;
            }

            const newVersion = existing.version + 1;
            
            const updateStmt = db.prepare(`UPDATE compensation_records SET 
              order_no = COALESCE(?, order_no),
              customer_name = COALESCE(?, customer_name),
              customer_phone = COALESCE(?, customer_phone),
              tent_model = COALESCE(?, tent_model),
              return_date = COALESCE(?, return_date),
              check_person = COALESCE(?, check_person),
              main_component_damage = COALESCE(?, main_component_damage),
              main_damage_level = COALESCE(?, main_damage_level),
              main_damage_description = COALESCE(?, main_damage_description),
              main_compensation_amount = COALESCE(?, main_compensation_amount),
              accessory_missing = COALESCE(?, accessory_missing),
              missing_accessory_list = COALESCE(?, missing_accessory_list),
              accessory_compensation_amount = COALESCE(?, accessory_compensation_amount),
              total_compensation_amount = COALESCE(?, total_compensation_amount),
              compensation_status = COALESCE(?, compensation_status),
              payment_method = COALESCE(?, payment_method),
              payment_time = COALESCE(?, payment_time),
              remarks = COALESCE(?, remarks),
              version = ?,
              updated_at = CURRENT_TIMESTAMP
              WHERE compensation_no = ?`);

            updateStmt.run(
              updateData.order_no, updateData.customer_name, updateData.customer_phone,
              updateData.tent_model, updateData.return_date, updateData.check_person,
              updateData.main_component_damage, updateData.main_damage_level,
              updateData.main_damage_description, updateData.main_compensation_amount,
              updateData.accessory_missing, updateData.missing_accessory_list,
              updateData.accessory_compensation_amount, updateData.total_compensation_amount,
              updateData.compensation_status, updateData.payment_method,
              updateData.payment_time, updateData.remarks,
              newVersion, compensation_no,
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                if (items) {
                  db.run('DELETE FROM compensation_items WHERE compensation_no = ?', 
                    [compensation_no], (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        reject(err);
                        return;
                      }

                      if (items.length > 0) {
                        const itemStmt = db.prepare(`INSERT INTO compensation_items 
                          (compensation_no, item_type, item_name, quantity, unit_price, subtotal, reason) 
                          VALUES (?, ?, ?, ?, ?, ?, ?)`);

                        let completed = 0;
                        items.forEach(item => {
                          itemStmt.run(
                            compensation_no, item.item_type, item.item_name,
                            item.quantity, item.unit_price, item.subtotal, item.reason,
                            (err) => {
                              if (err) {
                                db.run('ROLLBACK');
                                reject(err);
                                return;
                              }
                              completed++;
                              if (completed === items.length) {
                                itemStmt.finalize();
                                db.run('COMMIT');
                                resolve(newVersion);
                              }
                            }
                          );
                        });
                      } else {
                        db.run('COMMIT');
                        resolve(newVersion);
                      }
                    }
                  );
                } else {
                  db.run('COMMIT');
                  resolve(newVersion);
                }
              }
            );
            updateStmt.finalize();
          }
        );
      });
    });
  }

  static async exportAll() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT 
        cr.compensation_no, cr.order_no, cr.customer_name, cr.customer_phone,
        cr.tent_model, cr.return_date, cr.check_person, cr.main_component_damage,
        cr.main_damage_level, cr.main_damage_description, cr.main_compensation_amount,
        cr.accessory_missing, cr.missing_accessory_list, cr.accessory_compensation_amount,
        cr.total_compensation_amount, cr.compensation_status, cr.payment_method,
        cr.payment_time, cr.remarks, cr.version, cr.created_at
        FROM compensation_records cr ORDER BY cr.created_at DESC`, 
        (err, records) => {
          if (err) reject(err);
          else resolve(records);
        }
      );
    });
  }
}

module.exports = CompensationModel;
