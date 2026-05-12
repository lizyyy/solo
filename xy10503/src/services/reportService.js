const db = require('../config/database');

function generateWaveReport(waveId) {
  const wave = db.prepare(`
    SELECT w.*, wh.code as warehouse_code, wh.name as warehouse_name
    FROM waves w
    JOIN warehouses wh ON w.warehouse_id = wh.id
    WHERE w.id = ?
  `).get(waveId);

  if (!wave) return null;

  const waveOrders = db.prepare(`
    SELECT wo.*, o.order_no, o.status as order_status, o.total_amount, o.shipping_fee,
           o.customer_name, o.customer_phone
    FROM wave_orders wo
    JOIN orders o ON wo.order_id = o.id
    WHERE wo.wave_id = ?
    ORDER BY wo.created_at ASC
  `).all(waveId);

  const orderDetails = waveOrders.map(wo => {
    const lines = db.prepare(`
      SELECT * FROM order_lines WHERE order_id = ?
    `).all(wo.order_id);

    const stockouts = db.prepare(`
      SELECT s.* FROM stockouts s
      WHERE s.wave_id = ? AND s.order_id = ?
    `).all(waveId, wo.order_id);

    return {
      ...wo,
      lines,
      stockouts
    };
  });

  const stockouts = db.prepare(`
    SELECT s.*, wh.code as warehouse_code, wh.name as warehouse_name,
           o.order_no, o.customer_name
    FROM stockouts s
    JOIN warehouses wh ON s.warehouse_id = wh.id
    JOIN orders o ON s.order_id = o.id
    WHERE s.wave_id = ?
    ORDER BY s.created_at ASC
  `).all(waveId);

  const suggestions = db.prepare(`
    SELECT ts.*, from_wh.code as from_warehouse_code, from_wh.name as from_warehouse_name,
           to_wh.code as to_warehouse_code, to_wh.name as to_warehouse_name,
           sku.code as sku_code, sku.name as sku_name,
           s.order_line_id
    FROM transfer_suggestions ts
    JOIN warehouses from_wh ON ts.from_warehouse_id = from_wh.id
    JOIN warehouses to_wh ON ts.to_warehouse_id = to_wh.id
    JOIN skus sku ON ts.sku_id = sku.id
    JOIN stockouts s ON ts.stockout_id = s.id
    WHERE s.wave_id = ?
    ORDER BY ts.created_at ASC
  `).all(waveId);

  const delayedOrders = db.prepare(`
    SELECT o.* FROM orders o
    JOIN wave_orders wo ON o.id = wo.order_id
    WHERE wo.wave_id = ? AND o.status = 'delayed'
  `).all(waveId);

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
      warehouse: `${wave.warehouse_code} - ${wave.warehouse_name}`,
      status: wave.status,
      created_at: wave.created_at,
      updated_at: wave.updated_at
    },
    statistics: stats,
    orders: orderDetails.map(o => ({
      order_no: o.order_no,
      status: o.order_status,
      customer: o.customer_name,
      total_amount: o.total_amount,
      shipping_fee: o.shipping_fee,
      lines: o.lines.map(l => ({
        sku_code: l.sku_code,
        sku_name: l.sku_name,
        qty: l.qty,
        picked_qty: l.picked_qty,
        price: l.price,
        amount: l.amount,
        status: l.status
      })),
      stockouts: o.stockouts.map(s => ({
        sku_code: s.sku_code,
        sku_name: s.sku_name,
        requested_qty: s.requested_qty,
        available_qty: s.available_qty,
        shortage_qty: s.shortage_qty,
        reason: s.reason,
        status: s.status
      }))
    })),
    transfer_suggestions: suggestions.map(s => ({
      sku_code: s.sku_code,
      sku_name: s.sku_name,
      from_warehouse: `${s.from_warehouse_code} - ${s.from_warehouse_name}`,
      to_warehouse: `${s.to_warehouse_code} - ${s.to_warehouse_name}`,
      suggested_qty: s.suggested_qty,
      available_qty: s.available_qty,
      status: s.status
    })),
    delayed_orders: delayedOrders.map(o => ({
      order_no: o.order_no,
      customer_name: o.customer_name,
      total_amount: o.total_amount,
      created_at: o.created_at
    })),
    generated_at: new Date().toISOString()
  };
}

function generateStockoutReport(filters = {}) {
  let query = `
    SELECT s.*, wh.code as warehouse_code, wh.name as warehouse_name,
           o.order_no, o.customer_name, o.customer_phone,
           w.wave_no
    FROM stockouts s
    JOIN warehouses wh ON s.warehouse_id = wh.id
    JOIN orders o ON s.order_id = o.id
    JOIN waves w ON s.wave_id = w.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.wave_no) {
    query += ' AND w.wave_no = ?';
    params.push(filters.wave_no);
  }
  if (filters.status) {
    query += ' AND s.status = ?';
    params.push(filters.status);
  }
  if (filters.sku_code) {
    query += ' AND s.sku_code LIKE ?';
    params.push(`%${filters.sku_code}%`);
  }

  query += ' ORDER BY s.created_at DESC';

  const stockouts = db.prepare(query).all(...params);

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
      customer: s.customer_name,
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
    generated_at: new Date().toISOString()
  };
}

function generateOrderHierarchyReport(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;

  const rootOrderId = order.parent_order_id || order.id;
  const rootOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(rootOrderId);

  const allRelatedOrders = db.prepare(`
    SELECT * FROM orders WHERE id = ? OR parent_order_id = ?
    ORDER BY created_at ASC
  `).all(rootOrderId, rootOrderId);

  const linesByOrder = {};
  for (const o of allRelatedOrders) {
    linesByOrder[o.id] = db.prepare('SELECT * FROM order_lines WHERE order_id = ?').all(o.id);
  }

  return {
    root_order: {
      order_no: rootOrder.order_no,
      status: rootOrder.status,
      split_count: rootOrder.split_count,
      created_at: rootOrder.created_at
    },
    related_orders: allRelatedOrders.map(o => ({
      order_no: o.order_no,
      parent_order_no: o.parent_order_id
        ? db.prepare('SELECT order_no FROM orders WHERE id = ?').get(o.parent_order_id)?.order_no
        : null,
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
    })),
    generated_at: new Date().toISOString()
  };
}

function generateInventoryChangeReport(waveId) {
  const wave = db.prepare(`
    SELECT w.*, wh.code as warehouse_code, wh.name as warehouse_name
    FROM waves w
    JOIN warehouses wh ON w.warehouse_id = wh.id
    WHERE w.id = ?
  `).get(waveId);

  if (!wave) return null;

  const locks = db.prepare(`
    SELECT il.*, sku.code as sku_code, sku.name as sku_name
    FROM inventory_locks il
    JOIN skus sku ON il.sku_id = sku.id
    WHERE il.wave_id = ?
    ORDER BY il.created_at ASC
  `).all(waveId);

  const currentInventory = db.prepare(`
    SELECT inv.*, sku.code as sku_code, sku.name as sku_name
    FROM inventory inv
    JOIN skus sku ON inv.sku_id = sku.id
    WHERE inv.warehouse_id = ?
    ORDER BY sku.code ASC
  `).all(wave.warehouse_id);

  const stats = {
    total_locks: locks.length,
    active_locks: locks.filter(l => l.status === 'active').length,
    consumed_locks: locks.filter(l => l.status === 'consumed').length,
    released_locks: locks.filter(l => l.status === 'released').length
  };

  return {
    wave: {
      wave_no: wave.wave_no,
      warehouse: `${wave.warehouse_code} - ${wave.warehouse_name}`
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
    generated_at: new Date().toISOString()
  };
}

module.exports = {
  generateWaveReport,
  generateStockoutReport,
  generateOrderHierarchyReport,
  generateInventoryChangeReport
};
