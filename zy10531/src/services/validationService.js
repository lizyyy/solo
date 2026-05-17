const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

class ValidationService {
  async getActiveRules() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM validation_rules WHERE active = 1`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  validateField(value, rule) {
    if (rule.required && (!value || value.toString().trim() === '')) {
      return { valid: false, error: 'missing', message: rule.error_message };
    }

    if (!value) return { valid: true };

    switch (rule.validation_type) {
      case 'not_empty':
        return value.trim() !== '' 
          ? { valid: true }
          : { valid: false, error: 'empty', message: rule.error_message };

      case 'pattern':
        try {
          const regex = new RegExp(rule.validation_pattern);
          return regex.test(value)
            ? { valid: true }
            : { valid: false, error: 'pattern', message: rule.error_message };
        } catch (e) {
          return { valid: true };
        }

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value)
          ? { valid: true }
          : { valid: false, error: 'email', message: rule.error_message };

      case 'date':
        const date = new Date(value);
        return !isNaN(date.getTime())
          ? { valid: true }
          : { valid: false, error: 'date', message: rule.error_message };

      default:
        return { valid: true };
    }
  }

  async checkIdempotency(vendorCode, inputHash) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM validation_records WHERE vendor_code = ? AND raw_input = ? ORDER BY created_at DESC LIMIT 1`,
        [vendorCode, inputHash],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async createValidationRecord(vendorCode, rawInput) {
    const validationId = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO validation_records (vendor_code, validation_id, raw_input, status) VALUES (?, ?, ?, 'pending')`,
        [vendorCode, validationId, rawInput],
        function(err) {
          if (err) reject(err);
          else resolve(validationId);
        }
      );
    });
  }

  async saveMissingItems(validationId, vendorCode, errors) {
    const stmt = db.prepare(`
      INSERT INTO missing_items (validation_id, vendor_code, field_name, field_label, error_type, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const error of errors) {
      stmt.run(validationId, vendorCode, error.fieldName, error.fieldLabel, error.errorType, error.message);
    }

    return new Promise((resolve, reject) => {
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async updateValidationStatus(validationId, status, result) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE validation_records SET status = ?, validation_result = ? WHERE validation_id = ?`,
        [status, JSON.stringify(result), validationId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async validateVendor(vendorData) {
    const { vendor_code, ...fields } = vendorData;
    const rawInput = JSON.stringify(vendorData);
    const inputHash = rawInput;

    const existingValidation = await this.checkIdempotency(vendor_code, inputHash);
    if (existingValidation) {
      return {
        idempotent: true,
        existingValidationId: existingValidation.validation_id,
        status: existingValidation.status,
        message: '重复提交，返回已有校验结果'
      };
    }

    const rules = await this.getActiveRules();
    const validationId = await this.createValidationRecord(vendor_code, rawInput);
    const errors = [];

    for (const rule of rules) {
      const value = fields[rule.field_name];
      const result = this.validateField(value, rule);

      if (!result.valid) {
        errors.push({
          fieldName: rule.field_name,
          fieldLabel: rule.field_label,
          errorType: result.error,
          message: result.message
        });
      }
    }

    if (errors.length > 0) {
      await this.saveMissingItems(validationId, vendor_code, errors);
      await this.updateValidationStatus(validationId, 'failed', { errors, missingCount: errors.length });

      return {
        idempotent: false,
        validationId,
        status: 'failed',
        errors,
        missingCount: errors.length,
        message: `发现 ${errors.length} 个缺失或错误字段，已拦截`
      };
    }

    await this.updateValidationStatus(validationId, 'passed', { message: '所有字段校验通过' });

    return {
      idempotent: false,
      validationId,
      status: 'passed',
      message: '所有字段校验通过'
    };
  }

  async getMissingItems(validationId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM missing_items WHERE validation_id = ? ORDER BY created_at DESC`,
        [validationId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async resolveMissingItem(missingItemId, resolved = true) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE missing_items SET resolved = ? WHERE id = ?`,
        [resolved ? 1 : 0, missingItemId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }
}

module.exports = new ValidationService();
