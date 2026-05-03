import { Warehouse, Shelf, Aisle, PackingStation, SKULocation, Order } from './models.js';

export class ValidationError extends Error {
  constructor(message, field, row) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.row = row;
  }
}

export class DataValidator {
  static validateWarehouse(data) {
    const errors = [];
    const warnings = [];

    if (!data) {
      errors.push(new ValidationError('仓库数据为空', 'root'));
      return { valid: false, errors, warnings };
    }

    if (!data.dimensions) {
      errors.push(new ValidationError('缺少仓库尺寸信息', 'dimensions'));
    } else {
      if (typeof data.dimensions.width !== 'number' || data.dimensions.width <= 0) {
        errors.push(new ValidationError('仓库宽度必须是大于0的数字', 'dimensions.width'));
      }
      if (typeof data.dimensions.height !== 'number' || data.dimensions.height <= 0) {
        errors.push(new ValidationError('仓库高度必须是大于0的数字', 'dimensions.height'));
      }
    }

    if (!data.shelves || !Array.isArray(data.shelves)) {
      errors.push(new ValidationError('缺少货架数据或格式错误', 'shelves'));
    } else {
      data.shelves.forEach((shelf, index) => {
        const shelfErrors = this.validateShelf(shelf, index + 1);
        errors.push(...shelfErrors);
      });
    }

    if (data.packingStations && Array.isArray(data.packingStations)) {
      data.packingStations.forEach((station, index) => {
        const stationErrors = this.validatePackingStation(station, index + 1);
        errors.push(...stationErrors);
      });
    } else {
      warnings.push(new ValidationError('缺少打包台配置，将使用默认位置', 'packingStations'));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateShelf(shelf, rowNum) {
    const errors = [];

    if (!shelf.id) {
      errors.push(new ValidationError(`第 ${rowNum} 个货架缺少 ID`, 'shelf.id', rowNum));
    }
    if (typeof shelf.x !== 'number') {
      errors.push(new ValidationError(`货架 ${shelf.id || rowNum} 的 X 坐标必须是数字`, 'shelf.x', rowNum));
    }
    if (typeof shelf.y !== 'number') {
      errors.push(new ValidationError(`货架 ${shelf.id || rowNum} 的 Y 坐标必须是数字`, 'shelf.y', rowNum));
    }
    if (typeof shelf.width !== 'number' || shelf.width <= 0) {
      errors.push(new ValidationError(`货架 ${shelf.id || rowNum} 的宽度必须大于 0`, 'shelf.width', rowNum));
    }
    if (typeof shelf.depth !== 'number' || shelf.depth <= 0) {
      errors.push(new ValidationError(`货架 ${shelf.id || rowNum} 的深度必须大于 0`, 'shelf.depth', rowNum));
    }

    return errors;
  }

  static validatePackingStation(station, rowNum) {
    const errors = [];

    if (!station.id) {
      errors.push(new ValidationError(`第 ${rowNum} 个打包台缺少 ID`, 'packing.id', rowNum));
    }
    if (typeof station.x !== 'number') {
      errors.push(new ValidationError(`打包台 ${station.id || rowNum} 的 X 坐标必须是数字`, 'packing.x', rowNum));
    }
    if (typeof station.y !== 'number') {
      errors.push(new ValidationError(`打包台 ${station.id || rowNum} 的 Y 坐标必须是数字`, 'packing.y', rowNum));
    }

    return errors;
  }

  static validateSKUData(data) {
    const errors = [];
    const warnings = [];
    const skuCodes = new Set();

    if (!data || !Array.isArray(data)) {
      errors.push(new ValidationError('SKU 数据格式错误，应为数组', 'root'));
      return { valid: false, errors, warnings, validatedData: [] };
    }

    const validatedData = [];

    data.forEach((row, index) => {
      const rowNum = index + 1;
      
      if (!row.sku_code && !row.skuCode) {
        errors.push(new ValidationError(`第 ${rowNum} 行缺少 SKU 编码`, 'sku_code', rowNum));
        return;
      }

      const skuCode = row.sku_code || row.skuCode;
      
      if (skuCodes.has(skuCode)) {
        warnings.push(new ValidationError(`第 ${rowNum} 行 SKU 编码 ${skuCode} 重复`, 'sku_code', rowNum));
      }
      skuCodes.add(skuCode);

      if (!row.shelf_id && !row.shelfId) {
        errors.push(new ValidationError(`第 ${rowNum} 行 SKU ${skuCode} 缺少货架 ID`, 'shelf_id', rowNum));
      }

      if (row.quantity !== undefined && row.quantity !== null && row.quantity !== '') {
        const qty = parseInt(row.quantity);
        if (isNaN(qty) || qty < 0) {
          errors.push(new ValidationError(`第 ${rowNum} 行 SKU ${skuCode} 的库存数量必须是非负整数`, 'quantity', rowNum));
        }
      }

      if (row.reorder_threshold !== undefined && row.reorder_threshold !== null && row.reorder_threshold !== '') {
        const threshold = parseInt(row.reorder_threshold);
        if (isNaN(threshold) || threshold < 0) {
          errors.push(new ValidationError(`第 ${rowNum} 行 SKU ${skuCode} 的补货阈值必须是非负整数`, 'reorder_threshold', rowNum));
        }
      }

      validatedData.push(new SKULocation(row));
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      validatedData
    };
  }

  static validateOrderData(data) {
    const errors = [];
    const warnings = [];
    const orderMap = new Map();

    if (!data || !Array.isArray(data)) {
      errors.push(new ValidationError('订单数据格式错误，应为数组', 'root'));
      return { valid: false, errors, warnings, validatedData: [] };
    }

    data.forEach((row, index) => {
      const rowNum = index + 1;
      
      if (!row.order_id && !row.orderId) {
        errors.push(new ValidationError(`第 ${rowNum} 行缺少订单 ID`, 'order_id', rowNum));
        return;
      }

      const orderId = row.order_id || row.orderId;
      const skuCode = row.sku_code || row.skuCode;

      if (!skuCode) {
        errors.push(new ValidationError(`第 ${rowNum} 行订单 ${orderId} 缺少 SKU 编码`, 'sku_code', rowNum));
      }

      if (row.quantity !== undefined && row.quantity !== null && row.quantity !== '') {
        const qty = parseInt(row.quantity);
        if (isNaN(qty) || qty <= 0) {
          errors.push(new ValidationError(`第 ${rowNum} 行订单 ${orderId} 的数量必须是正整数`, 'quantity', rowNum));
        }
      }

      let order = orderMap.get(orderId);
      if (!order) {
        order = new Order(row);
        orderMap.set(orderId, order);
      }

      if (skuCode) {
        order.addItem(row);
      }
    });

    const validatedData = Array.from(orderMap.values());

    validatedData.forEach(order => {
      if (order.items.length === 0) {
        warnings.push(new ValidationError(`订单 ${order.orderId} 没有商品项`, 'order.items'));
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      validatedData
    };
  }

  static formatErrors(errors) {
    if (!errors || errors.length === 0) return '';
    
    return errors.map(err => {
      let msg = `❌ ${err.message}`;
      if (err.row) {
        msg += ` (行 ${err.row})`;
      }
      return msg;
    }).join('\n');
  }

  static formatWarnings(warnings) {
    if (!warnings || warnings.length === 0) return '';
    
    return warnings.map(warn => {
      let msg = `⚠️ ${warn.message}`;
      if (warn.row) {
        msg += ` (行 ${warn.row})`;
      }
      return msg;
    }).join('\n');
  }
}
