const { v4: uuidv4 } = require('uuid');
const db = require('../models/database');

const BUCKET_DEPOSIT_PER_UNIT = 50;

class DepositService {
  async generateOrderNo(prefix) {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${dateStr}${random}`;
  }

  async checkDuplicateOrder(orderNo) {
    const existing = await db.get(
      'SELECT id FROM delivery_orders WHERE order_no = ?',
      [orderNo]
    );
    return !!existing;
  }

  async checkDuplicateTransaction(transactionNo) {
    const existing = await db.get(
      'SELECT id FROM deposit_transactions WHERE transaction_no = ?',
      [transactionNo]
    );
    return !!existing;
  }

  async getCustomerById(customerId) {
    return await db.get(
      'SELECT * FROM customers WHERE id = ?',
      [customerId]
    );
  }

  async getCustomerByPhone(phone) {
    return await db.get(
      'SELECT * FROM customers WHERE phone = ?',
      [phone]
    );
  }

  async createCustomer(data) {
    const id = uuidv4();
    await db.run(
      `INSERT INTO customers (id, name, phone, address, total_deposit, frozen_deposit, available_deposit, bucket_count)
       VALUES (?, ?, ?, ?, 0, 0, 0, 0)`,
      [id, data.name, data.phone, data.address || '']
    );
    return await this.getCustomerById(id);
  }

  async updateCustomerDeposit(customerId, depositChange, bucketChange = 0) {
    const customer = await this.getCustomerById(customerId);
    if (!customer) {
      throw new Error('客户不存在');
    }

    const newTotal = customer.total_deposit + depositChange;
    const newAvailable = customer.available_deposit + depositChange;
    const newBucketCount = customer.bucket_count + bucketChange;

    await db.run(
      `UPDATE customers 
       SET total_deposit = ?, available_deposit = ?, bucket_count = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newTotal, newAvailable, newBucketCount, customerId]
    );

    return await this.getCustomerById(customerId);
  }

  async getAvailableBuckets(count) {
    const buckets = await db.all(
      'SELECT * FROM buckets WHERE status = ? LIMIT ?',
      ['in_stock', count]
    );
    if (buckets.length < count) {
      throw new Error(`库存桶不足，需要${count}个，当前只有${buckets.length}个`);
    }
    return buckets;
  }

  async createDeliveryOrder(data) {
    if (data.order_no && await this.checkDuplicateOrder(data.order_no)) {
      throw new Error('重复提交：配送单号已存在');
    }

    const customer = await this.getCustomerById(data.customer_id);
    if (!customer) {
      throw new Error('客户不存在');
    }

    const orderNo = data.order_no || await this.generateOrderNo('DO');
    const depositAmount = data.deposit_amount || data.bucket_count * BUCKET_DEPOSIT_PER_UNIT;

    const buckets = data.bucket_nos ? 
      await Promise.all(data.bucket_nos.map(no => 
        db.get('SELECT * FROM buckets WHERE bucket_no = ? AND status = ?', [no, 'in_stock'])
      )) :
      await this.getAvailableBuckets(data.bucket_count);

    if (buckets.includes(undefined) || buckets.length < data.bucket_count) {
      throw new Error('部分桶号不存在或已被使用');
    }

    await db.beginTransaction();
    try {
      const orderId = uuidv4();
      await db.run(
        `INSERT INTO delivery_orders 
         (id, order_no, customer_id, customer_name, delivery_address, bucket_count, deposit_amount, deposit_type, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, orderNo, data.customer_id, customer.name, data.delivery_address || customer.address, 
         data.bucket_count, depositAmount, data.deposit_type || 'new', 'pending', data.created_by || 'system']
      );

      for (const bucket of buckets) {
        await db.run(
          `INSERT INTO deposit_orders_buckets (id, delivery_order_id, bucket_id, bucket_no)
           VALUES (?, ?, ?, ?)`,
          [uuidv4(), orderId, bucket.id, bucket.bucket_no]
        );

        await db.run(
          `UPDATE buckets SET status = ?, customer_id = ?, current_delivery_id = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          ['in_use', data.customer_id, orderId, bucket.id]
        );
      }

      const transactionNo = await this.generateOrderNo('TX');
      if (await this.checkDuplicateTransaction(transactionNo)) {
        throw new Error('交易流水号重复，请重试');
      }

      await db.run(
        `INSERT INTO deposit_transactions 
         (id, transaction_no, customer_id, customer_name, type, amount, related_order_id, related_order_no, 
          bucket_ids, bucket_nos, before_balance, after_balance, operator, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), transactionNo, data.customer_id, customer.name, 'deposit_frozen', depositAmount, 
         orderId, orderNo, buckets.map(b => b.id).join(','), buckets.map(b => b.bucket_no).join(','),
         customer.total_deposit, customer.total_deposit, data.created_by || 'system', 
         data.remark || '配送冻结押金']
      );

      await db.run(
        `UPDATE customers 
         SET frozen_deposit = frozen_deposit + ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [depositAmount, data.customer_id]
      );

      await this.addStatusHistory('delivery_order', orderId, null, 'pending', data.created_by || 'system', '配送单创建，押金已冻结');

      await db.commit();

      return await this.getDeliveryOrderById(orderId);
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async confirmDeliveryOrder(orderId, operator) {
    const order = await this.getDeliveryOrderById(orderId);
    if (!order) {
      throw new Error('配送单不存在');
    }

    if (order.status !== 'pending') {
      throw new Error('配送单状态不是待确认，无法确认');
    }

    const customer = await this.getCustomerById(order.customer_id);
    if (!customer) {
      throw new Error('客户不存在');
    }

    await db.beginTransaction();
    try {
      await db.run(
        `UPDATE delivery_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ['completed', orderId]
      );

      const transactionNo = await this.generateOrderNo('TX');
      if (await this.checkDuplicateTransaction(transactionNo)) {
        throw new Error('交易流水号重复，请重试');
      }

      await db.run(
        `INSERT INTO deposit_transactions 
         (id, transaction_no, customer_id, customer_name, type, amount, related_order_id, related_order_no, 
          bucket_ids, bucket_nos, before_balance, after_balance, operator, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), transactionNo, order.customer_id, customer.name, 'deposit', order.deposit_amount, 
         orderId, order.order_no, order.buckets.map(b => b.bucket_id).join(','), 
         order.buckets.map(b => b.bucket_no).join(','),
         customer.total_deposit, customer.total_deposit + order.deposit_amount, operator || 'system', 
         '配送确认，押金正式入账']
      );

      await db.run(
        `UPDATE customers 
         SET total_deposit = total_deposit + ?, 
             available_deposit = available_deposit + ?,
             frozen_deposit = frozen_deposit - ?,
             bucket_count = bucket_count + ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [order.deposit_amount, order.deposit_amount, order.deposit_amount, order.bucket_count, order.customer_id]
      );

      await this.addStatusHistory('delivery_order', orderId, 'pending', 'completed', operator || 'system', '配送单确认完成，押金正式入账');

      await db.commit();

      return await this.getDeliveryOrderById(orderId);
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async cancelDeliveryOrder(orderId, operator) {
    const order = await this.getDeliveryOrderById(orderId);
    if (!order) {
      throw new Error('配送单不存在');
    }

    if (order.status !== 'pending') {
      throw new Error('配送单状态不是待确认，无法取消');
    }

    await db.beginTransaction();
    try {
      await db.run(
        `UPDATE delivery_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ['cancelled', orderId]
      );

      for (const bucket of order.buckets) {
        await db.run(
          `UPDATE buckets SET status = ?, customer_id = NULL, current_delivery_id = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          ['in_stock', bucket.bucket_id]
        );
      }

      await db.run(
        `UPDATE customers 
         SET frozen_deposit = frozen_deposit - ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [order.deposit_amount, order.customer_id]
      );

      await this.addStatusHistory('delivery_order', orderId, 'pending', 'cancelled', operator || 'system', '配送单已取消，押金解冻');

      await db.commit();

      return await this.getDeliveryOrderById(orderId);
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async getDeliveryOrderById(orderId) {
    const order = await db.get('SELECT * FROM delivery_orders WHERE id = ?', [orderId]);
    if (order) {
      order.buckets = await db.all(
        'SELECT * FROM deposit_orders_buckets WHERE delivery_order_id = ?',
        [orderId]
      );
    }
    return order;
  }

  async getDeliveryOrderByNo(orderNo) {
    const order = await db.get('SELECT * FROM delivery_orders WHERE order_no = ?', [orderNo]);
    if (order) {
      order.buckets = await db.all(
        'SELECT * FROM deposit_orders_buckets WHERE delivery_order_id = ?',
        [order.id]
      );
    }
    return order;
  }

  async createReturnRecord(data) {
    const customer = await this.getCustomerById(data.customer_id);
    if (!customer) {
      throw new Error('客户不存在');
    }

    const bucketNos = data.bucket_nos || [];
    const buckets = await Promise.all(
      bucketNos.map(no => db.get('SELECT * FROM buckets WHERE bucket_no = ? AND status = ? AND customer_id = ?', 
        [no, 'in_use', data.customer_id]))
    );

    const invalidBuckets = bucketNos.filter((_, i) => !buckets[i]);
    if (invalidBuckets.length > 0) {
      throw new Error(`桶号 ${invalidBuckets.join(', ')} 不存在或不属于当前客户`);
    }

    const refundAmount = buckets.length * BUCKET_DEPOSIT_PER_UNIT;
    const deductionAmount = data.deduction_amount || 0;
    const actualRefund = refundAmount - deductionAmount;

    if (customer.available_deposit < actualRefund) {
      throw new Error('可用押金不足，无法退款');
    }

    await db.beginTransaction();
    try {
      const returnId = uuidv4();
      const returnNo = await this.generateOrderNo('RT');

      await db.run(
        `INSERT INTO return_records 
         (id, return_no, customer_id, customer_name, bucket_count, refund_amount, deduction_amount, 
          deduction_reason, bucket_ids, bucket_nos, operator, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [returnId, returnNo, data.customer_id, customer.name, buckets.length, refundAmount, 
         deductionAmount, data.deduction_reason || '', buckets.map(b => b.id).join(','), 
         bucketNos.join(','), data.operator || 'system', data.remark || '退桶']
      );

      for (const bucket of buckets) {
        await db.run(
          `UPDATE buckets SET status = ?, customer_id = NULL, current_delivery_id = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          ['in_stock', bucket.id]
        );
      }

      const transactionNo = await this.generateOrderNo('TX');
      if (await this.checkDuplicateTransaction(transactionNo)) {
        throw new Error('交易流水号重复，请重试');
      }

      await db.run(
        `INSERT INTO deposit_transactions 
         (id, transaction_no, customer_id, customer_name, type, amount, related_order_id, related_order_no, 
          bucket_ids, bucket_nos, before_balance, after_balance, operator, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), transactionNo, data.customer_id, customer.name, 'refund', -actualRefund, 
         returnId, returnNo, buckets.map(b => b.id).join(','), bucketNos.join(','),
         customer.total_deposit, customer.total_deposit - actualRefund, data.operator || 'system', 
         `退桶退款，扣款${deductionAmount}元：${data.deduction_reason || ''}`]
      );

      await this.updateCustomerDeposit(data.customer_id, -actualRefund, -buckets.length);
      await this.addStatusHistory('return_record', returnId, null, 'completed', data.operator || 'system', '退桶完成');

      await db.commit();

      return await this.getReturnRecordById(returnId);
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async getReturnRecordById(returnId) {
    return await db.get('SELECT * FROM return_records WHERE id = ?', [returnId]);
  }

  async addStatusHistory(entityType, entityId, fromStatus, toStatus, operator, remark) {
    await db.run(
      `INSERT INTO status_history (id, entity_type, entity_id, from_status, to_status, operator, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), entityType, entityId, fromStatus, toStatus, operator, remark]
    );
  }

  async getStatusHistory(entityType, entityId) {
    return await db.all(
      'SELECT * FROM status_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
      [entityType, entityId]
    );
  }

  async logException(apiPath, requestData, errorType, errorMessage) {
    const exceptionId = uuidv4();
    const requestId = uuidv4();
    await db.run(
      `INSERT INTO exception_logs 
       (id, request_id, api_path, request_data, error_type, error_message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [exceptionId, requestId, apiPath, JSON.stringify(requestData), errorType, errorMessage, 'pending']
    );
    return { exceptionId, requestId };
  }

  async handleException(exceptionId, handlingResult, handledBy) {
    const exception = await db.get('SELECT * FROM exception_logs WHERE id = ?', [exceptionId]);
    if (!exception) {
      throw new Error('异常记录不存在');
    }

    await db.run(
      `UPDATE exception_logs 
       SET handling_result = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP, status = ?
       WHERE id = ?`,
      [handlingResult, handledBy, 'handled', exceptionId]
    );

    return await db.get('SELECT * FROM exception_logs WHERE id = ?', [exceptionId]);
  }

  async createManualCorrection(data) {
    const customer = await this.getCustomerById(data.customer_id);
    if (!customer) {
      throw new Error('客户不存在');
    }

    const correctionId = uuidv4();
    const correctionNo = await this.generateOrderNo('MC');

    let beforeValue, afterValue;
    switch (data.correction_type) {
      case 'deposit':
        beforeValue = customer.total_deposit;
        afterValue = data.after_value;
        break;
      case 'bucket_count':
        beforeValue = customer.bucket_count;
        afterValue = data.after_value;
        break;
      default:
        throw new Error('不支持的修正类型');
    }

    await db.beginTransaction();
    try {
      await db.run(
        `INSERT INTO manual_corrections 
         (id, correction_no, customer_id, correction_type, before_value, after_value, reason, operator, related_exception_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [correctionId, correctionNo, data.customer_id, data.correction_type, 
         beforeValue, afterValue, data.reason, data.operator, data.related_exception_id || null]
      );

      if (data.correction_type === 'deposit') {
        const change = afterValue - beforeValue;
        await db.run(
          `UPDATE customers 
           SET total_deposit = ?, available_deposit = available_deposit + ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [afterValue, change, data.customer_id]
        );

        const transactionNo = await this.generateOrderNo('TX');
        if (await this.checkDuplicateTransaction(transactionNo)) {
          throw new Error('交易流水号重复，请重试');
        }

        await db.run(
          `INSERT INTO deposit_transactions 
           (id, transaction_no, customer_id, customer_name, type, amount, before_balance, after_balance, operator, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), transactionNo, data.customer_id, customer.name, 'manual_correction', 
           change, beforeValue, afterValue, data.operator, `人工修正：${data.reason}`]
        );
      } else if (data.correction_type === 'bucket_count') {
        await db.run(
          `UPDATE customers SET bucket_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [afterValue, data.customer_id]
        );
      }

      await this.addStatusHistory('manual_correction', correctionId, null, 'approved', 
        data.operator, `人工修正：${data.reason}`);

      if (data.related_exception_id) {
        await this.handleException(data.related_exception_id, `已人工修正：${data.reason}`, data.operator);
      }

      await db.commit();

      return await db.get('SELECT * FROM manual_corrections WHERE id = ?', [correctionId]);
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async getDepositReport(params = {}) {
    const { startDate, endDate, customerId } = params;
    let sql = `SELECT * FROM deposit_transactions WHERE 1=1`;
    let countSql = `SELECT COUNT(*) as total FROM deposit_transactions WHERE 1=1`;
    let paramsArray = [];

    if (startDate) {
      sql += ` AND created_at >= ?`;
      countSql += ` AND created_at >= ?`;
      paramsArray.push(startDate);
    }
    if (endDate) {
      sql += ` AND created_at <= ?`;
      countSql += ` AND created_at <= ?`;
      paramsArray.push(endDate + ' 23:59:59');
    }
    if (customerId) {
      sql += ` AND customer_id = ?`;
      countSql += ` AND customer_id = ?`;
      paramsArray.push(customerId);
    }

    sql += ` ORDER BY created_at DESC`;

    const transactions = await db.all(sql, paramsArray);
    const countResult = await db.get(countSql, paramsArray);

    const summary = await db.get(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposit,
        COALESCE(SUM(CASE WHEN type = 'refund' THEN ABS(amount) ELSE 0 END), 0) as total_refund,
        COALESCE(SUM(CASE WHEN type = 'manual_correction' THEN amount ELSE 0 END), 0) as total_correction
       FROM deposit_transactions
       WHERE 1=1
       ${startDate ? ' AND created_at >= ?' : ''}
       ${endDate ? ' AND created_at <= ?' : ''}
       ${customerId ? ' AND customer_id = ?' : ''}`,
      paramsArray
    );

    return {
      transactions,
      summary,
      total: countResult.total
    };
  }

  async listCustomers(params = {}) {
    const { page = 1, pageSize = 20, keyword } = params;
    const offset = (page - 1) * pageSize;
    
    let sql = 'SELECT * FROM customers WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM customers WHERE 1=1';
    let paramsArray = [];

    if (keyword) {
      sql += ' AND (name LIKE ? OR phone LIKE ?)';
      countSql += ' AND (name LIKE ? OR phone LIKE ?)';
      paramsArray.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    paramsArray.push(pageSize, offset);

    const customers = await db.all(sql, paramsArray);
    const countResult = await db.get(countSql, paramsArray.slice(0, paramsArray.length - 2));

    return {
      customers,
      total: countResult.total,
      page,
      pageSize
    };
  }

  async listBuckets(params = {}) {
    const { status, customerId } = params;
    let sql = 'SELECT * FROM buckets WHERE 1=1';
    let paramsArray = [];

    if (status) {
      sql += ' AND status = ?';
      paramsArray.push(status);
    }
    if (customerId) {
      sql += ' AND customer_id = ?';
      paramsArray.push(customerId);
    }

    sql += ' ORDER BY created_at DESC';

    return await db.all(sql, paramsArray);
  }

  async listExceptions(params = {}) {
    const { status } = params;
    let sql = 'SELECT * FROM exception_logs WHERE 1=1';
    let paramsArray = [];

    if (status) {
      sql += ' AND status = ?';
      paramsArray.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    return await db.all(sql, paramsArray);
  }
}

module.exports = new DepositService();
