const store = require('../stores/MemoryStore');
const ContractVersionService = require('./ContractVersionService');
const TaxRuleService = require('./TaxRuleService');
const TaxSeparationService = require('./TaxSeparationService');

class HistoricalRecalculationService {
  static recalculateWithNewTaxRule(contractId, newTaxRuleId, params = {}) {
    const contract = ContractVersionService.getContractById(contractId);
    if (!contract) {
      throw new Error(`合同 ${contractId} 不存在`);
    }

    const latestVersion = ContractVersionService.getLatestVersion(contractId);
    if (!latestVersion) {
      throw new Error(`合同 ${contractId} 没有任何版本`);
    }

    const newRule = TaxRuleService.getRuleById(newTaxRuleId);
    if (!newRule || !newRule.isActive) {
      throw new Error(`税率规则 ${newTaxRuleId} 不存在或未启用`);
    }

    const oldRule = TaxRuleService.getRuleById(latestVersion.taxRuleId);
    
    const calculation = TaxSeparationService.calculateFromIncludingTax(
      latestVersion.amountWithTax,
      newRule.taxRate
    );

    let newItems = [];
    if (latestVersion.items && latestVersion.items.length > 0) {
      const itemsResult = TaxSeparationService.calculateItems(
        latestVersion.items.map(item => ({
          ...item,
          amount: item.amountWithTax,
          priceType: 'WITH_TAX'
        })),
        newRule.taxRate,
        'WITH_TAX'
      );
      newItems = itemsResult.items;
    }

    const comparison = {
      contractId: contract.id,
      originalVersion: {
        versionNo: latestVersion.versionNo,
        taxRate: latestVersion.taxRate,
        taxRule: oldRule ? {
          id: oldRule.id,
          code: oldRule.code,
          rate: oldRule.getTaxRatePercentage()
        } : null,
        amountWithTax: latestVersion.amountWithTax,
        amountWithoutTax: latestVersion.amountWithoutTax,
        taxAmount: latestVersion.taxAmount
      },
      newCalculation: {
        taxRate: newRule.taxRate,
        taxRule: {
          id: newRule.id,
          code: newRule.code,
          rate: newRule.getTaxRatePercentage()
        },
        amountWithTax: calculation.amountWithTax,
        amountWithoutTax: calculation.amountWithoutTax,
        taxAmount: calculation.taxAmount
      },
      differences: {
        amountWithoutTax: calculation.amountWithoutTax - latestVersion.amountWithoutTax,
        taxAmount: calculation.taxAmount - latestVersion.taxAmount,
        taxRateDiff: newRule.taxRate - (oldRule?.taxRate || 0)
      },
      businessImpact: {
        taxRateChange: `税率从 ${oldRule?.getTaxRatePercentage() || '未知'} 变更为 ${newRule.getTaxRatePercentage()}`,
        taxImpact: calculation.taxAmount >= latestVersion.taxAmount
          ? `税额增加 ${(calculation.taxAmount - latestVersion.taxAmount).toFixed(2)} 元`
          : `税额减少 ${(latestVersion.taxAmount - calculation.taxAmount).toFixed(2)} 元`,
        priceImpact: calculation.amountWithoutTax >= latestVersion.amountWithoutTax
          ? `不含税价增加 ${(calculation.amountWithoutTax - latestVersion.amountWithoutTax).toFixed(2)} 元`
          : `不含税价减少 ${(latestVersion.amountWithoutTax - calculation.amountWithoutTax).toFixed(2)} 元`
      }
    };

    if (params.createVersion !== false) {
      const versionNo = store.getNextVersionNumber(contractId);
      const newVersion = ContractVersionService.createVersion(contractId, {
        totalAmount: latestVersion.amountWithTax,
        priceType: 'WITH_TAX',
        taxRuleId: newTaxRuleId,
        versionDescription: params.versionDescription || `历史重算：税率规则变更为 ${newRule.name} (${newRule.getTaxRatePercentage()})`,
        changeType: 'RECALCULATION',
        basedOnVersionId: latestVersion.id,
        items: newItems.length > 0 ? newItems : latestVersion.items,
        createdBy: params.createdBy || latestVersion.createdBy
      });

      return {
        comparison: comparison,
        newVersion: newVersion,
        verification: {
          mathCheck: calculation.verification,
          itemsCheck: newItems.length > 0 ? '明细已同步重算' : '无明细项'
        }
      };
    }

    return {
      comparison: comparison,
      verification: {
        mathCheck: calculation.verification,
        note: '未创建新版本，仅返回计算结果'
      }
    };
  }

  static recalculateWithNewAmount(contractId, newTotalAmount, priceType, params = {}) {
    const contract = ContractVersionService.getContractById(contractId);
    if (!contract) {
      throw new Error(`合同 ${contractId} 不存在`);
    }

    const latestVersion = ContractVersionService.getLatestVersion(contractId);
    if (!latestVersion) {
      throw new Error(`合同 ${contractId} 没有任何版本`);
    }

    const rule = TaxRuleService.getRuleById(latestVersion.taxRuleId);
    
    const calculation = TaxSeparationService.calculateFromTotalAmount(
      newTotalAmount,
      rule.taxRate,
      priceType
    );

    const comparison = {
      contractId: contract.id,
      originalVersion: {
        versionNo: latestVersion.versionNo,
        amountWithTax: latestVersion.amountWithTax,
        amountWithoutTax: latestVersion.amountWithoutTax,
        taxAmount: latestVersion.taxAmount
      },
      newCalculation: {
        totalAmount: newTotalAmount,
        priceType: priceType,
        priceTypeDescription: priceType === 'WITH_TAX' ? '含税价' : '不含税价',
        amountWithTax: calculation.amountWithTax,
        amountWithoutTax: calculation.amountWithoutTax,
        taxAmount: calculation.taxAmount
      },
      differences: {
        amountWithTax: calculation.amountWithTax - latestVersion.amountWithTax,
        amountWithoutTax: calculation.amountWithoutTax - latestVersion.amountWithoutTax,
        taxAmount: calculation.taxAmount - latestVersion.taxAmount
      }
    };

    if (params.createVersion !== false) {
      const newVersion = ContractVersionService.createVersion(contractId, {
        totalAmount: newTotalAmount,
        priceType: priceType,
        taxRuleId: latestVersion.taxRuleId,
        versionDescription: params.versionDescription || `历史重算：${priceType === 'WITH_TAX' ? '含税价' : '不含税价'}调整为 ${newTotalAmount} 元`,
        changeType: 'RECALCULATION',
        basedOnVersionId: latestVersion.id,
        items: latestVersion.items,
        createdBy: params.createdBy || latestVersion.createdBy
      });

      return {
        comparison: comparison,
        newVersion: newVersion,
        verification: calculation.verification
      };
    }

    return {
      comparison: comparison,
      verification: calculation.verification
    };
  }

  static previewRecalculation(contractId, params) {
    const contract = ContractVersionService.getContractById(contractId);
    if (!contract) {
      throw new Error(`合同 ${contractId} 不存在`);
    }

    const latestVersion = ContractVersionService.getLatestVersion(contractId);
    if (!latestVersion) {
      throw new Error(`合同 ${contractId} 没有任何版本`);
    }

    const result = [];
    
    if (params.taxRuleIds && params.taxRuleIds.length > 0) {
      for (const ruleId of params.taxRuleIds) {
        const recalcResult = this.recalculateWithNewTaxRule(contractId, ruleId, { createVersion: false });
        result.push({
          type: 'TAX_RULE_CHANGE',
          ...recalcResult
        });
      }
    }

    if (params.amounts && params.amounts.length > 0) {
      for (const amountConfig of params.amounts) {
        const recalcResult = this.recalculateWithNewAmount(
          contractId, 
          amountConfig.amount, 
          amountConfig.priceType || 'WITH_TAX', 
          { createVersion: false }
        );
        result.push({
          type: 'AMOUNT_CHANGE',
          ...recalcResult
        });
      }
    }

    return {
      contractId: contract.id,
      contractNo: contract.contractNo,
      originalVersion: latestVersion.toJSON(),
      previews: result,
      businessAdvice: result.length > 0 
        ? `共生成 ${result.length} 个重算方案，请仔细核对税额和价税合计后再决定是否创建新版本`
        : '未提供任何重算参数'
    };
  }

  static verifyAllVersions(contractId) {
    const contract = ContractVersionService.getContractById(contractId);
    if (!contract) {
      throw new Error(`合同 ${contractId} 不存在`);
    }

    const versions = ContractVersionService.getAllVersions(contractId);
    const verifications = versions.map(version => {
      const calculation = {
        amountWithTax: version.amountWithTax,
        amountWithoutTax: version.amountWithoutTax,
        taxAmount: version.taxAmount,
        taxRate: version.taxRate
      };
      const verification = TaxSeparationService.verifyCalculation(calculation);
      
      return {
        versionNo: version.versionNo,
        versionId: version.id,
        status: version.status,
        changeType: version.changeType,
        taxRuleCode: version.taxRuleCode,
        amounts: {
          amountWithTax: version.amountWithTax,
          amountWithoutTax: version.amountWithoutTax,
          taxAmount: version.taxAmount
        },
        verification: verification,
        isConsistent: verification.isValid
      };
    });

    const allConsistent = verifications.every(v => v.isConsistent);
    const inconsistentVersions = verifications.filter(v => !v.isConsistent);

    return {
      contractId: contract.id,
      contractNo: contract.contractNo,
      totalVersions: versions.length,
      allConsistent: allConsistent,
      inconsistentCount: inconsistentVersions.length,
      verifications: verifications,
      summary: {
        status: allConsistent ? '所有版本计算一致' : `发现 ${inconsistentVersions.length} 个版本存在计算差异`,
        action: allConsistent 
          ? '无需处理' 
          : `建议对版本 ${inconsistentVersions.map(v => 'V' + v.versionNo).join(', ')} 进行重算`
      }
    };
  }
}

module.exports = HistoricalRecalculationService;
