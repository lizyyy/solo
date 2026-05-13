const { PalletCode, SupplierHandover, StoreCollection, DamagePhoto, DepositFlow } = require('../models');

class BusinessRuleEngine {
  constructor() {
    this.rules = [];
    this.initRules();
  }

  initRules() {
    this.addRule({
      name: '托盘编码有效性检查',
      module: 'supplier_handover',
      execute: async (data) => {
        const pallet = await PalletCode.findByPk(data.pallet_code_id);
        if (!pallet || pallet.status !== 'active') {
          return { passed: false, reason: '托盘编码无效或已停用' };
        }
        return { passed: true };
      }
    });

    this.addRule({
      name: '供应商交接数量限制',
      module: 'supplier_handover',
      execute: async (data) => {
        if (data.handover_quantity <= 0) {
          return { passed: false, reason: '交接数量必须大于0' };
        }
        if (data.handover_quantity > 10000) {
          return { passed: false, reason: '单次交接数量不能超过10000', needReview: true };
        }
        return { passed: true };
      }
    });

    this.addRule({
      name: '破损数量不能超过回收数量',
      module: 'store_collection',
      execute: async (data) => {
        if (data.damaged_quantity > data.collection_quantity) {
          return { passed: false, reason: '破损数量不能超过回收数量' };
        }
        return { passed: true };
      }
    });

    this.addRule({
      name: '高破损率需人工复核',
      module: 'store_collection',
      execute: async (data) => {
        const damageRate = data.damaged_quantity / data.collection_quantity;
        if (damageRate > 0.3) {
          return { passed: true, needReview: true, reason: '破损率超过30%，需要人工复核' };
        }
        return { passed: true };
      }
    });

    this.addRule({
      name: '重复提交检查',
      module: 'store_collection',
      execute: async (data, excludeId = null) => {
        const where = {
          store_id: data.store_id,
          pallet_code_id: data.pallet_code_id,
          collection_date: data.collection_date
        };
        if (excludeId) {
          where.id = { [require('sequelize').Op.ne]: excludeId };
        }
        const existing = await StoreCollection.findOne({ where });
        if (existing) {
          return { passed: false, reason: '同一天同一门店同一托盘的回收记录已存在', isDuplicate: true };
        }
        return { passed: true };
      }
    });

    this.addRule({
      name: '押金流水金额一致性检查',
      module: 'deposit_flow',
      execute: async (data) => {
        if (data.amount <= 0) {
          return { passed: false, reason: '金额必须大于0' };
        }
        return { passed: true };
      }
    });

    this.addRule({
      name: '破损照片数量检查',
      module: 'damage_photo',
      execute: async (data) => {
        const count = await DamagePhoto.count({
          where: { store_collection_id: data.store_collection_id }
        });
        if (count >= 10) {
          return { passed: false, reason: '单个回收记录最多上传10张照片' };
        }
        return { passed: true };
      }
    });
  }

  addRule(rule) {
    this.rules.push(rule);
  }

  async validate(module, data, excludeId = null) {
    const moduleRules = this.rules.filter(r => r.module === module);
    const results = [];

    for (const rule of moduleRules) {
      const result = await rule.execute(data, excludeId);
      results.push({
        ruleName: rule.name,
        ...result
      });
    }

    const failedRules = results.filter(r => !r.passed);
    const needReview = results.some(r => r.needReview);

    return {
      isValid: failedRules.length === 0,
      needReview,
      failedRules,
      allResults: results
    };
  }
}

module.exports = new BusinessRuleEngine();
