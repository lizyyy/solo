const db = require('../database');
const logService = require('./logService');
const batchService = require('./batchService');
const csv = require('csv-parser');
const { Readable } = require('stream');

class OrderService {
  async importOrdersFromCSV(csvBuffer, operator = 'system') {
    const results = [];
    const errors = [];

    await new Promise((resolve) => {
      const readable = Readable.from(csvBuffer.toString());
      readable
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve);
    });

    const { batchId, batchNo } = await batchService.createBatch('import_order', results.length);

    const successOrders = [];
    const failOrders = [];

    for (const row of results) {
      try {
        const orderNo = row.order_no || row.订单号;
        if (!orderNo) {
          throw new Error('缺少订单号');
        }

        const existingOrder = await db.get('SELECT id FROM orders WHERE order_no = ?', [orderNo]);
        if (existingOrder) {
          await batchService.addBatchItem(batchId, orderNo, 'success', '订单已存在，跳过导入');
          await logService.log('import_order', 'skip', '订单已存在，跳过导入', {
            batchId,
            orderId: existingOrder.id,
            operator,
            details: { orderNo }
          });
          successOrders.push({ orderNo, status: 'skipped', reason: '订单已存在' });
          continue;
        }

        const order = await this.createOrderFromRow(row, operator);
        await batchService.addBatchItem(batchId, orderNo, 'success', '导入成功');
        await logService.log('import_order', 'success', '订单导入成功', {
          batchId,
          orderId: order.id,
          operator,
          details: { orderNo }
        });
        successOrders.push({ orderNo, status: 'success', orderId: order.id });
      } catch (error) {
        const orderNo = row.order_no || row.订单号 || 'unknown';
        await batchService.addBatchItem(batchId, orderNo, 'fail', error.message);
        await logService.log('import_order', 'fail', error.message, {
          batchId,
          operator,
          details: { row, error: error.message }
        });
        failOrders.push({ orderNo, error: error.message });
      }
    }

    const batchResult = await batchService.completeBatch(batchId);

    return {
      batchId,
      batchNo,
      total: results.length,
      success: successOrders.length,
      fail: failOrders.length,
      successOrders,
      failOrders
    };
  }

  async createOrderFromRow(row, operator) {
    const orderId = db.generateId();
    const now = db.now();

    const orderNo = row.order_no || row.订单号;
    const groupLeaderId = row.group_leader_id || row.团长ID;
    const groupLeaderName = row.group_leader_name || row.团长姓名;
    const userId = row.user_id || row.用户ID;
    const userName = row.user_name || row.用户姓名;
    const totalAmount = parseFloat(row.total_amount || row.订单金额) || 0;
    const createdAt = row.created_at || row.下单时间 || now;

    await db.run(
      `INSERT INTO orders (
        id, order_no, group_leader_id, group_leader_name, user_id, user_name,
        total_amount, status, has_exception, imported_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
      [orderId, orderNo, groupLeaderId, groupLeaderName, userId, userName,
       totalAmount, now, createdAt, now]
    );

    if (row.products) {
      const products = JSON.parse(row.products);
      for (const product of products) {
        await this.createOrderItem(orderId, product, operator);
      }
    } else if (row.product_id || row.商品ID) {
      const product = {
        product_id: row.product_id || row.商品ID,
        product_name: row.product_name || row.商品名称,
        sku_id: row.sku_id || row.SKU_ID,
        sku_name: row.sku_name || row.SKU名称,
        quantity: parseInt(row.quantity || row.数量) || 1,
        unit_price: parseFloat(row.unit_price || row.单价) || 0,
        subtotal: parseFloat(row.subtotal || row.小计) || 0,
        is_out_of_stock: (row.is_out_of_stock || row.是否缺货) === '1' || (row.is_out_of_stock || row.是否缺货) === 'true'
      };
      await this.createOrderItem(orderId, product, operator);
    }

    return { id: orderId, orderNo };
  }

  async createOrderItem(orderId, product, operator) {
    const itemId = db.generateId();
    const now = db.now();

    await db.run(
      `INSERT INTO order_items (
        id, order_id, product_id, product_name, sku_id, sku_name,
        quantity, unit_price, subtotal, is_out_of_stock, compensation_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'none', ?, ?)`,
      [
        itemId, orderId,
        product.product_id, product.product_name,
        product.sku_id, product.sku_name,
        product.quantity, product.unit_price, product.subtotal,
        product.is_out_of_stock ? 1 : 0,
        now, now
      ]
    );

    if (product.is_out_of_stock) {
      await db.run(
        'UPDATE orders SET has_exception = 1, exception_reason = ? WHERE id = ?',
        ['包含缺货商品', orderId]
      );
      await logService.log('stock_check', 'exception', '检测到缺货商品', {
        orderId,
        orderItemId: itemId,
        operator,
        details: product
      });
    }

    return itemId;
  }

  async detectStockIssues(orderId, stockInfo) {
    const orderItems = await db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    let hasIssue = false;

    for (const item of orderItems) {
      const stock = stockInfo.find(s => 
        s.product_id === item.product_id && (!s.sku_id || s.sku_id === item.sku_id)
      );

      if (stock && stock.available_quantity < item.quantity) {
        hasIssue = true;
        await db.run(
          `UPDATE order_items 
           SET is_out_of_stock = 1, stock_quantity = ?, updated_at = ?
           WHERE id = ?`,
          [stock.available_quantity, db.now(), item.id]
        );

        await logService.log('stock_check', 'exception', 
          `库存不足，需求${item.quantity}，可用${stock.available_quantity}`, {
          orderId,
          orderItemId: item.id,
          details: { requested: item.quantity, available: stock.available_quantity }
        });
      }
    }

    if (hasIssue) {
      await db.run(
        'UPDATE orders SET has_exception = 1, exception_reason = ?, status = ? WHERE id = ?',
        ['包含缺货商品', 'exception', orderId]
      );
    }

    return hasIssue;
  }

  async getOrderDetail(orderId) {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return null;

    const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    const compensations = await db.all('SELECT * FROM compensations WHERE order_id = ?', [orderId]);
    const logs = await logService.getLogsByOrder(orderId);

    return { order, items, compensations, logs };
  }

  async getOrders(filters = {}) {
    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (filters.has_exception !== undefined) {
      sql += ' AND has_exception = ?';
      params.push(filters.has_exception ? 1 : 0);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.group_leader_id) {
      sql += ' AND group_leader_id = ?';
      params.push(filters.group_leader_id);
    }

    sql += ' ORDER BY created_at DESC';

    return await db.all(sql, params);
  }
}

module.exports = new OrderService();
