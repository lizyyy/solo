const config = require('../config');

class SecurityUtils {
  static maskPhone(phone) {
    if (!phone) return phone;
    return phone.replace(config.security.phoneMaskPattern, config.security.phoneMaskReplace);
  }

  static maskIdCard(idCard) {
    if (!idCard) return idCard;
    return idCard.replace(config.security.idCardMaskPattern, config.security.idCardMaskReplace);
  }

  static maskSensitiveData(data, fields = ['phone', 'visitor_phone', 'id_card']) {
    if (!data) return data;
    
    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item, fields));
    }
    
    if (typeof data === 'object') {
      const masked = { ...data };
      for (const field of fields) {
        if (masked[field]) {
          if (field.includes('phone')) {
            masked[field] = this.maskPhone(masked[field]);
          } else if (field.includes('id_card')) {
            masked[field] = this.maskIdCard(masked[field]);
          }
        }
      }
      return masked;
    }
    
    return data;
  }

  static generateVerificationCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  static sanitizeInput(input) {
    if (typeof input === 'string') {
      return input.trim().replace(/[<>]/g, '');
    }
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }
    if (typeof input === 'object' && input !== null) {
      const sanitized = {};
      for (const key in input) {
        sanitized[key] = this.sanitizeInput(input[key]);
      }
      return sanitized;
    }
    return input;
  }
}

module.exports = SecurityUtils;
