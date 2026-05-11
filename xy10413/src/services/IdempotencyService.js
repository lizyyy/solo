const { ArrivalNote } = require('../models');

class IdempotencyService {
  static async checkAndGetExisting(key) {
    if (!key) return null;

    return await ArrivalNote.findOne({
      where: {
        idempotencyKey: key
      }
    });
  }

  static generateKey(arrivalNo, poNo, supplierId) {
    return `${supplierId}-${poNo}-${arrivalNo}`;
  }
}

module.exports = IdempotencyService;
