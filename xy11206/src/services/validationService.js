const db = require('../database');

class ValidationService {
  constructor() {
    this.rules = [];
  }

  async loadRules() {
    this.rules = await db.all('SELECT * FROM validation_rules WHERE is_active = 1');
    return this.rules;
  }

  async validateDeliveryItem(item, orderId = null) {
    if (this.rules.length === 0) {
      await this.loadRules();
    }

    const errors = [];
    const warnings = [];

    for (const rule of this.rules) {
      const result = await this.applyRule(rule, item, orderId);
      if (result) {
        if (rule.severity === 'error') {
          errors.push({
            rule_code: rule.rule_code,
            rule_name: rule.rule_name,
            message: result.message || rule.error_message,
            details: result.details
          });
        } else {
          warnings.push({
            rule_code: rule.rule_code,
            rule_name: rule.rule_name,
            message: result.message || rule.error_message,
            details: result.details
          });
        }
      }
    }

    const isValid = errors.length === 0;
    const status = isValid ? 'validated' : 'invalid';
    const validationResult = isValid ? 'pass' : 'fail';
    const validationDetails = JSON.stringify({ errors, warnings });

    return {
      isValid,
      status,
      validationResult,
      validationDetails,
      errors,
      warnings
    };
  }

  async applyRule(rule, item, orderId) {
    switch (rule.rule_code) {
      case 'TEMPERATURE_OUT_OF_RANGE':
        return await this.validateTemperature(item);
      case 'DUPLICATE_BATCH_NO':
        return await this.validateDuplicateBatch(item, orderId);
      case 'MISSING_DAMAGE_PHOTO':
        return this.validateDamagePhoto(item);
      case 'INVALID_EXPIRY_DATE':
        return this.validateExpiryDate(item, rule);
      case 'MISSING_RECEIVER_INFO':
        return this.validateReceiverInfo(item, rule);
      default:
        return null;
    }
  }

  async validateTemperature(item) {
    if (item.temperature === null || item.temperature === undefined) {
      return {
        message: '温度数据缺失',
        details: { temperature: item.temperature }
      };
    }

    const product = await db.get(
      'SELECT min_temp, max_temp FROM products WHERE product_code = ?',
      [item.product_code]
    );

    if (!product) {
      return null;
    }

    if (product.min_temp !== null && product.max_temp !== null) {
      if (item.temperature < product.min_temp || item.temperature > product.max_temp) {
        return {
          message: `温度 ${item.temperature}°C 超出范围 ${product.min_temp}°C - ${product.max_temp}°C`,
          details: { 
            temperature: item.temperature, 
            min_temp: product.min_temp, 
            max_temp: product.max_temp 
          }
        };
      }
    }

    return null;
  }

  async validateDuplicateBatch(item, excludeOrderId = null) {
    let sql = `
      SELECT id FROM delivery_items 
      WHERE batch_no = ? AND product_code = ?
    `;
    const params = [item.batch_no, item.product_code];

    if (excludeOrderId) {
      sql += ' AND order_id != ?';
      params.push(excludeOrderId);
    }

    const existing = await db.get(sql, params);
    if (existing) {
      return {
        message: `批号 ${item.batch_no} 已存在`,
        details: { batch_no: item.batch_no, existing_id: existing.id }
      };
    }

    const inventory = await db.get(
      'SELECT id FROM inventory WHERE batch_no = ? AND product_code = ?',
      [item.batch_no, item.product_code]
    );
    if (inventory) {
      return {
        message: `批号 ${item.batch_no} 已在库存中存在`,
        details: { batch_no: item.batch_no, inventory_id: inventory.id }
      };
    }

    return null;
  }

  validateDamagePhoto(item) {
    if (item.has_damage === 1) {
      if (!item.damage_photo_path) {
        return {
          message: '有破损记录但未上传破损照片',
          details: { has_damage: true, has_photo: false }
        };
      }
    }
    return null;
  }

  validateExpiryDate(item, rule) {
    if (!item.expiry_date) {
      return {
        message: '有效期缺失',
        details: { expiry_date: null }
      };
    }

    const config = JSON.parse(rule.config_json || '{}');
    const minDays = config.min_days || 30;
    
    const expiryDate = new Date(item.expiry_date);
    const today = new Date();
    const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return {
        message: `产品已过期（有效期：${item.expiry_date}）`,
        details: { expiry_date: item.expiry_date, days_remaining: diffDays }
      };
    }

    if (diffDays < minDays) {
      return {
        message: `有效期不足${minDays}天（剩余${diffDays}天）`,
        details: { expiry_date: item.expiry_date, days_remaining: diffDays, min_days: minDays }
      };
    }

    return null;
  }

  validateReceiverInfo(item, rule) {
    const config = JSON.parse(rule.config_json || '{}');
    const issues = [];

    if (config.require_name && !item.receiver_name) {
      issues.push('签收人姓名缺失');
    }

    if (config.require_phone && !item.receiver_phone) {
      issues.push('签收人电话缺失');
    }

    if (issues.length > 0) {
      return {
        message: issues.join('；'),
        details: { receiver_name: item.receiver_name, receiver_phone: item.receiver_phone }
      };
    }

    return null;
  }

  async validateBatch(items, orderId = null) {
    const results = [];
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const validation = await this.validateDeliveryItem(item, orderId);
      results.push({
        index: i,
        item,
        ...validation
      });
      if (validation.isValid) {
        validCount++;
      } else {
        invalidCount++;
      }
    }

    return {
      results,
      validCount,
      invalidCount,
      totalCount: items.length
    };
  }
}

module.exports = new ValidationService();
