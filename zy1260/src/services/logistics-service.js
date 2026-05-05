const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const LogisticsService = {
  getShipment: (shipmentNo) => {
    return db.prepare(`
      SELECT * FROM shipments WHERE shipment_no = ?
    `).get(shipmentNo);
  },

  prepare: (transactionId, fromAddress, toAddress, items) => {
    const shipmentNo = `SHP_${uuidv4().substring(0, 8).toUpperCase()}`;
    
    db.prepare(`
      INSERT INTO shipments (transaction_id, shipment_no, from_address, to_address, items, status)
      VALUES (?, ?, ?, ?, ?, 'PREPARED')
    `).run(transactionId, shipmentNo, fromAddress, toAddress, JSON.stringify(items));

    db.prepare(`
      INSERT INTO logistics_operations (transaction_id, shipment_no, operation_type, status)
      VALUES (?, ?, 'PREPARE', 'SUCCESS')
    `).run(transactionId, shipmentNo);

    return {
      success: true,
      shipmentNo,
      fromAddress,
      toAddress,
      items,
      action: 'PREPARE',
      message: `生成运单 ${shipmentNo}，状态: PREPARED`
    };
  },

  confirm: (transactionId, shipmentNo) => {
    db.prepare(`
      UPDATE shipments SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP
      WHERE shipment_no = ?
    `).run(shipmentNo);

    db.prepare(`
      INSERT INTO logistics_operations (transaction_id, shipment_no, operation_type, status)
      VALUES (?, ?, 'CONFIRM', 'SUCCESS')
    `).run(transactionId, shipmentNo);

    return {
      success: true,
      shipmentNo,
      action: 'CONFIRM',
      message: `确认运单 ${shipmentNo}，状态: CONFIRMED`
    };
  },

  cancel: (transactionId, shipmentNo) => {
    db.prepare(`
      UPDATE shipments SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
      WHERE shipment_no = ?
    `).run(shipmentNo);

    db.prepare(`
      INSERT INTO logistics_operations (transaction_id, shipment_no, operation_type, status)
      VALUES (?, ?, 'CANCEL', 'SUCCESS')
    `).run(transactionId, shipmentNo);

    return {
      success: true,
      shipmentNo,
      action: 'CANCEL',
      message: `取消运单 ${shipmentNo}，状态: CANCELLED`
    };
  },

  getShipmentByTransaction: (transactionId) => {
    return db.prepare(`
      SELECT * FROM shipments WHERE transaction_id = ?
    `).get(transactionId);
  },

  getOperationHistory: (transactionId) => {
    return db.prepare(`
      SELECT * FROM logistics_operations WHERE transaction_id = ? ORDER BY created_at ASC
    `).all(transactionId);
  },

  listAllShipments: () => {
    return db.prepare('SELECT * FROM shipments ORDER BY created_at DESC').all();
  }
};

module.exports = LogisticsService;
