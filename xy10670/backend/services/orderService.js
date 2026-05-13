const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { db } = require('../database');

const PAPER_SIZES = ['A3', 'A4', 'A5', 'B5'];
const BINDING_TYPES = ['无线胶装', '骑马钉', '环装', '精装'];
const DEVICE_QUEUES = ['HP-M1', 'HP-M2', 'Canon-C1', 'Canon-C2', 'Xerox-X1'];
const STATUSES = ['pending', 'processing', 'success', 'blocked', 'manual_correction', 'failed', 'completed'];

const validateOrder = (order) => {
  const errors = [];
  
  if (!order.file_name) errors.push('文件名不能为空');
  if (!order.page_count || order.page_count < 1) errors.push('页数必须大于0');
  if (!PAPER_SIZES.includes(order.paper_size)) errors.push('无效的纸张规格');
  if (!BINDING_TYPES.includes(order.binding_type)) errors.push('无效的装订方式');
  if (!DEVICE_QUEUES.includes(order.device_queue)) errors.push('无效的设备队列');
  if (!order.pickup_promise) errors.push('取件承诺时间不能为空');

  return errors;
};

const addTimeline = (orderId, action, status, description, operator = 'system') => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO timeline (order_id, action, status, description, operator, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [orderId, action, status, description, operator, moment().toISOString()],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

const checkIdempotency = (key) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT order_id FROM idempotency_keys WHERE key = ?', [key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.order_id : null);
    });
  });
};

const saveIdempotencyKey = (key, orderId) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO idempotency_keys (key, order_id, created_at) VALUES (?, ?, ?)',
      [key, orderId, moment().toISOString()],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

const createOrder = async (orderData, idempotencyKey = null) => {
  if (idempotencyKey) {
    const existingOrderId = await checkIdempotency(idempotencyKey);
    if (existingOrderId) {
      const existingOrder = await getOrderById(existingOrderId);
      return { order: existingOrder, isDuplicate: true };
    }
  }

  const errors = validateOrder(orderData);
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  const orderId = uuidv4();
  const orderNo = 'PO' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const now = moment().toISOString();

  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      db.run('BEGIN TRANSACTION');

      try {
        db.run(
          'INSERT INTO orders (id, order_no, file_name, page_count, paper_size, binding_type, device_queue, pickup_promise, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            orderId,
            orderNo,
            orderData.file_name,
            orderData.page_count,
            orderData.paper_size,
            orderData.binding_type,
            orderData.device_queue,
            orderData.pickup_promise,
            'pending',
            now,
            now
          ],
          async (err) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }

            await addTimeline(orderId, 'CREATE', 'pending', '订单创建成功');

            if (idempotencyKey) {
              await saveIdempotencyKey(idempotencyKey, orderId);
            }

            db.run('COMMIT', async (commitErr) => {
              if (commitErr) {
                db.run('ROLLBACK');
                reject(commitErr);
                return;
              }
              const order = await getOrderById(orderId);
              resolve({ order, isDuplicate: false });
            });
          }
        );
      } catch (error) {
        db.run('ROLLBACK');
        reject(error);
      }
    });
  });
};

const getOrderById = (orderId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getOrders = (filters = {}) => {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.device_queue) {
      query += ' AND device_queue = ?';
      params.push(filters.device_queue);
    }
    if (filters.paper_size) {
      query += ' AND paper_size = ?';
      params.push(filters.paper_size);
    }
    if (filters.binding_type) {
      query += ' AND binding_type = ?';
      params.push(filters.binding_type);
    }
    if (filters.order_no) {
      query += ' AND order_no LIKE ?';
      params.push('%' + filters.order_no + '%');
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const updateBindingType = async (orderId, newBindingType, operator = 'system') => {
  if (!BINDING_TYPES.includes(newBindingType)) {
    throw new Error('无效的装订方式');
  }

  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  const oldBindingType = order.binding_type;
  const now = moment().toISOString();

  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      db.run('BEGIN TRANSACTION');

      try {
        db.run(
          'UPDATE orders SET binding_type = ?, updated_at = ? WHERE id = ?',
          [newBindingType, now, orderId],
          async (err) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }

            await addTimeline(
              orderId,
              'BINDING_CHANGE',
              order.status,
              `装订方式从 ${oldBindingType} 变更为 ${newBindingType}`,
              operator
            );

            db.run('COMMIT', async (commitErr) => {
              if (commitErr) {
                db.run('ROLLBACK');
                reject(commitErr);
                return;
              }
              const updatedOrder = await getOrderById(orderId);
              resolve(updatedOrder);
            });
          }
        );
      } catch (error) {
        db.run('ROLLBACK');
        reject(error);
      }
    });
  });
};

const updateDeviceQueue = async (orderId, newDeviceQueue, reason, operator = 'system') => {
  if (!DEVICE_QUEUES.includes(newDeviceQueue)) {
    throw new Error('无效的设备队列');
  }

  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  const oldDeviceQueue = order.device_queue;
  const now = moment().toISOString();

  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      db.run('BEGIN TRANSACTION');

      try {
        db.run(
          'UPDATE orders SET device_queue = ?, updated_at = ? WHERE id = ?',
          [newDeviceQueue, now, orderId],
          async (err) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }

            await addTimeline(
              orderId,
              'DEVICE_QUEUE_CHANGE',
              order.status,
              `设备队列从 ${oldDeviceQueue} 变更为 ${newDeviceQueue}，原因：${reason || '未说明'}`,
              operator
            );

            db.run('COMMIT', async (commitErr) => {
              if (commitErr) {
                db.run('ROLLBACK');
                reject(commitErr);
                return;
              }
              const updatedOrder = await getOrderById(orderId);
              resolve(updatedOrder);
            });
          }
        );
      } catch (error) {
        db.run('ROLLBACK');
        reject(error);
      }
    });
  });
};

const reviewPickupPromise = async (orderId, newPickupPromise, operator = 'system') => {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  const oldPickupPromise = order.pickup_promise;
  const now = moment().toISOString();

  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      db.run('BEGIN TRANSACTION');

      try {
        db.run(
          'UPDATE orders SET pickup_promise = ?, updated_at = ? WHERE id = ?',
          [newPickupPromise, now, orderId],
          async (err) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }

            await addTimeline(
              orderId,
              'PICKUP_REVIEW',
              order.status,
              `取件承诺从 ${oldPickupPromise} 复核为 ${newPickupPromise}`,
              operator
            );

            db.run('COMMIT', async (commitErr) => {
              if (commitErr) {
                db.run('ROLLBACK');
                reject(commitErr);
                return;
              }
              const updatedOrder = await getOrderById(orderId);
              resolve(updatedOrder);
            });
          }
        );
      } catch (error) {
        db.run('ROLLBACK');
        reject(error);
      }
    });
  });
};

const updateOrderStatus = async (orderId, newStatus, reason = '', operator = 'system') => {
  if (!STATUSES.includes(newStatus)) {
    throw new Error('无效的状态');
  }

  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  const oldStatus = order.status;
  const now = moment().toISOString();

  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      db.run('BEGIN TRANSACTION');

      try {
        const updateFields = ['status = ?', 'updated_at = ?'];
        const params = [newStatus, now];

        if (newStatus === 'failed' && reason) {
          updateFields.push('rework_reason = ?');
          params.push(reason);
        }

        params.push(orderId);

        db.run(
          `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
          params,
          async (err) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }

            const actionMap = {
              'processing': 'START_PROCESS',
              'success': 'SUCCESS',
              'blocked': 'BLOCK',
              'manual_correction': 'MANUAL_CORRECTION',
              'failed': 'FAIL',
              'completed': 'COMPLETE'
            };

            await addTimeline(
              orderId,
              actionMap[newStatus] || 'STATUS_CHANGE',
              newStatus,
              `状态从 ${oldStatus} 变更为 ${newStatus}${reason ? '，原因：' + reason : ''}`,
              operator
            );

            db.run('COMMIT', async (commitErr) => {
              if (commitErr) {
                db.run('ROLLBACK');
                reject(commitErr);
                return;
              }
              const updatedOrder = await getOrderById(orderId);
              resolve(updatedOrder);
            });
          }
        );
      } catch (error) {
        db.run('ROLLBACK');
        reject(error);
      }
    });
  });
};

const getTimeline = (orderId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM timeline WHERE order_id = ? ORDER BY created_at DESC', [orderId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const bulkImportOrders = async (ordersData, operator = 'system') => {
  const results = {
    success: [],
    failed: [],
    total: ordersData.length
  };

  for (const orderData of ordersData) {
    try {
      const { order } = await createOrder(orderData);
      results.success.push(order);
    } catch (error) {
      results.failed.push({
        data: orderData,
        error: error.message
      });
    }
  }

  return results;
};

module.exports = {
  PAPER_SIZES,
  BINDING_TYPES,
  DEVICE_QUEUES,
  STATUSES,
  createOrder,
  getOrderById,
  getOrders,
  updateBindingType,
  updateDeviceQueue,
  reviewPickupPromise,
  updateOrderStatus,
  getTimeline,
  bulkImportOrders,
  validateOrder
};
