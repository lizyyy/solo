const storage = require('../storage/file-storage');
const { InventoryItem, StockOperation, StockOperationType } = require('../models/inventory');
const { generateStockRecordId, generateExceptionId } = require('../utils/id-generator');
const { ExceptionRecord, ExceptionType, ExceptionSeverity } = require('../models/exception');

class InventoryService {
  getInventory(storeId, sku) {
    const inventoryList = storage.getInventory();
    const item = inventoryList.find(i => i.storeId === storeId && i.sku === sku);
    return item ? InventoryItem.fromJSON(item) : null;
  }
  
  createOrUpdateInventory(storeId, sku, totalStock) {
    const inventoryList = storage.getInventory();
    const index = inventoryList.findIndex(i => i.storeId === storeId && i.sku === sku);
    
    if (index !== -1) {
      const existing = InventoryItem.fromJSON(inventoryList[index]);
      const delta = totalStock - existing.totalStock;
      existing.availableStock += delta;
      existing.totalStock = totalStock;
      inventoryList[index] = existing.toJSON();
    } else {
      const newItem = new InventoryItem({
        sku: sku,
        storeId: storeId,
        totalStock: totalStock,
        availableStock: totalStock,
        reservedStock: 0
      });
      inventoryList.push(newItem.toJSON());
    }
    
    storage.saveInventory(inventoryList);
    return true;
  }
  
  reserveStock(orderId, storeId, items) {
    const inventoryList = storage.getInventory();
    const stockOperations = storage.getStockOperations();
    const results = [];
    
    for (const item of items) {
      const index = inventoryList.findIndex(i => i.storeId === storeId && i.sku === item.sku);
      if (index === -1) {
        this._recordException(orderId, ExceptionType.STOCK_RESERVE_FAILED, 
          `商品 ${item.sku} 在门店 ${storeId} 不存在`, 
          { sku: item.sku, storeId, quantity: item.quantity });
        results.push({ sku: item.sku, success: false, reason: '商品不存在' });
        continue;
      }
      
      const inventory = InventoryItem.fromJSON(inventoryList[index]);
      const previousReserved = inventory.reservedStock;
      const previousAvailable = inventory.availableStock;
      
      const reserveResult = inventory.reserve(item.quantity);
      if (!reserveResult.success) {
        this._recordException(orderId, ExceptionType.STOCK_RESERVE_FAILED, 
          reserveResult.reason, 
          { sku: item.sku, storeId, quantity: item.quantity, 
            available: previousAvailable });
        results.push({ sku: item.sku, success: false, reason: reserveResult.reason });
        continue;
      }
      
      inventoryList[index] = inventory.toJSON();
      
      stockOperations.push(new StockOperation({
        operationId: generateStockRecordId(),
        orderId: orderId,
        storeId: storeId,
        sku: item.sku,
        quantity: item.quantity,
        operationType: StockOperationType.RESERVE,
        operator: 'system',
        reason: '订单预留库存',
        previousReserved: previousReserved,
        previousAvailable: previousAvailable,
        newReserved: inventory.reservedStock,
        newAvailable: inventory.availableStock
      }).toJSON());
      
      results.push({ sku: item.sku, success: true });
    }
    
    storage.saveInventory(inventoryList);
    storage.saveStockOperations(stockOperations);
    
    const allSuccess = results.every(r => r.success);
    if (!allSuccess) {
      return {
        success: false,
        reason: '部分商品预留库存失败',
        details: results
      };
    }
    
    return { success: true };
  }
  
  restoreStock(orderId, storeId, items, reason = '超时释放库存回补') {
    const inventoryList = storage.getInventory();
    const stockOperations = storage.getStockOperations();
    const results = [];
    
    for (const item of items) {
      const index = inventoryList.findIndex(i => i.storeId === storeId && i.sku === item.sku);
      if (index === -1) {
        this._recordException(orderId, ExceptionType.STOCK_RESTORE_FAILED, 
          `商品 ${item.sku} 在门店 ${storeId} 不存在`, 
          { sku: item.sku, storeId, quantity: item.quantity });
        results.push({ sku: item.sku, success: false, reason: '商品不存在' });
        continue;
      }
      
      const inventory = InventoryItem.fromJSON(inventoryList[index]);
      const previousReserved = inventory.reservedStock;
      const previousAvailable = inventory.availableStock;
      
      const restoreResult = inventory.restore(item.quantity);
      if (!restoreResult.success) {
        this._recordException(orderId, ExceptionType.STOCK_RESTORE_FAILED, 
          restoreResult.reason, 
          { sku: item.sku, storeId, quantity: item.quantity, 
            reserved: previousReserved });
        results.push({ sku: item.sku, success: false, reason: restoreResult.reason });
        continue;
      }
      
      inventoryList[index] = inventory.toJSON();
      
      stockOperations.push(new StockOperation({
        operationId: generateStockRecordId(),
        orderId: orderId,
        storeId: storeId,
        sku: item.sku,
        quantity: item.quantity,
        operationType: StockOperationType.RESTORE,
        operator: 'system',
        reason: reason,
        previousReserved: previousReserved,
        previousAvailable: previousAvailable,
        newReserved: inventory.reservedStock,
        newAvailable: inventory.availableStock
      }).toJSON());
      
      results.push({ sku: item.sku, success: true });
    }
    
    storage.saveInventory(inventoryList);
    storage.saveStockOperations(stockOperations);
    
    return { success: results.every(r => r.success), details: results };
  }
  
  deductStock(orderId, storeId, items, reason = '订单核销扣减库存') {
    const inventoryList = storage.getInventory();
    const stockOperations = storage.getStockOperations();
    const results = [];
    
    for (const item of items) {
      const index = inventoryList.findIndex(i => i.storeId === storeId && i.sku === item.sku);
      if (index === -1) {
        results.push({ sku: item.sku, success: false, reason: '商品不存在' });
        continue;
      }
      
      const inventory = InventoryItem.fromJSON(inventoryList[index]);
      const previousReserved = inventory.reservedStock;
      const previousAvailable = inventory.availableStock;
      
      const deductResult = inventory.deduct(item.quantity);
      if (!deductResult.success) {
        results.push({ sku: item.sku, success: false, reason: deductResult.reason });
        continue;
      }
      
      inventoryList[index] = inventory.toJSON();
      
      stockOperations.push(new StockOperation({
        operationId: generateStockRecordId(),
        orderId: orderId,
        storeId: storeId,
        sku: item.sku,
        quantity: item.quantity,
        operationType: StockOperationType.DEDUCT,
        operator: 'system',
        reason: reason,
        previousReserved: previousReserved,
        previousAvailable: previousAvailable,
        newReserved: inventory.reservedStock,
        newAvailable: inventory.availableStock
      }).toJSON());
      
      results.push({ sku: item.sku, success: true });
    }
    
    storage.saveInventory(inventoryList);
    storage.saveStockOperations(stockOperations);
    
    return { success: results.every(r => r.success), details: results };
  }
  
  _recordException(orderId, type, message, details) {
    const exceptions = storage.getExceptions();
    const exception = new ExceptionRecord({
      exceptionId: generateExceptionId(),
      orderId: orderId,
      exceptionType: type,
      severity: ExceptionSeverity.ERROR,
      message: message,
      details: details
    });
    exceptions.push(exception.toJSON());
    storage.saveExceptions(exceptions);
  }
  
  getStockOperationsByOrder(orderId) {
    const operations = storage.getStockOperations();
    return operations.filter(op => op.orderId === orderId);
  }
  
  getStoreInventory(storeId) {
    const inventoryList = storage.getInventory();
    return inventoryList.filter(i => i.storeId === storeId);
  }
}

module.exports = new InventoryService();
