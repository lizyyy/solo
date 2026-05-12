const db = require('../config/database');
const historyService = require('./history');
const orderService = require('./orderService');
const inventoryService = require('./inventoryService');
const { v4: uuidv4 } = require('uuid');

const WAVE_STATUS = {
  CREATED: 'created',
  ASSIGNED: 'assigned',
  PICKING: 'picking',
  PARTIAL_PICKED: 'partial_picked',
  HAS_STOCKOUT: 'has_stockout',
  SPLITTING: 'splitting',
  TRANSFERING: 'transfering',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const STOCKOUT_STATUS = {
  PENDING: 'pending',
  SPLIT: 'split',
  TRANSFERING: 'transfering',
  TRANSFER_SUCCESS: 'transfer_success',
  TRANSFER_FAILED: 'transfer_failed',
  RETAINED: 'retained',
  RESOLVED: 'resolved'
};

const TRANSFER_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXECUTING: 'executing',
  SUCCESS: 'success',
  FAILED: 'failed',
  REJECTED: 'rejected'
};

function createWave(waveData) {
  const waveId = `wave_${uuidv4()}`;
  const waveNo = waveData.wave_no || `W${Date.now()}`;

  const transaction = db.transaction(() => {
    const warehouse = db.prepare('SELECT * FROM warehouses WHERE code = ?').get(waveData.warehouse_code);
    if (!warehouse) {
      throw new Error(`仓库 ${waveData.warehouse_code} 不存在`);
    }

    db.prepare(`
      INSERT INTO waves (id, wave_no, warehouse_id, status, order_count, total_sku_count, created_by)
      VALUES (?, ?, ?, ?, 0, 0, ?)
    `).run(
      waveId,
      waveNo,
      warehouse.id,
      WAVE_STATUS.CREATED,
      waveData.created_by || 'system'
    );

    historyService.addStatusHistory('wave', waveId, null, WAVE_STATUS.CREATED, waveData.created_by || 'system', '波次创建');
  });

  transaction();
  return getWaveById(waveId);
}

function getWaveById(waveId) {
  const wave = db.prepare(`
    SELECT w.*, wh.code as warehouse_code, wh.name as warehouse_name
    FROM waves w
    JOIN warehouses wh ON w.warehouse_id = wh.id
    WHERE w.id = ?
  `).get(waveId);

  if (!wave) return null;

  const waveOrders = db.prepare(`
    SELECT wo.*, o.order_no, o.status as order_status, o.customer_name
    FROM wave_orders wo
    JOIN orders o ON wo.order_id = o.id
    WHERE wo.wave_id = ?
    ORDER BY wo.created_at ASC
  `).all(waveId);

  const stockouts = db.prepare(`
    SELECT s.*, wh.code as warehouse_code, wh.name as warehouse_name,
           o.order_no
    FROM stockouts s
    JOIN warehouses wh ON s.warehouse_id = wh.id
    JOIN orders o ON s.order_id = o.id
    WHERE s.wave_id = ?
    ORDER BY s.created_at ASC
  `).all(waveId);

  const history = historyService.getStatusHistory('wave', waveId);
  const corrections = historyService.getManualCorrections('wave', waveId);

  return {
    ...wave,
    wave_orders: waveOrders,
    stockouts,
    history,
    manual_corrections: corrections
  };
}

function getWaveByNo(waveNo) {
  const wave = db.prepare('SELECT * FROM waves WHERE wave_no = ?').get(waveNo);
  return wave ? getWaveById(wave.id) : null;
}

function addOrdersToWave(waveId, orderNos, operator) {
  const wave = getWaveById(waveId);
  if (!wave) throw new Error('波次不存在');

  if (wave.status !== WAVE_STATUS.CREATED && wave.status !== WAVE_STATUS.ASSIGNED) {
    throw new Error(`波次状态为 ${wave.status}，无法添加订单`);
  }

  const transaction = db.transaction(() => {
    let orderCount = 0;
    let skuCount = 0;

    for (const orderNo of orderNos) {
      const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
      if (!order) {
        throw new Error(`订单 ${orderNo} 不存在`);
      }

      const existing = db.prepare('SELECT * FROM wave_orders WHERE wave_id = ? AND order_id = ?')
        .get(waveId, order.id);

      if (!existing) {
        db.prepare(`
          INSERT INTO wave_orders (id, wave_id, order_id, status)
          VALUES (?, ?, ?, 'assigned')
        `).run(`wo_${uuidv4()}`, waveId, order.id);

        orderCount++;
        const lines = db.prepare('SELECT * FROM order_lines WHERE order_id = ?').all(order.id);
        skuCount += lines.length;

        orderService.updateOrderStatus(order.id, orderService.ORDER_STATUS.WAVE_ASSIGNED, operator, `加入波次 ${wave.wave_no}`);
      }
    }

    if (orderCount > 0) {
      db.prepare(`
        UPDATE waves
        SET order_count = order_count + ?,
            total_sku_count = total_sku_count + ?,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(orderCount, skuCount, WAVE_STATUS.ASSIGNED, waveId);

      historyService.addStatusHistory('wave', waveId, wave.status, WAVE_STATUS.ASSIGNED, operator, `添加 ${orderCount} 个订单`);
    }
  });

  transaction();
  return getWaveById(waveId);
}

function startPicking(waveId, operator) {
  const wave = getWaveById(waveId);
  if (!wave) throw new Error('波次不存在');

  const validStatuses = [WAVE_STATUS.ASSIGNED, WAVE_STATUS.HAS_STOCKOUT, WAVE_STATUS.PARTIAL_PICKED];
  if (!validStatuses.includes(wave.status)) {
    throw new Error(`波次状态为 ${wave.status}，无法开始拣货`);
  }

  const transaction = db.transaction(() => {
    const waveOrders = db.prepare('SELECT * FROM wave_orders WHERE wave_id = ?').all(waveId);

    for (const wo of waveOrders) {
      const lines = db.prepare(`
        SELECT ol.* FROM order_lines ol
        WHERE ol.order_id = ? AND ol.status NOT IN ('shipped', 'cancelled', 'picked')
      `).all(wo.order_id);

      for (const line of lines) {
        const inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND sku_id = ?')
          .get(wave.warehouse_id, line.sku_id);

        if (inv && inv.available_qty >= line.qty) {
          try {
            inventoryService.lockInventory(waveId, wave.warehouse_id, line.sku_id, line.id, line.qty);
            orderService.updateLineStatus(line.id, orderService.LINE_STATUS.PICKING, operator, '锁定库存开始拣货');
          } catch (e) {
            console.error(`锁定库存失败: ${e.message}`);
          }
        }
      }

      orderService.updateOrderStatus(wo.order_id, orderService.ORDER_STATUS.PICKING, operator, `波次 ${wave.wave_no} 开始拣货`);
    }

    db.prepare(`
      UPDATE waves
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(WAVE_STATUS.PICKING, waveId);

    historyService.addStatusHistory('wave', waveId, wave.status, WAVE_STATUS.PICKING, operator, '开始拣货');
  });

  transaction();
  return getWaveById(waveId);
}

function reportPicked(waveId, pickedResults, operator) {
  const wave = getWaveById(waveId);
  if (!wave) throw new Error('波次不存在');

  if (wave.status !== WAVE_STATUS.PICKING && wave.status !== WAVE_STATUS.HAS_STOCKOUT) {
    throw new Error(`波次状态为 ${wave.status}，无法确认拣货`);
  }

  const stockouts = [];
  const pickedLineIds = [];

  const transaction = db.transaction(() => {
    for (const result of pickedResults) {
      const line = db.prepare('SELECT * FROM order_lines WHERE id = ?').get(result.order_line_id);
      if (!line) {
        throw new Error(`订单行 ${result.order_line_id} 不存在`);
      }

      if (line.status === orderService.LINE_STATUS.SHIPPED ||
          line.status === orderService.LINE_STATUS.PICKED) {
        continue;
      }

      if (result.picked_qty === line.qty) {
        inventoryService.confirmPicked(waveId, wave.warehouse_id, line.sku_id, line.id, line.qty);

        db.prepare(`
          UPDATE order_lines
          SET picked_qty = ?, status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(line.qty, orderService.LINE_STATUS.PICKED, line.id);

        pickedLineIds.push(line.id);
        historyService.addStatusHistory('order_line', line.id, line.status, orderService.LINE_STATUS.PICKED, operator, '拣货完成');
      } else if (result.picked_qty < line.qty) {
        const shortageQty = line.qty - result.picked_qty;

        if (result.picked_qty > 0) {
          inventoryService.confirmPicked(waveId, wave.warehouse_id, line.sku_id, line.id, result.picked_qty);
        }

        const inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND sku_id = ?')
          .get(wave.warehouse_id, line.sku_id);

        const stockoutId = `stout_${uuidv4()}`;
        db.prepare(`
          INSERT INTO stockouts (
            id, wave_id, warehouse_id, order_id, order_line_id, sku_id,
            sku_code, sku_name, requested_qty, available_qty, shortage_qty,
            reason, status, operator
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          stockoutId,
          waveId,
          wave.warehouse_id,
          line.order_id,
          line.id,
          line.sku_id,
          line.sku_code,
          line.sku_name,
          line.qty,
          inv ? inv.available_qty : 0,
          shortageQty,
          result.reason || '部分缺货',
          STOCKOUT_STATUS.PENDING,
          operator
        );

        db.prepare(`
          UPDATE order_lines
          SET picked_qty = ?, status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(result.picked_qty, orderService.LINE_STATUS.STOCKOUT, line.id);

        stockouts.push(stockoutId);
        historyService.addStatusHistory('order_line', line.id, line.status, orderService.LINE_STATUS.STOCKOUT, operator, `缺货 ${shortageQty} 件`);
      }
    }

    const newStatus = stockouts.length > 0 ? WAVE_STATUS.HAS_STOCKOUT : WAVE_STATUS.PARTIAL_PICKED;
    db.prepare(`
      UPDATE waves
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, waveId);

    historyService.addStatusHistory('wave', waveId, wave.status, newStatus, operator,
      stockouts.length > 0 ? `发现 ${stockouts.length} 个缺货` : '部分拣货完成');
  });

  transaction();

  return {
    wave: getWaveById(waveId),
    stockouts: stockouts.map(id => getStockoutById(id)),
    picked_line_ids: pickedLineIds
  };
}

function reportStockout(stockoutData, operator) {
  const wave = db.prepare('SELECT * FROM waves WHERE wave_no = ?').get(stockoutData.wave_no);
  if (!wave) throw new Error('波次不存在');

  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(stockoutData.order_no);
  if (!order) throw new Error('订单不存在');

  const line = db.prepare('SELECT * FROM order_lines WHERE order_id = ? AND sku_code = ?')
    .get(order.id, stockoutData.sku_code);
  if (!line) throw new Error('订单行不存在');

  const existingStockout = db.prepare(`
    SELECT * FROM stockouts
    WHERE wave_id = ? AND order_id = ? AND order_line_id = ? AND status = 'pending'
  `).get(wave.id, order.id, line.id);

  if (existingStockout) {
    return getStockoutById(existingStockout.id);
  }

  const inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND sku_id = ?')
    .get(wave.warehouse_id, line.sku_id);

  const stockoutId = `stout_${uuidv4()}`;
  const shortageQty = stockoutData.shortage_qty || (line.qty - line.picked_qty);

  db.prepare(`
    INSERT INTO stockouts (
      id, wave_id, warehouse_id, order_id, order_line_id, sku_id,
      sku_code, sku_name, requested_qty, available_qty, shortage_qty,
      reason, status, operator
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    stockoutId,
    wave.id,
    wave.warehouse_id,
    order.id,
    line.id,
    line.sku_id,
    line.sku_code,
    line.sku_name,
    line.qty,
    inv ? inv.available_qty : 0,
    shortageQty,
    stockoutData.reason || '缺货',
    STOCKOUT_STATUS.PENDING,
    operator
  );

  if (shortageQty === line.qty) {
    orderService.updateLineStatus(line.id, orderService.LINE_STATUS.STOCKOUT, operator, stockoutData.reason || '缺货');
  }

  db.prepare(`
    UPDATE waves
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(WAVE_STATUS.HAS_STOCKOUT, wave.id);

  historyService.addStatusHistory('wave', wave.id, null, WAVE_STATUS.HAS_STOCKOUT, operator, '新增缺货登记');
  historyService.addStatusHistory('stockout', stockoutId, null, STOCKOUT_STATUS.PENDING, operator, '缺货登记');

  return getStockoutById(stockoutId);
}

function getStockoutById(stockoutId) {
  const stockout = db.prepare(`
    SELECT s.*, wh.code as warehouse_code, wh.name as warehouse_name,
           o.order_no, w.wave_no
    FROM stockouts s
    JOIN warehouses wh ON s.warehouse_id = wh.id
    JOIN orders o ON s.order_id = o.id
    JOIN waves w ON s.wave_id = w.id
    WHERE s.id = ?
  `).get(stockoutId);

  if (!stockout) return null;

  const history = historyService.getStatusHistory('stockout', stockoutId);
  const suggestion = db.prepare('SELECT * FROM transfer_suggestions WHERE stockout_id = ?').get(stockoutId);

  return {
    ...stockout,
    history,
    transfer_suggestion: suggestion
  };
}

function generateTransferSuggestion(stockoutId, operator) {
  const stockout = getStockoutById(stockoutId);
  if (!stockout) throw new Error('缺货记录不存在');

  if (stockout.status !== STOCKOUT_STATUS.PENDING) {
    throw new Error(`缺货状态为 ${stockout.status}，无法生成换仓建议`);
  }

  const availableWares = inventoryService.findAvailableWarehouses(
    stockout.sku_id,
    stockout.warehouse_id,
    stockout.shortage_qty
  );

  if (availableWares.length === 0) {
    return {
      success: false,
      message: '其他仓库无可用库存',
      available_warehouses: []
    };
  }

  const selectedWarehouse = availableWares[0];

  const existing = db.prepare('SELECT * FROM transfer_suggestions WHERE stockout_id = ?').get(stockoutId);
  if (existing) {
    return {
      success: true,
      suggestion: existing,
      available_warehouses: availableWares
    };
  }

  const suggestionId = `ts_${uuidv4()}`;
  db.prepare(`
    INSERT INTO transfer_suggestions (
      id, stockout_id, from_warehouse_id, to_warehouse_id, sku_id,
      suggested_qty, available_qty, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    suggestionId,
    stockoutId,
    selectedWarehouse.warehouse_id,
    stockout.warehouse_id,
    stockout.sku_id,
    stockout.shortage_qty,
    selectedWarehouse.available_qty,
    TRANSFER_STATUS.PENDING
  );

  return {
    success: true,
    suggestion: db.prepare('SELECT * FROM transfer_suggestions WHERE id = ?').get(suggestionId),
    available_warehouses: availableWares
  };
}

function splitOrderForStockout(stockoutId, operator) {
  const stockout = getStockoutById(stockoutId);
  if (!stockout) throw new Error('缺货记录不存在');

  const order = orderService.getOrderById(stockout.order_id);
  if (!order) throw new Error('订单不存在');

  const line = db.prepare('SELECT * FROM order_lines WHERE id = ?').get(stockout.order_line_id);
  if (!line) throw new Error('订单行不存在');

  if (line.status === orderService.LINE_STATUS.SHIPPED) {
    throw new Error('已出库的订单行不能拆单');
  }

  const wave = getWaveById(stockout.wave_id);

  const transaction = db.transaction(() => {
    const splitCount = order.split_count || 0;
    const newOrderNo = `${order.order_no}-S${splitCount + 1}`;
    const newOrderId = `ord_${uuidv4()}`;

    db.prepare(`
      INSERT INTO orders (
        id, order_no, customer_name, customer_phone, province, city, address,
        total_amount, shipping_fee, status, parent_order_id, split_count
      ) SELECT ?, ?, customer_name, customer_phone, province, city, address,
        0, shipping_fee, ?, ?, ?
      FROM orders WHERE id = ?
    `).run(
      newOrderId,
      newOrderNo,
      orderService.ORDER_STATUS.SPLIT,
      order.parent_order_id || order.id,
      0,
      order.id
    );

    db.prepare(`
      UPDATE orders SET split_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(splitCount + 1, order.id);

    const shortageQty = stockout.shortage_qty;
    const shortageAmount = shortageQty * line.price;

    const newLineId = `line_${uuidv4()}`;
    db.prepare(`
      INSERT INTO order_lines (
        id, order_id, sku_id, sku_code, sku_name, qty, price, amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newLineId,
      newOrderId,
      line.sku_id,
      line.sku_code,
      line.sku_name,
      shortageQty,
      line.price,
      shortageAmount,
      orderService.LINE_STATUS.STOCKOUT
    );

    db.prepare(`
      UPDATE orders SET total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(shortageAmount, newOrderId);

    db.prepare(`
      UPDATE order_lines
      SET qty = qty - ?, amount = amount - ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(shortageQty, shortageAmount, line.id);

    const origAmount = db.prepare('SELECT SUM(amount) as total FROM order_lines WHERE order_id = ?')
      .get(order.id);

    db.prepare(`
      UPDATE orders SET total_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(origAmount.total, orderService.ORDER_STATUS.PARTIAL_PICKED, order.id);

    db.prepare(`
      UPDATE stockouts
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(STOCKOUT_STATUS.SPLIT, stockoutId);

    db.prepare(`
      UPDATE wave_orders
      SET status = 'partial', updated_at = CURRENT_TIMESTAMP
      WHERE wave_id = ? AND order_id = ?
    `).run(stockout.wave_id, order.id);

    historyService.addStatusHistory('order', order.id, order.status, orderService.ORDER_STATUS.PARTIAL_PICKED, operator, `拆单生成子单 ${newOrderNo}`);
    historyService.addStatusHistory('order', newOrderId, null, orderService.ORDER_STATUS.SPLIT, operator, `拆单自 ${order.order_no}`);
    historyService.addStatusHistory('stockout', stockoutId, stockout.status, STOCKOUT_STATUS.SPLIT, operator, '已拆单');
  });

  transaction();

  const newOrder = orderService.getOrderByNo(`${order.order_no}-S${(order.split_count || 0) + 1}`);

  return {
    success: true,
    original_order: orderService.getOrderById(order.id),
    new_child_order: newOrder,
    stockout: getStockoutById(stockoutId)
  };
}

function executeTransfer(stockoutId, operator) {
  const stockout = getStockoutById(stockoutId);
  if (!stockout) throw new Error('缺货记录不存在');

  const suggestion = db.prepare('SELECT * FROM transfer_suggestions WHERE stockout_id = ?').get(stockoutId);
  if (!suggestion) throw new Error('换仓建议不存在');

  if (suggestion.status !== TRANSFER_STATUS.PENDING && suggestion.status !== TRANSFER_STATUS.ACCEPTED) {
    throw new Error(`换仓建议状态为 ${suggestion.status}，无法执行`);
  }

  const sourceInv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND sku_id = ?')
    .get(suggestion.from_warehouse_id, suggestion.sku_id);

  if (!sourceInv || sourceInv.available_qty < suggestion.suggested_qty) {
    db.prepare(`
      UPDATE transfer_suggestions
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(TRANSFER_STATUS.FAILED, suggestion.id);

    db.prepare(`
      UPDATE stockouts
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(STOCKOUT_STATUS.TRANSFER_FAILED, stockoutId);

    historyService.addStatusHistory('stockout', stockoutId, stockout.status, STOCKOUT_STATUS.TRANSFER_FAILED, operator, '换仓库存不足');

    return {
      success: false,
      error: '源仓库库存不足',
      source_available: sourceInv ? sourceInv.available_qty : 0,
      requested: suggestion.suggested_qty
    };
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE inventory
      SET available_qty = available_qty - ?
      WHERE warehouse_id = ? AND sku_id = ?
    `).run(suggestion.suggested_qty, suggestion.from_warehouse_id, suggestion.sku_id);

    db.prepare(`
      UPDATE inventory
      SET available_qty = available_qty + ?
      WHERE warehouse_id = ? AND sku_id = ?
    `).run(suggestion.suggested_qty, suggestion.to_warehouse_id, suggestion.sku_id);

    db.prepare(`
      UPDATE transfer_suggestions
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(TRANSFER_STATUS.SUCCESS, suggestion.id);

    db.prepare(`
      UPDATE stockouts
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(STOCKOUT_STATUS.TRANSFER_SUCCESS, stockoutId);

    const line = db.prepare('SELECT * FROM order_lines WHERE id = ?').get(stockout.order_line_id);
    if (line) {
      db.prepare(`
        UPDATE order_lines
        SET picked_qty = picked_qty + ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(stockout.shortage_qty, orderService.LINE_STATUS.PICKED, line.id);
    }

    historyService.addStatusHistory('stockout', stockoutId, stockout.status, STOCKOUT_STATUS.TRANSFER_SUCCESS, operator, '换仓成功');
  });

  transaction();

  return {
    success: true,
    stockout: getStockoutById(stockoutId),
    suggestion: db.prepare('SELECT * FROM transfer_suggestions WHERE id = ?').get(suggestion.id)
  };
}

function retainStockout(stockoutId, operator) {
  const stockout = getStockoutById(stockoutId);
  if (!stockout) throw new Error('缺货记录不存在');

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE stockouts
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(STOCKOUT_STATUS.RETAINED, stockoutId);

    const line = db.prepare('SELECT * FROM order_lines WHERE id = ?').get(stockout.order_line_id);
    if (line) {
      db.prepare(`
        UPDATE order_lines
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(orderService.LINE_STATUS.RETAINED, line.id);
    }

    const order = orderService.getOrderById(stockout.order_id);
    if (order) {
      orderService.updateOrderStatus(order.id, orderService.ORDER_STATUS.DELAYED, operator, '缺货商品保留等待补货');
    }

    historyService.addStatusHistory('stockout', stockoutId, stockout.status, STOCKOUT_STATUS.RETAINED, operator, '选择保留，等待补货');
  });

  transaction();

  return getStockoutById(stockoutId);
}

function completeWave(waveId, operator) {
  const wave = getWaveById(waveId);
  if (!wave) throw new Error('波次不存在');

  const pendingStockouts = db.prepare(`
    SELECT * FROM stockouts WHERE wave_id = ? AND status IN ('pending', 'transfering')
  `).all(waveId);

  if (pendingStockouts.length > 0) {
    throw new Error(`波次还有 ${pendingStockouts.length} 个缺货未处理`);
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE waves
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(WAVE_STATUS.COMPLETED, waveId);

    const waveOrders = db.prepare('SELECT * FROM wave_orders WHERE wave_id = ?').all(waveId);
    for (const wo of waveOrders) {
      const lines = db.prepare(`
        SELECT COUNT(*) as cnt FROM order_lines
        WHERE order_id = ? AND status NOT IN ('shipped', 'picked', 'retained', 'cancelled')
      `).get(wo.order_id);

      if (lines.cnt === 0) {
        const order = orderService.getOrderById(wo.order_id);
        const newStatus = order.status === orderService.ORDER_STATUS.DELAYED
          ? orderService.ORDER_STATUS.PARTIAL_SHIPPED
          : orderService.ORDER_STATUS.SHIPPED;

        orderService.updateOrderStatus(wo.order_id, newStatus, operator, `波次 ${wave.wave_no} 完成`);
      }
    }

    historyService.addStatusHistory('wave', waveId, wave.status, WAVE_STATUS.COMPLETED, operator, '波次完成');
  });

  transaction();

  return getWaveById(waveId);
}

function listWaves(filters = {}) {
  let query = `
    SELECT w.*, wh.code as warehouse_code, wh.name as warehouse_name
    FROM waves w
    JOIN warehouses wh ON w.warehouse_id = wh.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.status) {
    query += ' AND w.status = ?';
    params.push(filters.status);
  }
  if (filters.wave_no) {
    query += ' AND w.wave_no LIKE ?';
    params.push(`%${filters.wave_no}%`);
  }

  query += ' ORDER BY w.created_at DESC';

  return db.prepare(query).all(...params);
}

module.exports = {
  WAVE_STATUS,
  STOCKOUT_STATUS,
  TRANSFER_STATUS,
  createWave,
  getWaveById,
  getWaveByNo,
  addOrdersToWave,
  startPicking,
  reportPicked,
  reportStockout,
  getStockoutById,
  generateTransferSuggestion,
  splitOrderForStockout,
  executeTransfer,
  retainStockout,
  completeWave,
  listWaves
};
