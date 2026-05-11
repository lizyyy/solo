const { ToleranceRule, PurchaseOrderItem } = require('../models');

class ToleranceService {
  static async checkDiscrepancy(poItemId, receivedQuantity, receivedSpec) {
    const poItem = await PurchaseOrderItem.findByPk(poItemId);
    if (!poItem) {
      throw new Error('采购单明细不存在');
    }

    const result = {
      orderedQuantity: parseFloat(poItem.quantity),
      orderedSpec: poItem.spec,
      receivedQuantity: parseFloat(receivedQuantity),
      receivedSpec: receivedSpec,
      discrepancyType: 'none',
      discrepancyQuantity: 0,
      isWithinTolerance: true,
      toleranceRule: null
    };

    if (receivedSpec && receivedSpec !== poItem.spec) {
      result.discrepancyType = 'spec_mismatch';
      result.isWithinTolerance = false;
      return result;
    }

    const toleranceRule = await this.findApplicableRule(poItem.productCode, poItem.spec);
    result.toleranceRule = toleranceRule;

    const diff = receivedQuantity - parseFloat(poItem.quantity);
    result.discrepancyQuantity = diff;

    if (diff > 0) {
      result.discrepancyType = 'overage';
    } else if (diff < 0) {
      result.discrepancyType = 'shortage';
    }

    if (result.discrepancyType !== 'none' && toleranceRule) {
      if (toleranceRule.toleranceType === 'percentage') {
        const toleranceAmount = parseFloat(poItem.quantity) * (parseFloat(toleranceRule.toleranceValue) / 100);
        result.isWithinTolerance = Math.abs(diff) <= toleranceAmount;
      } else {
        result.isWithinTolerance = Math.abs(diff) <= parseFloat(toleranceRule.toleranceValue);
      }
    }

    if (result.isWithinTolerance) {
      result.discrepancyType = 'none';
    }

    return result;
  }

  static async findApplicableRule(productCode, spec) {
    let rule = await ToleranceRule.findOne({
      where: {
        productCode,
        spec
      }
    });

    if (!rule) {
      rule = await ToleranceRule.findOne({
        where: {
          productCode,
          spec: null
        }
      });
    }

    if (!rule) {
      rule = await ToleranceRule.findOne({
        where: { isDefault: true }
      });
    }

    return rule;
  }
}

module.exports = ToleranceService;
