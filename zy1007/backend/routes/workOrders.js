const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = express.Router();

const STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  WAITING_PARTS: 'waiting_parts',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const generateOrderNo = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `WO${year}${month}${day}${random}`;
};

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = `SELECT * FROM work_orders ORDER BY created_at DESC`;
  let params = [];

  if (status) {
    sql = `SELECT * FROM work_orders WHERE status = ? ORDER BY created_at DESC`;
    params = [status];
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ data: rows });
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM work_orders WHERE id = ?`, [id], (err, workOrder) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }

    db.all(`
      SELECT spu.*, sp.name as spare_part_name, sp.model as spare_part_model, sp.unit as spare_part_unit
      FROM spare_part_usages spu
      JOIN spare_parts sp ON spu.spare_part_id = sp.id
      WHERE spu.work_order_id = ?
    `, [id], (err, usages) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      db.all(`SELECT * FROM communications WHERE work_order_id = ? ORDER BY created_at DESC`, [id], (err, communications) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        res.json({
          data: {
            ...workOrder,
            usages,
            communications
          }
        });
      });
    });
  });
});

router.post('/', (req, res) => {
  const { customer_name, customer_phone, device_type, device_model, fault_description, spare_parts } = req.body;

  if (!customer_name) {
    return res.status(400).json({ error: '客户姓名不能为空' });
  }

  if (spare_parts && spare_parts.length > 0) {
    for (const part of spare_parts) {
      if (part.quantity <= 0) {
        return res.status(400).json({ error: '备件数量必须大于0' });
      }
    }
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    const checkStockPromises = [];
    if (spare_parts && spare_parts.length > 0) {
      for (const part of spare_parts) {
        checkStockPromises.push(
          new Promise((resolve, reject) => {
            db.get('SELECT stock, name FROM spare_parts WHERE id = ?', [part.id], (err, row) => {
              if (err) return reject(err);
              if (!row) return reject(new Error(`备件 ${part.id} 不存在`));
              if (row.stock < part.quantity) {
                return reject(new Error(`备件 "${row.name}" 库存不足，当前库存: ${row.stock}，需要: ${part.quantity}`));
              }
              resolve({ ...row, requestedQty: part.quantity });
            });
          })
        );
      }
    }

    Promise.all(checkStockPromises)
      .then(() => {
        const orderNo = generateOrderNo();
        const workOrderId = uuidv4();
        const now = new Date().toISOString();

        db.run(`
          INSERT INTO work_orders (id, order_no, customer_name, customer_phone, device_type, device_model, fault_description, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [workOrderId, orderNo, customer_name, customer_phone, device_type, device_model, fault_description, STATUS.PENDING, now, now], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          const usagePromises = [];
          if (spare_parts && spare_parts.length > 0) {
            for (const part of spare_parts) {
              const usageId = uuidv4();
              
              usagePromises.push(
                new Promise((resolve, reject) => {
                  db.run(`
                    INSERT INTO spare_part_usages (id, work_order_id, spare_part_id, quantity, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                  `, [usageId, workOrderId, part.id, part.quantity, 'occupied', now, now], (err) => {
                    if (err) return reject(err);
                    
                    db.run(`
                      UPDATE spare_parts SET stock = stock - ?, updated_at = ? WHERE id = ?
                    `, [part.quantity, now, part.id], (err) => {
                      if (err) return reject(err);
                      resolve();
                    });
                  });
                })
              );
            }
          }

          Promise.all(usagePromises)
            .then(() => {
              db.run('COMMIT', (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }
                res.status(201).json({
                  data: {
                    id: workOrderId,
                    order_no: orderNo,
                    customer_name,
                    status: STATUS.PENDING,
                    created_at: now
                  }
                });
              });
            })
            .catch((err) => {
              db.run('ROLLBACK');
              res.status(500).json({ error: err.message });
            });
        });
      })
      .catch((err) => {
        db.run('ROLLBACK');
        res.status(400).json({ error: err.message });
      });
  });
});

router.put('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, operator, note, spare_parts } = req.body;

  const validStatuses = Object.values(STATUS);
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.get('SELECT * FROM work_orders WHERE id = ?', [id], (err, workOrder) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      if (!workOrder) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: '工单不存在' });
      }

      if (workOrder.status === STATUS.COMPLETED || workOrder.status === STATUS.CANCELLED) {
        db.run('ROLLBACK');
        return res.status(400).json({ error: '已完成或已取消的工单无法修改状态' });
      }

      const now = new Date().toISOString();
      const promises = [];

      if (status === STATUS.CANCELLED) {
        promises.push(
          new Promise((resolve, reject) => {
            db.all(`
              SELECT spu.*, sp.name as spare_part_name
              FROM spare_part_usages spu
              JOIN spare_parts sp ON spu.spare_part_id = sp.id
              WHERE spu.work_order_id = ? AND spu.status = 'occupied'
            `, [id], (err, usages) => {
              if (err) return reject(err);
              
              const releasePromises = [];
              for (const usage of usages) {
                releasePromises.push(
                  new Promise((relResolve, relReject) => {
                    db.run(`
                      UPDATE spare_parts SET stock = stock + ?, updated_at = ? WHERE id = ?
                    `, [usage.quantity, now, usage.spare_part_id], (err) => {
                      if (err) return relReject(err);
                      
                      db.run(`
                        UPDATE spare_part_usages SET status = 'released', updated_at = ? WHERE id = ?
                      `, [now, usage.id], (err) => {
                        if (err) return relReject(err);
                        relResolve();
                      });
                    });
                  })
                );
              }
              
              Promise.all(releasePromises)
                .then(resolve)
                .catch(reject);
            });
          })
        );
      }

      if (status === STATUS.COMPLETED) {
        promises.push(
          new Promise((resolve, reject) => {
            db.all(`
              SELECT spu.*, sp.name as spare_part_name
              FROM spare_part_usages spu
              JOIN spare_parts sp ON spu.spare_part_id = sp.id
              WHERE spu.work_order_id = ? AND spu.status = 'occupied'
            `, [id], (err, usages) => {
              if (err) return reject(err);
              
              const deductPromises = [];
              for (const usage of usages) {
                deductPromises.push(
                  new Promise((deductResolve, deductReject) => {
                    db.run(`
                      UPDATE spare_part_usages SET status = 'deducted', updated_at = ? WHERE id = ?
                    `, [now, usage.id], (err) => {
                      if (err) return deductReject(err);
                      deductResolve();
                    });
                  })
                );
              }
              
              Promise.all(deductPromises)
                .then(resolve)
                .catch(reject);
            });
          })
        );
      }

      if (spare_parts && spare_parts.length > 0) {
        for (const part of spare_parts) {
          if (part.quantity <= 0) {
            db.run('ROLLBACK');
            return res.status(400).json({ error: '备件数量必须大于0' });
          }
          
          promises.push(
            new Promise((resolve, reject) => {
              db.get('SELECT stock, name FROM spare_parts WHERE id = ?', [part.id], (err, row) => {
                if (err) return reject(err);
                if (!row) return reject(new Error(`备件 ${part.id} 不存在`));
                if (row.stock < part.quantity) {
                  return reject(new Error(`备件 "${row.name}" 库存不足，当前库存: ${row.stock}，需要: ${part.quantity}`));
                }
                
                const usageId = uuidv4();
                db.run(`
                  INSERT INTO spare_part_usages (id, work_order_id, spare_part_id, quantity, status, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [usageId, id, part.id, part.quantity, 'occupied', now, now], (err) => {
                  if (err) return reject(err);
                  
                  db.run(`
                    UPDATE spare_parts SET stock = stock - ?, updated_at = ? WHERE id = ?
                  `, [part.quantity, now, part.id], (err) => {
                    if (err) return reject(err);
                    resolve();
                  });
                });
              });
            })
          );
        }
      }

      Promise.all(promises)
        .then(() => {
          db.run(`
            UPDATE work_orders SET status = ?, updated_at = ? WHERE id = ?
          `, [status, now, id], (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }

            if (note) {
              const commId = uuidv4();
              db.run(`
                INSERT INTO communications (id, work_order_id, operator, content, created_at)
                VALUES (?, ?, ?, ?, ?)
              `, [commId, id, operator || '系统', `状态变更为: ${getStatusText(status)}${note ? ` - ${note}` : ''}`, now], (err) => {
                if (err) {
                  console.warn('保存沟通记录失败:', err);
                }
                
                db.run('COMMIT', (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                  }
                  res.json({
                    data: {
                      id,
                      status,
                      updated_at: now
                    }
                  });
                });
              });
            } else {
              db.run('COMMIT', (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }
                res.json({
                  data: {
                    id,
                    status,
                    updated_at: now
                  }
                });
              });
            }
          });
        })
        .catch((err) => {
          db.run('ROLLBACK');
          res.status(400).json({ error: err.message });
        });
    });
  });
});

router.post('/:id/communications', (req, res) => {
  const { id } = req.params;
  const { operator, content } = req.body;

  if (!content) {
    return res.status(400).json({ error: '沟通内容不能为空' });
  }

  db.get('SELECT id FROM work_orders WHERE id = ?', [id], (err, workOrder) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }

    const commId = uuidv4();
    const now = new Date().toISOString();

    db.run(`
      INSERT INTO communications (id, work_order_id, operator, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [commId, id, operator || '匿名', content, now], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.status(201).json({
        data: {
          id: commId,
          work_order_id: id,
          operator,
          content,
          created_at: now
        }
      });
    });
  });
});

function getStatusText(status) {
  const statusMap = {
    [STATUS.PENDING]: '待接单',
    [STATUS.IN_PROGRESS]: '维修中',
    [STATUS.WAITING_PARTS]: '等待备件',
    [STATUS.COMPLETED]: '已完成',
    [STATUS.CANCELLED]: '已取消'
  };
  return statusMap[status] || status;
}

module.exports = router;
