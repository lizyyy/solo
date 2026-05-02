const db = require('../database/db');
const { validatePhone, validateEstimatedTime, checkTechnicianConflict } = require('../utils/validators');

const VALID_STATUSES = ['待检测', '待报价', '维修中', '待取机', '已完成', '已取消'];

const getOrders = (req, res) => {
  const { date, technician_id, status } = req.query;
  
  let query = `
    SELECT 
      o.*,
      c.name as customer_name,
      c.phone as customer_phone,
      d.brand as device_brand,
      d.model as device_model,
      d.imei as device_imei,
      t.name as technician_name
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN devices d ON o.device_id = d.id
    LEFT JOIN technicians t ON o.technician_id = t.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (date) {
    query += ' AND DATE(o.created_at) = ?';
    params.push(date);
  }
  
  if (technician_id) {
    query += ' AND o.technician_id = ?';
    params.push(technician_id);
  }
  
  if (status) {
    query += ' AND o.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY o.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('获取工单失败:', err);
      res.status(500).json({ error: '获取工单失败' });
      return;
    }
    res.json(rows);
  });
};

const getOrderById = (req, res) => {
  const { id } = req.params;
  
  db.get(`
    SELECT 
      o.*,
      c.name as customer_name,
      c.phone as customer_phone,
      d.brand as device_brand,
      d.model as device_model,
      d.imei as device_imei,
      t.name as technician_name
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN devices d ON o.device_id = d.id
    LEFT JOIN technicians t ON o.technician_id = t.id
    WHERE o.id = ?
  `, [id], (err, order) => {
    if (err) {
      console.error('获取工单详情失败:', err);
      res.status(500).json({ error: '获取工单详情失败' });
      return;
    }
    
    if (!order) {
      res.status(404).json({ error: '工单不存在' });
      return;
    }
    
    db.all(`
      SELECT sh.*, t.name as changed_by_name
      FROM status_history sh
      LEFT JOIN technicians t ON sh.changed_by = t.id
      WHERE sh.order_id = ?
      ORDER BY sh.changed_at DESC
    `, [id], (err, history) => {
      if (err) {
        console.error('获取状态历史失败:', err);
        res.status(500).json({ error: '获取状态历史失败' });
        return;
      }
      
      db.all(`
        SELECT n.*, t.name as created_by_name
        FROM notes n
        LEFT JOIN technicians t ON n.created_by = t.id
        WHERE n.order_id = ?
        ORDER BY n.created_at DESC
      `, [id], (err, notes) => {
        if (err) {
          console.error('获取备注失败:', err);
          res.status(500).json({ error: '获取备注失败' });
          return;
        }
        
        res.json({ ...order, status_history: history, notes });
      });
    });
  });
};

const createOrder = async (req, res) => {
  const {
    customer_name,
    customer_phone,
    device_brand,
    device_model,
    device_imei,
    technician_id,
    fault_description,
    quote,
    estimated_completion_time,
    status = '待检测'
  } = req.body;

  const phoneValidation = validatePhone(customer_phone);
  if (!phoneValidation.valid) {
    res.status(400).json({ error: phoneValidation.message });
    return;
  }

  const now = new Date().toISOString();
  const timeValidation = validateEstimatedTime(now, estimated_completion_time);
  if (!timeValidation.valid) {
    res.status(400).json({ error: timeValidation.message });
    return;
  }

  if (technician_id && estimated_completion_time) {
    try {
      const conflict = await checkTechnicianConflict(technician_id, estimated_completion_time);
      if (conflict.conflict) {
        res.status(400).json({ error: conflict.message });
        return;
      }
    } catch (err) {
      console.error('检查维修师傅冲突失败:', err);
      res.status(500).json({ error: '检查预约冲突失败' });
      return;
    }
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.run(`
      INSERT OR IGNORE INTO customers (name, phone) VALUES (?, ?)
    `, [customer_name, customer_phone], function(err) {
      if (err) {
        db.run('ROLLBACK');
        console.error('创建客户失败:', err);
        res.status(500).json({ error: '创建客户失败' });
        return;
      }

      db.get(`SELECT id FROM customers WHERE phone = ?`, [customer_phone], (err, customer) => {
        if (err) {
          db.run('ROLLBACK');
          console.error('获取客户ID失败:', err);
          res.status(500).json({ error: '获取客户ID失败' });
          return;
        }

        db.run(`
          INSERT INTO devices (customer_id, brand, model, imei)
          VALUES (?, ?, ?, ?)
        `, [customer.id, device_brand, device_model, device_imei], function(err) {
          if (err) {
            db.run('ROLLBACK');
            console.error('创建设备失败:', err);
            res.status(500).json({ error: '创建设备失败' });
            return;
          }

          const deviceId = this.lastID;

          db.run(`
            INSERT INTO orders (
              customer_id, device_id, technician_id, fault_description,
              quote, estimated_completion_time, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            customer.id, deviceId, technician_id || null, fault_description,
            quote || null, estimated_completion_time || null, status
          ], function(err) {
            if (err) {
              db.run('ROLLBACK');
              console.error('创建工单失败:', err);
              res.status(500).json({ error: '创建工单失败' });
              return;
            }

            const orderId = this.lastID;

            db.run(`
              INSERT INTO status_history (order_id, old_status, new_status)
              VALUES (?, NULL, ?)
            `, [orderId, status], (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('创建状态历史失败:', err);
                res.status(500).json({ error: '创建状态历史失败' });
                return;
              }

              db.run('COMMIT');
              res.status(201).json({ id: orderId, message: '工单创建成功' });
            });
          });
        });
      });
    });
  });
};

const updateOrder = async (req, res) => {
  const { id } = req.params;
  const {
    customer_name,
    customer_phone,
    device_brand,
    device_model,
    device_imei,
    technician_id,
    fault_description,
    quote,
    estimated_completion_time,
    status,
    note
  } = req.body;

  db.get(`SELECT * FROM orders WHERE id = ?`, [id], async (err, existingOrder) => {
    if (err) {
      console.error('获取现有工单失败:', err);
      res.status(500).json({ error: '获取现有工单失败' });
      return;
    }

    if (!existingOrder) {
      res.status(404).json({ error: '工单不存在' });
      return;
    }

    if (customer_phone) {
      const phoneValidation = validatePhone(customer_phone);
      if (!phoneValidation.valid) {
        res.status(400).json({ error: phoneValidation.message });
        return;
      }
    }

    if (estimated_completion_time) {
      const timeValidation = validateEstimatedTime(
        existingOrder.created_at,
        estimated_completion_time
      );
      if (!timeValidation.valid) {
        res.status(400).json({ error: timeValidation.message });
        return;
      }
    }

    const checkTechId = technician_id !== undefined ? technician_id : existingOrder.technician_id;
    const checkEstTime = estimated_completion_time || existingOrder.estimated_completion_time;

    if (checkTechId && checkEstTime) {
      try {
        const conflict = await checkTechnicianConflict(checkTechId, checkEstTime, parseInt(id));
        if (conflict.conflict) {
          res.status(400).json({ error: conflict.message });
          return;
        }
      } catch (err) {
        console.error('检查维修师傅冲突失败:', err);
        res.status(500).json({ error: '检查预约冲突失败' });
        return;
      }
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      if (customer_name || customer_phone) {
        const updateFields = [];
        const updateValues = [];

        if (customer_name) {
          updateFields.push('name = ?');
          updateValues.push(customer_name);
        }
        if (customer_phone) {
          updateFields.push('phone = ?');
          updateValues.push(customer_phone);
        }
        updateValues.push(existingOrder.customer_id);

        db.run(`
          UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?
        `, updateValues, (err) => {
          if (err) {
            db.run('ROLLBACK');
            console.error('更新客户失败:', err);
            res.status(500).json({ error: '更新客户失败' });
            return;
          }
        });
      }

      if (device_brand || device_model || device_imei) {
        const updateFields = [];
        const updateValues = [];

        if (device_brand) {
          updateFields.push('brand = ?');
          updateValues.push(device_brand);
        }
        if (device_model) {
          updateFields.push('model = ?');
          updateValues.push(device_model);
        }
        if (device_imei) {
          updateFields.push('imei = ?');
          updateValues.push(device_imei);
        }
        updateValues.push(existingOrder.device_id);

        db.run(`
          UPDATE devices SET ${updateFields.join(', ')} WHERE id = ?
        `, updateValues, (err) => {
          if (err) {
            db.run('ROLLBACK');
            console.error('更新设备失败:', err);
            res.status(500).json({ error: '更新设备失败' });
            return;
          }
        });
      }

      const orderUpdateFields = [];
      const orderUpdateValues = [];

      if (technician_id !== undefined) {
        orderUpdateFields.push('technician_id = ?');
        orderUpdateValues.push(technician_id || null);
      }
      if (fault_description) {
        orderUpdateFields.push('fault_description = ?');
        orderUpdateValues.push(fault_description);
      }
      if (quote !== undefined) {
        orderUpdateFields.push('quote = ?');
        orderUpdateValues.push(quote || null);
      }
      if (estimated_completion_time !== undefined) {
        orderUpdateFields.push('estimated_completion_time = ?');
        orderUpdateValues.push(estimated_completion_time || null);
      }

      const statusChanged = status && status !== existingOrder.status;
      if (statusChanged) {
        if (!VALID_STATUSES.includes(status)) {
          db.run('ROLLBACK');
          res.status(400).json({ error: '无效的状态值' });
          return;
        }
        orderUpdateFields.push('status = ?');
        orderUpdateValues.push(status);
      }

      orderUpdateFields.push('updated_at = CURRENT_TIMESTAMP');
      orderUpdateValues.push(id);

      if (orderUpdateFields.length > 0) {
        db.run(`
          UPDATE orders SET ${orderUpdateFields.join(', ')} WHERE id = ?
        `, orderUpdateValues, (err) => {
          if (err) {
            db.run('ROLLBACK');
            console.error('更新工单失败:', err);
            res.status(500).json({ error: '更新工单失败' });
            return;
          }

          if (statusChanged) {
            db.run(`
              INSERT INTO status_history (order_id, old_status, new_status, note)
              VALUES (?, ?, ?, ?)
            `, [id, existingOrder.status, status, note || null], (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('创建状态历史失败:', err);
                res.status(500).json({ error: '创建状态历史失败' });
                return;
              }
            });
          }

          if (note && !statusChanged) {
            db.run(`
              INSERT INTO notes (order_id, content) VALUES (?, ?)
            `, [id, note], (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('创建备注失败:', err);
                res.status(500).json({ error: '创建备注失败' });
                return;
              }
            });
          }

          db.run('COMMIT');
          res.json({ message: '工单更新成功' });
        });
      } else {
        db.run('ROLLBACK');
        res.json({ message: '没有需要更新的字段' });
      }
    });
  });
};

const updateOrderStatus = (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: '无效的状态值' });
    return;
  }

  db.get(`SELECT * FROM orders WHERE id = ?`, [id], (err, order) => {
    if (err) {
      console.error('获取工单失败:', err);
      res.status(500).json({ error: '获取工单失败' });
      return;
    }

    if (!order) {
      res.status(404).json({ error: '工单不存在' });
      return;
    }

    if (order.status === status) {
      res.json({ message: '状态未改变' });
      return;
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(`
        UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [status, id], (err) => {
        if (err) {
          db.run('ROLLBACK');
          console.error('更新工单状态失败:', err);
          res.status(500).json({ error: '更新工单状态失败' });
          return;
        }

        db.run(`
          INSERT INTO status_history (order_id, old_status, new_status, note)
          VALUES (?, ?, ?, ?)
        `, [id, order.status, status, note || null], (err) => {
          if (err) {
            db.run('ROLLBACK');
            console.error('创建状态历史失败:', err);
            res.status(500).json({ error: '创建状态历史失败' });
            return;
          }

          db.run('COMMIT');
          res.json({ message: '状态更新成功' });
        });
      });
    });
  });
};

const addNote = (req, res) => {
  const { id } = req.params;
  const { content, created_by } = req.body;

  if (!content || !content.trim()) {
    res.status(400).json({ error: '备注内容不能为空' });
    return;
  }

  db.get(`SELECT id FROM orders WHERE id = ?`, [id], (err, order) => {
    if (err) {
      console.error('获取工单失败:', err);
      res.status(500).json({ error: '获取工单失败' });
      return;
    }

    if (!order) {
      res.status(404).json({ error: '工单不存在' });
      return;
    }

    db.run(`
      INSERT INTO notes (order_id, content, created_by)
      VALUES (?, ?, ?)
    `, [id, content, created_by || null], function(err) {
      if (err) {
        console.error('添加备注失败:', err);
        res.status(500).json({ error: '添加备注失败' });
        return;
      }

      res.status(201).json({ id: this.lastID, message: '备注添加成功' });
    });
  });
};

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  addNote,
  VALID_STATUSES
};
