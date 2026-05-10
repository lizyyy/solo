const DeclarationRecord = require('../models/DeclarationRecord');
const Attachment = require('../models/Attachment');
const Enterprise = require('../models/Enterprise');
const TaxPeriod = require('../models/TaxPeriod');
const ValidationRule = require('../models/ValidationRule');
const AuditLogService = require('./AuditLogService');
const ValidationEngine = require('./ValidationEngine');
const logger = require('../utils/logger');

class DeclarationService {
  static async getDeclarationRecord(enterpriseCode, periodCode) {
    let record = await DeclarationRecord.findOne({ enterpriseCode, periodCode });
    
    if (!record) {
      const validationResult = await ValidationEngine.validateDeclaration(
        enterpriseCode,
        periodCode,
        { Enterprise, TaxPeriod, ValidationRule, Attachment, DeclarationRecord }
      );

      record = await DeclarationRecord.create({
        enterpriseCode,
        periodCode,
        overallStatus: validationResult.isValid ? 'READY_TO_DECLARE' : 
          (validationResult.missingAttachments.length > 0 ? 'MISSING_ATTACHMENTS' : 
           (validationResult.invalidAttachments.length > 0 ? 'INVALID' : 'DRAFT')),
        validationResult: {
          isComplete: validationResult.isValid,
          missingAttachments: validationResult.missingAttachments,
          invalidAttachments: validationResult.invalidAttachments,
          validatedAttachments: validationResult.validatedAttachments,
          validationTime: new Date()
        },
        attachmentSummary: validationResult.attachmentSummary
      });
    }

    const enterprise = await Enterprise.findOne({ enterpriseCode });
    const period = await TaxPeriod.findOne({ periodCode });

    return {
      record,
      enterprise,
      period
    };
  }

  static async validateDeclaration(enterpriseCode, periodCode, operatorInfo = {}) {
    const validationResult = await ValidationEngine.validateDeclaration(
      enterpriseCode,
      periodCode,
      { Enterprise, TaxPeriod, ValidationRule, Attachment, DeclarationRecord }
    );

    let record = await DeclarationRecord.findOne({ enterpriseCode, periodCode });
    const oldStatus = record?.overallStatus;

    let newStatus = 'DRAFT';
    if (!validationResult.isValid) {
      if (validationResult.missingAttachments.length > 0) {
        newStatus = 'MISSING_ATTACHMENTS';
      } else if (validationResult.invalidAttachments.length > 0) {
        newStatus = 'INVALID';
      }
    } else {
      newStatus = 'READY_TO_DECLARE';
    }

    if (!record) {
      record = await DeclarationRecord.create({
        enterpriseCode,
        periodCode,
        overallStatus: newStatus,
        validationResult: {
          isComplete: validationResult.isValid,
          missingAttachments: validationResult.missingAttachments,
          invalidAttachments: validationResult.invalidAttachments,
          validatedAttachments: validationResult.validatedAttachments,
          validationTime: new Date(),
          validator: operatorInfo.operator || 'system'
        },
        attachmentSummary: validationResult.attachmentSummary,
        createdBy: operatorInfo.operator || 'system',
        updatedBy: operatorInfo.operator || 'system'
      });
    } else {
      record = await DeclarationRecord.findOneAndUpdate(
        { enterpriseCode, periodCode },
        {
          overallStatus: newStatus,
          validationResult: {
            isComplete: validationResult.isValid,
            missingAttachments: validationResult.missingAttachments,
            invalidAttachments: validationResult.invalidAttachments,
            validatedAttachments: validationResult.validatedAttachments,
            validationTime: new Date(),
            validator: operatorInfo.operator || 'system'
          },
          attachmentSummary: validationResult.attachmentSummary,
          updatedBy: operatorInfo.operator || 'system'
        },
        { new: true }
      );
    }

    if (oldStatus && oldStatus !== newStatus) {
      await AuditLogService.logStatusChange({
        enterpriseCode,
        periodCode,
        recordId: record._id.toString(),
        operator: operatorInfo.operator || 'system',
        operatorRole: operatorInfo.role,
        ipAddress: operatorInfo.ip,
        oldValue: { overallStatus: oldStatus },
        newValue: { overallStatus: newStatus },
        details: validationResult
      });
    }

    return {
      isValid: validationResult.isValid,
      status: newStatus,
      validationResult,
      record
    };
  }

  static async submitDeclaration(enterpriseCode, periodCode, operatorInfo = {}) {
    const { record } = await this.getDeclarationRecord(enterpriseCode, periodCode);

    if (record.overallStatus !== 'READY_TO_DECLARE') {
      throw new Error(`当前状态为 ${record.overallStatus}，无法提交申报`);
    }

    const oldStatus = record.overallStatus;

    const updatedRecord = await DeclarationRecord.findOneAndUpdate(
      { enterpriseCode, periodCode },
      {
        overallStatus: 'DECLARED',
        declarationTime: new Date(),
        declaredBy: operatorInfo.operator || 'system',
        updatedBy: operatorInfo.operator || 'system'
      },
      { new: true }
    );

    await AuditLogService.logDeclaration({
      enterpriseCode,
      periodCode,
      recordId: updatedRecord._id.toString(),
      operator: operatorInfo.operator || 'system',
      operatorRole: operatorInfo.role,
      ipAddress: operatorInfo.ip,
      oldValue: { overallStatus: oldStatus },
      newValue: { overallStatus: 'DECLARED' },
      details: {
        declarationTime: new Date(),
        declaredBy: operatorInfo.operator || 'system'
      }
    });

    logger.info(`[DECLARATION] 企业 ${enterpriseCode} 申报期 ${periodCode} 已提交申报`, {
      operator: operatorInfo.operator
    });

    return updatedRecord;
  }

  static async manualCorrectStatus(enterpriseCode, periodCode, data, operatorInfo = {}) {
    const { reason, targetStatus, remark } = data;

    if (!reason) {
      throw new Error('人工修正必须提供原因');
    }

    const validStatuses = ['READY_TO_DECLARE', 'DECLARED', 'MANUAL_CORRECTED', 'INVALID'];
    if (!validStatuses.includes(targetStatus)) {
      throw new Error(`无效的目标状态：${targetStatus}`);
    }

    let record = await DeclarationRecord.findOne({ enterpriseCode, periodCode });
    if (!record) {
      throw new Error('申报记录不存在');
    }

    const oldStatus = record.overallStatus;

    const correctionRecord = {
      time: new Date(),
      operator: operatorInfo.operator || 'system',
      reason,
      oldStatus,
      newStatus: targetStatus
    };

    record = await DeclarationRecord.findOneAndUpdate(
      { enterpriseCode, periodCode },
      {
        overallStatus: targetStatus,
        lastCorrectionTime: new Date(),
        lastCorrectedBy: operatorInfo.operator || 'system',
        $push: { correctionReasons: correctionRecord },
        remark: remark || record.remark,
        updatedBy: operatorInfo.operator || 'system'
      },
      { new: true }
    );

    await AuditLogService.logManualCorrection({
      enterpriseCode,
      periodCode,
      recordId: record._id.toString(),
      operator: operatorInfo.operator || 'system',
      operatorRole: operatorInfo.role,
      ipAddress: operatorInfo.ip,
      oldValue: { overallStatus: oldStatus },
      newValue: { overallStatus: targetStatus },
      reason,
      details: {
        remark,
        correctionRecord
      }
    });

    logger.info(`[DECLARATION] 企业 ${enterpriseCode} 申报期 ${periodCode} 人工修正状态`, {
      oldStatus,
      newStatus: targetStatus,
      operator: operatorInfo.operator,
      reason
    });

    return record;
  }

  static async getDeclarationHistory(enterpriseCode, periodCode) {
    const logs = await AuditLogService.queryLogs({
      enterpriseCode,
      periodCode,
      page: 1,
      pageSize: 100
    });

    const record = await DeclarationRecord.findOne({ enterpriseCode, periodCode });

    return {
      record,
      history: logs.logs,
      correctionReasons: record?.correctionReasons || []
    };
  }

  static async getDeclarations(params) {
    const query = {};
    
    if (params.enterpriseCode) query.enterpriseCode = params.enterpriseCode;
    if (params.periodCode) query.periodCode = params.periodCode;
    if (params.overallStatus) query.overallStatus = params.overallStatus;

    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const [records, total] = await Promise.all([
      DeclarationRecord.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(pageSize),
      DeclarationRecord.countDocuments(query)
    ]);

    return {
      records,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  static async generateReport(enterpriseCode, periodCode) {
    const { record, enterprise, period } = await this.getDeclarationRecord(enterpriseCode, periodCode);
    const attachments = await Attachment.find({
      enterpriseCode,
      periodCode,
      isLatest: true
    });
    const logs = await AuditLogService.queryLogs({
      enterpriseCode,
      periodCode,
      page: 1,
      pageSize: 50
    });

    const report = {
      reportType: 'DECLARATION_SUMMARY',
      generatedAt: new Date(),
      enterprise: enterprise ? {
        enterpriseCode: enterprise.enterpriseCode,
        enterpriseName: enterprise.enterpriseName,
        taxRegistrationNumber: enterprise.taxRegistrationNumber,
        industry: enterprise.industry
      } : null,
      period: period ? {
        periodCode: period.periodCode,
        periodType: period.periodType,
        year: period.year,
        month: period.month,
        quarter: period.quarter,
        startDate: period.startDate,
        endDate: period.endDate,
        declarationDeadline: period.declarationDeadline
      } : null,
      declarationStatus: {
        overallStatus: record.overallStatus,
        isComplete: record.validationResult?.isComplete || false,
        validationTime: record.validationResult?.validationTime
      },
      attachmentSummary: record.attachmentSummary,
      attachments: attachments.map(a => ({
        attachmentId: a.attachmentId,
        attachmentType: a.attachmentType,
        attachmentName: a.attachmentName,
        fileName: a.fileName,
        fileSize: a.fileSize,
        validationStatus: a.validationStatus,
        uploadTime: a.uploadTime,
        uploadUser: a.uploadUser
      })),
      missingAttachments: record.validationResult?.missingAttachments || [],
      invalidAttachments: record.validationResult?.invalidAttachments || [],
      correctionHistory: record.correctionReasons || [],
      auditLogSummary: {
        totalLogs: logs.pagination.total,
        recentLogs: logs.logs.slice(0, 10).map(l => ({
          logType: l.logType,
          action: l.action,
          operator: l.operator,
          time: l.createdAt,
          reason: l.reason
        }))
      },
      canDeclare: record.overallStatus === 'READY_TO_DECLARE'
    };

    return report;
  }

  static async getStatistics(params = {}) {
    const match = {};
    if (params.enterpriseCode) match.enterpriseCode = params.enterpriseCode;
    if (params.periodCode) match.periodCode = params.periodCode;

    const statusStats = await DeclarationRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$overallStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const attachmentStats = await DeclarationRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRequired: { $sum: '$attachmentSummary.totalRequired' },
          totalOptional: { $sum: '$attachmentSummary.totalOptional' },
          validRequired: { $sum: '$attachmentSummary.validRequired' },
          validOptional: { $sum: '$attachmentSummary.validOptional' }
        }
      }
    ]);

    return {
      byStatus: statusStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      attachments: attachmentStats[0] || {
        totalRequired: 0,
        totalOptional: 0,
        validRequired: 0,
        validOptional: 0
      }
    };
  }
}

module.exports = DeclarationService;
