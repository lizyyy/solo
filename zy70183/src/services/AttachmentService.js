const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Attachment = require('../models/Attachment');
const Enterprise = require('../models/Enterprise');
const TaxPeriod = require('../models/TaxPeriod');
const ValidationRule = require('../models/ValidationRule');
const DeclarationRecord = require('../models/DeclarationRecord');
const AuditLogService = require('./AuditLogService');
const ValidationEngine = require('./ValidationEngine');
const logger = require('../utils/logger');
const config = require('../config');

class AttachmentService {
  static async ensureUploadDir() {
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }
  }

  static async uploadAttachment(data, file, operatorInfo = {}) {
    const { enterpriseCode, periodCode, attachmentType, sourceSystem, uploadUser } = data;

    await this.ensureUploadDir();

    const enterpriseValidation = await ValidationEngine.validateEnterprise(enterpriseCode, Enterprise);
    if (!enterpriseValidation.isValid) {
      throw new Error(enterpriseValidation.errors.join('; '));
    }

    const periodValidation = await ValidationEngine.validatePeriod(periodCode, TaxPeriod);
    if (!periodValidation.isValid) {
      throw new Error(periodValidation.errors.join('; '));
    }

    const rules = await ValidationEngine.getApplicableRules(
      enterpriseValidation.enterprise,
      periodValidation.period,
      ValidationRule
    );
    const mergedRules = ValidationEngine.mergeRules(rules);
    
    const matchingRule = mergedRules.find(r => r.attachmentType === attachmentType);
    if (!matchingRule) {
      logger.warn(`[ATTACHMENT] 附件类型不在规则中：${attachmentType}`);
    }

    const fileValidation = ValidationEngine.validateFile(file, matchingRule || {});
    
    const fileExt = path.extname(file.originalname).toLowerCase();
    const storageFileName = `${uuidv4()}${fileExt}`;
    const storagePath = path.join(config.uploadDir, storageFileName);

    fs.renameSync(file.path, storagePath);

    const existingAttachments = await Attachment.find({
      enterpriseCode,
      periodCode,
      attachmentType,
      isLatest: true
    });

    for (const existing of existingAttachments) {
      await Attachment.updateOne(
        { _id: existing._id },
        {
          isLatest: false,
          replacedByAttachmentId: uuidv4()
        }
      );
    }

    const attachment = await Attachment.create({
      enterpriseCode,
      periodCode,
      sourceSystem: sourceSystem || 'UNKNOWN',
      attachmentType,
      attachmentName: matchingRule?.attachmentName || attachmentType,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      storagePath,
      uploadUser: uploadUser || operatorInfo.operator || 'system',
      validationStatus: fileValidation.isValid ? 'PENDING' : 'INVALID',
      validationMessages: fileValidation.errors,
      isValidated: false,
      version: existingAttachments.length + 1,
      isLatest: true,
      replacesAttachmentId: existingAttachments[0]?.attachmentId,
      createdBy: operatorInfo.operator || 'system',
      updatedBy: operatorInfo.operator || 'system'
    });

    await AuditLogService.logAttachmentUpload({
      enterpriseCode,
      periodCode,
      attachmentId: attachment.attachmentId,
      operator: operatorInfo.operator || 'system',
      operatorRole: operatorInfo.role,
      sourceSystem: sourceSystem || 'UNKNOWN',
      ipAddress: operatorInfo.ip,
      userAgent: operatorInfo.userAgent,
      details: {
        attachmentType,
        fileName: file.originalname,
        fileSize: file.size,
        validationStatus: attachment.validationStatus
      }
    });

    return attachment;
  }

  static async validateAttachment(attachmentId, operatorInfo = {}) {
    const attachment = await Attachment.findOne({ attachmentId });
    if (!attachment) {
      throw new Error('附件不存在');
    }

    if (attachment.isValidated && attachment.validationStatus === 'VALID') {
      return attachment;
    }

    const oldStatus = attachment.validationStatus;
    
    let validationStatus = 'VALID';
    const validationMessages = [];

    if (attachment.validationMessages.length > 0) {
      validationStatus = 'INVALID';
      validationMessages.push(...attachment.validationMessages);
    }

    await Attachment.updateOne(
      { attachmentId },
      {
        validationStatus,
        validationMessages,
        validatedAt: new Date(),
        isValidated: true,
        updatedBy: operatorInfo.operator || 'system'
      }
    );

    const updatedAttachment = await Attachment.findOne({ attachmentId });

    await AuditLogService.logAttachmentValidate({
      enterpriseCode: attachment.enterpriseCode,
      periodCode: attachment.periodCode,
      attachmentId,
      operator: operatorInfo.operator || 'system',
      operatorRole: operatorInfo.role,
      ipAddress: operatorInfo.ip,
      oldValue: { validationStatus: oldStatus },
      newValue: { validationStatus },
      details: { validationMessages }
    });

    await this.updateDeclarationStatus(
      attachment.enterpriseCode, 
      attachment.periodCode, 
      operatorInfo
    );

    return updatedAttachment;
  }

  static async manualCorrectAttachment(attachmentId, data, operatorInfo = {}) {
    const { reason, targetStatus } = data;

    if (!reason) {
      throw new Error('人工修正必须提供原因');
    }

    const attachment = await Attachment.findOne({ attachmentId });
    if (!attachment) {
      throw new Error('附件不存在');
    }

    const oldStatus = attachment.validationStatus;
    const newStatus = targetStatus || 'MANUAL_CORRECTED';

    await Attachment.updateOne(
      { attachmentId },
      {
        validationStatus: newStatus,
        validatedAt: new Date(),
        isValidated: true,
        remark: reason,
        updatedBy: operatorInfo.operator || 'system'
      }
    );

    const updatedAttachment = await Attachment.findOne({ attachmentId });

    await AuditLogService.logManualCorrection({
      enterpriseCode: attachment.enterpriseCode,
      periodCode: attachment.periodCode,
      attachmentId,
      operator: operatorInfo.operator || 'system',
      operatorRole: operatorInfo.role,
      ipAddress: operatorInfo.ip,
      oldValue: { validationStatus: oldStatus },
      newValue: { validationStatus: newStatus },
      reason,
      details: {
        remark: reason,
        manualCorrection: true
      }
    });

    await this.updateDeclarationStatus(
      attachment.enterpriseCode, 
      attachment.periodCode, 
      operatorInfo
    );

    return updatedAttachment;
  }

  static async updateDeclarationStatus(enterpriseCode, periodCode, operatorInfo = {}) {
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
        oldValue: { overallStatus: oldStatus },
        newValue: { overallStatus: newStatus },
        details: {
          missingCount: validationResult.missingAttachments.length,
          invalidCount: validationResult.invalidAttachments.length,
          validCount: validationResult.validatedAttachments.length
        }
      });
    }

    return record;
  }

  static async getAttachments(params) {
    const query = {};
    
    if (params.enterpriseCode) query.enterpriseCode = params.enterpriseCode;
    if (params.periodCode) query.periodCode = params.periodCode;
    if (params.attachmentType) query.attachmentType = params.attachmentType;
    if (params.validationStatus) query.validationStatus = params.validationStatus;
    if (params.sourceSystem) query.sourceSystem = params.sourceSystem;
    if (params.isLatest !== undefined) query.isLatest = params.isLatest;

    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const [attachments, total] = await Promise.all([
      Attachment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      Attachment.countDocuments(query)
    ]);

    return {
      attachments,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  static async getAttachmentHistory(attachmentId) {
    const current = await Attachment.findOne({ attachmentId });
    if (!current) {
      throw new Error('附件不存在');
    }

    const history = await Attachment.find({
      $or: [
        { attachmentId },
        { replacedByAttachmentId: attachmentId },
        { attachmentId: current.replacesAttachmentId }
      ]
    }).sort({ version: 1 });

    return {
      current,
      history
    };
  }
}

module.exports = AttachmentService;
