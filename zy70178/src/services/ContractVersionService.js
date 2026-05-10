const Contract = require('../models/Contract');
const ContractVersion = require('../models/ContractVersion');
const store = require('../stores/MemoryStore');
const TaxRuleService = require('./TaxRuleService');
const TaxSeparationService = require('./TaxSeparationService');

class ContractVersionService {
  static createContract(contractParams, versionParams) {
    if (!contractParams.contractNo || !contractParams.title || !contractParams.industry) {
      throw new Error('合同缺少必要字段：contractNo, title, industry 为必填项');
    }

    const existing = store.getContractByNo(contractParams.contractNo);
    if (existing) {
      throw new Error(`合同编号 ${contractParams.contractNo} 已存在，不允许重复创建`);
    }

    const contract = new Contract({
      ...contractParams,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    store.saveContract(contract);

    const version = this.createVersion(contract.id, {
      ...versionParams,
      versionNo: 1,
      changeType: 'CREATE'
    });

    contract.currentVersionId = version.id;
    contract.updatedAt = new Date().toISOString();
    store.saveContract(contract);

    return {
      contract: contract,
      version: version
    };
  }

  static createVersion(contractId, params) {
    const contract = store.getContractById(contractId);
    if (!contract) {
      throw new Error(`合同 ${contractId} 不存在`);
    }

    if (params.totalAmount === undefined) {
      throw new Error('版本缺少必要字段：totalAmount 为必填项');
    }

    if (!params.priceType) {
      throw new Error('版本缺少必要字段：priceType 为必填项（WITH_TAX 或 WITHOUT_TAX）');
    }

    const taxRule = this.resolveTaxRule(params, contract);
    if (!taxRule) {
      throw new Error('无法确定适用税率，请提供 taxRuleId 或确保合同行业有匹配的税率规则');
    }

    const calculation = TaxSeparationService.calculateFromTotalAmount(
      params.totalAmount,
      taxRule.taxRate,
      params.priceType
    );

    let itemsCalculation = null;
    let finalItems = [];
    if (params.items && params.items.length > 0) {
      itemsCalculation = TaxSeparationService.calculateItems(
        params.items,
        taxRule.taxRate,
        params.priceType
      );
      finalItems = itemsCalculation.items;
    }

    const versionNo = params.versionNo || store.getNextVersionNumber(contractId);
    const basedOnVersionId = params.basedOnVersionId || store.getLatestVersionByContractId(contractId)?.id || null;

    const version = new ContractVersion({
      contractId: contract.id,
      versionNo: versionNo,
      versionDescription: params.versionDescription || '',
      totalAmount: params.totalAmount,
      taxRuleId: taxRule.id,
      taxRuleCode: taxRule.code,
      taxRate: taxRule.taxRate,
      priceType: params.priceType,
      amountWithTax: calculation.amountWithTax,
      amountWithoutTax: calculation.amountWithoutTax,
      taxAmount: calculation.taxAmount,
      items: finalItems,
      basedOnVersionId: basedOnVersionId,
      changeType: params.changeType || 'AMOUNT_CHANGE',
      status: params.status || 'PENDING_APPROVAL',
      createdBy: params.createdBy || contract.createdBy,
      createdAt: new Date().toISOString()
    });

    store.saveContractVersion(version);
    return version;
  }

  static resolveTaxRule(params, contract) {
    if (params.taxRuleId) {
      const rule = TaxRuleService.getRuleById(params.taxRuleId);
      if (rule && rule.isActive) return rule;
      throw new Error(`税率规则 ${params.taxRuleId} 不存在或未启用`);
    }

    if (params.taxRuleCode) {
      const rule = TaxRuleService.findApplicableRuleByCode(params.taxRuleCode);
      if (rule) return rule;
      throw new Error(`税率规则 ${params.taxRuleCode} 不存在或当前不适用`);
    }

    const rule = TaxRuleService.findApplicableRule(contract.industry, contract.effectiveDate);
    if (rule) return rule;

    return null;
  }

  static updateContractAmount(contractId, newAmount, priceType, params = {}) {
    const contract = store.getContractById(contractId);
    if (!contract) {
      throw new Error(`合同 ${contractId} 不存在`);
    }

    const latestVersion = store.getLatestVersionByContractId(contractId);
    if (!latestVersion) {
      throw new Error(`合同 ${contractId} 没有任何版本`);
    }

    const newVersion = this.createVersion(contractId, {
      totalAmount: newAmount,
      priceType: priceType,
      taxRuleId: latestVersion.taxRuleId,
      versionDescription: params.versionDescription || `合同金额从 ${latestVersion.totalAmount} 变更为 ${newAmount}`,
      changeType: 'AMOUNT_CHANGE',
      basedOnVersionId: latestVersion.id,
      items: params.items || latestVersion.items,
      createdBy: params.createdBy || latestVersion.createdBy
    });

    return {
      contract: contract,
      oldVersion: latestVersion,
      newVersion: newVersion,
      comparison: this.generateVersionComparison(latestVersion, newVersion)
    };
  }

  static updateContractTaxRate(contractId, newTaxRuleId, params = {}) {
    const contract = store.getContractById(contractId);
    if (!contract) {
      throw new Error(`合同 ${contractId} 不存在`);
    }

    const latestVersion = store.getLatestVersionByContractId(contractId);
    if (!latestVersion) {
      throw new Error(`合同 ${contractId} 没有任何版本`);
    }

    const oldRule = TaxRuleService.getRuleById(latestVersion.taxRuleId);
    const newRule = TaxRuleService.getRuleById(newTaxRuleId);
    if (!newRule || !newRule.isActive) {
      throw new Error(`税率规则 ${newTaxRuleId} 不存在或未启用`);
    }

    const newVersion = this.createVersion(contractId, {
      totalAmount: latestVersion.amountWithTax,
      priceType: 'WITH_TAX',
      taxRuleId: newTaxRuleId,
      versionDescription: params.versionDescription || `税率从 ${oldRule?.getTaxRatePercentage() || '未知'} 变更为 ${newRule.getTaxRatePercentage()}`,
      changeType: 'TAX_RATE_CHANGE',
      basedOnVersionId: latestVersion.id,
      items: params.items || latestVersion.items,
      createdBy: params.createdBy || latestVersion.createdBy
    });

    return {
      contract: contract,
      oldVersion: latestVersion,
      newVersion: newVersion,
      comparison: this.generateVersionComparison(latestVersion, newVersion)
    };
  }

  static generateVersionComparison(oldVersion, newVersion) {
    const amountDiff = newVersion.amountWithTax - oldVersion.amountWithTax;
    const taxDiff = newVersion.taxAmount - oldVersion.taxAmount;
    const withoutTaxDiff = newVersion.amountWithoutTax - oldVersion.amountWithoutTax;

    return {
      contractId: oldVersion.contractId,
      oldVersionNo: oldVersion.versionNo,
      newVersionNo: newVersion.versionNo,
      changes: {
        amountWithTax: {
          old: oldVersion.amountWithTax,
          new: newVersion.amountWithTax,
          difference: amountDiff,
          differencePercentage: oldVersion.amountWithTax > 0 ? (amountDiff / oldVersion.amountWithTax * 100).toFixed(2) + '%' : 'N/A'
        },
        amountWithoutTax: {
          old: oldVersion.amountWithoutTax,
          new: newVersion.amountWithoutTax,
          difference: withoutTaxDiff
        },
        taxAmount: {
          old: oldVersion.taxAmount,
          new: newVersion.taxAmount,
          difference: taxDiff
        },
        taxRate: {
          old: oldVersion.taxRate,
          new: newVersion.taxRate,
          oldPercentage: oldVersion.getTaxRatePercentage(),
          newPercentage: newVersion.getTaxRatePercentage(),
          isChanged: oldVersion.taxRate !== newVersion.taxRate
        }
      },
      businessSummary: {
        changeType: newVersion.getChangeTypeDescription(),
        description: newVersion.versionDescription,
        impact: amountDiff >= 0 
          ? `合同金额增加 ${Math.abs(amountDiff).toFixed(2)} 元，其中税额增加 ${Math.abs(taxDiff).toFixed(2)} 元`
          : `合同金额减少 ${Math.abs(amountDiff).toFixed(2)} 元，其中税额减少 ${Math.abs(taxDiff).toFixed(2)} 元`
      }
    };
  }

  static getContractById(id) {
    return store.getContractById(id);
  }

  static getContractByNo(contractNo) {
    return store.getContractByNo(contractNo);
  }

  static getVersionById(id) {
    return store.getContractVersionById(id);
  }

  static getAllVersions(contractId) {
    return store.getVersionsByContractId(contractId);
  }

  static getLatestVersion(contractId) {
    return store.getLatestVersionByContractId(contractId);
  }

  static activateVersion(versionId) {
    const version = store.getContractVersionById(versionId);
    if (!version) {
      throw new Error(`版本 ${versionId} 不存在`);
    }

    version.status = 'ACTIVE';
    version.updatedAt = new Date().toISOString();
    store.saveContractVersion(version);

    const contract = store.getContractById(version.contractId);
    if (contract) {
      contract.currentVersionId = version.id;
      contract.status = 'ACTIVE';
      contract.updatedAt = new Date().toISOString();
      store.saveContract(contract);
    }

    return {
      version: version,
      contract: contract
    };
  }

  static generateBusinessReport(contract, version) {
    const calculation = {
      amountWithTax: version.amountWithTax,
      amountWithoutTax: version.amountWithoutTax,
      taxAmount: version.taxAmount,
      taxRate: version.taxRate,
      verification: version.items && version.items.length > 0 
        ? { formulaUsed: '基于明细项汇总计算' }
        : { formulaUsed: `使用 ${version.getPriceTypeDescription()} ${version.totalAmount} 进行价税分离` }
    };

    const baseReport = TaxSeparationService.generateBusinessReport(calculation, {
      title: contract.title,
      contractNo: contract.contractNo
    });

    return {
      ...baseReport,
      contractInfo: {
        id: contract.id,
        contractNo: contract.contractNo,
        title: contract.title,
        partyA: contract.partyA,
        partyB: contract.partyB,
        industry: contract.industry,
        effectiveDate: contract.effectiveDate,
        status: contract.status
      },
      versionInfo: {
        id: version.id,
        versionNo: version.versionNo,
        description: version.versionDescription,
        changeType: version.getChangeTypeDescription(),
        status: version.getStatusDescription(),
        taxRule: {
          id: version.taxRuleId,
          code: version.taxRuleCode,
          rate: version.getTaxRatePercentage()
        },
        createdAt: version.createdAt
      },
      hasLineItems: version.items && version.items.length > 0,
      lineItemCount: version.items ? version.items.length : 0
    };
  }
}

module.exports = ContractVersionService;
