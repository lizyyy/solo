import crypto from 'crypto';
import { getDb, runQuery, getQuery, allQuery } from '../database/db';
import { RiskLevel, ValidationStatus, FailedItem, CorrectionRecord, RollbackCandidate, OutputFormat } from '../types';

const generateId = (): string => {
  return crypto.randomUUID();
};

export class OutputService {
  static async getFailedItems(batchId?: string, riskLevel?: RiskLevel, resolved?: boolean): Promise<FailedItem[]> {
    const db = getDb();
    let sql = 'SELECT * FROM failed_items WHERE 1=1';
    const params: any[] = [];
    
    if (batchId) {
      sql += ' AND batch_id = ?';
      params.push(batchId);
    }
    
    if (riskLevel) {
      sql += ' AND risk_level = ?';
      params.push(riskLevel);
    }
    
    if (resolved !== undefined) {
      sql += ' AND resolved = ?';
      params.push(resolved ? 1 : 0);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const items = await allQuery(db, sql, params);
    db.close();
    
    return items.map(item => ({
      id: item.id,
      batchId: item.batch_id,
      fileRecordId: item.file_record_id,
      validationResultId: item.validation_result_id,
      checkType: item.check_type,
      fieldName: item.field_name,
      errorMessage: item.error_message,
      riskLevel: item.risk_level,
      fileName: item.file_name,
      supplierCode: item.supplier_code,
      supplierName: item.supplier_name,
      department: item.department,
      createdAt: new Date(item.created_at),
      resolved: !!item.resolved,
      resolvedAt: item.resolved_at ? new Date(item.resolved_at) : undefined,
      resolver: item.resolver
    }));
  }

  static async markFailedItemResolved(failedItemId: string, resolver: string): Promise<void> {
    const db = getDb();
    await runQuery(db, `
      UPDATE failed_items 
      SET resolved = 1, resolved_at = ?, resolver = ?
      WHERE id = ?
    `, [new Date().toISOString(), resolver, failedItemId]);
    db.close();
  }

  static async correctField(
    fileRecordId: string,
    batchId: string,
    fieldName: string,
    oldValue: string,
    newValue: string,
    correctedBy: string,
    correctionReason: string,
    riskLevel: RiskLevel
  ): Promise<CorrectionRecord> {
    const db = getDb();
    const correctionId = generateId();
    
    const previousResult = await getQuery(db, `
      SELECT status FROM validation_results 
      WHERE file_record_id = ? AND field_name LIKE ?
      LIMIT 1
    `, [fileRecordId, `%${fieldName}%`]);
    
    const previousStatus = previousResult?.status || ValidationStatus.FAILED;
    const newStatus = ValidationStatus.MANUALLY_CORRECTED;
    
    await runQuery(db, `
      UPDATE file_records 
      SET ${fieldName} = ?
      WHERE id = ?
    `, [newValue, fileRecordId]);
    
    await runQuery(db, `
      INSERT INTO correction_records (id, file_record_id, batch_id, field_name, old_value, new_value,
                                      corrected_by, correction_reason, correction_time, risk_level,
                                      previous_status, new_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      correctionId, fileRecordId, batchId, fieldName, oldValue, newValue,
      correctedBy, correctionReason, new Date().toISOString(), riskLevel,
      previousStatus, newStatus
    ]);
    
    await runQuery(db, `
      UPDATE validation_results 
      SET status = ?
      WHERE file_record_id = ? AND field_name LIKE ?
    `, [newStatus, fileRecordId, `%${fieldName}%`]);
    
    db.close();
    
    return {
      id: correctionId,
      fileRecordId,
      batchId,
      fieldName,
      oldValue,
      newValue,
      correctedBy,
      correctionReason,
      correctionTime: new Date(),
      riskLevel,
      previousStatus,
      newStatus
    };
  }

  static async getCorrectionRecords(batchId?: string, fileRecordId?: string): Promise<CorrectionRecord[]> {
    const db = getDb();
    let sql = 'SELECT * FROM correction_records WHERE 1=1';
    const params: any[] = [];
    
    if (batchId) {
      sql += ' AND batch_id = ?';
      params.push(batchId);
    }
    
    if (fileRecordId) {
      sql += ' AND file_record_id = ?';
      params.push(fileRecordId);
    }
    
    sql += ' ORDER BY correction_time DESC';
    
    const records = await allQuery(db, sql, params);
    db.close();
    
    return records.map(record => ({
      id: record.id,
      fileRecordId: record.file_record_id,
      batchId: record.batch_id,
      fieldName: record.field_name,
      oldValue: record.old_value,
      newValue: record.new_value,
      correctedBy: record.corrected_by,
      correctionReason: record.correction_reason,
      correctionTime: new Date(record.correction_time),
      riskLevel: record.risk_level,
      previousStatus: record.previous_status,
      newStatus: record.new_status
    }));
  }

  static async generateRollbackCandidates(batchId: string, reason: string, approver: string): Promise<RollbackCandidate[]> {
    const db = getDb();
    const candidates: RollbackCandidate[] = [];
    
    const failedRecords = await allQuery(db, `
      SELECT DISTINCT fr.id, fr.file_name, fr.supplier_code, vr.risk_level
      FROM file_records fr
      JOIN validation_results vr ON fr.id = vr.file_record_id
      WHERE fr.batch_id = ? AND vr.status = ?
    `, [batchId, ValidationStatus.FAILED]);
    
    for (const record of failedRecords) {
      const candidateId = generateId();
      
      await runQuery(db, `
        INSERT INTO rollback_candidates (id, batch_id, file_record_id, file_name, supplier_code,
                                          reason, risk_level, created_at, approved, approved_by, approved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `, [
        candidateId, batchId, record.id, record.file_name, record.supplier_code,
        reason, record.risk_level, new Date().toISOString(), 
        approver, new Date().toISOString()
      ]);
      
      candidates.push({
        id: candidateId,
        batchId,
        fileRecordId: record.id,
        fileName: record.file_name,
        supplierCode: record.supplier_code,
        reason,
        riskLevel: record.risk_level,
        createdAt: new Date(),
        approved: true,
        approvedBy: approver,
        approvedAt: new Date()
      });
    }
    
    db.close();
    return candidates;
  }

  static async getRollbackCandidates(batchId?: string, approved?: boolean): Promise<RollbackCandidate[]> {
    const db = getDb();
    let sql = 'SELECT * FROM rollback_candidates WHERE 1=1';
    const params: any[] = [];
    
    if (batchId) {
      sql += ' AND batch_id = ?';
      params.push(batchId);
    }
    
    if (approved !== undefined) {
      sql += ' AND approved = ?';
      params.push(approved ? 1 : 0);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const candidates = await allQuery(db, sql, params);
    db.close();
    
    return candidates.map(candidate => ({
      id: candidate.id,
      batchId: candidate.batch_id,
      fileRecordId: candidate.file_record_id,
      fileName: candidate.file_name,
      supplierCode: candidate.supplier_code,
      reason: candidate.reason,
      riskLevel: candidate.risk_level,
      createdAt: new Date(candidate.created_at),
      approved: !!candidate.approved,
      approvedBy: candidate.approved_by,
      approvedAt: candidate.approved_at ? new Date(candidate.approved_at) : undefined
    }));
  }

  static async exportBatchResults(batchId: string, format: OutputFormat): Promise<string | Buffer> {
    const db = getDb();
    
    const batch = await getQuery(db, 'SELECT * FROM validation_batches WHERE id = ?', [batchId]);
    const fileRecords = await allQuery(db, 'SELECT * FROM file_records WHERE batch_id = ?', [batchId]);
    const validationResults = await allQuery(db, 'SELECT * FROM validation_results WHERE batch_id = ?', [batchId]);
    const failedItems = await allQuery(db, 'SELECT * FROM failed_items WHERE batch_id = ?', [batchId]);
    const correctionRecords = await allQuery(db, 'SELECT * FROM correction_records WHERE batch_id = ?', [batchId]);
    
    db.close();
    
    const result = {
      batch: {
        id: batch.id,
        name: batch.batch_name,
        department: batch.department,
        createdAt: batch.created_at,
        createdBy: batch.created_by,
        status: batch.status,
        summary: {
          totalFiles: batch.total_files,
          successCount: batch.success_count,
          failedCount: batch.failed_count,
          manuallyCorrectedCount: batch.manually_corrected_count
        }
      },
      files: fileRecords.map(fr => ({
        id: fr.id,
        fileName: fr.file_name,
        filePath: fr.file_path,
        supplier: {
          code: fr.supplier_code,
          name: fr.supplier_name,
          originalCode: fr.original_supplier_code,
          originalName: fr.original_supplier_name,
          codeChanged: fr.supplier_code !== fr.original_supplier_code,
          nameChanged: fr.supplier_name !== fr.original_supplier_name
        },
        department: fr.department,
        uploadTime: fr.upload_time,
        uploader: fr.uploader
      })),
      validationResults: validationResults.map(vr => ({
        id: vr.id,
        fileRecordId: vr.file_record_id,
        checkType: vr.check_type,
        fieldName: vr.field_name,
        status: vr.status,
        riskLevel: vr.risk_level,
        errorMessage: vr.error_message,
        expectedValue: vr.expected_value,
        actualValue: vr.actual_value,
        checkedAt: vr.checked_at
      })),
      failedItems: failedItems.map(fi => ({
        id: fi.id,
        fileName: fi.file_name,
        supplierCode: fi.supplier_code,
        supplierName: fi.supplier_name,
        department: fi.department,
        checkType: fi.check_type,
        fieldName: fi.field_name,
        errorMessage: fi.error_message,
        riskLevel: fi.risk_level,
        createdAt: fi.created_at,
        resolved: !!fi.resolved
      })),
      correctionRecords: correctionRecords.map(cr => ({
        id: cr.id,
        fieldName: cr.field_name,
        oldValue: cr.old_value,
        newValue: cr.new_value,
        correctedBy: cr.corrected_by,
        correctionReason: cr.correction_reason,
        correctionTime: cr.correction_time,
        riskLevel: cr.risk_level
      }))
    };
    
    if (format === 'json') {
      return JSON.stringify(result, null, 2);
    }
    
    if (format === 'markdown') {
      return this.generateMarkdownReport(result);
    }
    
    return Buffer.from(JSON.stringify(result, null, 2), 'utf-8');
  }

  private static generateMarkdownReport(data: any): string {
    let md = `# 文件入库校验报告 - ${data.batch.name}\n\n`;
    md += `## 批次信息\n\n`;
    md += `- **批次ID**: ${data.batch.id}\n`;
    md += `- **部门**: ${data.batch.department}\n`;
    md += `- **创建时间**: ${data.batch.createdAt}\n`;
    md += `- **创建人**: ${data.batch.createdBy}\n`;
    md += `- **状态**: ${data.batch.status}\n\n`;
    
    md += `## 校验摘要\n\n`;
    md += `| 指标 | 数量 |\n`;
    md += `|------|------|\n`;
    md += `| 总文件数 | ${data.batch.summary.totalFiles} |\n`;
    md += `| 校验通过 | ${data.batch.summary.successCount} |\n`;
    md += `| 校验失败 | ${data.batch.summary.failedCount} |\n`;
    md += `| 人工修正 | ${data.batch.summary.manuallyCorrectedCount} |\n\n`;
    
    if (data.failedItems.length > 0) {
      md += `## 失败项详情\n\n`;
      md += `| 文件名 | 供应商 | 部门 | 校验类型 | 错误信息 | 风险等级 |\n`;
      md += `|--------|--------|------|----------|----------|----------|\n`;
      
      for (const item of data.failedItems) {
        md += `| ${item.fileName} | ${item.supplierName || 'N/A'} | ${item.department || 'N/A'} | ${item.checkType} | ${item.errorMessage} | ${item.riskLevel} |\n`;
      }
      md += '\n';
    }
    
    if (data.correctionRecords.length > 0) {
      md += `## 人工修正记录\n\n`;
      md += `| 字段名 | 原值 | 新值 | 修正人 | 修正原因 | 修正时间 | 风险等级 |\n`;
      md += `|--------|------|------|--------|----------|----------|----------|\n`;
      
      for (const record of data.correctionRecords) {
        md += `| ${record.fieldName} | ${record.oldValue} | ${record.newValue} | ${record.correctedBy} | ${record.correctionReason} | ${record.correctionTime} | ${record.riskLevel} |\n`;
      }
      md += '\n';
    }
    
    md += `## 供应商目录修正前后对比\n\n`;
    md += `| 文件名 | 修正前代码 | 修正后代码 | 修正前名称 | 修正后名称 | 是否变更 |\n`;
    md += `|--------|------------|------------|------------|------------|----------|\n`;
    
    for (const file of data.files) {
      const changed = file.supplier.codeChanged || file.supplier.nameChanged ? '是' : '否';
      md += `| ${file.fileName} | ${file.supplier.originalCode || '(空)'} | ${file.supplier.code || '(空)'} | ${file.supplier.originalName || '(空)'} | ${file.supplier.name || '(空)'} | ${changed} |\n`;
    }
    
    return md;
  }

  static async queryByRiskLevel(batchId: string, riskLevel: RiskLevel): Promise<any> {
    const db = getDb();
    
    const failedItems = await allQuery(db, `
      SELECT * FROM failed_items 
      WHERE batch_id = ? AND risk_level = ?
      ORDER BY created_at DESC
    `, [batchId, riskLevel]);
    
    const correctionRecords = await allQuery(db, `
      SELECT * FROM correction_records 
      WHERE batch_id = ? AND risk_level = ?
      ORDER BY correction_time DESC
    `, [batchId, riskLevel]);
    
    const validationResults = await allQuery(db, `
      SELECT * FROM validation_results 
      WHERE batch_id = ? AND risk_level = ?
      ORDER BY checked_at DESC
    `, [batchId, riskLevel]);
    
    db.close();
    
    return {
      riskLevel,
      failedItems: failedItems.map(fi => ({
        id: fi.id,
        fileName: fi.file_name,
        supplierCode: fi.supplier_code,
        supplierName: fi.supplier_name,
        department: fi.department,
        checkType: fi.check_type,
        errorMessage: fi.error_message,
        createdAt: fi.created_at
      })),
      correctionRecords: correctionRecords.map(cr => ({
        id: cr.id,
        fileName: cr.file_name,
        fieldName: cr.field_name,
        oldValue: cr.old_value,
        newValue: cr.new_value,
        correctedBy: cr.corrected_by,
        correctionReason: cr.correction_reason,
        correctionTime: cr.correction_time
      })),
      validationResults: validationResults.map(vr => ({
        id: vr.id,
        checkType: vr.check_type,
        status: vr.status,
        errorMessage: vr.error_message
      })),
      summary: {
        failedCount: failedItems.length,
        correctedCount: correctionRecords.length,
        totalCount: validationResults.length
      }
    };
  }
}
