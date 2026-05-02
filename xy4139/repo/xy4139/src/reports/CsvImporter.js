const csv = require('csv-parser');
const { Readable } = require('stream');
const Batch = require('../models/Batch');
const { ExpiryValidator } = require('../validation/ExpiryValidator');
const { StockValidator } = require('../validation/StockValidator');

class ImportError extends Error {
  constructor(message, code = 'IMPORT_ERROR', row = null) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
    this.row = row;
    this.status = 400;
  }
}

class CsvImporter {
  static requiredColumns = [
    'chemical_id',
    'batch_number',
    'expiry_date',
    'initial_quantity',
    'unit'
  ];

  static optionalColumns = [
    'production_date',
    'supplier',
    'manufacturer',
    'storage_location'
  ];

  static async parseCsvBuffer(buffer) {
    const results = [];
    const stream = Readable.from(buffer);
    
    return new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          results.push(row);
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (err) => {
          reject(new ImportError(`CSV解析失败: ${err.message}`, 'PARSE_ERROR'));
        });
    });
  }

  static validateHeader(headers) {
    const missingColumns = this.requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      throw new ImportError(
        `缺少必填列: ${missingColumns.join(', ')}`,
        'MISSING_REQUIRED_COLUMNS'
      );
    }
    
    return true;
  }

  static validateRow(row, index) {
    const errors = [];
    const rowNumber = index + 2;
    
    if (!row.chemical_id || row.chemical_id.trim() === '') {
      errors.push(`第 ${rowNumber} 行: chemical_id 不能为空`);
    }
    
    if (!row.batch_number || row.batch_number.trim() === '') {
      errors.push(`第 ${rowNumber} 行: batch_number 不能为空`);
    }
    
    if (!row.expiry_date || row.expiry_date.trim() === '') {
      errors.push(`第 ${rowNumber} 行: expiry_date 不能为空`);
    } else {
      try {
        ExpiryValidator.validateExpiryDate(row.expiry_date, row.production_date);
      } catch (e) {
        errors.push(`第 ${rowNumber} 行: ${e.message}`);
      }
    }
    
    if (!row.initial_quantity || row.initial_quantity.trim() === '') {
      errors.push(`第 ${rowNumber} 行: initial_quantity 不能为空`);
    } else {
      const quantity = parseFloat(row.initial_quantity);
      if (isNaN(quantity) || quantity <= 0) {
        errors.push(`第 ${rowNumber} 行: initial_quantity 必须是大于0的数字`);
      }
    }
    
    if (!row.unit || row.unit.trim() === '') {
      errors.push(`第 ${rowNumber} 行: unit 不能为空`);
    }
    
    return errors;
  }

  static async importBatches(csvData, user, chemicalRepository, batchRepository, auditLogRepository) {
    const rows = await this.parseCsvBuffer(csvData);
    
    if (rows.length === 0) {
      throw new ImportError('CSV文件为空', 'EMPTY_FILE');
    }
    
    const headers = Object.keys(rows[0]);
    this.validateHeader(headers);
    
    const validationErrors = [];
    for (let i = 0; i < rows.length; i++) {
      const errors = this.validateRow(rows[i], i);
      validationErrors.push(...errors);
    }
    
    if (validationErrors.length > 0) {
      throw new ImportError(
        `数据验证失败:\n${validationErrors.join('\n')}`,
        'VALIDATION_ERROR'
      );
    }
    
    const batches = [];
    const successCount = 0;
    const errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      
      try {
        const chemical = await chemicalRepository.findById(row.chemical_id);
        if (!chemical) {
          throw new Error(`试剂不存在: ${row.chemical_id}`);
        }
        
        const existingBatch = await batchRepository.findByBatchNumber(row.batch_number);
        if (existingBatch) {
          throw new Error(`批次号已存在: ${row.batch_number}`);
        }
        
        const batch = new Batch({
          chemical_id: row.chemical_id,
          batch_number: row.batch_number.trim(),
          production_date: row.production_date || null,
          expiry_date: row.expiry_date,
          initial_quantity: parseFloat(row.initial_quantity),
          current_quantity: parseFloat(row.initial_quantity),
          unit: row.unit.trim(),
          supplier: row.supplier || null,
          manufacturer: row.manufacturer || null,
          storage_location: row.storage_location || null,
          created_by: user.id,
          updated_by: user.id
        });
        
        const createdBatch = await batchRepository.create(batch);
        batches.push(createdBatch);
        
      } catch (error) {
        errorCount++;
        errors.push(`第 ${rowNumber} 行: ${error.message}`);
      }
    }
    
    const AuditLog = require('../models/AuditLog');
    await auditLogRepository.logAction({
      action: AuditLog.actions.BATCH_IMPORT,
      entity_type: AuditLog.entityTypes.BATCH,
      description: `批量导入批次: 成功 ${batches.length} 条，失败 ${errors.length} 条`,
      user_id: user.id,
      user_role: user.role
    });
    
    return {
      success: batches.length > 0,
      total: rows.length,
      success_count: batches.length,
      error_count: errors.length,
      errors: errors,
      batches: batches.map(b => b.toJSON())
    };
  }

  static getImportTemplate() {
    const headers = [...this.requiredColumns, ...this.optionalColumns];
    
    return {
      columns: headers,
      required_columns: this.requiredColumns,
      optional_columns: this.optionalColumns,
      example: {
        chemical_id: 'chem-001',
        batch_number: 'BATCH-2024-001',
        expiry_date: '2025-12-31',
        initial_quantity: '100',
        unit: 'mL',
        production_date: '2024-01-01',
        supplier: '某试剂公司',
        manufacturer: '某制造商',
        storage_location: 'A区-1号柜'
      }
    };
  }
}

module.exports = { CsvImporter, ImportError };
