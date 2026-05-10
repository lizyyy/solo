const fs = require('fs');
const path = require('path');

class ExportManager {
  constructor(store) {
    this.store = store;
  }

  exportWave(waveId, outputDir) {
    const wave = this.store.getWaveById(waveId);
    if (!wave) {
      return { success: false, error: `波次不存在: ${waveId}` };
    }

    if (!wave.isConfirmed) {
      return {
        success: false,
        error: `波次尚未确认，当前状态: ${wave.status}`
      };
    }

    const orders = this._getWaveOrders(wave);
    const pickingList = this._generatePickingList(wave, orders);
    const pickingTickets = this._generatePickingTickets(wave, orders);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const waveDir = path.join(outputDir, waveId);
    if (!fs.existsSync(waveDir)) {
      fs.mkdirSync(waveDir, { recursive: true });
    }

    const summaryPath = path.join(waveDir, 'summary.json');
    const pickingListPath = path.join(waveDir, 'picking-list.json');
    const ticketsPath = path.join(waveDir, 'picking-tickets.json');

    fs.writeFileSync(summaryPath, JSON.stringify(wave.toJSON(), null, 2));
    fs.writeFileSync(pickingListPath, JSON.stringify(pickingList, null, 2));
    fs.writeFileSync(ticketsPath, JSON.stringify(pickingTickets, null, 2));

    return {
      success: true,
      waveId,
      files: {
        summary: summaryPath,
        pickingList: pickingListPath,
        pickingTickets: ticketsPath
      },
      orderCount: orders.length,
      pickingItemCount: pickingList.length
    };
  }

  _getWaveOrders(wave) {
    const orders = [];
    for (const orderId of wave.orderIds) {
      const order = this.store.getOrderById(orderId);
      if (order) {
        orders.push(order);
      }
    }
    return orders;
  }

  _generatePickingList(wave, orders) {
    const pickingMap = new Map();

    for (const allocation of wave.allocations) {
      const key = `${allocation.locationCode}|${allocation.sku}`;
      if (!pickingMap.has(key)) {
        pickingMap.set(key, {
          waveId: wave.waveId,
          locationCode: allocation.locationCode,
          sku: allocation.sku,
          totalQty: 0,
          orders: []
        });
      }
      const item = pickingMap.get(key);
      item.totalQty += allocation.qty;
      item.orders.push({
        orderId: allocation.orderId,
        orderNumber: allocation.orderNumber,
        qty: allocation.qty
      });
    }

    const list = Array.from(pickingMap.values());
    list.sort((a, b) => {
      return a.locationCode.localeCompare(b.locationCode);
    });

    return list;
  }

  _generatePickingTickets(wave, orders) {
    const tickets = [];

    for (const order of orders) {
      const orderAllocations = wave.allocations.filter(
        a => a.orderId === order.orderId
      );

      const items = orderAllocations.map(a => ({
        sku: a.sku,
        locationCode: a.locationCode,
        qty: a.qty
      }));

      tickets.push({
        waveId: wave.waveId,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        carrierCode: order.carrierCode,
        customerName: order.customerName,
        shippingAddress: order.shippingAddress,
        items
      });
    }

    return tickets;
  }

  exportWaveAsCsv(waveId, outputDir) {
    const wave = this.store.getWaveById(waveId);
    if (!wave) {
      return { success: false, error: `波次不存在: ${waveId}` };
    }

    const orders = this._getWaveOrders(wave);
    const pickingList = this._generatePickingList(wave, orders);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const waveDir = path.join(outputDir, waveId);
    if (!fs.existsSync(waveDir)) {
      fs.mkdirSync(waveDir, { recursive: true });
    }

    const csvPath = path.join(waveDir, 'picking-list.csv');
    const lines = ['locationCode,sku,totalQty,orderNumbers'];

    for (const item of pickingList) {
      const orderNumbers = item.orders.map(o => o.orderNumber).join(';');
      lines.push(`${item.locationCode},${item.sku},${item.totalQty},${orderNumbers}`);
    }

    fs.writeFileSync(csvPath, lines.join('\n'));

    return {
      success: true,
      waveId,
      file: csvPath
    };
  }
}

module.exports = ExportManager;
