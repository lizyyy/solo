const db = require('./database');
const { v4: uuidv4 } = require('uuid');

const ORDER_STATUS = {
  LOCKED: 'locked',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout'
};

const ERROR_TYPES = {
  INSUFFICIENT_STOCK: 'insufficient_stock',
  DUPLICATE_REQUEST: 'duplicate_request',
  STATUS_CONFLICT: 'status_conflict',
  TIMEOUT: 'timeout',
  NOT_FOUND: 'not_found'
};

class InventoryService {
  constructor() {
    this.lockTimeoutSeconds = 300;
    this.locks = new Map();
  }

  async getInventory(productId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT product_id, total_stock, available_stock, locked_stock, sold_stock, version FROM inventory WHERE product_id = ?',
        [productId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  async createInventory(productId, totalStock) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO inventory (product_id, total_stock, available_stock, locked_stock, sold_stock, version) VALUES (?, ?, ?, 0, 0, 0)',
        [productId, totalStock, totalStock],
        function(err) {
          if (err) return reject(err);
          resolve({ productId, totalStock });
        }
      );
    });
  }

  _acquireLock(key) {
    return new Promise((resolve) => {
      const tryLock = () => {
        if (!this.locks.has(key) || this.locks.get(key) === false) {
          this.locks.set(key, true);
          resolve(true);
        } else {
          setTimeout(tryLock, 10);
        }
      };
      tryLock();
    });
  }

  _releaseLock(key) {
    this.locks.set(key, false);
  }

  async lockStock(productId, orderId, userId, quantity) {
    const lockKey = `product:${productId}`;
    await this._acquireLock(lockKey);

    try {
      return await new Promise((resolve, reject) => {
        db.serialize(() => {
          db.get(
            'SELECT * FROM orders WHERE order_id = ?',
            [orderId],
            (err, existingOrder) => {
              if (err) {
                this._releaseLock(lockKey);
                return reject(err);
              }

              if (existingOrder) {
                this._releaseLock(lockKey);
                return resolve({
                  success: false,
                  errorType: ERROR_TYPES.DUPLICATE_REQUEST,
                  errorMessage: `订单 ${orderId} 已存在`,
                  order: existingOrder
                });
              }

              db.get(
                'SELECT * FROM orders WHERE user_id = ? AND product_id = ? AND status IN (?, ?)',
                [userId, productId, ORDER_STATUS.LOCKED, ORDER_STATUS.PAID],
                (err, userExistingOrder) => {
                  if (err) {
                    this._releaseLock(lockKey);
                    return reject(err);
                  }

                  if (userExistingOrder) {
                    this._releaseLock(lockKey);
                    return resolve({
                      success: false,
                      errorType: ERROR_TYPES.DUPLICATE_REQUEST,
                      errorMessage: `用户 ${userId} 已存在进行中的订单 ${userExistingOrder.order_id}`,
                      order: userExistingOrder
                    });
                  }

                  db.get(
                    'SELECT * FROM inventory WHERE product_id = ?',
                    [productId],
                    (err, inventory) => {
                      if (err) {
                        this._releaseLock(lockKey);
                        return reject(err);
                      }

                      if (!inventory) {
                        this._releaseLock(lockKey);
                        return resolve({
                          success: false,
                          errorType: ERROR_TYPES.NOT_FOUND,
                          errorMessage: `商品 ${productId} 不存在`
                        });
                      }

                      if (inventory.available_stock < quantity) {
                        this._releaseLock(lockKey);
                        return resolve({
                          success: false,
                          errorType: ERROR_TYPES.INSUFFICIENT_STOCK,
                          errorMessage: `库存不足，可用: ${inventory.available_stock}, 请求: ${quantity}`,
                          availableStock: inventory.available_stock,
                          requestedQuantity: quantity
                        });
                      }

                      const newAvailable = inventory.available_stock - quantity;
                      const newLocked = inventory.locked_stock + quantity;
                      const newVersion = inventory.version + 1;

                      db.run(
                        'UPDATE inventory SET available_stock = ?, locked_stock = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND version = ?',
                        [newAvailable, newLocked, newVersion, productId, inventory.version],
                        function(err) {
                          if (err || this.changes === 0) {
                            this._releaseLock(lockKey);
                            return resolve({
                              success: false,
                              errorType: ERROR_TYPES.STATUS_CONFLICT,
                              errorMessage: '库存更新冲突，重试'
                            });
                          }

                          const now = new Date();
                          const timeoutAt = new Date(now.getTime() + this.lockTimeoutSeconds * 1000);

                          db.run(
                            'INSERT INTO orders (order_id, product_id, user_id, quantity, status, locked_at, timeout_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [orderId, productId, userId, quantity, ORDER_STATUS.LOCKED, now.toISOString(), timeoutAt.toISOString()],
                            (err) => {
                              if (err) {
                                db.run(
                                  'UPDATE inventory SET available_stock = ?, locked_stock = ?, version = ? WHERE product_id = ?',
                                  [inventory.available_stock, inventory.locked_stock, inventory.version, productId]
                                );
                                this._releaseLock(lockKey);
                                return reject(err);
                              }

                              this._releaseLock(lockKey);
                              resolve({
                                success: true,
                                orderId,
                                quantity,
                                status: ORDER_STATUS.LOCKED,
                                timeoutAt: timeoutAt.toISOString()
                              });
                            }
                          );
                        }.bind(this)
                      );
                    }
                  );
                }
              );
            }
          );
        });
      });
    } catch (err) {
      this._releaseLock(lockKey);
      throw err;
    }
  }

  async confirmPayment(orderId) {
    const lockKey = `order:${orderId}`;
    await this._acquireLock(lockKey);

    try {
      return await new Promise((resolve, reject) => {
        db.serialize(() => {
          db.get(
            'SELECT * FROM orders WHERE order_id = ?',
            [orderId],
            (err, order) => {
              if (err) {
                this._releaseLock(lockKey);
                return reject(err);
              }

              if (!order) {
                this._releaseLock(lockKey);
                return resolve({
                  success: false,
                  errorType: ERROR_TYPES.NOT_FOUND,
                  errorMessage: `订单 ${orderId} 不存在`
                });
              }

              if (order.status === ORDER_STATUS.PAID) {
                this._releaseLock(lockKey);
                return resolve({
                  success: true,
                  orderId,
                  status: ORDER_STATUS.PAID,
                  isDuplicate: true,
                  message: '订单已支付，幂等返回'
                });
              }

              if (order.status === ORDER_STATUS.CANCELLED) {
                this._releaseLock(lockKey);
                return resolve({
                  success: false,
                  errorType: ERROR_TYPES.STATUS_CONFLICT,
                  errorMessage: `订单 ${orderId} 已取消，无法支付`
                });
              }

              if (order.status === ORDER_STATUS.TIMEOUT) {
                this._releaseLock(lockKey);
                return resolve({
                  success: false,
                  errorType: ERROR_TYPES.TIMEOUT,
                  errorMessage: `订单 ${orderId} 已超时关闭`
                });
              }

              if (order.status !== ORDER_STATUS.LOCKED) {
                this._releaseLock(lockKey);
                return resolve({
                  success: false,
                  errorType: ERROR_TYPES.STATUS_CONFLICT,
                  errorMessage: `订单状态异常: ${order.status}`
                });
              }

              db.get(
                'SELECT * FROM inventory WHERE product_id = ?',
                [order.product_id],
                (err, inventory) => {
                  if (err) {
                    this._releaseLock(lockKey);
                    return reject(err);
                  }

                  if (inventory.locked_stock < order.quantity) {
                    this._releaseLock(lockKey);
                    this.logAbnormalOrder(orderId, 'locked_stock_mismatch', `锁定库存不足: ${inventory.locked_stock} < ${order.quantity}`);
                    return resolve({
                      success: false,
                      errorType: ERROR_TYPES.STATUS_CONFLICT,
                      errorMessage: '锁定库存不一致'
                    });
                  }

                  const newLocked = inventory.locked_stock - order.quantity;
                  const newSold = inventory.sold_stock + order.quantity;
                  const newVersion = inventory.version + 1;

                  db.run(
                    'UPDATE inventory SET locked_stock = ?, sold_stock = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND version = ?',
                    [newLocked, newSold, newVersion, order.product_id, inventory.version],
                    function(err) {
                      if (err || this.changes === 0) {
                        this._releaseLock(lockKey);
                        return resolve({
                          success: false,
                          errorType: ERROR_TYPES.STATUS_CONFLICT,
                          errorMessage: '库存更新冲突，重试'
                        });
                      }

                      const now = new Date();
                      db.run(
                        'UPDATE orders SET status = ?, paid_at = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?',
                        [ORDER_STATUS.PAID, now.toISOString(), orderId],
                        (err) => {
                          if (err) {
                            db.run(
                              'UPDATE inventory SET locked_stock = ?, sold_stock = ?, version = ? WHERE product_id = ?',
                              [inventory.locked_stock, inventory.sold_stock, inventory.version, order.product_id]
                            );
                            this._releaseLock(lockKey);
                            return reject(err);
                          }

                          this._releaseLock(lockKey);
                          resolve({
                            success: true,
                            orderId,
                            status: ORDER_STATUS.PAID,
                            paidAt: now.toISOString()
                          });
                        }
                      );
                    }.bind(this)
                  );
                }
              );
            }
          );
        });
      });
    } catch (err) {
      this._releaseLock(lockKey);
      throw err;
    }
  }

  async cancelOrder(orderId) {
    const lockKey = `order:${orderId}`;
    await this._acquireLock(lockKey);

    try {
      return await new Promise((resolve, reject) => {
        db.serialize(() => {
          db.get(
            'SELECT * FROM orders WHERE order_id = ?',
            [orderId],
            (err, order) => {
              if (err) {
                this._releaseLock(lockKey);
                return reject(err);
              }

              if (!order) {
                this._releaseLock(lockKey);
                return resolve({
                  success: false,
                  errorType: ERROR_TYPES.NOT_FOUND,
                  errorMessage: `订单 ${orderId} 不存在`
                });
              }

              if (order.status === ORDER_STATUS.CANCELLED) {
                this._releaseLock(lockKey);
                return resolve({
                  success: true,
                  orderId,
                  status: ORDER_STATUS.CANCELLED,
                  isDuplicate: true,
                  message: '订单已取消，幂等返回'
                });
              }

              if (order.status === ORDER_STATUS.PAID) {
                this._releaseLock(lockKey);
                return resolve({
                  success: false,
                  errorType: ERROR_TYPES.STATUS_CONFLICT,
                  errorMessage: `订单 ${orderId} 已支付，需要走退款流程`
                });
              }

              if (order.status !== ORDER_STATUS.LOCKED) {
                this._releaseLock(lockKey);
                return resolve({
                  success: false,
                  errorType: ERROR_TYPES.STATUS_CONFLICT,
                  errorMessage: `订单状态异常: ${order.status}`
                });
              }

              db.get(
                'SELECT * FROM inventory WHERE product_id = ?',
                [order.product_id],
                (err, inventory) => {
                  if (err) {
                    this._releaseLock(lockKey);
                    return reject(err);
                  }

                  const newAvailable = inventory.available_stock + order.quantity;
                  const newLocked = inventory.locked_stock - order.quantity;
                  const newVersion = inventory.version + 1;

                  if (newLocked < 0) {
                    this._releaseLock(lockKey);
                    this.logAbnormalOrder(orderId, 'negative_locked_stock', `锁定库存将变为负数: ${newLocked}`);
                    return resolve({
                      success: false,
                      errorType: ERROR_TYPES.STATUS_CONFLICT,
                      errorMessage: '库存状态异常'
                    });
                  }

                  db.run(
                    'UPDATE inventory SET available_stock = ?, locked_stock = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND version = ?',
                    [newAvailable, newLocked, newVersion, order.product_id, inventory.version],
                    function(err) {
                      if (err || this.changes === 0) {
                        this._releaseLock(lockKey);
                        return resolve({
                          success: false,
                          errorType: ERROR_TYPES.STATUS_CONFLICT,
                          errorMessage: '库存更新冲突，重试'
                        });
                      }

                      const now = new Date();
                      db.run(
                        'UPDATE orders SET status = ?, cancelled_at = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?',
                        [ORDER_STATUS.CANCELLED, now.toISOString(), orderId],
                        (err) => {
                          if (err) {
                            db.run(
                              'UPDATE inventory SET available_stock = ?, locked_stock = ?, version = ? WHERE product_id = ?',
                              [inventory.available_stock, inventory.locked_stock, inventory.version, order.product_id]
                            );
                            this._releaseLock(lockKey);
                            return reject(err);
                          }

                          this._releaseLock(lockKey);
                          resolve({
                            success: true,
                            orderId,
                            status: ORDER_STATUS.CANCELLED,
                            cancelledAt: now.toISOString()
                          });
                        }
                      );
                    }.bind(this)
                  );
                }
              );
            }
          );
        });
      });
    } catch (err) {
      this._releaseLock(lockKey);
      throw err;
    }
  }

  async closeTimeoutOrders() {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      db.all(
        'SELECT * FROM orders WHERE status = ? AND timeout_at < ?',
        [ORDER_STATUS.LOCKED, now],
        async (err, timeoutOrders) => {
          if (err) return reject(err);

          const results = [];
          for (const order of timeoutOrders) {
            try {
              const result = await this._timeoutCloseOrder(order);
              results.push(result);
            } catch (e) {
              results.push({
                orderId: order.order_id,
                success: false,
                error: e.message
              });
            }
          }
          resolve(results);
        }
      );
    });
  }

  async _timeoutCloseOrder(order) {
    const lockKey = `order:${order.order_id}`;
    await this._acquireLock(lockKey);

    try {
      return await new Promise((resolve, reject) => {
        db.serialize(() => {
          db.get(
            'SELECT * FROM orders WHERE order_id = ?',
            [order.order_id],
            (err, currentOrder) => {
              if (err) {
                this._releaseLock(lockKey);
                return reject(err);
              }

              if (currentOrder.status !== ORDER_STATUS.LOCKED) {
                this._releaseLock(lockKey);
                return resolve({
                  orderId: order.order_id,
                  success: true,
                  status: currentOrder.status,
                  message: '订单状态已变更，跳过'
                });
              }

              db.get(
                'SELECT * FROM inventory WHERE product_id = ?',
                [order.product_id],
                (err, inventory) => {
                  if (err) {
                    this._releaseLock(lockKey);
                    return reject(err);
                  }

                  const newAvailable = inventory.available_stock + order.quantity;
                  const newLocked = inventory.locked_stock - order.quantity;
                  const newVersion = inventory.version + 1;

                  if (newLocked < 0) {
                    this._releaseLock(lockKey);
                    return resolve({
                      orderId: order.order_id,
                      success: false,
                      errorType: 'inventory_error',
                      errorMessage: '锁定库存不足'
                    });
                  }

                  db.run(
                    'UPDATE inventory SET available_stock = ?, locked_stock = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND version = ?',
                    [newAvailable, newLocked, newVersion, order.product_id, inventory.version],
                    function(err) {
                      if (err || this.changes === 0) {
                        this._releaseLock(lockKey);
                        return resolve({
                          orderId: order.order_id,
                          success: false,
                          errorType: 'version_conflict',
                          errorMessage: '库存版本冲突'
                        });
                      }

                      const now = new Date();
                      db.run(
                        'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?',
                        [ORDER_STATUS.TIMEOUT, order.order_id],
                        (err) => {
                          if (err) {
                            db.run(
                              'UPDATE inventory SET available_stock = ?, locked_stock = ?, version = ? WHERE product_id = ?',
                              [inventory.available_stock, inventory.locked_stock, inventory.version, order.product_id]
                            );
                            this._releaseLock(lockKey);
                            return reject(err);
                          }

                          this._releaseLock(lockKey);
                          resolve({
                            orderId: order.order_id,
                            success: true,
                            status: ORDER_STATUS.TIMEOUT
                          });
                        }
                      );
                    }.bind(this)
                  );
                }
              );
            }
          );
        });
      });
    } catch (err) {
      this._releaseLock(lockKey);
      throw err;
    }
  }

  async getCompensationReport() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM inventory',
        (err, inventoryList) => {
          if (err) return reject(err);

          db.all(
            'SELECT * FROM orders ORDER BY created_at DESC LIMIT 100',
            (err, orders) => {
              if (err) return reject(err);

              db.all(
                'SELECT * FROM compensation_logs ORDER BY created_at DESC LIMIT 100',
                (err, compensationLogs) => {
                  if (err) return reject(err);

                  db.all(
                    'SELECT * FROM abnormal_orders ORDER BY created_at DESC LIMIT 100',
                    (err, abnormalOrders) => {
                      if (err) return reject(err);

                      const now = new Date();
                      const stats = {
                        inventory: inventoryList,
                        orders: {
                          total: orders.length,
                          locked: orders.filter(o => o.status === ORDER_STATUS.LOCKED).length,
                          paid: orders.filter(o => o.status === ORDER_STATUS.PAID).length,
                          cancelled: orders.filter(o => o.status === ORDER_STATUS.CANCELLED).length,
                          timeout: orders.filter(o => o.status === ORDER_STATUS.TIMEOUT).length
                        },
                        compensationLogs,
                        abnormalOrders,
                        generatedAt: now.toISOString()
                      };

                      for (const inv of inventoryList) {
                        const expectedTotal = inv.available_stock + inv.locked_stock + inv.sold_stock;
                        const stockConserved = expectedTotal === inv.total_stock;
                        inv.stockConserved = stockConserved;
                        inv.expectedTotal = expectedTotal;
                      }

                      resolve(stats);
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  }

  logAbnormalOrder(orderId, errorType, errorMessage, details = null) {
    db.run(
      'INSERT OR IGNORE INTO abnormal_orders (order_id, error_type, error_message, details) VALUES (?, ?, ?, ?)',
      [orderId, errorType, errorMessage, details ? JSON.stringify(details) : null]
    );
  }

  logCompensation(compensationId, orderId, action, status, details = null) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO compensation_logs (compensation_id, order_id, action, status, details) VALUES (?, ?, ?, ?, ?)',
        [compensationId, orderId, action, status, details ? JSON.stringify(details) : null],
        function(err) {
          if (err) return reject(err);
          resolve({
            compensationId,
            isDuplicate: this.changes === 0
          });
        }
      );
    });
  }
}

module.exports = {
  InventoryService,
  ORDER_STATUS,
  ERROR_TYPES
};
