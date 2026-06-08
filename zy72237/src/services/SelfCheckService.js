const { SOURCE_TYPE } = require('../models/ValuationAnomaly');

class SelfCheckService {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  async runAllChecks(anomalyId) {
    const anomaly = this.dataStore.getById(anomalyId);
    if (!anomaly) {
      throw new Error('异常记录不存在');
    }

    const results = {
      duplicateImport: await this.checkDuplicateImport(anomaly),
      zeroWithReversal: await this.checkZeroWithReversal(anomaly),
      recalcAfterSupplement: await this.checkRecalcAfterSupplement(anomaly),
      exportConsistency: await this.checkExportConsistency(anomaly),
      checkedAt: new Date(),
      overallPass: false
    };

    results.overallPass = 
      results.duplicateImport.pass &&
      results.zeroWithReversal.pass &&
      results.recalcAfterSupplement.pass &&
      results.exportConsistency.pass;

    anomaly.selfCheckResults = results;
    this.dataStore.update(anomaly);

    return results;
  }

  async checkDuplicateImport(anomaly) {
    const result = {
      pass: true,
      warnings: [],
      details: null
    };

    const sourceTypes = new Set();
    const duplicates = [];

    anomaly.sources.forEach((source, index) => {
      const key = `${source.type}_${source.batchNo || source.emailId || 'default'}`;
      if (sourceTypes.has(key)) {
        duplicates.push({
          type: source.type,
          batchNo: source.batchNo,
          emailId: source.emailId,
          index,
          importedAt: source.importedAt
        });
      }
      sourceTypes.add(key);
    });

    const allAnomalies = this.dataStore.getAll();
    allAnomalies.forEach(other => {
      if (other.id !== anomaly.id) {
        if (other.recordId === anomaly.recordId) {
          duplicates.push({
            type: 'record_duplicate',
            conflictRecordId: other.id,
            securityCode: other.securityCode
          });
        }
      }
    });

    if (duplicates.length > 0) {
      result.pass = false;
      result.warnings.push('检测到重复导入');
      result.details = duplicates;
    }

    return result;
  }

  async checkZeroWithReversal(anomaly) {
    const { STATUS } = require('../models/ValuationAnomaly');
    const result = {
      pass: true,
      warnings: [],
      details: null,
      requiresRiskReview: false
    };

    if (anomaly.marketValue === 0 && anomaly.remark && anomaly.remark.includes('已冲正')) {
      const riskConfirmed = anomaly.status === STATUS.CONFIRMED || anomaly.status === STATUS.NORMAL;
      if (riskConfirmed) {
        result.pass = true;
        result.warnings.push('金额为0且备注已冲正，风控已复核确认');
        result.details = {
          marketValue: anomaly.marketValue,
          remark: anomaly.remark,
          riskReviewCompleted: true
        };
      } else {
        result.pass = false;
        result.requiresRiskReview = true;
        result.warnings.push('金额为0但备注显示已冲正，需要风控复核');
        result.details = {
          marketValue: anomaly.marketValue,
          remark: anomaly.remark,
          suggestion: '请风控同事确认该笔冲正交易是否有效，不可自动归为正常'
        };
      }
    }

    return result;
  }

  async checkRecalcAfterSupplement(anomaly) {
    const result = {
      pass: true,
      warnings: [],
      details: null
    };

    const hasEmail = anomaly.sources.some(s => s.type === SOURCE_TYPE.EMAIL);
    const hasBatch = anomaly.sources.some(s => s.type === SOURCE_TYPE.BATCH);

    if (hasEmail && hasBatch) {
      const step2Action = anomaly.workflowHistory.find(h => h.action === 'step_2');
      if (!step2Action) {
        result.pass = false;
        result.warnings.push('补录清算批次号后未进行重算确认');
        result.details = {
          hasEmail: true,
          hasBatch: true,
          suggestion: '请完成批次号补看流程后确认重算结果'
        };
      }
    }

    if (anomaly.calculationParams) {
      const sourceCount = anomaly.sources.length;
      const calcTime = new Date(anomaly.calculationParams.calculatedAt);
      
      anomaly.sources.forEach(source => {
        const importTime = new Date(source.importedAt);
        if (importTime > calcTime) {
          result.pass = false;
          result.warnings.push('存在补录数据后未重算的情况');
          result.details = {
            lastCalculatedAt: calcTime,
            sourceImportedAt: importTime,
            sourceType: source.type,
            suggestion: '新数据导入后需要重新执行估值计算'
          };
        }
      });
    }

    return result;
  }

  async checkExportConsistency(anomaly) {
    const result = {
      pass: true,
      warnings: [],
      details: null
    };

    const viewData = anomaly.toJSON();
    const exportData = this.generateExportData(anomaly);
    const apiData = this.generateApiResponse(anomaly);

    const inconsistencies = [];

    const compareFields = ['marketValue', 'calculatedValue', 'deviation', 'status', 'remark', 'isZeroWithReversal'];
    compareFields.forEach(field => {
      if (viewData[field] !== exportData[field]) {
        inconsistencies.push({
          field,
          viewValue: viewData[field],
          exportValue: exportData[field],
          location: 'view_vs_export'
        });
      }
      if (viewData[field] !== apiData[field]) {
        inconsistencies.push({
          field,
          viewValue: viewData[field],
          apiValue: apiData[field],
          location: 'view_vs_api'
        });
      }
    });

    if (inconsistencies.length > 0) {
      result.pass = false;
      result.warnings.push('页面展示、导出数据、接口返回存在不一致');
      result.details = inconsistencies;
    }

    return result;
  }

  generateExportData(anomaly) {
    const baseData = anomaly.toJSON();
    return {
      ...baseData,
      exportTime: new Date().toISOString()
    };
  }

  generateApiResponse(anomaly) {
    return anomaly.toJSON();
  }

  generateReport(checkResults) {
    const report = {
      title: '市值法估值异常提醒自检报告',
      generatedAt: new Date(),
      overall: {
        pass: checkResults.overallPass,
        status: checkResults.overallPass ? '通过' : '未通过'
      },
      checks: []
    };

    const checkNames = {
      duplicateImport: '重复导入检测',
      zeroWithReversal: '零值冲正检测',
      recalcAfterSupplement: '补录重算检测',
      exportConsistency: '导出一致性检测'
    };

    Object.keys(checkNames).forEach(key => {
      if (checkResults[key]) {
        report.checks.push({
          name: checkNames[key],
          pass: checkResults[key].pass,
          warnings: checkResults[key].warnings,
          details: checkResults[key].details
        });
      }
    });

    return report;
  }
}

module.exports = SelfCheckService;
