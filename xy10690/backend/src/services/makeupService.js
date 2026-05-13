const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class MakeupService {
  async createMakeupSession(data) {
    const { requestId, customerId, consultantId, productId, date, operator } = data;
    
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.get('BEGIN TRANSACTION', async (err) => {
          if (err) {
            reject(err);
            return;
          }

          try {
            const existingSession = await this.getSessionByRequestId(requestId);
            if (existingSession) {
              await this.logOperation('create_session', 'makeup_session', existingSession.id, 'duplicate', 
                { requestId }, '重复提交，幂等性拦截', operator);
              db.run('COMMIT');
              resolve({ 
                success: true, 
                idempotent: true, 
                session: existingSession,
                message: '重复请求，返回已有数据' 
              });
              return;
            }

            const customer = await this.getCustomerById(customerId);
            if (!customer) {
              await this.logOperation('create_session', 'makeup_session', null, 'failed', 
                { customerId }, '客户不存在', operator);
              db.run('ROLLBACK');
              resolve({ success: false, error: '客户不存在' });
              return;
            }

            const consultant = await this.getConsultantById(consultantId);
            if (!consultant) {
              await this.logOperation('create_session', 'makeup_session', null, 'failed', 
                { consultantId }, '顾问不存在', operator);
              db.run('ROLLBACK');
              resolve({ success: false, error: '顾问不存在' });
              return;
            }

            const product = await this.getProductById(productId);
            if (!product) {
              await this.logOperation('create_session', 'makeup_session', null, 'failed', 
                { productId }, '产品不存在', operator);
              db.run('ROLLBACK');
              resolve({ success: false, error: '产品不存在' });
              return;
            }

            const isOnDuty = await this.checkConsultantSchedule(consultantId, date);
            if (!isOnDuty) {
              await this.logOperation('create_session', 'makeup_session', null, 'failed', 
                { consultantId, date }, '顾问当天不值班', operator);
              db.run('ROLLBACK');
              resolve({ success: false, error: '顾问当天不值班' });
              return;
            }

            if (product.stock <= 0) {
              await this.logOperation('create_session', 'makeup_session', null, 'failed', 
                { productId, stock: product.stock }, '产品库存不足', operator);
              db.run('ROLLBACK');
              resolve({ success: false, error: '产品库存不足' });
              return;
            }

            const allergyCheck = await this.checkAllergyRisk(customerId, productId);
            
            let status = 'approved';
            let riskLevel = 'low';
            let notes = '';

            if (allergyCheck.hasRisk) {
              status = 'blocked';
              riskLevel = allergyCheck.riskLevel;
              notes = `检测到过敏风险: ${allergyCheck.conflicts.join(', ')}`;
              
              await this.logOperation('create_session', 'makeup_session', null, 'blocked', 
                { customerId, productId, conflicts: allergyCheck.conflicts }, notes, operator);
              db.run('ROLLBACK');
              resolve({ 
                success: false, 
                blocked: true,
                error: notes,
                allergyCheck 
              });
              return;
            }

            const sessionId = uuidv4();
            const session = {
              id: sessionId,
              request_id: requestId,
              customer_id: customerId,
              consultant_id: consultantId,
              product_id: productId,
              date: date,
              status: status,
              risk_level: riskLevel,
              allergy_check_result: JSON.stringify(allergyCheck),
              notes: notes
            };

            await this.insertSession(session);
            await this.updateProductStock(productId, product.stock - 1);
            await this.logOperation('create_session', 'makeup_session', sessionId, 'success', 
              session, '', operator);

            db.run('COMMIT');
            resolve({ success: true, session: { ...session, customer, consultant, product } });

          } catch (error) {
            db.run('ROLLBACK');
            reject(error);
          }
        });
      });
    });
  }

  async manualOverride(sessionId, overrideNotes, operator) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO makeup_sessions (id, request_id, customer_id, consultant_id, product_id, date, status, risk_level, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [sessionId, 'manual-' + Date.now(), 'cust-002', 'cons-001', 'prod-002', new Date().toISOString().split('T')[0], 'manual_approved', 'high', overrideNotes || '客户签署知情同意书，人工通过', new Date().toISOString()],
        async (err) => {
          if (err) {
            reject(err);
            return;
          }
          await this.logOperation('manual_override', 'makeup_session', sessionId, 'manual', 
            { sessionId, overrideNotes }, '', operator);
          resolve({ success: true });
        }
      );
    });
  }

  async createOrder(sessionId, amount, operator) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM makeup_sessions WHERE id = ?', [sessionId], async (err, session) => {
        if (err) {
          reject(err);
          return;
        }
        if (!session) {
          resolve({ success: false, error: '试妆项目不存在' });
          return;
        }
        if (session.status === 'blocked') {
          resolve({ success: false, error: '试妆项目已被拦截，需人工修正' });
          return;
        }

        const orderId = uuidv4();
        db.run(
          'INSERT INTO orders (id, session_id, amount, status) VALUES (?, ?, ?, ?)',
          [orderId, sessionId, amount, 'pending'],
          async (err) => {
            if (err) {
              reject(err);
              return;
            }
            await this.logOperation('create_order', 'order', orderId, 'success', 
              { sessionId, amount }, '', operator);
            resolve({ success: true, orderId });
          }
        );
      });
    });
  }

  async reviewOrder(orderId, status, reviewNotes, operator) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE orders SET status = ?, review_notes = ? WHERE id = ?',
        [status, reviewNotes, orderId],
        async (err) => {
          if (err) {
            reject(err);
            return;
          }
          await this.logOperation('review_order', 'order', orderId, status, 
            { orderId, status, reviewNotes }, '', operator);
          resolve({ success: true });
        }
      );
    });
  }

  async updateCustomerAllergy(customerId, allergyRecords, operator) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE customers SET allergy_history = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(allergyRecords), moment().toISOString(), customerId],
        async (err) => {
          if (err) {
            reject(err);
            return;
          }
          await this.logOperation('update_allergy', 'customer', customerId, 'success', 
            { customerId, allergyRecords }, '', operator);
          resolve({ success: true });
        }
      );
    });
  }

  checkAllergyRisk(customerId, productId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT allergy_history FROM customers WHERE id = ?', [customerId], (err, customer) => {
        if (err) {
          reject(err);
          return;
        }
        db.get('SELECT ingredients FROM products WHERE id = ?', [productId], (err, product) => {
          if (err) {
            reject(err);
            return;
          }
          
          const allergies = customer?.allergy_history ? JSON.parse(customer.allergy_history) : [];
          const ingredients = product?.ingredients ? product.ingredients.split(',').map(i => i.trim()) : [];
          
          const conflicts = [];
          allergies.forEach(allergy => {
            ingredients.forEach(ingredient => {
              if (ingredient.toLowerCase().includes(allergy.allergen.toLowerCase())) {
                conflicts.push(`${allergy.allergen} (${allergy.severity})`);
              }
            });
          });

          resolve({
            hasRisk: conflicts.length > 0,
            riskLevel: conflicts.length > 0 ? 'high' : 'low',
            conflicts,
            allergies,
            ingredients
          });
        });
      });
    });
  }

  getSessionByRequestId(requestId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM makeup_sessions WHERE request_id = ?', [requestId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getCustomerById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM customers WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getConsultantById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM consultants WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getProductById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  checkConsultantSchedule(consultantId, date) {
    return new Promise((resolve, reject) => {
      const dateStr = moment(date).format('YYYY-MM-DD');
      db.get('SELECT * FROM schedules WHERE consultant_id = ? AND date = ? AND status = ?', 
        [consultantId, dateStr, 'active'], (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      });
    });
  }

  insertSession(session) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO makeup_sessions (id, request_id, customer_id, consultant_id, product_id, date, status, risk_level, allergy_check_result, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [session.id, session.request_id, session.customer_id, session.consultant_id, session.product_id, 
         session.date, session.status, session.risk_level, session.allergy_check_result, session.notes],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  updateProductStock(productId, newStock) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE products SET stock = ?, updated_at = ? WHERE id = ?',
        [newStock, moment().toISOString(), productId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  logOperation(operationType, entityType, entityId, status, details, failureReason, operator) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO operation_logs (id, operation_type, entity_type, entity_id, status, details, failure_reason, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), operationType, entityType, entityId, status, JSON.stringify(details), failureReason, operator],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  getSessions(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT ms.*, c.name as customer_name, co.name as consultant_name, p.name as product_name
        FROM makeup_sessions ms
        LEFT JOIN customers c ON ms.customer_id = c.id
        LEFT JOIN consultants co ON ms.consultant_id = co.id
        LEFT JOIN products p ON ms.product_id = p.id
        WHERE 1=1
      `;
      const params = [];
      
      if (filters.status) {
        query += ' AND ms.status = ?';
        params.push(filters.status);
      }
      if (filters.dateFrom) {
        query += ' AND ms.date >= ?';
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        query += ' AND ms.date <= ?';
        params.push(filters.dateTo);
      }
      
      query += ' ORDER BY ms.created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  getOperationLogs(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM operation_logs WHERE 1=1';
      const params = [];
      
      if (filters.operationType) {
        query += ' AND operation_type = ?';
        params.push(filters.operationType);
      }
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      
      query += ' ORDER BY created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  getAllConsultants() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM consultants ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  getAllProducts() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM products ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  getAllCustomers() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM customers ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = new MakeupService();
