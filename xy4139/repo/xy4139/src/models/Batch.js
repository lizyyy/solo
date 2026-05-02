const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class Batch {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.chemical_id = data.chemical_id;
    this.batch_number = data.batch_number;
    this.production_date = data.production_date;
    this.expiry_date = data.expiry_date;
    this.initial_quantity = data.initial_quantity;
    this.current_quantity = data.current_quantity !== undefined ? data.current_quantity : data.initial_quantity;
    this.unit = data.unit;
    this.supplier = data.supplier;
    this.manufacturer = data.manufacturer;
    this.storage_location = data.storage_location;
    this.status = data.status || 'active';
    this.created_at = data.created_at || moment().toISOString();
    this.updated_at = data.updated_at || moment().toISOString();
    this.created_by = data.created_by;
    this.updated_by = data.updated_by;
  }

  static validate(data) {
    const errors = [];
    
    if (!data.chemical_id) {
      errors.push('试剂ID不能为空');
    }
    
    if (!data.batch_number) {
      errors.push('批次号不能为空');
    }
    
    if (!data.initial_quantity) {
      errors.push('初始数量不能为空');
    }
    
    if (data.initial_quantity && data.initial_quantity <= 0) {
      errors.push('初始数量必须大于0');
    }
    
    if (!data.expiry_date) {
      errors.push('有效期不能为空');
    }
    
    if (data.expiry_date) {
      const expiryMoment = moment(data.expiry_date);
      if (!expiryMoment.isValid()) {
        errors.push('有效期格式无效');
      } else if (expiryMoment.isBefore(moment())) {
        errors.push('有效期不能早于当前时间');
      }
    }
    
    return errors;
  }

  isExpired() {
    return moment().isAfter(moment(this.expiry_date));
  }

  getDaysUntilExpiry() {
    const expiryMoment = moment(this.expiry_date);
    const now = moment();
    return expiryMoment.diff(now, 'days');
  }

  isLowStock(threshold) {
    return this.current_quantity <= threshold;
  }

  toJSON() {
    return {
      id: this.id,
      chemical_id: this.chemical_id,
      batch_number: this.batch_number,
      production_date: this.production_date,
      expiry_date: this.expiry_date,
      initial_quantity: this.initial_quantity,
      current_quantity: this.current_quantity,
      unit: this.unit,
      supplier: this.supplier,
      manufacturer: this.manufacturer,
      storage_location: this.storage_location,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at,
      created_by: this.created_by,
      updated_by: this.updated_by,
      is_expired: this.isExpired(),
      days_until_expiry: this.getDaysUntilExpiry()
    };
  }
}

module.exports = Batch;
