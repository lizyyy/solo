const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ConfigHandover {
  static async createCustomer(customerId, customerName) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO customers (customer_id, customer_name) VALUES (?, ?)',
        [customerId, customerName],
        function(err) {
          if (err) reject(err);
          else resolve({ customerId, customerName, isNew: this.changes > 0 });
        }
      );
    });
  }

  static async createConfigItem(data) {
    const id = uuidv4();
    const { customerId, configKey, configValue, configType, description, operatorId, operatorName } = data;
    
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id, config_value FROM config_items WHERE customer_id = ? AND config_key = ?',
        [customerId, configKey],
        (err, existing) => {
          if (err) {
            reject(err);
            return;
          }

          if (existing) {
            resolve({
              id: existing.id,
              isNew: false,
              message: '配置项已存在，使用状态推进接口进行变更'
            });
            return;
          }

          db.run(
            `INSERT INTO config_items 
             (id, customer_id, config_key, config_value, config_type, description, status) 
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [id, customerId, configKey, configValue, configType || 'string', description],
            function(err) {
              if (err) {
                reject(err);
                return;
              }

              db.run(
                `INSERT INTO change_records 
                 (id, config_item_id, operation_type, new_value, operator_id, operator_name, change_reason) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [uuidv4(), id, 'create', configValue, operatorId, operatorName, '初始创建配置项'],
                (err) => {
                  if (err) reject(err);
                  else resolve({ id, isNew: true });
                }
              );
            }
          );
        }
      );
    });
  }

  static async addSourceMaterial(configItemId, material) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO source_materials 
         (id, config_item_id, material_type, material_content, material_url, uploaded_by) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, configItemId, material.type, material.content, material.url || null, material.uploadedBy],
        function(err) {
          if (err) reject(err);
          else resolve({ id });
        }
      );
    });
  }

  static async getConfigItem(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM config_items WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getConfigItemsByCustomer(customerId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM config_items WHERE customer_id = ? ORDER BY created_at DESC', [customerId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getSourceMaterials(configItemId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM source_materials WHERE config_item_id = ? ORDER BY uploaded_at DESC', [configItemId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async advanceStatus(configItemId, newStatus, operatorId, operatorName, comment) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, status FROM config_items WHERE id = ?', [configItemId], (err, current) => {
        if (err) {
          reject(err);
          return;
        }

        if (!current) {
          reject(new Error('配置项不存在'));
          return;
        }

        if (current.status === newStatus) {
          resolve({
            success: false,
            message: '状态未变更，当前状态与目标状态相同',
            currentStatus: current.status
          });
          return;
        }

        const statusFlow = ['pending', 'confirmed', 'delivered', 'completed'];
        const currentIndex = statusFlow.indexOf(current.status);
        const targetIndex = statusFlow.indexOf(newStatus);

        if (targetIndex <= currentIndex) {
          resolve({
            success: false,
            message: '状态只能向前推进，不能回退或跳过',
            currentStatus: current.status
          });
          return;
        }

        db.run(
          'UPDATE config_items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newStatus, configItemId],
          function(err) {
            if (err) {
              reject(err);
              return;
            }

            db.run(
              `INSERT INTO change_records 
               (id, config_item_id, operation_type, old_value, new_value, operator_id, operator_name, change_reason) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [uuidv4(), configItemId, 'status_change', current.status, newStatus, operatorId, operatorName, comment || '状态推进'],
              (err) => {
                if (err) reject(err);
                else resolve({
                  success: true,
                  oldStatus: current.status,
                  newStatus: newStatus
                });
              }
            );
          }
        );
      });
    });
  }

  static async confirmConfig(configItemId, confirmerId, confirmerName, comment) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, status FROM config_items WHERE id = ?', [configItemId], (err, config) => {
        if (err) {
          reject(err);
          return;
        }

        if (!config) {
          reject(new Error('配置项不存在'));
          return;
        }

        db.get(
          'SELECT id FROM confirmations WHERE config_item_id = ? AND confirmer_id = ? AND confirmation_status = ?',
          [configItemId, confirmerId, 'confirmed'],
          (err, existing) => {
            if (err) {
              reject(err);
              return;
            }

            if (existing) {
              resolve({
                success: false,
                message: '该确认人已确认过此配置项，不能重复确认'
              });
              return;
            }

            db.run(
              `INSERT INTO confirmations 
               (id, config_item_id, confirmer_id, confirmer_name, confirmation_status, confirmed_at, comment) 
               VALUES (?, ?, ?, ?, 'confirmed', CURRENT_TIMESTAMP, ?)`,
              [uuidv4(), configItemId, confirmerId, confirmerName, comment],
              function(err) {
                if (err) reject(err);
                else resolve({ success: true });
              }
            );
          }
        );
      });
    });
  }

  static async getConfirmations(configItemId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM confirmations WHERE config_item_id = ? ORDER BY created_at DESC', [configItemId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getChangeRecords(configItemId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM change_records WHERE config_item_id = ? ORDER BY created_at DESC', [configItemId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async manualCorrection(configItemId, newValue, operatorId, operatorName, reason) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, config_value FROM config_items WHERE id = ?', [configItemId], (err, current) => {
        if (err) {
          reject(err);
          return;
        }

        if (!current) {
          reject(new Error('配置项不存在'));
          return;
        }

        if (current.config_value === newValue) {
          resolve({
            success: false,
            message: '配置值未变更',
            currentValue: current.config_value
          });
          return;
        }

        db.run(
          'UPDATE config_items SET config_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newValue, configItemId],
          function(err) {
            if (err) {
              reject(err);
              return;
            }

            db.run(
              `INSERT INTO change_records 
               (id, config_item_id, operation_type, old_value, new_value, operator_id, operator_name, change_reason) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [uuidv4(), configItemId, 'manual_correction', current.config_value, newValue, operatorId, operatorName, reason],
              (err) => {
                if (err) reject(err);
                else resolve({
                  success: true,
                  oldValue: current.config_value,
                  newValue: newValue
                });
              }
            );
          }
        );
      });
    });
  }

  static async recordException(data) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO exceptions 
         (id, config_item_id, exception_type, original_input, processing_basis, error_message) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, data.configItemId || null, data.type, data.originalInput, data.processingBasis || null, data.errorMessage || null],
        function(err) {
          if (err) reject(err);
          else resolve({ id });
        }
      );
    });
  }

  static async getExceptions(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM exceptions WHERE 1=1';
      const params = [];

      if (filters.configItemId) {
        sql += ' AND config_item_id = ?';
        params.push(filters.configItemId);
      }
      if (filters.handled !== undefined) {
        sql += ' AND handled = ?';
        params.push(filters.handled ? 1 : 0);
      }

      sql += ' ORDER BY created_at DESC';
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async handleException(exceptionId, handledBy) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, handled FROM exceptions WHERE id = ?', [exceptionId], (err, exception) => {
        if (err) {
          reject(err);
          return;
        }

        if (!exception) {
          reject(new Error('异常记录不存在'));
          return;
        }

        if (exception.handled) {
          resolve({
            success: false,
            message: '该异常已被处理，不能重复处理'
          });
          return;
        }

        db.run(
          'UPDATE exceptions SET handled = 1, handled_by = ?, handled_at = CURRENT_TIMESTAMP WHERE id = ?',
          [handledBy, exceptionId],
          function(err) {
            if (err) reject(err);
            else resolve({ success: true });
          }
        );
      });
    });
  }

  static async generateHandoverSummary(customerId, generatedBy) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM config_items WHERE customer_id = ?', [customerId], async (err, configs) => {
        if (err) {
          reject(err);
          return;
        }

        const summaryData = [];
        for (const config of configs) {
          const sources = await this.getSourceMaterials(config.id);
          const confirmations = await this.getConfirmations(config.id);
          const changes = await this.getChangeRecords(config.id);

          summaryData.push({
            configKey: config.config_key,
            configValue: config.config_value,
            status: config.status,
            description: config.description,
            sources: sources.map(s => ({ type: s.material_type, uploadedBy: s.uploaded_by })),
            confirmations: confirmations.map(c => ({ name: c.confirmer_name, status: c.confirmation_status })),
            changeCount: changes.length,
            createdAt: config.created_at
          });
        }

        const summaryContent = JSON.stringify(summaryData, null, 2);
        const id = uuidv4();

        db.get('SELECT MAX(version) as max_version FROM handover_summaries WHERE customer_id = ?', [customerId], (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          const version = (row?.max_version || 0) + 1;

          db.run(
            'INSERT INTO handover_summaries (id, customer_id, summary_content, generated_by, version) VALUES (?, ?, ?, ?, ?)',
            [id, customerId, summaryContent, generatedBy, version],
            function(err) {
              if (err) reject(err);
              else resolve({ id, version, summary: summaryData });
            }
          );
        });
      });
    });
  }

  static async getHandoverSummaries(customerId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM handover_summaries WHERE customer_id = ? ORDER BY version DESC', [customerId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async compareChanges(configItemId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM change_records WHERE config_item_id = ? ORDER BY created_at ASC',
        [configItemId],
        (err, changes) => {
          if (err) reject(err);
          else {
            const comparisons = changes.map((change, index) => ({
              sequence: index + 1,
              operation: change.operation_type,
              oldValue: change.old_value,
              newValue: change.new_value,
              operator: change.operator_name,
              reason: change.change_reason,
              timestamp: change.created_at
            }));
            resolve(comparisons);
          }
        }
      );
    });
  }

  static async getCustomer(customerId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM customers WHERE customer_id = ?', [customerId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

module.exports = ConfigHandover;
