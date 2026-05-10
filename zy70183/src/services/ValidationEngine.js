const path = require('path');
const logger = require('../utils/logger');

const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'xls', 'xlsx', 'doc', 'docx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

class ValidationEngine {
  static validateFile(file, rule = {}) {
    const errors = [];
    const warnings = [];

    const allowedFormats = rule.allowedFormats || ALLOWED_EXTENSIONS;
    const maxSize = rule.maxSize || MAX_FILE_SIZE;

    const fileExt = path.extname(file.originalname).toLowerCase().slice(1);
    if (!allowedFormats.includes(fileExt)) {
      errors.push(`文件格式不支持。允许的格式：${allowedFormats.join('、')}`);
    }

    if (file.size > maxSize) {
      errors.push(`文件大小超出限制。最大允许：${(maxSize / 1024 / 1024).toFixed(1)}MB，当前：${(file.size / 1024 / 1024).toFixed(2)}MB`);
    }

    if (!file.originalname || file.originalname.trim() === '') {
      warnings.push('文件名为空，建议提供有意义的文件名');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static async validateEnterprise(enterpriseCode, EnterpriseModel) {
    const errors = [];
    const enterprise = await EnterpriseModel.findOne({ 
      enterpriseCode, 
      status: 'ACTIVE' 
    });

    if (!enterprise) {
      errors.push(`企业主体不存在或已停用：${enterpriseCode}`);
      return {
        isValid: false,
        errors,
        enterprise: null
      };
    }

    return {
      isValid: true,
      errors: [],
      enterprise
    };
  }

  static async validatePeriod(periodCode, TaxPeriodModel) {
    const errors = [];
    const period = await TaxPeriodModel.findOne({ 
      periodCode,
      status: 'ACTIVE'
    });

    if (!period) {
      errors.push(`申报期不存在或已关闭：${periodCode}`);
      return {
        isValid: false,
        errors,
        period: null
      };
    }

    const now = new Date();
    if (now > period.declarationDeadline) {
      errors.push(`申报期已过截止日期：${period.declarationDeadline.toLocaleDateString()}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      period
    };
  }

  static async getApplicableRules(enterprise, period, ValidationRuleModel) {
    const rules = await ValidationRuleModel.find({
      status: 'ACTIVE',
      $or: [
        { periodType: 'ALL' },
        { periodType: period.periodType }
      ],
      $or: [
        { applicableIndustries: { $size: 0 } },
        { applicableIndustries: enterprise.industry ? { $in: [enterprise.industry] } : { $exists: true } }
      ]
    }).sort({ priority: -1 });

    return rules;
  }

  static mergeRules(rules) {
    const mergedAttachments = new Map();

    rules.forEach(rule => {
      rule.requiredAttachments.forEach(attachment => {
        const key = attachment.attachmentType;
        if (!mergedAttachments.has(key)) {
          mergedAttachments.set(key, { ...attachment });
        } else {
          const existing = mergedAttachments.get(key);
          if (!existing.isRequired && attachment.isRequired) {
            mergedAttachments.set(key, { ...attachment });
          }
        }
      });
    });

    return Array.from(mergedAttachments.values());
  }

  static async validateDeclaration(enterpriseCode, periodCode, models) {
    const { Enterprise, TaxPeriod, ValidationRule, Attachment, DeclarationRecord } = models;
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      missingAttachments: [],
      invalidAttachments: [],
      validatedAttachments: [],
      attachmentSummary: {
        totalRequired: 0,
        totalOptional: 0,
        uploadedRequired: 0,
        uploadedOptional: 0,
        validRequired: 0,
        validOptional: 0
      }
    };

    const enterpriseResult = await this.validateEnterprise(enterpriseCode, Enterprise);
    if (!enterpriseResult.isValid) {
      result.errors.push(...enterpriseResult.errors);
      result.isValid = false;
      return result;
    }

    const periodResult = await this.validatePeriod(periodCode, TaxPeriod);
    if (!periodResult.isValid) {
      result.errors.push(...periodResult.errors);
      result.isValid = false;
      return result;
    }

    const rules = await this.getApplicableRules(
      enterpriseResult.enterprise, 
      periodResult.period, 
      ValidationRule
    );
    
    const requiredAttachments = this.mergeRules(rules);
    
    result.attachmentSummary.totalRequired = requiredAttachments.filter(a => a.isRequired).length;
    result.attachmentSummary.totalOptional = requiredAttachments.filter(a => !a.isRequired).length;

    const uploadedAttachments = await Attachment.find({
      enterpriseCode,
      periodCode,
      isLatest: true
    });

    requiredAttachments.forEach(required => {
      const uploaded = uploadedAttachments.find(
        a => a.attachmentType === required.attachmentType
      );

      if (!uploaded) {
        if (required.isRequired) {
          result.missingAttachments.push({
            attachmentType: required.attachmentType,
            attachmentName: required.attachmentName,
            isRequired: true
          });
        } else {
          result.warnings.push(`可选附件缺失：${required.attachmentName}`);
        }
      } else {
        if (required.isRequired) {
          result.attachmentSummary.uploadedRequired++;
        } else {
          result.attachmentSummary.uploadedOptional++;
        }

        if (uploaded.validationStatus === 'VALID' || uploaded.validationStatus === 'MANUAL_CORRECTED') {
          result.validatedAttachments.push({
            attachmentId: uploaded.attachmentId,
            attachmentType: uploaded.attachmentType,
            attachmentName: uploaded.attachmentName
          });
          
          if (required.isRequired) {
            result.attachmentSummary.validRequired++;
          } else {
            result.attachmentSummary.validOptional++;
          }
        } else if (uploaded.validationStatus === 'INVALID') {
          result.invalidAttachments.push({
            attachmentId: uploaded.attachmentId,
            attachmentType: uploaded.attachmentType,
            attachmentName: uploaded.attachmentName,
            reasons: uploaded.validationMessages
          });
        } else if (uploaded.validationStatus === 'PENDING') {
          result.warnings.push(`附件待校验：${uploaded.attachmentName}`);
        }
      }
    });

    if (result.missingAttachments.length > 0) {
      result.isValid = false;
      result.errors.push(`缺失 ${result.missingAttachments.length} 个必填附件`);
    }

    if (result.invalidAttachments.length > 0) {
      result.isValid = false;
      result.errors.push(`${result.invalidAttachments.length} 个附件校验不通过`);
    }

    logger.info(`[VALIDATION] 企业 ${enterpriseCode} 申报期 ${periodCode} 校验完成`, {
      isValid: result.isValid,
      missingCount: result.missingAttachments.length,
      invalidCount: result.invalidAttachments.length,
      validCount: result.validatedAttachments.length
    });

    return result;
  }
}

module.exports = ValidationEngine;
