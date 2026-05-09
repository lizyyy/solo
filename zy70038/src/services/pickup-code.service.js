const config = require('../config');
const storage = require('../storage/file-storage');
const { generateExceptionId } = require('../utils/id-generator');
const { ExceptionRecord, ExceptionType, ExceptionSeverity } = require('../models/exception');

class PickupCodeService {
  generateUniqueCode(storeId) {
    const codes = storage.getPickupCodes();
    const storeCodes = codes.filter(c => c.storeId === storeId && !c.used);
    const existingCodes = new Set(storeCodes.map(c => c.code));
    
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
      const code = this._generateCode();
      if (!existingCodes.has(code)) {
        return code;
      }
      attempts++;
    }
    
    this._recordDuplicateCodeIssue(storeId);
    throw new Error(`无法在门店 ${storeId} 生成唯一自提码，请稍后重试`);
  }
  
  _generateCode() {
    const chars = '0123456789';
    let code = '';
    for (let i = 0; i < config.pickupCodeLength; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
  
  assignCode(orderId, storeId) {
    const code = this.generateUniqueCode(storeId);
    const codes = storage.getPickupCodes();
    
    codes.push({
      code: code,
      orderId: orderId,
      storeId: storeId,
      createdAt: Date.now(),
      used: false,
      usedAt: null
    });
    
    storage.savePickupCodes(codes);
    return code;
  }
  
  validateCode(code, storeId) {
    const codes = storage.getPickupCodes();
    const pickupCode = codes.find(
      c => c.code === code && c.storeId === storeId && !c.used
    );
    
    if (!pickupCode) {
      return {
        valid: false,
        reason: '自提码无效或已被使用',
        orderId: null
      };
    }
    
    return {
      valid: true,
      orderId: pickupCode.orderId
    };
  }
  
  markCodeUsed(code, orderId) {
    const codes = storage.getPickupCodes();
    const index = codes.findIndex(c => c.code === code && c.orderId === orderId);
    
    if (index !== -1) {
      codes[index].used = true;
      codes[index].usedAt = Date.now();
      storage.savePickupCodes(codes);
      return true;
    }
    return false;
  }
  
  _recordDuplicateCodeIssue(storeId) {
    const exceptions = storage.getExceptions();
    const exception = new ExceptionRecord({
      exceptionId: generateExceptionId(),
      orderId: null,
      exceptionType: ExceptionType.PICKUP_CODE_DUPLICATE,
      severity: ExceptionSeverity.WARNING,
      message: `门店 ${storeId} 自提码生成冲突`,
      details: {
        storeId: storeId,
        issue: '多次尝试生成唯一码失败，可能需要增加码长度或清理过期码'
      }
    });
    exceptions.push(exception.toJSON());
    storage.saveExceptions(exceptions);
  }
  
  getActiveCodesByStore(storeId) {
    const codes = storage.getPickupCodes();
    return codes.filter(c => c.storeId === storeId && !c.used);
  }
  
  cleanupExpiredCodes(cutoffTime) {
    const codes = storage.getPickupCodes();
    const beforeCount = codes.length;
    
    const activeCodes = codes.filter(c => {
      if (c.used) return true;
      return c.createdAt > cutoffTime;
    });
    
    if (activeCodes.length !== beforeCount) {
      storage.savePickupCodes(activeCodes);
    }
    
    return beforeCount - activeCodes.length;
  }
}

module.exports = new PickupCodeService();
