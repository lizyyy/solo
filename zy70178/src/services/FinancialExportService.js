const ContractVersionService = require('./ContractVersionService');
const TaxSeparationService = require('./TaxSeparationService');

class FinancialExportService {
  static exportContractForFinance(contractId, versionId = null) {
    const contract = ContractVersionService.getContractById(contractId);
    if (!contract) {
      throw new Error(`合同 ${contractId} 不存在`);
    }

    let version;
    if (versionId) {
      version = ContractVersionService.getVersionById(versionId);
      if (!version) {
        throw new Error(`版本 ${versionId} 不存在`);
      }
    } else {
      version = ContractVersionService.getLatestVersion(contractId);
      if (!version) {
        throw new Error(`合同 ${contractId} 没有任何版本`);
      }
    }

    const report = ContractVersionService.generateBusinessReport(contract, version);
    
    return {
      exportType: 'FINANCE_EXPORT',
      exportDate: new Date().toISOString(),
      businessContext: {
        contractNo: contract.contractNo,
        contractTitle: contract.title,
        partyA: contract.partyA,
        partyB: contract.partyB,
        signDate: contract.signDate,
        effectiveDate: contract.effectiveDate,
        industry: contract.industry,
        versionNo: version.versionNo,
        changeType: version.changeType,
        changeTypeDescription: version.getChangeTypeDescription(),
        status: version.status,
        statusDescription: version.getStatusDescription()
      },
      taxRuleInfo: {
        ruleId: version.taxRuleId,
        ruleCode: version.taxRuleCode,
        taxRate: version.taxRate,
        taxRatePercentage: version.getTaxRatePercentage()
      },
      financialBreakdown: {
        amounts: report.amounts,
        calculationLogic: report.calculationLogic,
        verification: report.verification
      },
      lineItems: version.items && version.items.length > 0 ? {
        itemCount: version.items.length,
        items: version.items.map((item, index) => ({
          lineNo: index + 1,
          description: item.description || `明细项 ${index + 1}`,
          taxRate: item.taxRate,
          taxRatePercentage: (item.taxRate * 100).toFixed(2) + '%',
          amountWithTax: item.amountWithTax,
          amountWithoutTax: item.amountWithoutTax,
          taxAmount: item.taxAmount,
          verification: item.verification
        })),
        totals: this.calculateItemTotals(version.items)
      } : null,
      businessSummary: report.breakdown.description,
      auditTrail: {
        createdBy: version.createdBy,
        createdAt: version.createdAt,
        approvedBy: version.approvedBy,
        approvedAt: version.approvedAt
      }
    };
  }

  static calculateItemTotals(items) {
    const totals = items.reduce(
      (acc, item) => ({
        amountWithTax: acc.amountWithTax + item.amountWithTax,
        amountWithoutTax: acc.amountWithoutTax + item.amountWithoutTax,
        taxAmount: acc.taxAmount + item.taxAmount
      }),
      { amountWithTax: 0, amountWithoutTax: 0, taxAmount: 0 }
    );

    return {
      amountWithTax: TaxSeparationService.roundToTwoDecimals(totals.amountWithTax),
      amountWithoutTax: TaxSeparationService.roundToTwoDecimals(totals.amountWithoutTax),
      taxAmount: TaxSeparationService.roundToTwoDecimals(totals.taxAmount),
      verification: {
        check: `明细合计：含税价 ${TaxSeparationService.roundToTwoDecimals(totals.amountWithTax)} = 不含税价 ${TaxSeparationService.roundToTwoDecimals(totals.amountWithoutTax)} + 税额 ${TaxSeparationService.roundToTwoDecimals(totals.taxAmount)}`,
        isValid: TaxSeparationService.roundToTwoDecimals(totals.amountWithoutTax + totals.taxAmount) === TaxSeparationService.roundToTwoDecimals(totals.amountWithTax)
      }
    };
  }

  static exportVersionHistory(contractId) {
    const contract = ContractVersionService.getContractById(contractId);
    if (!contract) {
      throw new Error(`合同 ${contractId} 不存在`);
    }

    const versions = ContractVersionService.getAllVersions(contractId);
    
    const history = versions.map(version => {
      const report = ContractVersionService.generateBusinessReport(contract, version);
      return {
        versionNo: version.versionNo,
        versionId: version.id,
        basedOnVersionId: version.basedOnVersionId,
        changeType: version.changeType,
        changeTypeDescription: version.getChangeTypeDescription(),
        description: version.versionDescription,
        status: version.status,
        statusDescription: version.getStatusDescription(),
        taxRuleCode: version.taxRuleCode,
        taxRatePercentage: version.getTaxRatePercentage(),
        amounts: {
          amountWithTax: version.amountWithTax,
          amountWithTaxFormatted: report.amounts.amountWithTaxFormatted,
          amountWithoutTax: version.amountWithoutTax,
          amountWithoutTaxFormatted: report.amounts.amountWithoutTaxFormatted,
          taxAmount: version.taxAmount,
          taxAmountFormatted: report.amounts.taxAmountFormatted
        },
        createdAt: version.createdAt,
        createdBy: version.createdBy
      };
    });

    return {
      exportType: 'VERSION_HISTORY',
      exportDate: new Date().toISOString(),
      contractInfo: {
        id: contract.id,
        contractNo: contract.contractNo,
        title: contract.title,
        partyA: contract.partyA,
        partyB: contract.partyB
      },
      totalVersions: versions.length,
      currentVersionId: contract.currentVersionId,
      versions: history,
      summary: {
        activeVersions: history.filter(v => v.status === 'ACTIVE').length,
        pendingVersions: history.filter(v => v.status === 'PENDING_APPROVAL').length,
        rejectedVersions: history.filter(v => v.status === 'REJECTED').length,
        latestChange: history.length > 0 ? history[history.length - 1].changeTypeDescription : '无变更历史'
      }
    };
  }

  static exportTaxSummaryForPeriod(contracts, startDate, endDate) {
    const summary = {
      exportType: 'TAX_SUMMARY',
      exportDate: new Date().toISOString(),
      period: {
        start: startDate,
        end: endDate
      },
      contracts: [],
      totals: {
        amountWithTax: 0,
        amountWithoutTax: 0,
        taxAmount: 0
      },
      byTaxRate: {},
      byIndustry: {}
    };

    contracts.forEach(contract => {
      const version = ContractVersionService.getLatestVersion(contract.id);
      if (!version) return;

      const contractSummary = {
        contractNo: contract.contractNo,
        title: contract.title,
        industry: contract.industry,
        taxRuleCode: version.taxRuleCode,
        taxRate: version.taxRate,
        taxRatePercentage: version.getTaxRatePercentage(),
        amountWithTax: version.amountWithTax,
        amountWithoutTax: version.amountWithoutTax,
        taxAmount: version.taxAmount
      };

      summary.contracts.push(contractSummary);

      summary.totals.amountWithTax += version.amountWithTax;
      summary.totals.amountWithoutTax += version.amountWithoutTax;
      summary.totals.taxAmount += version.taxAmount;

      const rateKey = version.getTaxRatePercentage();
      if (!summary.byTaxRate[rateKey]) {
        summary.byTaxRate[rateKey] = {
          count: 0,
          amountWithTax: 0,
          amountWithoutTax: 0,
          taxAmount: 0
        };
      }
      summary.byTaxRate[rateKey].count++;
      summary.byTaxRate[rateKey].amountWithTax += version.amountWithTax;
      summary.byTaxRate[rateKey].amountWithoutTax += version.amountWithoutTax;
      summary.byTaxRate[rateKey].taxAmount += version.taxAmount;

      const industryKey = contract.industry || '未分类';
      if (!summary.byIndustry[industryKey]) {
        summary.byIndustry[industryKey] = {
          count: 0,
          amountWithTax: 0,
          amountWithoutTax: 0,
          taxAmount: 0
        };
      }
      summary.byIndustry[industryKey].count++;
      summary.byIndustry[industryKey].amountWithTax += version.amountWithTax;
      summary.byIndustry[industryKey].amountWithoutTax += version.amountWithoutTax;
      summary.byIndustry[industryKey].taxAmount += version.taxAmount;
    });

    summary.totals.amountWithTax = TaxSeparationService.roundToTwoDecimals(summary.totals.amountWithTax);
    summary.totals.amountWithoutTax = TaxSeparationService.roundToTwoDecimals(summary.totals.amountWithoutTax);
    summary.totals.taxAmount = TaxSeparationService.roundToTwoDecimals(summary.totals.taxAmount);

    Object.keys(summary.byTaxRate).forEach(key => {
      summary.byTaxRate[key].amountWithTax = TaxSeparationService.roundToTwoDecimals(summary.byTaxRate[key].amountWithTax);
      summary.byTaxRate[key].amountWithoutTax = TaxSeparationService.roundToTwoDecimals(summary.byTaxRate[key].amountWithoutTax);
      summary.byTaxRate[key].taxAmount = TaxSeparationService.roundToTwoDecimals(summary.byTaxRate[key].taxAmount);
    });

    Object.keys(summary.byIndustry).forEach(key => {
      summary.byIndustry[key].amountWithTax = TaxSeparationService.roundToTwoDecimals(summary.byIndustry[key].amountWithTax);
      summary.byIndustry[key].amountWithoutTax = TaxSeparationService.roundToTwoDecimals(summary.byIndustry[key].amountWithoutTax);
      summary.byIndustry[key].taxAmount = TaxSeparationService.roundToTwoDecimals(summary.byIndustry[key].taxAmount);
    });

    return summary;
  }

  static formatAsTextReport(exportData) {
    let report = '';
    const separator = '='.repeat(60);
    const subSeparator = '-'.repeat(60);

    if (exportData.exportType === 'FINANCE_EXPORT') {
      report += `${separator}\n`;
      report += '合同财务导出报告\n';
      report += `${separator}\n\n`;
      
      report += '【合同基本信息】\n';
      report += `合同编号：${exportData.businessContext.contractNo}\n`;
      report += `合同名称：${exportData.businessContext.contractTitle}\n`;
      report += `甲方：${exportData.businessContext.partyA || '未填写'}\n`;
      report += `乙方：${exportData.businessContext.partyB || '未填写'}\n`;
      report += `签订日期：${exportData.businessContext.signDate || '未填写'}\n`;
      report += `生效日期：${exportData.businessContext.effectiveDate || '未填写'}\n`;
      report += `所属行业：${exportData.businessContext.industry || '未分类'}\n\n`;

      report += '【版本信息】\n';
      report += `版本号：V${exportData.businessContext.versionNo}\n`;
      report += `变更类型：${exportData.businessContext.changeTypeDescription}\n`;
      report += `状态：${exportData.businessContext.statusDescription}\n\n`;

      report += '【税率信息】\n';
      report += `税率规则：${exportData.taxRuleInfo.ruleCode}\n`;
      report += `税率：${exportData.taxRuleInfo.taxRatePercentage}\n\n`;

      report += '【财务明细】\n';
      report += `含税价：${exportData.financialBreakdown.amounts.amountWithTaxFormatted}\n`;
      report += `不含税价：${exportData.financialBreakdown.amounts.amountWithoutTaxFormatted}\n`;
      report += `增值税税额：${exportData.financialBreakdown.amounts.taxAmountFormatted}\n\n`;

      report += '【计算逻辑】\n';
      report += `${exportData.financialBreakdown.calculationLogic}\n\n`;

      report += '【验证结果】\n';
      report += `状态：${exportData.financialBreakdown.verification.status}\n`;
      Object.keys(exportData.financialBreakdown.verification.details).forEach(key => {
        report += `${exportData.financialBreakdown.verification.details[key]}\n`;
      });
      report += '\n';

      if (exportData.lineItems) {
        report += `${subSeparator}\n`;
        report += '【明细项】\n';
        report += `${subSeparator}\n`;
        exportData.lineItems.items.forEach(item => {
          report += `\n【明细项 ${item.lineNo}】${item.description}\n`;
          report += `  税率：${item.taxRatePercentage}\n`;
          report += `  含税价：¥${item.amountWithTax.toFixed(2)}\n`;
          report += `  不含税价：¥${item.amountWithoutTax.toFixed(2)}\n`;
          report += `  税额：¥${item.taxAmount.toFixed(2)}\n`;
        });
        report += `\n【明细合计】\n`;
        report += `  含税价：¥${exportData.lineItems.totals.amountWithTax.toFixed(2)}\n`;
        report += `  不含税价：¥${exportData.lineItems.totals.amountWithoutTax.toFixed(2)}\n`;
        report += `  税额：¥${exportData.lineItems.totals.taxAmount.toFixed(2)}\n`;
        report += `  验证：${exportData.lineItems.totals.verification.isValid ? '通过' : '不通过'}\n`;
      }

      report += `\n${subSeparator}\n`;
      report += '【业务摘要】\n';
      report += `${exportData.businessSummary}\n`;

    } else if (exportData.exportType === 'VERSION_HISTORY') {
      report += `${separator}\n`;
      report += '合同版本历史\n';
      report += `${separator}\n\n`;
      
      report += '【合同基本信息】\n';
      report += `合同编号：${exportData.contractInfo.contractNo}\n`;
      report += `合同名称：${exportData.contractInfo.title}\n`;
      report += `甲方：${exportData.contractInfo.partyA || '未填写'}\n`;
      report += `乙方：${exportData.contractInfo.partyB || '未填写'}\n\n`;

      report += `总版本数：${exportData.totalVersions}\n`;
      report += `生效中：${exportData.summary.activeVersions} | 待审批：${exportData.summary.pendingVersions} | 已驳回：${exportData.summary.rejectedVersions}\n\n`;

      report += `${subSeparator}\n`;
      report += '【版本历史】\n';
      report += `${subSeparator}\n\n`;
      
      exportData.versions.forEach(version => {
        report += `\n【V${version.versionNo}】${version.changeTypeDescription}\n`;
        report += `  状态：${version.statusDescription}\n`;
        report += `  描述：${version.description || '无'}\n`;
        report += `  税率：${version.taxRatePercentage}\n`;
        report += `  含税价：${version.amounts.amountWithTaxFormatted}\n`;
        report += `  不含税价：${version.amounts.amountWithoutTaxFormatted}\n`;
        report += `  税额：${version.amounts.taxAmountFormatted}\n`;
        report += `  创建人：${version.createdBy}\n`;
        report += `  创建时间：${version.createdAt}\n`;
      });

    } else if (exportData.exportType === 'TAX_SUMMARY') {
      report += `${separator}\n`;
      report += '税务汇总报告\n';
      report += `${separator}\n\n`;
      
      report += `统计期间：${exportData.period.start} 至 ${exportData.period.end}\n`;
      report += `合同数量：${exportData.contracts.length}\n\n`;

      report += '【汇总数据】\n';
      report += `含税价合计：¥${exportData.totals.amountWithTax.toFixed(2)}\n`;
      report += `不含税价合计：¥${exportData.totals.amountWithoutTax.toFixed(2)}\n`;
      report += `税额合计：¥${exportData.totals.taxAmount.toFixed(2)}\n\n`;

      report += `${subSeparator}\n`;
      report += '【按税率分类】\n';
      report += `${subSeparator}\n\n`;
      Object.keys(exportData.byTaxRate).forEach(rate => {
        const data = exportData.byTaxRate[rate];
        report += `税率 ${rate}：${data.count} 份合同\n`;
        report += `  含税价：¥${data.amountWithTax.toFixed(2)}\n`;
        report += `  不含税价：¥${data.amountWithoutTax.toFixed(2)}\n`;
        report += `  税额：¥${data.taxAmount.toFixed(2)}\n\n`;
      });

      report += `${subSeparator}\n`;
      report += '【按行业分类】\n';
      report += `${subSeparator}\n\n`;
      Object.keys(exportData.byIndustry).forEach(industry => {
        const data = exportData.byIndustry[industry];
        report += `${industry}：${data.count} 份合同\n`;
        report += `  含税价：¥${data.amountWithTax.toFixed(2)}\n`;
        report += `  不含税价：¥${data.amountWithoutTax.toFixed(2)}\n`;
        report += `  税额：¥${data.taxAmount.toFixed(2)}\n\n`;
      });
    }

    report += `\n${separator}\n`;
    report += `导出时间：${exportData.exportDate}\n`;
    report += `${separator}\n`;

    return report;
  }
}

module.exports = FinancialExportService;
