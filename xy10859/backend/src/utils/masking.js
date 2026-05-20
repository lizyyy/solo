class MaskingService {
  static maskPhone(phone, type) {
    if (!phone) return '';
    phone = String(phone);
    
    switch (type) {
      case 'none':
        return phone;
      case 'middle':
        if (phone.length >= 11) {
          return phone.slice(0, 3) + '****' + phone.slice(-4);
        }
        return '****' + phone.slice(-4);
      case 'last4':
        return '****' + phone.slice(-4);
      case 'full':
        return '*'.repeat(phone.length);
      default:
        return phone.slice(0, 3) + '****' + phone.slice(-4);
    }
  }

  static maskIdCard(idCard, type) {
    if (!idCard) return '';
    idCard = String(idCard);
    
    switch (type) {
      case 'none':
        return idCard;
      case 'middle':
        if (idCard.length >= 18) {
          return idCard.slice(0, 6) + '********' + idCard.slice(-4);
        }
        return '****' + idCard.slice(-4);
      case 'last4':
        return '************' + idCard.slice(-4);
      case 'full':
        return '*'.repeat(idCard.length);
      default:
        return idCard.slice(0, 6) + '********' + idCard.slice(-4);
    }
  }

  static applyMasking(data, strategies) {
    const result = { ...data };
    strategies.forEach(strategy => {
      if (result[strategy.field_name]) {
        if (strategy.field_name === 'phone') {
          result[strategy.field_name] = this.maskPhone(result[strategy.field_name], strategy.masking_type);
        } else if (strategy.field_name === 'id_card') {
          result[strategy.field_name] = this.maskIdCard(result[strategy.field_name], strategy.masking_type);
        }
      }
    });
    return result;
  }

  static validateViolation(data, roleCode) {
    const violations = [];
    const sensitiveFields = ['phone', 'id_card'];
    
    if (roleCode === 'customer_service') {
      sensitiveFields.forEach(field => {
        if (data[field] && !data[field].includes('*')) {
          violations.push(`字段 ${field} 未正确脱敏`);
        }
      });
    }
    
    return violations;
  }
}

module.exports = MaskingService;