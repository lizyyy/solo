const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const { recordStatusHistory } = require('./utils/history');
function generateSampleData() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const activityId1 = uuidv4();
      const activityId2 = uuidv4();
      db.run(
        `INSERT INTO activities (id, name, threshold_amount, gift_product_id, gift_quantity, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [activityId1, '满99送精美礼品A', 99, 'GIFT001', 1, 'active']
      );
      db.run(
        `INSERT INTO activities (id, name, threshold_amount, gift_product_id, gift_quantity, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [activityId2, '满199送豪华礼品B', 199, 'GIFT002', 1, 'active']
      );
      const inventoryId1 = uuidv4();
      const inventoryId2 = uuidv4();
      db.run(
        `INSERT INTO gift_inventory (id, product_id, product_name, total_quantity, used_quantity, available_quantity)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [inventoryId1, 'GIFT001', '精美保温杯', 100, 45, 55]
      );
      db.run(
        `INSERT INTO gift_inventory (id, product_id, product_name, total_quantity, used_quantity, available_quantity)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [inventoryId2, 'GIFT002', '豪华无线耳机', 50, 20, 30]
      );
      const orders = [
        { id: uuidv4(), order_no: 'ORD202401001', user_id: 'U001', user_name: '张三', total_amount: 150, activity_id: activityId1, gift_qualified: 1, gift_product_id: 'GIFT001', gift_quantity: 1, status: 'gift_qualified' },
        { id: uuidv4(), order_no: 'ORD202401002', user_id: 'U002', user_name: '李四', total_amount: 250, activity_id: activityId2, gift_qualified: 1, gift_product_id: 'GIFT002', gift_quantity: 1, status: 'gift_qualified' },
        { id: uuidv4(), order_no: 'ORD202401003', user_id: 'U003', user_name: '王五', total_amount: 80, activity_id: activityId1, gift_qualified: 0, gift_product_id: null, gift_quantity: 0, status: 'gift_not_qualified' },
        { id: uuidv4(), order_no: 'ORD202401004', user_id: 'U004', user_name: '赵六', total_amount: 300, activity_id: activityId2, gift_qualified: 1, gift_product_id: 'GIFT002', gift_quantity: 1, status: 'split' },
        { id: uuidv4(), order_no: 'ORD202401005', user_id: 'U005', user_name: '钱七', total_amount: 180, activity_id: activityId1, gift_qualified: 0, gift_product_id: null, gift_quantity: 0, status: 'gift_cancelled' },
      ];
      const orderItems = [
        { id: uuidv4(), order_id: orders[0].id, product_id: 'P001', product_name: '商品A', price: 50, quantity: 2, amount: 100, is_gift: 0 },
        { id: uuidv4(), order_id: orders[0].id, product_id: 'GIFT001', product_name: '精美保温杯', price: 0, quantity: 1, amount: 0, is_gift: 1 },
        { id: uuidv4(), order_id: orders[1].id, product_id: 'P002', product_name: '商品B', price: 250, quantity: 1, amount: 250, is_gift: 0 },
        { id: uuidv4(), order_id: orders[1].id, product_id: 'GIFT002', product_name: '豪华无线耳机', price: 0, quantity: 1, amount: 0, is_gift: 1 },
        { id: uuidv4(), order_id: orders[2].id, product_id: 'P003', product_name: '商品C', price: 80, quantity: 1, amount: 80, is_gift: 0 },
        { id: uuidv4(), order_id: orders[3].id, product_id: 'P004', product_name: '商品D', price: 300, quantity: 1, amount: 300, is_gift: 0 },
        { id: uuidv4(), order_id: orders[3].id, product_id: 'GIFT002', product_name: '豪华无线耳机', price: 0, quantity: 1, amount: 0, is_gift: 1 },
        { id: uuidv4(), order_id: orders[4].id, product_id: 'P005', product_name: '商品E', price: 180, quantity: 1, amount: 180, is_gift: 0 },
      ];
      const orderStmt = db.prepare(`
        INSERT INTO orders (id, order_no, user_id, user_name, total_amount, activity_id, gift_qualified, gift_product_id, gift_quantity, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      orders.forEach(order => {
        orderStmt.run(order.id, order.order_no, order.user_id, order.user_name, order.total_amount, order.activity_id, order.gift_qualified, order.gift_product_id, order.gift_quantity, order.status);
      });
      orderStmt.finalize();
      const itemStmt = db.prepare(`
        INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, amount, is_gift)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      orderItems.forEach(item => {
        itemStmt.run(item.id, item.order_id, item.product_id, item.product_name, item.price, item.quantity, item.amount, item.is_gift);
      });
      itemStmt.finalize();
      const splitOrders = [
        { id: uuidv4(), parent_order_id: orders[3].id, split_order_no: 'SPLIT202401001', split_type: 'warehouse_split', total_amount: 300, created_by: 'admin' },
      ];
      const splitStmt = db.prepare(`
        INSERT INTO split_orders (id, parent_order_id, split_order_no, split_type, total_amount, status, created_by)
        VALUES (?, ?, ?, ?, ?, 'completed', ?)
      `);
      splitOrders.forEach(split => {
        splitStmt.run(split.id, split.parent_order_id, split.split_order_no, split.split_type, split.total_amount, split.created_by);
      });
      splitStmt.finalize();
      const refunds = [
        { id: uuidv4(), order_id: orders[4].id, order_item_id: orderItems[7].id, refund_no: 'REF202401001', refund_type: 'partial', refund_amount: 50, refund_quantity: 0, reason: '商品瑕疵', operator: '客服小明', affect_gift: 1 },
        { id: uuidv4(), order_id: orders[1].id, order_item_id: orderItems[2].id, refund_no: 'REF202401002', refund_type: 'partial', refund_amount: 20, refund_quantity: 0, reason: '差价退款', operator: '客服小红', affect_gift: 0 },
      ];
      const refundStmt = db.prepare(`
        INSERT INTO refunds (id, order_id, order_item_id, refund_no, refund_type, refund_amount, refund_quantity, reason, operator, status, affect_gift)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
      `);
      refunds.forEach(refund => {
        refundStmt.run(refund.id, refund.order_id, refund.order_item_id, refund.refund_no, refund.refund_type, refund.refund_amount, refund.refund_quantity, refund.reason, refund.operator, refund.affect_gift);
      });
      refundStmt.finalize();
      const manualGifts = [
        { id: uuidv4(), order_id: orders[2].id, user_id: 'U003', gift_product_id: 'GIFT001', gift_product_name: '精美保温杯', gift_quantity: 1, reason: 'VIP客户补偿', operator: '主管老王' },
      ];
      const manualStmt = db.prepare(`
        INSERT INTO manual_gifts (id, order_id, user_id, gift_product_id, gift_product_name, gift_quantity, reason, operator, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')
      `);
      manualGifts.forEach(gift => {
        manualStmt.run(gift.id, gift.order_id, gift.user_id, gift.gift_product_id, gift.gift_product_name, gift.gift_quantity, gift.reason, gift.operator);
      });
      manualStmt.finalize();
      const recalculations = [
        { id: uuidv4(), order_id: orders[4].id, recalculate_type: 'refund', before_data: JSON.stringify({ gift_qualified: 1, gift_quantity: 1 }), after_data: JSON.stringify({ gift_qualified: 0, gift_quantity: 0 }), result: 'not_qualified', operator: '系统' },
      ];
      const recalcStmt = db.prepare(`
        INSERT INTO qualification_recalculations (id, order_id, recalculate_type, before_data, after_data, result, operator)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      recalculations.forEach(recalc => {
        recalcStmt.run(recalc.id, recalc.order_id, recalc.recalculate_type, recalc.before_data, recalc.after_data, recalc.result, recalc.operator);
      });
      recalcStmt.finalize();
      const historyRecords = [
        { id: uuidv4(), business_type: 'order', business_id: orders[0].id, before_status: 'pending', after_status: 'gift_qualified', before_value: null, after_value: JSON.stringify({ gift_qualified: 1 }), operator: '系统', remark: '订单满足赠品资格' },
        { id: uuidv4(), business_type: 'order', business_id: orders[1].id, before_status: 'pending', after_status: 'gift_qualified', before_value: null, after_value: JSON.stringify({ gift_qualified: 1 }), operator: '系统', remark: '订单满足赠品资格' },
        { id: uuidv4(), business_type: 'order', business_id: orders[2].id, before_status: 'pending', after_status: 'gift_not_qualified', before_value: null, after_value: JSON.stringify({ gift_qualified: 0 }), operator: '系统', remark: '订单金额未达到门槛' },
        { id: uuidv4(), business_type: 'order', business_id: orders[3].id, before_status: 'gift_qualified', after_status: 'split', before_value: null, after_value: JSON.stringify({ status: 'split' }), operator: 'admin', remark: '订单已拆单' },
        { id: uuidv4(), business_type: 'order', business_id: orders[4].id, before_status: 'gift_qualified', after_status: 'gift_cancelled', before_value: JSON.stringify({ gift_qualified: 1 }), after_value: JSON.stringify({ gift_qualified: 0 }), operator: '客服小明', remark: '退款导致赠品资格取消' },
        { id: uuidv4(), business_type: 'inventory', business_id: inventoryId1, before_status: 'available', after_status: 'deduct', before_value: JSON.stringify({ available_quantity: 56 }), after_value: JSON.stringify({ available_quantity: 55 }), operator: '系统', remark: '订单扣减库存' },
        { id: uuidv4(), business_type: 'inventory', business_id: inventoryId2, before_status: 'available', after_status: 'deduct', before_value: JSON.stringify({ available_quantity: 32 }), after_value: JSON.stringify({ available_quantity: 30 }), operator: '系统', remark: '订单扣减库存' },
        { id: uuidv4(), business_type: 'inventory', business_id: inventoryId1, before_status: 'available', after_status: 'deduct', before_value: JSON.stringify({ available_quantity: 55 }), after_value: JSON.stringify({ available_quantity: 54 }), operator: '主管老王', remark: '人工补赠扣减库存' },
        { id: uuidv4(), business_type: 'manual_gift', business_id: manualGifts[0].id, before_status: null, after_status: 'approved', before_value: null, after_value: null, operator: '主管老王', remark: 'VIP客户补偿' },
        { id: uuidv4(), business_type: 'refund', business_id: refunds[0].id, before_status: null, after_status: 'approved', before_value: null, after_value: null, operator: '客服小明', remark: '商品瑕疵，影响赠品: 是' },
      ];
      const historyStmt = db.prepare(`
        INSERT INTO status_history (id, business_type, business_id, before_status, after_status, before_value, after_value, operator, remark, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      historyRecords.forEach(record => {
        historyStmt.run(record.id, record.business_type, record.business_id, record.before_status, record.after_status, record.before_value, record.after_value, record.operator, record.remark);
      });
      historyStmt.finalize();
      db.run('COMMIT', (err) => {
        if (err) {
          db.run('ROLLBACK');
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}
if (require.main === module) {
  console.log('正在生成样例数据...');
  generateSampleData()
    .then(() => {
      console.log('样例数据生成完成！');
      process.exit(0);
    })
    .catch(err => {
      console.error('样例数据生成失败:', err);
      process.exit(1);
    });
}
module.exports = { generateSampleData };
