const fs = require('fs');
const path = require('path');

class Importer {
  static importFromFile(filePath, store) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();

    if (ext === '.json') {
      return Importer._importJSON(filePath, store);
    } else if (ext === '.csv') {
      return Importer._importCSV(filePath, store);
    }
    throw new Error(`不支持的文件格式: ${ext}`);
  }

  static _importJSON(filePath, store) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const fileName = path.basename(filePath).toLowerCase();

    if (fileName.includes('carrier')) {
      return Importer._importCarriers(data, store);
    } else if (fileName.includes('product')) {
      return Importer._importProducts(data, store);
    } else if (fileName.includes('location')) {
      return Importer._importLocations(data, store);
    } else if (fileName.includes('inventory') || fileName.includes('stock')) {
      return Importer._importInventories(data, store);
    } else if (fileName.includes('order')) {
      return Importer._importOrders(data, store);
    }
    throw new Error('无法识别的数据文件类型，请检查文件名');
  }

  static _importCSV(filePath, store) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    if (lines.length < 2) return { imported: 0 };

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const fileName = path.basename(filePath).toLowerCase();

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const record = {};
      headers.forEach((header, idx) => {
        record[header] = values[idx];
      });
      records.push(record);
    }

    if (fileName.includes('carrier')) {
      return Importer._importCarriers(records, store);
    } else if (fileName.includes('product')) {
      return Importer._importProducts(records, store);
    } else if (fileName.includes('location')) {
      return Importer._importLocations(records, store);
    } else if (fileName.includes('inventory') || fileName.includes('stock')) {
      return Importer._importInventories(records, store);
    } else if (fileName.includes('order')) {
      return Importer._importOrdersFromCSV(records, store);
    }
    throw new Error('无法识别的数据文件类型，请检查文件名');
  }

  static _importCarriers(data, store) {
    let count = 0;
    for (const item of data) {
      store.addCarrier(item);
      count++;
    }
    return { imported: count, type: 'carriers' };
  }

  static _importProducts(data, store) {
    let count = 0;
    for (const item of data) {
      store.addProduct(item);
      count++;
    }
    return { imported: count, type: 'products' };
  }

  static _importLocations(data, store) {
    let count = 0;
    for (const item of data) {
      store.addLocation(item);
      count++;
    }
    return { imported: count, type: 'locations' };
  }

  static _importInventories(data, store) {
    let count = 0;
    for (const item of data) {
      store.addInventory(item);
      count++;
    }
    return { imported: count, type: 'inventories' };
  }

  static _importOrders(data, store) {
    let count = 0;
    for (const item of data) {
      store.addOrder(item);
      count++;
    }
    return { imported: count, type: 'orders' };
  }

  static _importOrdersFromCSV(records, store) {
    const orderMap = new Map();
    for (const record of records) {
      const orderNumber = record['ordernumber'] || record['order_id'] || record['id'];
      if (!orderNumber) continue;

      if (!orderMap.has(orderNumber)) {
        orderMap.set(orderNumber, {
          orderNumber,
          status: record['status'] || 'PENDING',
          carrierCode: record['carriercode'] || record['carrier'],
          carrierName: record['carriername'] || '',
          customerName: record['customername'] || '',
          orderDate: record['orderdate'] || record['date'],
          shippingAddress: record['shippingaddress'] || record['address'] || '',
          totalAmount: record['totalamount'] || record['total'] || '0',
          items: []
        });
      }

      const order = orderMap.get(orderNumber);
      const sku = record['sku'] || record['productsku'];
      if (sku) {
        order.items.push({
          sku,
          qty: record['qty'] || record['quantity'] || '1',
          unitPrice: record['unitprice'] || record['price'] || '0'
        });
      }
    }

    let count = 0;
    for (const order of orderMap.values()) {
      store.addOrder(order);
      count++;
    }
    return { imported: count, type: 'orders' };
  }
}

module.exports = Importer;
