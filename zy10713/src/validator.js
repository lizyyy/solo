export class Validator {
  constructor(options = {}) {
    this.expectedVariables = options.expectedVariables || [];
    this.validTouchStatuses = options.validTouchStatuses || ['success', 'failed', 'skipped', 'pending'];
    this.errors = [];
    this.warnings = [];
  }

  validate(records, context = 'unknown') {
    const errors = [];
    const warnings = [];
    const validatedRecords = [];

    for (const record of records) {
      const result = this.validateRecord(record, context);
      validatedRecords.push({
        ...result.record,
        validation: {
          isValid: result.isValid,
          errors: result.errors,
          warnings: result.warnings
        }
      });
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return {
      records: validatedRecords,
      errors,
      warnings,
      summary: {
        total: records.length,
        valid: validatedRecords.filter(r => r.validation.isValid).length,
        hasErrors: errors.length > 0,
        hasWarnings: warnings.length > 0
      }
    };
  }

  validateRecord(record, context) {
    const errors = [];
    const warnings = [];

    if (!record.templateId) {
      errors.push({
        type: 'EMPTY_TEMPLATE_ID',
        context,
        chatId: record.chatId,
        chatName: record.chatName,
        message: '模板ID不能为空',
        timestamp: new Date().toISOString()
      });
    }

    if (!record.chatId) {
      errors.push({
        type: 'EMPTY_CHAT_ID',
        context,
        templateId: record.templateId,
        templateName: record.templateName,
        message: '群ID不能为空',
        timestamp: new Date().toISOString()
      });
    }

    const variableCheck = this.checkVariables(record, context);
    errors.push(...variableCheck.errors);
    warnings.push(...variableCheck.warnings);

    const statusCheck = this.checkTouchStatus(record, context);
    errors.push(...statusCheck.errors);
    warnings.push(...statusCheck.warnings);

    const migrationCheck = this.detectGroupMigration(record, context);
    warnings.push(...migrationCheck.warnings);

    return {
      record,
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  checkVariables(record, context) {
    const errors = [];
    const warnings = [];

    if (!record.variables || Object.keys(record.variables).length === 0) {
      warnings.push({
        type: 'EMPTY_VARIABLES',
        context,
        templateId: record.templateId,
        templateName: record.templateName,
        chatId: record.chatId,
        chatName: record.chatName,
        message: '模板变量为空',
        timestamp: new Date().toISOString()
      });
      return { errors, warnings };
    }

    if (this.expectedVariables.length > 0) {
      const missingVars = this.expectedVariables.filter(v => !record.variables[v]);
      if (missingVars.length > 0) {
        errors.push({
          type: 'MISSING_EXPECTED_VARIABLES',
          context,
          templateId: record.templateId,
          templateName: record.templateName,
          chatId: record.chatId,
          chatName: record.chatName,
          missingVariables: missingVars,
          message: `缺少预期模板变量: ${missingVars.join(', ')}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    if (record.variables._raw) {
      warnings.push({
        type: 'VARIABLE_PARSE_FAILED',
        context,
        templateId: record.templateId,
        templateName: record.templateName,
        chatId: record.chatId,
        chatName: record.chatName,
        rawValue: record.variables._raw,
        message: '模板变量JSON解析失败，使用原始值',
        timestamp: new Date().toISOString()
      });
    }

    return { errors, warnings };
  }

  checkTouchStatus(record, context) {
    const errors = [];
    const warnings = [];

    if (!record.touchStatus || record.touchStatus === 'unknown') {
      warnings.push({
        type: 'UNKNOWN_TOUCH_STATUS',
        context,
        templateId: record.templateId,
        templateName: record.templateName,
        chatId: record.chatId,
        chatName: record.chatName,
        status: record.touchStatus,
        message: '触达状态未知',
        timestamp: new Date().toISOString()
      });
    } else if (!this.validTouchStatuses.includes(record.touchStatus)) {
      warnings.push({
        type: 'INVALID_TOUCH_STATUS',
        context,
        templateId: record.templateId,
        templateName: record.templateName,
        chatId: record.chatId,
        chatName: record.chatName,
        status: record.touchStatus,
        validStatuses: this.validTouchStatuses,
        message: `无效的触达状态: ${record.touchStatus}`,
        timestamp: new Date().toISOString()
      });
    }

    return { errors, warnings };
  }

  detectGroupMigration(record, context) {
    const warnings = [];

    if (record.chatName && record.chatName.includes('已迁移')) {
      warnings.push({
        type: 'GROUP_MIGRATED',
        context,
        templateId: record.templateId,
        templateName: record.templateName,
        chatId: record.chatId,
        chatName: record.chatName,
        message: '检测到群已迁移，可能影响触达结果',
        timestamp: new Date().toISOString()
      });
    }

    if (record.chatId && record.chatId.startsWith('migrated_')) {
      warnings.push({
        type: 'GROUP_MIGRATED_ID',
        context,
        templateId: record.templateId,
        templateName: record.templateName,
        chatId: record.chatId,
        chatName: record.chatName,
        message: '群ID带有迁移标记，已继续处理',
        timestamp: new Date().toISOString()
      });
    }

    return { warnings };
  }

  compareValidation(oldValidation, newValidation) {
    const differences = [];

    const oldErrors = new Set(oldValidation.errors.map(e => e.type));
    const newErrors = new Set(newValidation.errors.map(e => e.type));

    for (const type of oldErrors) {
      if (!newErrors.has(type)) {
        differences.push({
          type: 'ERROR_RESOLVED',
          errorType: type,
          message: `旧版本存在的错误"${type}"在新版本中已解决`,
          timestamp: new Date().toISOString()
        });
      }
    }

    for (const type of newErrors) {
      if (!oldErrors.has(type)) {
        differences.push({
          type: 'NEW_ERROR_INTRODUCED',
          errorType: type,
          message: `新版本引入了新错误"${type}"`,
          timestamp: new Date().toISOString()
        });
      }
    }

    return differences;
  }
}

export default Validator;
