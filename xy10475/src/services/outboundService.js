const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const ORDER_STATUS = {
  PENDING: 'pending',
  RECEIVING: 'receiving',
  RECEIVED: 'received',
  CHECKING: 'checking',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const SCAN_RESULT = {
  SUCCESS: 'success',
  ERROR_WRONG_SKU: 'error_wrong_sku',
  ERROR_DUPLICATE: 'error_duplicate',
  ERROR_OVERSCAN: 'error_overscan',
  ERROR_ORDER_CANCELLED: 'error_order_cancelled',
  ERROR_ORDER_COMPLETED: 'error_order_completed'
};

const createOrder = (userId, orderNo, items = []) => {
  const tx = db.transaction(() => {
    const orderId = uuidv4();
    
    db.prepare(`
      INSERT INTO outbound_orders (id, order_no, status, total_items, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(orderId, orderNo, ORDER_STATUS.PENDING, 0, userId);

    addOperationLog(orderId, userId, 'CREATE_ORDER', `Created order ${orderNo}`);

    if (items.length > 0) {
      importItems(orderId, userId, items);
    }

    return getOrderById(orderId);
  });

  return tx();
};

const importItems = (orderId, userId, items) => {
  const order = getOrderById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }
  if (order.status !== ORDER_STATUS.PENDING) {
    throw new Error('Can only import items to pending orders');
  }

  const tx = db.transaction(() => {
    const insertItem = db.prepare(`
      INSERT INTO order_items (id, order_id, sku, barcode, product_name, expected_qty)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let totalQty = 0;
    for (const item of items) {
      if (!item.sku || !item.barcode || !item.expected_qty) {
        throw new Error('Each item requires sku, barcode, and expected_qty');
      }
      insertItem.run(
        uuidv4(),
        orderId,
        item.sku,
        item.barcode,
        item.product_name || item.sku,
        item.expected_qty
      );
      totalQty += item.expected_qty;
    }

    const existingItems = getOrderItems(orderId);
    const totalItems = existingItems.reduce((sum, i) => sum + i.expected_qty, 0);

    db.prepare(`
      UPDATE outbound_orders 
      SET status = ?, total_items = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(ORDER_STATUS.RECEIVING, totalItems, orderId);

    addOperationLog(orderId, userId, 'IMPORT_ITEMS', `Imported ${items.length} items`);

    return getOrderById(orderId);
  });

  return tx();
};

const getOrderById = (orderId) => {
  return db.prepare(`
    SELECT * FROM outbound_orders WHERE id = ?
  `).get(orderId);
};

const getOrderByNo = (orderNo) => {
  return db.prepare(`
    SELECT * FROM outbound_orders WHERE order_no = ?
  `).get(orderNo);
};

const getOrderItems = (orderId) => {
  return db.prepare(`
    SELECT * FROM order_items WHERE order_id = ? ORDER BY id
  `).all(orderId);
};

const scanItem = (orderId, userId, barcode) => {
  const order = getOrderById(orderId);
  
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.status === ORDER_STATUS.CANCELLED) {
    const scanId = uuidv4();
    db.prepare(`
      INSERT INTO scan_records (id, order_id, scanner_id, barcode, scan_result, error_type, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(scanId, orderId, userId, barcode, SCAN_RESULT.ERROR_ORDER_CANCELLED, 'ORDER_CANCELLED', 'Order has been cancelled');
    
    return {
      success: false,
      error: 'ORDER_CANCELLED',
      message: 'This order has been cancelled',
      scanId
    };
  }

  if (order.status === ORDER_STATUS.COMPLETED) {
    const scanId = uuidv4();
    db.prepare(`
      INSERT INTO scan_records (id, order_id, scanner_id, barcode, scan_result, error_type, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(scanId, orderId, userId, barcode, SCAN_RESULT.ERROR_ORDER_COMPLETED, 'ORDER_COMPLETED', 'Order has been completed');
    
    return {
      success: false,
      error: 'ORDER_COMPLETED',
      message: 'This order has already been completed',
      scanId
    };
  }

  const matchingItems = db.prepare(`
    SELECT * FROM order_items WHERE order_id = ? AND barcode = ?
  `).all(orderId, barcode);

  const scanId = uuidv4();

  if (matchingItems.length === 0) {
    db.prepare(`
      INSERT INTO scan_records (id, order_id, scanner_id, barcode, scan_result, error_type, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(scanId, orderId, userId, barcode, SCAN_RESULT.ERROR_WRONG_SKU, 'WRONG_SKU', `Barcode ${barcode} not found in order`);
    
    addOperationLog(orderId, userId, 'SCAN_ERROR', `Wrong SKU: ${barcode}`);

    return {
      success: false,
      error: 'WRONG_SKU',
      message: `Barcode ${barcode} is not in this order`,
      scanId
    };
  }

  const incompleteItem = matchingItems.find(item => item.scanned_qty < item.expected_qty);

  if (!incompleteItem) {
    const itemId = matchingItems[0].id;
    db.prepare(`
      INSERT INTO scan_records (id, order_id, item_id, scanner_id, barcode, scan_result, error_type, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(scanId, orderId, itemId, userId, barcode, SCAN_RESULT.ERROR_OVERSCAN, 'OVERSCAN', `Item ${barcode} already fully scanned`);
    
    addOperationLog(orderId, userId, 'SCAN_ERROR', `Overscan: ${barcode}`);

    return {
      success: false,
      error: 'OVERSCAN',
      message: `All quantity of ${barcode} has already been scanned`,
      scanId
    };
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE order_items SET scanned_qty = scanned_qty + 1 WHERE id = ?
    `).run(incompleteItem.id);

    db.prepare(`
      INSERT INTO scan_records (id, order_id, item_id, scanner_id, barcode, scan_result)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(scanId, orderId, incompleteItem.id, userId, barcode, SCAN_RESULT.SUCCESS);

    const items = getOrderItems(orderId);
    const totalScanned = items.reduce((sum, i) => sum + i.scanned_qty, 0);
    const totalExpected = items.reduce((sum, i) => sum + i.expected_qty, 0);

    let newStatus = ORDER_STATUS.CHECKING;
    if (totalScanned === totalExpected) {
      newStatus = ORDER_STATUS.RECEIVED;
    }

    db.prepare(`
      UPDATE outbound_orders 
      SET scanned_items = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(totalScanned, newStatus, orderId);

    return {
      success: true,
      message: `Scanned ${incompleteItem.product_name} (${incompleteItem.sku})`,
      item: {
        id: incompleteItem.id,
        sku: incompleteItem.sku,
        barcode: incompleteItem.barcode,
        productName: incompleteItem.product_name,
        scannedQty: incompleteItem.scanned_qty + 1,
        expectedQty: incompleteItem.expected_qty
      },
      scanId,
      orderProgress: {
        total: totalExpected,
        scanned: totalScanned + 1,
        remaining: totalExpected - totalScanned - 1,
        isComplete: (totalScanned + 1) === totalExpected
      }
    };
  });

  return tx();
};

const confirmOutbound = (orderId, userId) => {
  const order = getOrderById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.status !== ORDER_STATUS.RECEIVED) {
    const items = getOrderItems(orderId);
    const missing = items.filter(i => i.scanned_qty < i.expected_qty);
    
    if (missing.length > 0) {
      return {
        success: false,
        error: 'INCOMPLETE',
        message: 'Order not fully scanned',
        missingItems: missing.map(m => ({
          sku: m.sku,
          barcode: m.barcode,
          productName: m.product_name,
          missingQty: m.expected_qty - m.scanned_qty
        }))
      };
    }
  }

  db.prepare(`
    UPDATE outbound_orders 
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(ORDER_STATUS.COMPLETED, orderId);

  addOperationLog(orderId, userId, 'CONFIRM_OUTBOUND', 'Order confirmed for outbound');

  return {
    success: true,
    message: 'Order confirmed successfully',
    order: getOrderById(orderId)
  };
};

const cancelOrder = (orderId, userId, reason = '') => {
  const order = getOrderById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }
  if (order.status === ORDER_STATUS.COMPLETED) {
    throw new Error('Cannot cancel completed order');
  }
  if (order.status === ORDER_STATUS.CANCELLED) {
    return { success: true, message: 'Order already cancelled' };
  }

  db.prepare(`
    UPDATE outbound_orders 
    SET status = ?, cancelled_by = ?, cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(ORDER_STATUS.CANCELLED, userId, orderId);

  db.prepare(`
    UPDATE order_items SET scanned_qty = 0 WHERE order_id = ?
  `).run(orderId);

  db.prepare(`
    UPDATE outbound_orders SET scanned_items = 0 WHERE id = ?
  `).run(orderId);

  addOperationLog(orderId, userId, 'CANCEL_ORDER', reason || 'Order cancelled');

  return {
    success: true,
    message: 'Order cancelled and scan records released',
    order: getOrderById(orderId)
  };
};

const getOrderProgress = (orderId) => {
  const order = getOrderById(orderId);
  if (!order) {
    return null;
  }

  const items = getOrderItems(orderId);
  const totalScanned = items.reduce((sum, i) => sum + i.scanned_qty, 0);
  const totalExpected = items.reduce((sum, i) => sum + i.expected_qty, 0);

  const missingItems = items
    .filter(i => i.scanned_qty < i.expected_qty)
    .map(i => ({
      id: i.id,
      sku: i.sku,
      barcode: i.barcode,
      productName: i.product_name,
      expectedQty: i.expected_qty,
      scannedQty: i.scanned_qty,
      missingQty: i.expected_qty - i.scanned_qty
    }));

  const overscanItems = items
    .filter(i => i.scanned_qty > i.expected_qty)
    .map(i => ({
      id: i.id,
      sku: i.sku,
      barcode: i.barcode,
      productName: i.product_name,
      expectedQty: i.expected_qty,
      scannedQty: i.scanned_qty,
      overscanQty: i.scanned_qty - i.expected_qty
    }));

  const scanRecords = db.prepare(`
    SELECT 
      sr.*,
      u.username as scanner_name
    FROM scan_records sr
    LEFT JOIN users u ON sr.scanner_id = u.id
    WHERE sr.order_id = ?
    ORDER BY sr.created_at DESC
  `).all(orderId);

  const logs = getOperationLogs(orderId);

  return {
    order: {
      id: order.id,
      orderNo: order.order_no,
      status: order.status,
      totalItems: totalExpected,
      scannedItems: totalScanned,
      progress: totalExpected > 0 ? Math.round((totalScanned / totalExpected) * 100) : 0
    },
    items: items.map(i => ({
      id: i.id,
      sku: i.sku,
      barcode: i.barcode,
      productName: i.product_name,
      expectedQty: i.expected_qty,
      scannedQty: i.scanned_qty,
      isComplete: i.scanned_qty === i.expected_qty
    })),
    differences: {
      missing: missingItems,
      overscan: overscanItems
    },
    scanRecords,
    operationLogs: logs
  };
};

const getCheckerErrorStats = () => {
  return db.prepare(`
    SELECT 
      u.id as checker_id,
      u.username as checker_name,
      COUNT(sr.id) as total_scans,
      SUM(CASE WHEN sr.scan_result != 'success' THEN 1 ELSE 0 END) as error_count,
      ROUND(
        SUM(CASE WHEN sr.scan_result != 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(sr.id),
        2
      ) as error_rate
    FROM scan_records sr
    JOIN users u ON sr.scanner_id = u.id
    GROUP BY u.id, u.username
    ORDER BY error_rate DESC
  `).all();
};

const getCheckerErrorDetails = (checkerId) => {
  return db.prepare(`
    SELECT 
      sr.*,
      oo.order_no,
      u.username as checker_name
    FROM scan_records sr
    JOIN outbound_orders oo ON sr.order_id = oo.id
    JOIN users u ON sr.scanner_id = u.id
    WHERE sr.scanner_id = ? AND sr.scan_result != 'success'
    ORDER BY sr.created_at DESC
  `).all(checkerId);
};

const addOperationLog = (orderId, userId, action, details) => {
  db.prepare(`
    INSERT INTO operation_logs (id, order_id, user_id, action, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), orderId, userId, action, details);
};

const getOperationLogs = (orderId) => {
  return db.prepare(`
    SELECT 
      ol.*,
      u.username as operator_name
    FROM operation_logs ol
    LEFT JOIN users u ON ol.user_id = u.id
    WHERE ol.order_id = ?
    ORDER BY ol.created_at DESC
  `).all(orderId);
};

const listOrders = (status = null) => {
  let query = 'SELECT * FROM outbound_orders';
  const params = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';
  
  return db.prepare(query).all(...params);
};

module.exports = {
  ORDER_STATUS,
  SCAN_RESULT,
  createOrder,
  importItems,
  getOrderById,
  getOrderByNo,
  getOrderItems,
  scanItem,
  confirmOutbound,
  cancelOrder,
  getOrderProgress,
  getCheckerErrorStats,
  getCheckerErrorDetails,
  listOrders
};
