const moment = require('moment');
const config = require('../config');

class ExpiryError extends Error {
  constructor(message, code = 'EXPIRY_ERROR') {
    super(message);
    this.name = 'ExpiryError';
    this.code = code;
    this.status = 400;
  }
}

class ExpiryValidator {
  static isExpired(expiryDate) {
    const expiryMoment = moment(expiryDate);
    const now = moment();
    return now.isAfter(expiryMoment);
  }

  static validateNotExpired(expiryDate, entityName = '批次') {
    if (this.isExpired(expiryDate)) {
      throw new ExpiryError(
        `${entityName}已过期。有效期: ${expiryDate}`,
        'EXPIRED_ENTITY'
      );
    }
    return true;
  }

  static getDaysUntilExpiry(expiryDate) {
    const expiryMoment = moment(expiryDate);
    const now = moment();
    return expiryMoment.diff(now, 'days');
  }

  static isNearExpiry(expiryDate, daysThreshold = null) {
    const effectiveThreshold = daysThreshold !== null ? daysThreshold : config.alert.expiry_days_threshold;
    const daysUntilExpiry = this.getDaysUntilExpiry(expiryDate);
    return daysUntilExpiry <= effectiveThreshold && daysUntilExpiry >= 0;
  }

  static checkNearExpiry(expiryDate, daysThreshold = null, entityName = '批次') {
    if (this.isNearExpiry(expiryDate, daysThreshold)) {
      const daysUntilExpiry = this.getDaysUntilExpiry(expiryDate);
      throw new ExpiryError(
        `${entityName}即将过期。剩余 ${daysUntilExpiry} 天，有效期: ${expiryDate}`,
        'NEAR_EXPIRY_WARNING'
      );
    }
    return true;
  }

  static validateExpiryDate(expiryDate, productionDate = null) {
    const expiryMoment = moment(expiryDate);
    const now = moment();
    
    if (!expiryMoment.isValid()) {
      throw new ExpiryError(
        '有效期格式无效',
        'INVALID_EXPIRY_DATE'
      );
    }
    
    if (productionDate) {
      const productionMoment = moment(productionDate);
      if (!productionMoment.isValid()) {
        throw new ExpiryError(
          '生产日期格式无效',
          'INVALID_PRODUCTION_DATE'
        );
      }
      if (expiryMoment.isBefore(productionMoment)) {
        throw new ExpiryError(
          '有效期不能早于生产日期',
          'EXPIRY_BEFORE_PRODUCTION'
        );
      }
    }
    
    return true;
  }

  static validateFutureExpiryDate(expiryDate) {
    const expiryMoment = moment(expiryDate);
    const now = moment();
    
    if (!expiryMoment.isValid()) {
      throw new ExpiryError(
        '有效期格式无效',
        'INVALID_EXPIRY_DATE'
      );
    }
    
    if (expiryMoment.isBefore(now)) {
      throw new ExpiryError(
        '有效期不能早于当前时间',
        'EXPIRED_DATE'
      );
    }
    
    return true;
  }

  static canUseForRequest(expiryDate) {
    if (this.isExpired(expiryDate)) {
      return {
        valid: false,
        reason: '已过期',
        code: 'EXPIRED'
      };
    }
    
    if (this.isNearExpiry(expiryDate)) {
      return {
        valid: true,
        warning: '即将过期',
        code: 'NEAR_EXPIRY'
      };
    }
    
    return {
      valid: true,
      code: 'VALID'
    };
  }

  static getExpiryStatus(expiryDate) {
    if (this.isExpired(expiryDate)) {
      return {
        status: 'expired',
        text: '已过期',
        daysUntilExpiry: this.getDaysUntilExpiry(expiryDate)
      };
    }
    
    if (this.isNearExpiry(expiryDate)) {
      return {
        status: 'warning',
        text: '即将过期',
        daysUntilExpiry: this.getDaysUntilExpiry(expiryDate)
      };
    }
    
    return {
      status: 'valid',
      text: '有效',
      daysUntilExpiry: this.getDaysUntilExpiry(expiryDate)
    };
  }
}

module.exports = { ExpiryValidator, ExpiryError };
