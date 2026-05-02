const config = require('../config');

class StockError extends Error {
  constructor(message, code = 'STOCK_ERROR') {
    super(message);
    this.name = 'StockError';
    this.code = code;
    this.status = 400;
  }
}

class StockValidator {
  static validateSufficientStock(currentStock, requestedQuantity) {
    if (currentStock < requestedQuantity) {
      throw new StockError(
        `库存不足。当前库存: ${currentStock}, 申请数量: ${requestedQuantity}`,
        'INSUFFICIENT_STOCK'
      );
    }
    return true;
  }

  static validatePositiveQuantity(quantity) {
    if (quantity <= 0) {
      throw new StockError(
        '数量必须大于0',
        'INVALID_QUANTITY'
      );
    }
    return true;
  }

  static validateReturnQuantity(requestedQuantity, returnedQuantity) {
    if (returnedQuantity <= 0) {
      throw new StockError(
        '归还数量必须大于0',
        'INVALID_RETURN_QUANTITY'
      );
    }
    
    if (returnedQuantity > requestedQuantity) {
      throw new StockError(
        `归还数量不能超过申请数量。申请数量: ${requestedQuantity}, 归还数量: ${returnedQuantity}`,
        'RETURN_QUANTITY_EXCEEDS_REQUEST'
      );
    }
    return true;
  }

  static isLowStock(currentStock, threshold = null) {
    const effectiveThreshold = threshold !== null ? threshold : config.alert.stock_threshold;
    return currentStock <= effectiveThreshold;
  }

  static checkLowStock(currentStock, threshold = null) {
    if (this.isLowStock(currentStock, threshold)) {
      throw new StockError(
        `库存低于预警阈值。当前库存: ${currentStock}, 预警阈值: ${threshold !== null ? threshold : config.alert.stock_threshold}`,
        'LOW_STOCK_WARNING'
      );
    }
    return true;
  }

  static validateBatchActive(batchStatus) {
    if (batchStatus !== 'active') {
      throw new StockError(
        `批次状态无效，当前状态: ${batchStatus}`,
        'INACTIVE_BATCH'
      );
    }
    return true;
  }

  static validateStockOperation(currentStock, operationType, quantity) {
    switch (operationType) {
      case 'deduct':
        return this.validateSufficientStock(currentStock, quantity);
      case 'add':
        return this.validatePositiveQuantity(quantity);
      default:
        throw new StockError(
          `无效的库存操作类型: ${operationType}`,
          'INVALID_OPERATION'
        );
    }
  }

  static calculateNewStock(currentStock, operationType, quantity) {
    this.validateStockOperation(currentStock, operationType, quantity);
    
    switch (operationType) {
      case 'deduct':
        return currentStock - quantity;
      case 'add':
        return currentStock + quantity;
      default:
        return currentStock;
    }
  }
}

module.exports = { StockValidator, StockError };
