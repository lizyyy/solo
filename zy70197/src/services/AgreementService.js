const Agreement = require('../models/Agreement');
const AmountRecord = require('../models/AmountRecord');

class AgreementService {
  static async createAgreement({ name, year, totalAmount }) {
    if (!name || !year || !totalAmount) {
      throw new Error('协议名称、年度和总额度为必填项');
    }
    
    if (totalAmount <= 0) {
      throw new Error('总额度必须大于0');
    }
    
    const existing = Agreement.findByNameAndYear(name, year);
    if (existing) {
      throw new Error('该年度协议已存在');
    }
    
    const agreement = Agreement.create({ name, year, totalAmount });
    
    AmountRecord.create({
      agreementId: agreement.id,
      type: 'initialize',
      amount: totalAmount,
      balance: totalAmount,
      description: `协议初始化，总额度: ${totalAmount}`
    });
    
    return agreement;
  }

  static getAgreement(id) {
    const agreement = Agreement.findById(id);
    if (!agreement) {
      throw new Error('协议不存在');
    }
    
    const available = Agreement.getAvailableAmount(id);
    return {
      ...agreement,
      available_amount: available,
      utilization_rate: agreement.total_amount > 0 
        ? ((agreement.used_amount + agreement.reserved_amount) / agreement.total_amount * 100).toFixed(2)
        : '0.00'
    };
  }

  static getAllAgreements() {
    const agreements = Agreement.findAll();
    return agreements.map(agreement => {
      const available = Agreement.getAvailableAmount(agreement.id);
      return {
        ...agreement,
        available_amount: available,
        utilization_rate: agreement.total_amount > 0 
          ? ((agreement.used_amount + agreement.reserved_amount) / agreement.total_amount * 100).toFixed(2)
          : '0.00'
      };
    });
  }

  static updateAgreementTotalAmount(id, newTotalAmount) {
    const agreement = Agreement.findById(id);
    if (!agreement) {
      throw new Error('协议不存在');
    }
    
    const occupiedAmount = agreement.reserved_amount + agreement.used_amount;
    if (newTotalAmount < occupiedAmount) {
      throw new Error(`新额度不能小于已占用额度: ${occupiedAmount}`);
    }
    
    const delta = newTotalAmount - agreement.total_amount;
    const updated = Agreement.update(id, { totalAmount: newTotalAmount });
    
    AmountRecord.create({
      agreementId: id,
      type: 'adjust_total',
      amount: delta,
      balance: newTotalAmount - occupiedAmount,
      description: `调整协议总额度: ${agreement.total_amount} -> ${newTotalAmount}`
    });
    
    return updated;
  }

  static canReserve(agreementId, amount) {
    return Agreement.canReserve(agreementId, amount);
  }

  static getAvailableAmount(agreementId) {
    return Agreement.getAvailableAmount(agreementId);
  }
}

module.exports = AgreementService;
