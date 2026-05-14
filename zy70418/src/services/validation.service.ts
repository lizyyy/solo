import crypto from 'crypto';
import { getDb, runQuery, getQuery, allQuery } from '../database/db';
import { RiskLevel, ValidationStatus, FileRecord, ValidationResult, FailedItem, ValidationBatch } from '../types';

const generateId = (): string => {
  return crypto.randomUUID();
};

export interface FileMetadata {
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  supplierCode: string;
  supplierName: string;
  department: string;
  uploader: string;
}

export class ValidationService {
  static async createBatch(batchName: string, department: string, createdBy: string): Promise<string> {
    const batchId = generateId();
    const db = getDb();
    
    await runQuery(db, `
      INSERT INTO validation_batches (id, batch_name, department, created_at, created_by, status)
      VALUES (?, ?, ?, ?, ?, 'processing')
    `, [batchId, batchName, department, new Date().toISOString(), createdBy]);
    
    db.close();
    return batchId;
  }

  static async addFileRecord(batchId: string, metadata: FileMetadata): Promise<string> {
    const fileId = generateId();
    const db = getDb();
    
    await runQuery(db, `
      INSERT INTO file_records (id, batch_id, file_name, file_path, file_size, file_type, 
                                supplier_code, supplier_name, department, upload_time, uploader,
                                original_supplier_code, original_supplier_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      fileId, batchId, metadata.fileName, metadata.filePath, metadata.fileSize, metadata.fileType,
      metadata.supplierCode, metadata.supplierName, metadata.department, 
      new Date().toISOString(), metadata.uploader,
      metadata.supplierCode, metadata.supplierName
    ]);
    
    db.close();
    return fileId;
  }

  static async validateEmptyValues(fileRecordId: string, batchId: string): Promise<ValidationResult> {
    const db = getDb();
    const fileRecord = await getQuery(db, 'SELECT * FROM file_records WHERE id = ?', [fileRecordId]);
    
    const emptyFields: string[] = [];
    const checkFields = ['supplier_code', 'supplier_name', 'department', 'file_name'];
    
    for (const field of checkFields) {
      const value = fileRecord[field];
      if (value === null || value === undefined || value === '' || value === 'null') {
        emptyFields.push(field);
      }
    }
    
    const resultId = generateId();
    const status = emptyFields.length === 0 ? ValidationStatus.SUCCESS : ValidationStatus.FAILED;
    const riskLevel = emptyFields.length > 2 ? RiskLevel.HIGH : emptyFields.length > 0 ? RiskLevel.MEDIUM : RiskLevel.LOW;
    
    const errorMessage = emptyFields.length > 0 
      ? `检测到空值字段: ${emptyFields.join(', ')}。空值被错误地当作有效数据处理。`
      : undefined;
    
    await runQuery(db, `
      INSERT INTO validation_results (id, file_record_id, batch_id, check_type, field_name, status, 
                                      risk_level, error_message, checked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      resultId, fileRecordId, batchId, 'empty_value_check', emptyFields.join(','), 
      status, riskLevel, errorMessage, new Date().toISOString()
    ]);
    
    if (status === ValidationStatus.FAILED) {
      await this.saveFailedItem(batchId, fileRecordId, resultId, 'empty_value_check', 
        emptyFields.join(','), errorMessage!, riskLevel, fileRecord);
    }
    
    db.close();
    
    return {
      id: resultId,
      fileRecordId,
      batchId,
      checkType: 'empty_value_check',
      fieldName: emptyFields.join(','),
      status,
      riskLevel,
      errorMessage,
      checkedAt: new Date()
    };
  }

  static async validateSupplierDirectory(fileRecordId: string, batchId: string): Promise<ValidationResult> {
    const db = getDb();
    const fileRecord = await getQuery(db, 'SELECT * FROM file_records WHERE id = ?', [fileRecordId]);
    const supplier = await getQuery(db, 'SELECT * FROM supplier_directory WHERE supplier_code = ?', 
      [fileRecord.supplier_code]);
    
    const resultId = generateId();
    let status = ValidationStatus.SUCCESS;
    let riskLevel = RiskLevel.LOW;
    let errorMessage: string | undefined;
    let expectedValue: string | undefined;
    let actualValue: string | undefined;
    
    if (!fileRecord.supplier_code || fileRecord.supplier_code === '') {
      status = ValidationStatus.FAILED;
      riskLevel = RiskLevel.HIGH;
      errorMessage = '供应商代码为空，无法在目录中匹配。空值被错误地当作有效供应商处理。';
      actualValue = '(空值)';
    } else if (!supplier) {
      status = ValidationStatus.FAILED;
      riskLevel = RiskLevel.MEDIUM;
      errorMessage = `供应商代码 ${fileRecord.supplier_code} 不在供应商目录中`;
      actualValue = fileRecord.supplier_code;
    } else if (!supplier.is_active) {
      status = ValidationStatus.FAILED;
      riskLevel = RiskLevel.MEDIUM;
      errorMessage = `供应商 ${supplier.supplier_name} 已被标记为不活跃`;
      actualValue = 'inactive';
      expectedValue = 'active';
    } else if (supplier.supplier_name !== fileRecord.supplier_name && fileRecord.supplier_name) {
      status = ValidationStatus.FAILED;
      riskLevel = RiskLevel.LOW;
      errorMessage = `供应商名称不匹配: 目录中为 "${supplier.supplier_name}", 文件中为 "${fileRecord.supplier_name}"`;
      expectedValue = supplier.supplier_name;
      actualValue = fileRecord.supplier_name;
    }
    
    await runQuery(db, `
      INSERT INTO validation_results (id, file_record_id, batch_id, check_type, field_name, status, 
                                      risk_level, error_message, expected_value, actual_value, checked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      resultId, fileRecordId, batchId, 'supplier_directory_check', 'supplier_code,supplier_name', 
      status, riskLevel, errorMessage, expectedValue, actualValue, new Date().toISOString()
    ]);
    
    if (status === ValidationStatus.FAILED) {
      await this.saveFailedItem(batchId, fileRecordId, resultId, 'supplier_directory_check',
        'supplier_code,supplier_name', errorMessage!, riskLevel, fileRecord);
    }
    
    db.close();
    
    return {
      id: resultId,
      fileRecordId,
      batchId,
      checkType: 'supplier_directory_check',
      fieldName: 'supplier_code,supplier_name',
      status,
      riskLevel,
      errorMessage,
      expectedValue,
      actualValue,
      checkedAt: new Date()
    };
  }

  static async validateFileIntegrity(fileRecordId: string, batchId: string): Promise<ValidationResult> {
    const db = getDb();
    const fileRecord = await getQuery(db, 'SELECT * FROM file_records WHERE id = ?', [fileRecordId]);
    
    const resultId = generateId();
    let status = ValidationStatus.SUCCESS;
    let riskLevel = RiskLevel.LOW;
    let errorMessage: string | undefined;
    
    const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];
    const fileExtension = fileRecord.file_name.toLowerCase().substring(fileRecord.file_name.lastIndexOf('.'));
    
    if (!allowedImageTypes.includes(fileExtension)) {
      status = ValidationStatus.FAILED;
      riskLevel = RiskLevel.MEDIUM;
      errorMessage = `不支持的文件格式: ${fileExtension}。仅支持图片格式文件入库。`;
    }
    
    if (fileRecord.file_size === 0) {
      status = ValidationStatus.FAILED;
      riskLevel = RiskLevel.HIGH;
      errorMessage = '文件大小为0，可能是空文件或损坏文件。空文件被错误地当作有效文件处理。';
    }
    
    await runQuery(db, `
      INSERT INTO validation_results (id, file_record_id, batch_id, check_type, field_name, status, 
                                      risk_level, error_message, checked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      resultId, fileRecordId, batchId, 'file_integrity_check', 'file_type,file_size', 
      status, riskLevel, errorMessage, new Date().toISOString()
    ]);
    
    if (status === ValidationStatus.FAILED) {
      await this.saveFailedItem(batchId, fileRecordId, resultId, 'file_integrity_check',
        'file_type,file_size', errorMessage!, riskLevel, fileRecord);
    }
    
    db.close();
    
    return {
      id: resultId,
      fileRecordId,
      batchId,
      checkType: 'file_integrity_check',
      fieldName: 'file_type,file_size',
      status,
      riskLevel,
      errorMessage,
      checkedAt: new Date()
    };
  }

  private static async saveFailedItem(
    batchId: string, 
    fileRecordId: string, 
    validationResultId: string, 
    checkType: string,
    fieldName: string | undefined,
    errorMessage: string,
    riskLevel: RiskLevel,
    fileRecord: any
  ): Promise<void> {
    const db = getDb();
    const failedItemId = generateId();
    
    await runQuery(db, `
      INSERT INTO failed_items (id, batch_id, file_record_id, validation_result_id, check_type, field_name,
                                error_message, risk_level, file_name, supplier_code, supplier_name, 
                                department, created_at, resolved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      failedItemId, batchId, fileRecordId, validationResultId, checkType, fieldName,
      errorMessage, riskLevel, fileRecord.file_name, fileRecord.supplier_code, 
      fileRecord.supplier_name, fileRecord.department, new Date().toISOString()
    ]);
    
    db.close();
  }

  static async validateFile(fileRecordId: string, batchId: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    results.push(await this.validateEmptyValues(fileRecordId, batchId));
    results.push(await this.validateSupplierDirectory(fileRecordId, batchId));
    results.push(await this.validateFileIntegrity(fileRecordId, batchId));
    
    await this.updateBatchCounts(batchId);
    
    return results;
  }

  static async updateBatchCounts(batchId: string): Promise<void> {
    const db = getDb();
    
    const successCount = await getQuery(db, `
      SELECT COUNT(*) as count FROM validation_results 
      WHERE batch_id = ? AND status = ?
    `, [batchId, ValidationStatus.SUCCESS]);
    
    const failedCount = await getQuery(db, `
      SELECT COUNT(*) as count FROM validation_results 
      WHERE batch_id = ? AND status = ?
    `, [batchId, ValidationStatus.FAILED]);
    
    const manuallyCorrectedCount = await getQuery(db, `
      SELECT COUNT(*) as count FROM validation_results 
      WHERE batch_id = ? AND status = ?
    `, [batchId, ValidationStatus.MANUALLY_CORRECTED]);
    
    await runQuery(db, `
      UPDATE validation_batches 
      SET success_count = ?, failed_count = ?, manually_corrected_count = ?, status = 'completed'
      WHERE id = ?
    `, [successCount.count, failedCount.count, manuallyCorrectedCount.count, batchId]);
    
    db.close();
  }

  static async getBatch(batchId: string): Promise<ValidationBatch | null> {
    const db = getDb();
    const batch = await getQuery(db, 'SELECT * FROM validation_batches WHERE id = ?', [batchId]);
    db.close();
    
    if (!batch) return null;
    
    return {
      id: batch.id,
      batchName: batch.batch_name,
      department: batch.department,
      totalFiles: batch.total_files,
      successCount: batch.success_count,
      failedCount: batch.failed_count,
      manuallyCorrectedCount: batch.manually_corrected_count,
      createdAt: new Date(batch.created_at),
      createdBy: batch.created_by,
      status: batch.status
    };
  }

  static async getAllBatches(): Promise<ValidationBatch[]> {
    const db = getDb();
    const batches = await allQuery(db, 'SELECT * FROM validation_batches ORDER BY created_at DESC');
    db.close();
    
    return batches.map(batch => ({
      id: batch.id,
      batchName: batch.batch_name,
      department: batch.department,
      totalFiles: batch.total_files,
      successCount: batch.success_count,
      failedCount: batch.failed_count,
      manuallyCorrectedCount: batch.manually_corrected_count,
      createdAt: new Date(batch.created_at),
      createdBy: batch.created_by,
      status: batch.status
    }));
  }
}
