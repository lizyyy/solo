const ContractVersionService = require('../services/ContractVersionService');
const HistoricalRecalculationService = require('../services/HistoricalRecalculationService');
const ResponseHandler = require('../utils/responseHandler');

class ContractController {
  static async createContract(req, res) {
    try {
      const { contract, version } = ContractVersionService.createContract(
        req.body.contract,
        req.body.version
      );
      
      return ResponseHandler.created(
        res,
        {
          contract: contract.toJSON(),
          version: version.toJSON()
        },
        `合同 ${contract.contractNo} 创建成功，版本 V${version.versionNo} 已生成`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async getContractById(req, res) {
    try {
      const contract = ContractVersionService.getContractById(req.params.id);
      if (!contract) {
        return ResponseHandler.notFound(res, '合同');
      }
      
      const version = ContractVersionService.getLatestVersion(contract.id);
      
      return ResponseHandler.success(
        res,
        {
          contract: contract.toJSON(),
          latestVersion: version ? version.toJSON() : null
        },
        `查询成功：${contract.title}`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async getContractByNo(req, res) {
    try {
      const contract = ContractVersionService.getContractByNo(req.params.contractNo);
      if (!contract) {
        return ResponseHandler.notFound(res, '合同');
      }
      
      const version = ContractVersionService.getLatestVersion(contract.id);
      
      return ResponseHandler.success(
        res,
        {
          contract: contract.toJSON(),
          latestVersion: version ? version.toJSON() : null
        },
        `查询成功：${contract.title}`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async getAllVersions(req, res) {
    try {
      const contract = ContractVersionService.getContractById(req.params.contractId);
      if (!contract) {
        return ResponseHandler.notFound(res, '合同');
      }
      
      const versions = ContractVersionService.getAllVersions(req.params.contractId);
      
      return ResponseHandler.success(
        res,
        {
          contractId: contract.id,
          contractNo: contract.contractNo,
          count: versions.length,
          versions: versions.map(v => v.toJSON())
        },
        `合同 ${contract.contractNo} 共有 ${versions.length} 个版本`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async getVersionById(req, res) {
    try {
      const version = ContractVersionService.getVersionById(req.params.versionId);
      if (!version) {
        return ResponseHandler.notFound(res, '版本');
      }
      
      return ResponseHandler.success(
        res,
        { version: version.toJSON() },
        `查询成功：版本 V${version.versionNo}`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async updateAmount(req, res) {
    try {
      const result = ContractVersionService.updateContractAmount(
        req.params.contractId,
        req.body.newAmount,
        req.body.priceType,
        {
          versionDescription: req.body.versionDescription,
          createdBy: req.body.createdBy
        }
      );
      
      return ResponseHandler.success(
        res,
        {
          oldVersion: result.oldVersion.toJSON(),
          newVersion: result.newVersion.toJSON(),
          comparison: result.comparison
        },
        `金额变更成功：${result.comparison.businessSummary.impact}`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async updateTaxRate(req, res) {
    try {
      const result = ContractVersionService.updateContractTaxRate(
        req.params.contractId,
        req.body.newTaxRuleId,
        {
          versionDescription: req.body.versionDescription,
          createdBy: req.body.createdBy
        }
      );
      
      return ResponseHandler.success(
        res,
        {
          oldVersion: result.oldVersion.toJSON(),
          newVersion: result.newVersion.toJSON(),
          comparison: result.comparison
        },
        `税率变更成功：${result.comparison.changes.taxRate.oldPercentage} → ${result.comparison.changes.taxRate.newPercentage}`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async getBusinessReport(req, res) {
    try {
      const contract = ContractVersionService.getContractById(req.params.contractId);
      if (!contract) {
        return ResponseHandler.notFound(res, '合同');
      }
      
      let version;
      if (req.query.versionId) {
        version = ContractVersionService.getVersionById(req.query.versionId);
      } else {
        version = ContractVersionService.getLatestVersion(contract.id);
      }
      
      if (!version) {
        return ResponseHandler.error(res, new Error('合同没有任何版本'));
      }
      
      const report = ContractVersionService.generateBusinessReport(contract, version);
      
      return ResponseHandler.businessResult(
        res,
        report,
        report.verification.status
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async recalculateWithNewTaxRule(req, res) {
    try {
      const result = HistoricalRecalculationService.recalculateWithNewTaxRule(
        req.params.contractId,
        req.body.newTaxRuleId,
        {
          createVersion: req.body.createVersion !== false,
          versionDescription: req.body.versionDescription,
          createdBy: req.body.createdBy
        }
      );
      
      return ResponseHandler.success(
        res,
        result,
        result.newVersion 
          ? `历史重算完成，新版本 V${result.newVersion.versionNo} 已创建`
          : '历史重算预览完成（未创建新版本）'
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async recalculateWithNewAmount(req, res) {
    try {
      const result = HistoricalRecalculationService.recalculateWithNewAmount(
        req.params.contractId,
        req.body.newTotalAmount,
        req.body.priceType,
        {
          createVersion: req.body.createVersion !== false,
          versionDescription: req.body.versionDescription,
          createdBy: req.body.createdBy
        }
      );
      
      return ResponseHandler.success(
        res,
        result,
        result.newVersion 
          ? `历史重算完成，新版本 V${result.newVersion.versionNo} 已创建`
          : '历史重算预览完成（未创建新版本）'
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async previewRecalculation(req, res) {
    try {
      const result = HistoricalRecalculationService.previewRecalculation(
        req.params.contractId,
        req.body
      );
      
      return ResponseHandler.success(
        res,
        result,
        result.businessAdvice
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async verifyAllVersions(req, res) {
    try {
      const result = HistoricalRecalculationService.verifyAllVersions(req.params.contractId);
      
      return ResponseHandler.success(
        res,
        result,
        result.summary.status
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }
}

module.exports = ContractController;
