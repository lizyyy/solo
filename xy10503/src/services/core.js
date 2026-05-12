const { store, saveData } = require('./store');
const { v4: uuidv4 } = require('uuid');

const ORDER_STATUS = {
  PENDING: 'pending',
  WAVE_ASSIGNED: 'wave_assigned',
  PICKING: 'picking',
  PARTIAL_PICKED: 'partial_picked',
  SPLIT: 'split',
  SHIPPED: 'shipped',
  PARTIAL_SHIPPED: 'partial_shipped',
  DELAYED: 'delayed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
};

const LINE_STATUS = {
  PENDING: 'pending',
  PICKING: 'picking',
  PICKED: 'picked',
  SHIPPED: 'shipped',
  STOCKOUT: 'stockout',
  TRANSFERING: 'transfering',
  TRANSFER_FAILED: 'transfer_failed',
  RETAINED: 'retained',
  CANCELLED: 'cancelled'
};

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

function now() {
  return new Date().toISOString();
}

function addStatusHistory(entityType, entityId, oldStatus, newStatus, operator, remark) {
  store.status_history.push({
    id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    entity_type: entityType,
    entity_id: entityId,
    old_status: oldStatus,
    new_status: newStatus,
    operator: operator || 'system',
    remark: remark || '',
    created_at: now()
  });
  saveData();
}

function getStatusHistory(entityType, entityId) {
  return store.status_history.filter(h => h.entity_type === entityType && h.entity_id === entityId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function addManualCorrection(entityType, entityId, fieldName, oldValue, newValue, reason, operator) {
  store.manual_corrections.push({
    id: `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    entity_type: entityType,
    entity_id: entityId,
    field_name: fieldName,
    old_value: oldValue ? String(oldValue) : null,
    new_value: newValue ? String(newValue) : null,
    reason: reason,
    operator: operator,
    created_at: now()
  });
  saveData();
}

function getManualCorrections(entityType, entityId) {
  return store.manual_corrections.filter(c => c.entity_type === entityType && c.entity_id === entityId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function createOrder(orderData) {
  const orderId = `ord_${uuidv4()}`;
  const orderNo = orderData.order_no || `SO${Date.now()}`;
  const operator = orderData.operator || 'system';

  let totalAmount = 0;
  const lines = [];

  for (const lineData of orderData.lines) {
    const sku = store.skus.find(s => s.code === lineData.sku_code);
    if (!sku) {
      throw new Error(`SKU ${lineData.sku_code} 不存在`);
    }

    const amount = lineData.qty * lineData.price;
    totalAmount += amount;

    const line = {
      id: `line_${uuidv4()}`,
      order_id: orderId,
      sku_id: sku.id,
      sku_code: sku.code,
      sku_name: sku.name,
      qty: lineData.qty,
      price: lineData.price,
      amount: amount,
      picked_qty: 0,
      shipped_qty: 0,
      status: LINE_STATUS.PENDING,
      created_at: now(),
      updated_at: now()
    };
    lines.push(line);
  }

  const order = {
    id: orderId,
    order_no: orderNo,
    customer_name: orderData.customer_name,
    customer_phone: orderData.customer_phone,
    province: orderData.province,
    city: orderData.city,
    address: orderData.address,
    total_amount: totalAmount,
    shipping_fee: orderData.shipping_fee || 0,
    status: ORDER_STATUS.PENDING,
    parent_order_id: null,
    split_count: 0,
    created_at: now(),
    updated_at: now()
  };

  store.orders.push(order);
  store.order_lines.push(...lines);

  addStatusHistory('order', orderId, null, ORDER_STATUS.PENDING, operator, '订单创建');
  saveData();

  return getOrderById(orderId);
}

function getOrderById(orderId) {
  const order = store.orders.find(o => o.id === orderId);
  if (!order) return null;

  return {
    ...order,
    lines: store.order_lines.filter(l => l.order_id === orderId),
    history: getStatusHistory('order', orderId),
    manual_corrections: getManualCorrections('order', orderId),
    child_orders: store.orders.filter(o => o.parent_order_id === orderId)
  };
}

function getOrderByNo(orderNo) {
  const order = store.orders.find(o => o.order_no === orderNo);
  return order ? getOrderById(order.id) : null;
}

function updateOrderStatus(orderId, newStatus, operator, remark) {
  const order = store.orders.find(o => o.id === orderId);
  if (!order) throw new Error('订单不存在');

  const oldStatus = order.status;
  if (oldStatus === newStatus) return getOrderById(orderId);

  order.status = newStatus;
  order.updated_at = now();

  addStatusHistory('order', orderId, oldStatus, newStatus, operator, remark);
  saveData();

  return getOrderById(orderId);
}

function updateLineStatus(lineId, newStatus, operator, remark) {
  const line = store.order_lines.find(l => l.id === lineId);
  if (!line) throw new Error('订单行不存在');

  const oldStatus = line.status;
  if (oldStatus === newStatus) return line;

  line.status = newStatus;
  line.updated_at = now();

  addStatusHistory('order_line', lineId, oldStatus, newStatus, operator, remark);
  saveData();

  return line;
}

function listOrders(filters = {}) {
  let orders = [...store.orders];

  if (filters.status) {
    orders = orders.filter(o => o.status === filters.status);
  }
  if (filters.order_no) {
    orders = orders.filter(o => o.order_no.includes(filters.order_no));
  }

  return orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function correctOrderStatus(orderId, oldStatus, newStatus, reason, operator) {
  const order = store.orders.find(o => o.id === orderId);
  if (!order) throw new Error('订单不存在');

  const actualOldStatus = order.status;
  order.status = newStatus;
  order.updated_at = now();

  addManualCorrection('order', orderId, 'status', oldStatus, newStatus, reason, operator);
  addStatusHistory('order', orderId, actualOldStatus, newStatus, operator, `人工修正: ${reason}`);
  saveData();

  return getOrderById(orderId);
}

function createWave(waveData) {
  const waveId = `wave_${uuidv4()}`;
  const waveNo = waveData.wave_no || `W${Date.now()}`;
  const createdBy = waveData.created_by || 'system';

  const warehouse = store.warehouses.find(w => w.code === waveData.warehouse_code);
  if (!warehouse) {
    throw new Error(`仓库 ${waveData.warehouse_code} 不存在`);
  }

  const wave = {
    id: waveId,
    wave_no: waveNo,
    warehouse_id: warehouse.id,
    warehouse_code: warehouse.code,
    warehouse_name: warehouse.name,
    status: WAVE_STATUS.CREATED,
    order_count: 0,
    total_sku_count: 0,
    created_by: createdBy,
    created_at: now(),
    updated_at: now()
  };

  store.waves.push(wave);
  addStatusHistory('wave', waveId, null, WAVE_STATUS.CREATED, createdBy, '波次创建');
  saveData();

  return getWaveById(waveId);
}

function getWaveById(waveId) {
  const wave = store.waves.find(w => w.id === waveId);
  if (!wave) return null;

  const warehouse = store.warehouses.find(wh => wh.id === wave.warehouse_id);

  const waveOrders = store.wave_orders.filter(wo => wo.wave_id === waveId).map(wo => {
    const order = store.orders.find(o => o.id === wo.order_id);
    return {
      ...wo,
      order_no: order ? order.order_no : null,
      order_status: order ? order.status : null,
      customer_name: order ? order.customer_name : null
    };
  }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const stockouts = store.stockouts.filter(s => s.wave_id === waveId).map(s => {
    const wh = store.warehouses.find(h => h.id === s.warehouse_id);
    const order = store.orders.find(o => o.id === s.order_id);
    return {
      ...s,
      warehouse_code: wh ? wh.code : null,
      warehouse_name: wh ? wh.name : null,
      order_no: order ? order.order_no : null
    };
  }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return {
    ...wave,
    warehouse_code: warehouse ? warehouse.code : wave.warehouse_code,
    warehouse_name: warehouse ? warehouse.name : wave.warehouse_name,
    wave_orders: waveOrders,
    stockouts,
    history: getStatusHistory('wave', waveId),
    manual_corrections: getManualCorrections('wave', waveId)
  };
}

function getWaveByNo(waveNo) {
  const wave = store.waves.find(w => w.wave_no === waveNo);
  return wave ? getWaveById(wave.id) : null;
}

function addOrdersToWave(waveId, orderNos, operator) {
  const wave = getWaveById(waveId);
  if (!wave) throw new Error('波次不存在');

  if (wave.status !== WAVE_STATUS.CREATED && wave.status !== WAVE_STATUS.ASSIGNED) {
    throw new Error(`波次状态为 ${wave.status}，无法添加订单`);
  }

  let orderCount = 0;
  let skuCount = 0;

  for (const orderNo of orderNos) {
    const order = store.orders.find(o => o.order_no === orderNo);
    if (!order) {
      throw new Error(`订单 ${orderNo} 不存在`);
    }

    const existing = store.wave_orders.find(wo => wo.wave_id === waveId && wo.order_id === order.id);

    if (!existing) {
      store.wave_orders.push({
        id: `wo_${uuidv4()}`,
        wave_id: waveId,
        order_id: order.id,
        status: 'assigned',
        created_at: now()
      });

      orderCount++;
      const lines = store.order_lines.filter(l => l.order_id === order.id);
      skuCount += lines.length;

      updateOrderStatus(order.id, ORDER_STATUS.WAVE_ASSIGNED, operator, `加入波次 ${wave.wave_no}`);
    }
  }

  if (orderCount > 0) {
    const waveObj = store.waves.find(w => w.id === waveId);
    waveObj.order_count += orderCount;
    waveObj.total_sku_count += skuCount;
    waveObj.status = WAVE_STATUS.ASSIGNED;
    waveObj.updated_at = now();

    addStatusHistory('wave', waveId, wave.status, WAVE_STATUS.ASSIGNED, operator, `添加 ${orderCount} 个订单`);
    saveData();
  }

  return getWaveById(waveId);
}

function lockInventory(waveId, warehouseId, skuId, orderLineId, qty) {
  const inv = store.inventory.find(i => i.warehouse_id === warehouseId && i.sku_id === skuId);
  if (!inv) {
    throw new Error(`仓库库存不存在`);
  }

  if (inv.available_qty < qty) {
    throw new Error(`可用库存不足，当前可用: ${inv.available_qty}, 需要: ${qty}`);
  }

  inv.available_qty -= qty;
  inv.locked_qty += qty;

  store.inventory_locks.push({
    id: `lock_${uuidv4()}`,
    wave_id: waveId,
    warehouse_id: warehouseId,
    sku_id: skuId,
    order_line_id: orderLineId,
    qty: qty,
    status: 'active',
    created_at: now()
  });

  saveData();
  return inv;
}

function confirmPicked(waveId, warehouseId, skuId, orderLineId, qty) {
  const locks = store.inventory_locks.filter(l =>
    l.wave_id === waveId && l.warehouse_id === warehouseId &&
    l.sku_id === skuId && l.order_line_id === orderLineId && l.status === 'active'
  );

  const totalLocked = locks.reduce((sum, l) => sum + l.qty, 0);
  if (totalLocked < qty) {
    throw new Error(`锁定库存不足`);
  }

  const inv = store.inventory.find(i => i.warehouse_id === warehouseId && i.sku_id === skuId);
  if (inv) {
    inv.locked_qty -= qty;
  }

  for (const lock of locks) {
    lock.status = 'consumed';
  }

  saveData();
  return inv;
}

function findAvailableWarehouses(skuId, excludeWarehouseId, qty) {
  return store.inventory.filter(inv =>
    inv.sku_id === skuId &&
    inv.warehouse_id !== excludeWarehouseId &&
    inv.available_qty >= qty
  ).map(inv => {
    const wh = store.warehouses.find(h => h.id === inv.warehouse_id);
    const sku = store.skus.find(s => s.id === inv.sku_id);
    return {
      ...inv,
      warehouse_code: wh ? wh.code : null,
      warehouse_name: wh ? wh.name : null,
      warehouse_id: inv.warehouse_id,
      sku_code: sku ? sku.code : null,
      sku_name: sku ? sku.name : null
    };
  }).sort((a, b) => b.available_qty - a.available_qty);
}

function startPicking(waveId, operator) {
  const wave = getWaveById(waveId);
  if (!wave) throw new Error('波次不存在');

  const validStatuses = [WAVE_STATUS.ASSIGNED, WAVE_STATUS.HAS_STOCKOUT, WAVE_STATUS.PARTIAL_PICKED];
  if (!validStatuses.includes(wave.status)) {
    throw new Error(`波次状态为 ${wave.status}，无法开始拣货`);
  }

  const waveOrders = store.wave_orders.filter(wo => wo.wave_id === waveId);
  const waveObj = store.waves.find(w => w.id === waveId);

  for (const wo of waveOrders) {
    const lines = store.order_lines.filter(l =>
      l.order_id === wo.order_id &&
      !['shipped', 'cancelled', 'picked'].includes(l.status)
    );

    for (const line of lines) {
      const inv = store.inventory.find(i =>
        i.warehouse_id === waveObj.warehouse_id && i.sku_id === line.sku_id
      );

      if (inv && inv.available_qty >= line.qty) {
        try {
          lockInventory(waveId, waveObj.warehouse_id, line.sku_id, line.id, line.qty);
          updateLineStatus(line.id, LINE_STATUS.PICKING, operator, '锁定库存开始拣货');
        } catch (e) {
          console.error(`锁定库存失败: ${e.message}`);
        }
      }
    }

    updateOrderStatus(wo.order_id, ORDER_STATUS.PICKING, operator, `波次 ${wave.wave_no} 开始拣货`);
  }

  waveObj.status = WAVE_STATUS.PICKING;
  waveObj.updated_at = now();

  addStatusHistory('wave', waveId, wave.status, WAVE_STATUS.PICKING, operator, '开始拣货');
  saveData();

  return getWaveById(waveId);
}

function reportPicked(waveId, pickedResults, operator) {
  const wave = getWaveById(waveId);
  if (!wave) throw new Error('波次不存在');

  if (wave.status !== WAVE_STATUS.PICKING && wave.status !== WAVE_STATUS.HAS_STOCKOUT) {
    throw new Error(`波次状态为 ${wave.status}，无法确认拣货`);
  }

  const waveObj = store.waves.find(w => w.id === waveId);
  const stockouts = [];
  const pickedLineIds = [];

  for (const result of pickedResults) {
    const line = store.order_lines.find(l => l.id === result.order_line_id);
    if (!line) {
      throw new Error(`订单行 ${result.order_line_id} 不存在`);
    }

    if (line.status === LINE_STATUS.SHIPPED || line.status === LINE_STATUS.PICKED) {
      continue;
    }

    if (result.picked_qty === line.qty) {
      confirmPicked(waveId, waveObj.warehouse_id, line.sku_id, line.id, line.qty);

      line.picked_qty = line.qty;
      line.status = LINE_STATUS.PICKED;
      line.updated_at = now();

      pickedLineIds.push(line.id);
      addStatusHistory('order_line', line.id, line.status, LINE_STATUS.PICKED, operator, '拣货完成');
    } else if (result.picked_qty < line.qty) {
      const shortageQty = line.qty - result.picked_qty;

      if (result.picked_qty > 0) {
        confirmPicked(waveId, waveObj.warehouse_id, line.sku_id, line.id, result.picked_qty);
      }

      const inv = store.inventory.find(i =>
        i.warehouse_id === waveObj.warehouse_id && i.sku_id === line.sku_id
      );

      const stockout = {
        id: `stout_${uuidv4()}`,
        wave_id: waveId,
        warehouse_id: waveObj.warehouse_id,
        order_id: line.order_id,
        order_line_id: line.id,
        sku_id: line.sku_id,
        sku_code: line.sku_code,
        sku_name: line.sku_name,
        requested_qty: line.qty,
        available_qty: inv ? inv.available_qty : 0,
        shortage_qty: shortageQty,
        reason: result.reason || '部分缺货',
        status: STOCKOUT_STATUS.PENDING,
        operator: operator,
        created_at: now(),
        updated_at: now()
      };

      store.stockouts.push(stockout);
      stockouts.push(stockout.id);

      line.picked_qty = result.picked_qty;
      line.status = LINE_STATUS.STOCKOUT;
      line.updated_at = now();

      addStatusHistory('order_line', line.id, line.status, LINE_STATUS.STOCKOUT, operator, `缺货 ${shortageQty} 件`);
    }
  }

  const newStatus = stockouts.length > 0 ? WAVE_STATUS.HAS_STOCKOUT : WAVE_STATUS.PARTIAL_PICKED;
  waveObj.status = newStatus;
  waveObj.updated_at = now();

  addStatusHistory('wave', waveId, wave.status, newStatus, operator,
    stockouts.length > 0 ? `发现 ${stockouts.length} 个缺货` : '部分拣货完成');

  saveData();

  return {
    wave: getWaveById(waveId),
    stockouts: stockouts.map(id => getStockoutById(id)),
    picked_line_ids: pickedLineIds
  };
}

function getStockoutById(stockoutId) {
  const stockout = store.stockouts.find(s => s.id === stockoutId);
  if (!stockout) return null;

  const wh = store.warehouses.find(h => h.id === stockout.warehouse_id);
  const order = store.orders.find(o => o.id === stockout.order_id);
  const wave = store.waves.find(w => w.id === stockout.wave_id);

  return {
    ...stockout,
    warehouse_code: wh ? wh.code : null,
    warehouse_name: wh ? wh.name : null,
    order_no: order ? order.order_no : null,
    wave_no: wave ? wave.wave_no : null,
    history: getStatusHistory('stockout', stockoutId),
    transfer_suggestion: store.transfer_suggestions.find(t => t.stockout_id === stockoutId)
  };
}

function reportStockout(stockoutData, operator) {
  const wave = store.waves.find(w => w.wave_no === stockoutData.wave_no);
  if (!wave) throw new Error('波次不存在');

  const order = store.orders.find(o => o.order_no === stockoutData.order_no);
  if (!order) throw new Error('订单不存在');

  const line = store.order_lines.find(l => l.order_id === order.id && l.sku_code === stockoutData.sku_code);
  if (!line) throw new Error('订单行不存在');

  const existingStockout = store.stockouts.find(s =>
    s.wave_id === wave.id && s.order_id === order.id &&
    s.order_line_id === line.id && s.status === STOCKOUT_STATUS.PENDING
  );

  if (existingStockout) {
    return getStockoutById(existingStockout.id);
  }

  const inv = store.inventory.find(i => i.warehouse_id === wave.warehouse_id && i.sku_id === line.sku_id);
  const shortageQty = stockoutData.shortage_qty || (line.qty - line.picked_qty);

  const stockout = {
    id: `stout_${uuidv4()}`,
    wave_id: wave.id,
    warehouse_id: wave.warehouse_id,
    order_id: order.id,
    order_line_id: line.id,
    sku_id: line.sku_id,
    sku_code: line.sku_code,
    sku_name: line.sku_name,
    requested_qty: line.qty,
    available_qty: inv ? inv.available_qty : 0,
    shortage_qty: shortageQty,
    reason: stockoutData.reason || '缺货',
    status: STOCKOUT_STATUS.PENDING,
    operator: operator,
    created_at: now(),
    updated_at: now()
  };

  store.stockouts.push(stockout);

  if (shortageQty === line.qty) {
    updateLineStatus(line.id, LINE_STATUS.STOCKOUT, operator, stockoutData.reason || '缺货');
  }

  wave.status = WAVE_STATUS.HAS_STOCKOUT;
  wave.updated_at = now();

  addStatusHistory('wave', wave.id, wave.status, WAVE_STATUS.HAS_STOCKOUT, operator, '新增缺货登记');
  addStatusHistory('stockout', stockout.id, null, STOCKOUT_STATUS.PENDING, operator, '缺货登记');
  saveData();

  return getStockoutById(stockout.id);
}

function generateTransferSuggestion(stockoutId, operator) {
  const stockout = getStockoutById(stockoutId);
  if (!stockout) throw new Error('缺货记录不存在');

  if (stockout.status !== STOCKOUT_STATUS.PENDING) {
    throw new Error(`缺货状态为 ${stockout.status}，无法生成换仓建议`);
  }

  const availableWares = findAvailableWarehouses(
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

  const existing = store.transfer_suggestions.find(t => t.stockout_id === stockoutId);
  if (existing) {
    return {
      success: true,
      suggestion: existing,
      available_warehouses: availableWares
    };
  }

  const suggestion = {
    id: `ts_${uuidv4()}`,
    stockout_id: stockoutId,
    from_warehouse_id: selectedWarehouse.warehouse_id,
    to_warehouse_id: stockout.warehouse_id,
    sku_id: stockout.sku_id,
    suggested_qty: stockout.shortage_qty,
    available_qty: selectedWarehouse.available_qty,
    status: TRANSFER_STATUS.PENDING,
    created_at: now(),
    updated_at: now()
  };

  store.transfer_suggestions.push(suggestion);
  saveData();

  return {
    success: true,
    suggestion: suggestion,
    available_warehouses: availableWares
  };
}

function splitOrderForStockout(stockoutId, operator) {
  const stockout = getStockoutById(stockoutId);
  if (!stockout) throw new Error('缺货记录不存在');

  const order = getOrderById(stockout.order_id);
  if (!order) throw new Error('订单不存在');

  const line = store.order_lines.find(l => l.id === stockout.order_line_id);
  if (!line) throw new Error('订单行不存在');

  if (line.status === LINE_STATUS.SHIPPED) {
    throw new Error('已出库的订单行不能拆单');
  }

  const splitCount = order.split_count || 0;
  const newOrderNo = `${order.order_no}-S${splitCount + 1}`;
  const newOrderId = `ord_${uuidv4()}`;

  const shortageQty = stockout.shortage_qty;
  const shortageAmount = shortageQty * line.price;

  const newOrder = {
    id: newOrderId,
    order_no: newOrderNo,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    province: order.province,
    city: order.city,
    address: order.address,
    total_amount: shortageAmount,
    shipping_fee: order.shipping_fee,
    status: ORDER_STATUS.SPLIT,
    parent_order_id: order.parent_order_id || order.id,
    split_count: 0,
    created_at: now(),
    updated_at: now()
  };

  store.orders.push(newOrder);

  const orderObj = store.orders.find(o => o.id === order.id);
  orderObj.split_count = splitCount + 1;

  const newLine = {
    id: `line_${uuidv4()}`,
    order_id: newOrderId,
    sku_id: line.sku_id,
    sku_code: line.sku_code,
    sku_name: line.sku_name,
    qty: shortageQty,
    price: line.price,
    amount: shortageAmount,
    picked_qty: 0,
    shipped_qty: 0,
    status: LINE_STATUS.STOCKOUT,
    created_at: now(),
    updated_at: now()
  };

  store.order_lines.push(newLine);

  line.qty -= shortageQty;
  line.amount -= shortageAmount;
  line.updated_at = now();

  const origLines = store.order_lines.filter(l => l.order_id === order.id);
  const origAmount = origLines.reduce((sum, l) => sum + l.amount, 0);
  orderObj.total_amount = origAmount;
  orderObj.status = ORDER_STATUS.PARTIAL_PICKED;
  orderObj.updated_at = now();

  const stockoutObj = store.stockouts.find(s => s.id === stockoutId);
  stockoutObj.status = STOCKOUT_STATUS.SPLIT;
  stockoutObj.updated_at = now();

  const waveOrder = store.wave_orders.find(wo => wo.wave_id === stockout.wave_id && wo.order_id === order.id);
  if (waveOrder) {
    waveOrder.status = 'partial';
  }

  addStatusHistory('order', order.id, order.status, ORDER_STATUS.PARTIAL_PICKED, operator, `拆单生成子单 ${newOrderNo}`);
  addStatusHistory('order', newOrderId, null, ORDER_STATUS.SPLIT, operator, `拆单自 ${order.order_no}`);
  addStatusHistory('stockout', stockoutId, stockout.status, STOCKOUT_STATUS.SPLIT, operator, '已拆单');

  saveData();

  return {
    success: true,
    original_order: getOrderById(order.id),
    new_child_order: getOrderByNo(newOrderNo),
    stockout: getStockoutById(stockoutId)
  };
}

function executeTransfer(stockoutId, operator) {
  const stockout = getStockoutById(stockoutId);
  if (!stockout) throw new Error('缺货记录不存在');

  const suggestion = store.transfer_suggestions.find(t => t.stockout_id === stockoutId);
  if (!suggestion) throw new Error('换仓建议不存在');

  if (suggestion.status !== TRANSFER_STATUS.PENDING && suggestion.status !== TRANSFER_STATUS.ACCEPTED) {
    throw new Error(`换仓建议状态为 ${suggestion.status}，无法执行`);
  }

  const sourceInv = store.inventory.find(i =>
    i.warehouse_id === suggestion.from_warehouse_id && i.sku_id === suggestion.sku_id
  );

  if (!sourceInv || sourceInv.available_qty < suggestion.suggested_qty) {
    suggestion.status = TRANSFER_STATUS.FAILED;
    suggestion.updated_at = now();

    const stockoutObj = store.stockouts.find(s => s.id === stockoutId);
    stockoutObj.status = STOCKOUT_STATUS.TRANSFER_FAILED;
    stockoutObj.updated_at = now();

    addStatusHistory('stockout', stockoutId, stockout.status, STOCKOUT_STATUS.TRANSFER_FAILED, operator, '换仓库存不足');
    saveData();

    return {
      success: false,
      error: '源仓库库存不足',
      source_available: sourceInv ? sourceInv.available_qty : 0,
      requested: suggestion.suggested_qty
    };
  }

  sourceInv.available_qty -= suggestion.suggested_qty;

  const destInv = store.inventory.find(i =>
    i.warehouse_id === suggestion.to_warehouse_id && i.sku_id === suggestion.sku_id
  );
  if (destInv) {
    destInv.available_qty += suggestion.suggested_qty;
  }

  suggestion.status = TRANSFER_STATUS.SUCCESS;
  suggestion.updated_at = now();

  const stockoutObj = store.stockouts.find(s => s.id === stockoutId);
  stockoutObj.status = STOCKOUT_STATUS.TRANSFER_SUCCESS;
  stockoutObj.updated_at = now();

  const line = store.order_lines.find(l => l.id === stockout.order_line_id);
  if (line) {
    line.picked_qty += stockout.shortage_qty;
    line.status = LINE_STATUS.PICKED;
    line.updated_at = now();
  }

  addStatusHistory('stockout', stockoutId, stockout.status, STOCKOUT_STATUS.TRANSFER_SUCCESS, operator, '换仓成功');
  saveData();

  return {
    success: true,
    stockout: getStockoutById(stockoutId),
    suggestion: suggestion
  };
}

function retainStockout(stockoutId, operator) {
  const stockout = getStockoutById(stockoutId);
  if (!stockout) throw new Error('缺货记录不存在');

  const stockoutObj = store.stockouts.find(s => s.id === stockoutId);
  stockoutObj.status = STOCKOUT_STATUS.RETAINED;
  stockoutObj.updated_at = now();

  const line = store.order_lines.find(l => l.id === stockout.order_line_id);
  if (line) {
    line.status = LINE_STATUS.RETAINED;
    line.updated_at = now();
  }

  const order = store.orders.find(o => o.id === stockout.order_id);
  if (order) {
    order.status = ORDER_STATUS.DELAYED;
    order.updated_at = now();
    addStatusHistory('order', order.id, order.status, ORDER_STATUS.DELAYED, operator, '缺货商品保留等待补货');
  }

  addStatusHistory('stockout', stockoutId, stockout.status, STOCKOUT_STATUS.RETAINED, operator, '选择保留，等待补货');
  saveData();

  return getStockoutById(stockoutId);
}

function completeWave(waveId, operator) {
  const wave = getWaveById(waveId);
  if (!wave) throw new Error('波次不存在');

  const pendingStockouts = store.stockouts.filter(s =>
    s.wave_id === waveId && ['pending', 'transfering'].includes(s.status)
  );

  if (pendingStockouts.length > 0) {
    throw new Error(`波次还有 ${pendingStockouts.length} 个缺货未处理`);
  }

  const waveObj = store.waves.find(w => w.id === waveId);
  waveObj.status = WAVE_STATUS.COMPLETED;
  waveObj.updated_at = now();

  const waveOrders = store.wave_orders.filter(wo => wo.wave_id === waveId);
  for (const wo of waveOrders) {
    const lines = store.order_lines.filter(l => l.order_id === wo.order_id);
    const pendingLines = lines.filter(l =>
      !['shipped', 'picked', 'retained', 'cancelled'].includes(l.status)
    );

    if (pendingLines.length === 0) {
      const order = store.orders.find(o => o.id === wo.order_id);
      if (order) {
        const newStatus = order.status === ORDER_STATUS.DELAYED
          ? ORDER_STATUS.PARTIAL_SHIPPED
          : ORDER_STATUS.SHIPPED;

        const oldStatus = order.status;
        order.status = newStatus;
        order.updated_at = now();
        addStatusHistory('order', order.id, oldStatus, newStatus, operator, `波次 ${wave.wave_no} 完成`);
      }
    }
  }

  addStatusHistory('wave', waveId, wave.status, WAVE_STATUS.COMPLETED, operator, '波次完成');
  saveData();

  return getWaveById(waveId);
}

function listWaves(filters = {}) {
  let waves = store.waves.map(w => {
    const wh = store.warehouses.find(h => h.id === w.warehouse_id);
    return {
      ...w,
      warehouse_code: wh ? wh.code : null,
      warehouse_name: wh ? wh.name : null
    };
  });

  if (filters.status) {
    waves = waves.filter(w => w.status === filters.status);
  }
  if (filters.wave_no) {
    waves = waves.filter(w => w.wave_no.includes(filters.wave_no));
  }

  return waves.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getIdempotentKey(requestKey) {
  const record = store.idempotency.find(r => r.request_key === requestKey);
  return record ? JSON.parse(record.response) : null;
}

function saveIdempotentKey(requestKey, response) {
  store.idempotency.push({
    id: `idem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    request_key: requestKey,
    response: JSON.stringify(response),
    created_at: now()
  });
  saveData();
}

function withIdempotency(requestKey, handler) {
  const existing = getIdempotentKey(requestKey);
  if (existing) {
    return {
      isIdempotent: true,
      data: existing
    };
  }

  const result = handler();
  saveIdempotentKey(requestKey, result);

  return {
    isIdempotent: false,
    data: result
  };
}

function generateWaveReport(waveId) {
  const wave = store.waves.find(w => w.id === waveId);
  if (!wave) return null;

  const warehouse = store.warehouses.find(wh => wh.id === wave.warehouse_id);

  const waveOrders = store.wave_orders.filter(wo => wo.wave_id === waveId).map(wo => {
    const order = store.orders.find(o => o.id === wo.order_id);
    const lines = store.order_lines.filter(l => l.order_id === wo.order_id);
    const stockouts = store.stockouts.filter(s => s.wave_id === waveId && s.order_id === wo.order_id);

    return {
      ...wo,
      order_no: order ? order.order_no : null,
      order_status: order ? order.status : null,
      customer: order ? order.customer_name : null,
      total_amount: order ? order.total_amount : 0,
      shipping_fee: order ? order.shipping_fee : 0,
      lines: lines.map(l => ({
        sku_code: l.sku_code,
        sku_name: l.sku_name,
        qty: l.qty,
        picked_qty: l.picked_qty,
        price: l.price,
        amount: l.amount,
        status: l.status
      })),
      stockouts: stockouts.map(s => ({
        sku_code: s.sku_code,
        sku_name: s.sku_name,
        requested_qty: s.requested_qty,
        available_qty: s.available_qty,
        shortage_qty: s.shortage_qty,
        reason: s.reason,
        status: s.status
      }))
    };
  });

  const stockouts = store.stockouts.filter(s => s.wave_id === waveId).map(s => {
    const wh = store.warehouses.find(h => h.id === s.warehouse_id);
    const order = store.orders.find(o => o.id === s.order_id);
    return {
      ...s,
      warehouse_code: wh ? wh.code : null,
      warehouse_name: wh ? wh.name : null,
      order_no: order ? order.order_no : null,
      customer: order ? order.customer_name : null
    };
  });

  const suggestions = store.transfer_suggestions.filter(t => {
    const stockout = store.stockouts.find(s => s.id === t.stockout_id);
    return stockout && stockout.wave_id === waveId;
  }).map(t => {
    const fromWh = store.warehouses.find(wh => wh.id === t.from_warehouse_id);
    const toWh = store.warehouses.find(wh => wh.id === t.to_warehouse_id);
    const sku = store.skus.find(s => s.id === t.sku_id);
    return {
      ...t,
      from_warehouse_code: fromWh ? fromWh.code : null,
      from_warehouse_name: fromWh ? fromWh.name : null,
      to_warehouse_code: toWh ? toWh.code : null,
      to_warehouse_name: toWh ? toWh.name : null,
      sku_code: sku ? sku.code : null,
      sku_name: sku ? sku.name : null,
      from_warehouse: fromWh ? `${fromWh.code} - ${fromWh.name}` : null,
      to_warehouse: toWh ? `${toWh.code} - ${toWh.name}` : null
    };
  });

  const delayedOrders = store.orders.filter(o => {
    const wo = store.wave_orders.find(w => w.wave_id === waveId && w.order_id === o.id);
    return wo && o.status === ORDER_STATUS.DELAYED;
  }).map(o => ({
    order_no: o.order_no,
    customer_name: o.customer_name,
    total_amount: o.total_amount,
    created_at: o.created_at
  }));

  const stats = {
    total_orders: wave.order_count,
    total_skus: wave.total_sku_count,
    stockout_count: stockouts.length,
    resolved_stockout_count: stockouts.filter(s => ['split', 'transfer_success', 'retained'].includes(s.status)).length,
    pending_stockout_count: stockouts.filter(s => ['pending', 'transfering'].includes(s.status)).length,
    transfer_success_count: suggestions.filter(s => s.status === 'success').length,
    transfer_failed_count: suggestions.filter(s => s.status === 'failed').length,
    delayed_order_count: delayedOrders.length
  };

  return {
    wave: {
      wave_no: wave.wave_no,
      warehouse: warehouse ? `${warehouse.code} - ${warehouse.name}` : null,
      status: wave.status,
      created_at: wave.created_at,
      updated_at: wave.updated_at
    },
    statistics: stats,
    orders: waveOrders,
    transfer_suggestions: suggestions,
    delayed_orders: delayedOrders,
    generated_at: now()
  };
}

function generateStockoutReport(filters = {}) {
  let stockouts = store.stockouts.map(s => {
    const wh = store.warehouses.find(h => h.id === s.warehouse_id);
    const order = store.orders.find(o => o.id === s.order_id);
    const wave = store.waves.find(w => w.id === s.wave_id);
    return {
      ...s,
      warehouse_code: wh ? wh.code : null,
      warehouse_name: wh ? wh.name : null,
      order_no: order ? order.order_no : null,
      customer: order ? order.customer_name : null,
      customer_phone: order ? order.customer_phone : null,
      wave_no: wave ? wave.wave_no : null
    };
  });

  if (filters.wave_no) {
    stockouts = stockouts.filter(s => s.wave_no === filters.wave_no);
  }
  if (filters.status) {
    stockouts = stockouts.filter(s => s.status === filters.status);
  }
  if (filters.sku_code) {
    stockouts = stockouts.filter(s => s.sku_code.includes(filters.sku_code));
  }

  stockouts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const stats = {
    total_stockouts: stockouts.length,
    by_status: {
      pending: stockouts.filter(s => s.status === 'pending').length,
      split: stockouts.filter(s => s.status === 'split').length,
      transfer_success: stockouts.filter(s => s.status === 'transfer_success').length,
      transfer_failed: stockouts.filter(s => s.status === 'transfer_failed').length,
      retained: stockouts.filter(s => s.status === 'retained').length
    },
    total_shortage_qty: stockouts.reduce((sum, s) => sum + s.shortage_qty, 0)
  };

  return {
    statistics: stats,
    stockouts: stockouts.map(s => ({
      stockout_id: s.id,
      wave_no: s.wave_no,
      order_no: s.order_no,
      customer: s.customer,
      warehouse: `${s.warehouse_code} - ${s.warehouse_name}`,
      sku_code: s.sku_code,
      sku_name: s.sku_name,
      requested_qty: s.requested_qty,
      available_qty: s.available_qty,
      shortage_qty: s.shortage_qty,
      reason: s.reason,
      status: s.status,
      operator: s.operator,
      created_at: s.created_at,
      updated_at: s.updated_at
    })),
    generated_at: now()
  };
}

function generateOrderHierarchyReport(orderId) {
  const order = store.orders.find(o => o.id === orderId);
  if (!order) return null;

  const rootOrderId = order.parent_order_id || order.id;
  const rootOrder = store.orders.find(o => o.id === rootOrderId);

  const allRelatedOrders = store.orders.filter(o =>
    o.id === rootOrderId || o.parent_order_id === rootOrderId
  ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const linesByOrder = {};
  for (const o of allRelatedOrders) {
    linesByOrder[o.id] = store.order_lines.filter(l => l.order_id === o.id);
  }

  return {
    root_order: {
      order_no: rootOrder.order_no,
      status: rootOrder.status,
      split_count: rootOrder.split_count,
      created_at: rootOrder.created_at
    },
    related_orders: allRelatedOrders.map(o => {
      const parentOrder = o.parent_order_id ? store.orders.find(x => x.id === o.parent_order_id) : null;
      return {
        order_no: o.order_no,
        parent_order_no: parentOrder ? parentOrder.order_no : null,
        is_root: !o.parent_order_id,
        status: o.status,
        total_amount: o.total_amount,
        shipping_fee: o.shipping_fee,
        lines: linesByOrder[o.id].map(l => ({
          sku_code: l.sku_code,
          sku_name: l.sku_name,
          qty: l.qty,
          picked_qty: l.picked_qty,
          price: l.price,
          amount: l.amount,
          status: l.status
        }))
      };
    }),
    generated_at: now()
  };
}

function generateInventoryChangeReport(waveId) {
  const wave = store.waves.find(w => w.id === waveId);
  if (!wave) return null;

  const warehouse = store.warehouses.find(wh => wh.id === wave.warehouse_id);

  const locks = store.inventory_locks.filter(l => l.wave_id === waveId).map(l => {
    const sku = store.skus.find(s => s.id === l.sku_id);
    return {
      ...l,
      sku_code: sku ? sku.code : null,
      sku_name: sku ? sku.name : null
    };
  }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const currentInventory = store.inventory.filter(i => i.warehouse_id === wave.warehouse_id).map(inv => {
    const sku = store.skus.find(s => s.id === inv.sku_id);
    return {
      ...inv,
      sku_code: sku ? sku.code : null,
      sku_name: sku ? sku.name : null
    };
  }).sort((a, b) => (a.sku_code || '').localeCompare(b.sku_code || ''));

  const stats = {
    total_locks: locks.length,
    active_locks: locks.filter(l => l.status === 'active').length,
    consumed_locks: locks.filter(l => l.status === 'consumed').length,
    released_locks: locks.filter(l => l.status === 'released').length
  };

  return {
    wave: {
      wave_no: wave.wave_no,
      warehouse: warehouse ? `${warehouse.code} - ${warehouse.name}` : null
    },
    statistics: stats,
    lock_history: locks.map(l => ({
      sku_code: l.sku_code,
      sku_name: l.sku_name,
      qty: l.qty,
      status: l.status,
      created_at: l.created_at
    })),
    current_inventory: currentInventory.map(inv => ({
      sku_code: inv.sku_code,
      sku_name: inv.sku_name,
      available_qty: inv.available_qty,
      locked_qty: inv.locked_qty
    })),
    generated_at: now()
  };
}

module.exports = {
  ORDER_STATUS,
  LINE_STATUS,
  WAVE_STATUS,
  STOCKOUT_STATUS,
  TRANSFER_STATUS,
  createOrder,
  getOrderById,
  getOrderByNo,
  updateOrderStatus,
  updateLineStatus,
  listOrders,
  correctOrderStatus,
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
  listWaves,
  getIdempotentKey,
  saveIdempotentKey,
  withIdempotency,
  generateWaveReport,
  generateStockoutReport,
  generateOrderHierarchyReport,
  generateInventoryChangeReport,
  findAvailableWarehouses
};
