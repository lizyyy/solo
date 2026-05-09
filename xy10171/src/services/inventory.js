const { query, queryOne, insert, update, transaction } = require('../db');
const { RESERVATION_STATUSES } = require('../constants/statuses');
const { ERROR_CODES } = require('../constants/errorCodes');

function getInventory(sku) {
  return queryOne('inventories', i => i.sku === sku);
}

function upsertInventory(sku, totalQty, availableQty, reservedQty) {
  const existing = queryOne('inventories', i => i.sku === sku);
  if (existing) {
    return update('inventories', i => i.sku === sku, {
      total_qty: totalQty,
      available_qty: availableQty,
      reserved_qty: reservedQty
    });
  }
  return insert('inventories', {
    id: Date.now(),
    sku,
    total_qty: totalQty,
    available_qty: availableQty,
    reserved_qty: reservedQty
  });
}

function reserveInventory(exchangeId, sku, qty) {
  let success = false;
  transaction(() => {
    const inventory = queryOne('inventories', i => i.sku === sku);
    
    if (!inventory || inventory.available_qty < qty) {
      const error = new Error('库存不足');
      error.code = ERROR_CODES.INSUFFICIENT_INVENTORY;
      throw error;
    }

    update('inventories', i => i.sku === sku, {
      available_qty: inventory.available_qty - qty,
      reserved_qty: inventory.reserved_qty + qty
    });

    insert('inventory_reservations', {
      id: Date.now(),
      exchange_id: exchangeId,
      sku,
      qty,
      status: RESERVATION_STATUSES.RESERVED,
      created_at: new Date().toISOString(),
      released_at: null
    });

    success = true;
  });

  return success;
}

function releaseInventory(exchangeId, sku) {
  let success = false;
  transaction(() => {
    const reservation = queryOne(
      'inventory_reservations',
      r => r.exchange_id === exchangeId && r.sku === sku && r.status === RESERVATION_STATUSES.RESERVED
    );

    if (!reservation) {
      success = false;
      return;
    }

    const inventory = queryOne('inventories', i => i.sku === sku);
    if (inventory) {
      update('inventories', i => i.sku === sku, {
        available_qty: inventory.available_qty + reservation.qty,
        reserved_qty: inventory.reserved_qty - reservation.qty
      });
    }

    update(
      'inventory_reservations',
      r => r.id === reservation.id,
      {
        status: RESERVATION_STATUSES.RELEASED,
        released_at: new Date().toISOString()
      }
    );

    success = true;
  });

  return success;
}

function consumeInventory(exchangeId, sku) {
  let success = false;
  transaction(() => {
    const reservation = queryOne(
      'inventory_reservations',
      r => r.exchange_id === exchangeId && r.sku === sku && r.status === RESERVATION_STATUSES.RESERVED
    );

    if (!reservation) {
      success = false;
      return;
    }

    const inventory = queryOne('inventories', i => i.sku === sku);
    if (inventory) {
      update('inventories', i => i.sku === sku, {
        total_qty: inventory.total_qty - reservation.qty,
        reserved_qty: inventory.reserved_qty - reservation.qty
      });
    }

    update(
      'inventory_reservations',
      r => r.id === reservation.id,
      {
        status: RESERVATION_STATUSES.CONSUMED,
        released_at: new Date().toISOString()
      }
    );

    success = true;
  });

  return success;
}

function getInventoryStats() {
  const inventories = query('inventories');
  
  const overview = {
    total_skus: inventories.length,
    total_inventory: inventories.reduce((sum, i) => sum + i.total_qty, 0),
    total_available: inventories.reduce((sum, i) => sum + i.available_qty, 0),
    total_reserved: inventories.reduce((sum, i) => sum + i.reserved_qty, 0)
  };

  const reservations = query('inventory_reservations');
  const grouped = {};
  reservations.forEach(r => {
    if (!grouped[r.status]) {
      grouped[r.status] = { count: 0, total_qty: 0 };
    }
    grouped[r.status].count++;
    grouped[r.status].total_qty += r.qty;
  });

  const reservationStats = Object.keys(grouped).map(status => ({
    status,
    count: grouped[status].count,
    total_qty: grouped[status].total_qty
  }));

  return {
    overview,
    reservations: reservationStats
  };
}

module.exports = {
  getInventory,
  upsertInventory,
  reserveInventory,
  releaseInventory,
  consumeInventory,
  getInventoryStats
};
