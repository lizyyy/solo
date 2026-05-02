import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { v4 as uuidv4 } from 'uuid';

export class ImportExportService {
  constructor(db) {
    this.db = db;
  }

  async importCSV(content, entityType, options = {}) {
    const results = {
      success: 0,
      failed: 0,
      errors: [],
      records: []
    };

    return new Promise((resolve, reject) => {
      parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        ...options
      }, (err, records) => {
        if (err) {
          reject(err);
          return;
        }

        const transaction = this.db.transaction(() => {
          for (const record of records) {
          try {
            const imported = this.importRecord(entityType, record);
            results.records.push(imported);
            results.success++;
          } catch (e) {
            results.failed++;
            results.errors.push({
              record,
              error: e.message
            });
          }
        }
        });

        try {
          transaction();
          resolve(results);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  importJSON(content, entityType) {
    const data = JSON.parse(content);
    const records = Array.isArray(data) ? data : [data];
    
    const results = {
      success: 0,
      failed: 0,
      errors: [],
      records: []
    };

    const transaction = this.db.transaction(() => {
      for (const record of records) {
        try {
          const imported = this.importRecord(entityType, record);
          results.records.push(imported);
          results.success++;
        } catch (e) {
          results.failed++;
          results.errors.push({
            record,
            error: e.message
          });
        }
      }
    });

    transaction();
    return results;
  }

  importRecord(entityType, record) {
    switch (entityType) {
      case 'cases':
        return this.importCase(record);
      case 'teeth':
        return this.importTooth(record);
      case 'prescriptions':
        return this.importPrescription(record);
      case 'scan_files':
        return this.importScanFile(record);
      case 'process_steps':
        return this.importProcessStep(record);
      case 'rework_requests':
        return this.importReworkRequest(record);
      case 'try_in_feedbacks':
        return this.importTryInFeedback(record);
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  importCase(record) {
    const id = record.id || uuidv4();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cases (
        id, case_number, patient_name, doctor_name, clinic_name,
        status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      record.caseNumber || record.case_number,
      record.patientName || record.patient_name,
      record.doctorName || record.doctor_name,
      record.clinicName || record.clinic_name,
      record.status || 'PRESCRIPTION_RECEIVED',
      record.notes
    );

    return { id, ...record };
  }

  importTooth(record) {
    const id = record.id || uuidv4();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO teeth (
        id, case_id, tooth_number, tooth_type, is_rework,
        rework_count, version, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      record.caseId || record.case_id,
      record.toothNumber || record.tooth_number,
      record.toothType || record.tooth_type,
      record.isRework || record.is_rework || false,
      record.reworkCount || record.rework_count || 0,
      record.version || 1,
      record.status || 'PENDING'
    );

    return { id, ...record };
  }

  importPrescription(record) {
    const id = record.id || uuidv4();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO prescriptions (
        id, case_id, prescription_number, received_at, doctor_name,
        tooth_numbers, restoration_type, material, shade, due_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      record.caseId || record.case_id,
      record.prescriptionNumber || record.prescription_number,
      record.receivedAt || record.received_at || new Date().toISOString(),
      record.doctorName || record.doctor_name,
      record.toothNumbers || record.tooth_numbers,
      record.restorationType || record.restoration_type,
      record.material,
      record.shade,
      record.dueDate || record.due_date,
      record.notes
    );

    return { id, ...record };
  }

  importScanFile(record) {
    const id = record.id || uuidv4();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO scan_files (
        id, case_id, file_name, file_type, scan_type,
        scan_date, version, is_valid, validation_errors, received_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      record.caseId || record.case_id,
      record.fileName || record.file_name,
      record.fileType || record.file_type,
      record.scanType || record.scan_type,
      record.scanDate || record.scan_date,
      record.version || 1,
      record.isValid !== false,
      record.validationErrors || record.validation_errors,
      record.receivedAt || record.received_at || new Date().toISOString()
    );

    return { id, ...record };
  }

  importProcessStep(record) {
    const id = record.id || uuidv4();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO process_steps (
        id, case_id, tooth_id, step_name, step_order,
        status, started_at, completed_at, assigned_to, notes, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      record.caseId || record.case_id,
      record.toothId || record.tooth_id,
      record.stepName || record.step_name,
      record.stepOrder || record.step_order || 0,
      record.status || 'PENDING',
      record.startedAt || record.started_at,
      record.completedAt || record.completed_at,
      record.assignedTo || record.assigned_to,
      record.notes,
      record.version || 1
    );

    return { id, ...record };
  }

  importReworkRequest(record) {
    const id = record.id || uuidv4();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO rework_requests (
        id, case_id, tooth_id, request_date, reason_code,
        reason_description, rework_type, requested_by, source_step,
        target_step, status, reviewed_by, reviewed_at, review_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      record.caseId || record.case_id,
      record.toothId || record.tooth_id,
      record.requestDate || record.request_date || new Date().toISOString(),
      record.reasonCode || record.reason_code,
      record.reasonDescription || record.reason_description,
      record.reworkType || record.rework_type,
      record.requestedBy || record.requested_by,
      record.sourceStep || record.source_step,
      record.targetStep || record.target_step,
      record.status || 'PENDING',
      record.reviewedBy || record.reviewed_by,
      record.reviewedAt || record.reviewed_at,
      record.reviewNotes || record.review_notes
    );

    return { id, ...record };
  }

  importTryInFeedback(record) {
    const id = record.id || uuidv4();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO try_in_feedbacks (
        id, case_id, tooth_id, feedback_date, doctor_name,
        fit_status, occlusion_status, esthetics_status, notes,
        needs_rework, rework_reason, is_followed_up, followed_up_by,
        followed_up_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      record.caseId || record.case_id,
      record.toothId || record.tooth_id,
      record.feedbackDate || record.feedback_date || new Date().toISOString(),
      record.doctorName || record.doctor_name,
      record.fitStatus || record.fit_status,
      record.occlusionStatus || record.occlusion_status,
      record.estheticsStatus || record.esthetics_status,
      record.notes,
      record.needsRework || record.needs_rework || false,
      record.reworkReason || record.rework_reason,
      record.isFollowedUp || record.is_followed_up || false,
      record.followedUpBy || record.followed_up_by,
      record.followedUpAt || record.followed_up_at
    );

    return { id, ...record };
  }

  async exportCSV(entityType, filters = {}) {
    const records = this.getRecords(entityType, filters);
    
    return new Promise((resolve, reject) => {
      stringify(records, {
        header: true,
        columns: this.getColumnsForEntity(entityType)
      }, (err, output) => {
        if (err) reject(err);
        else resolve(output);
      });
    });
  }

  exportJSON(entityType, filters = {}) {
    const records = this.getRecords(entityType, filters);
    return JSON.stringify(records, null, 2);
  }

  exportMarkdown(entityType, filters = {}) {
    const records = this.getRecords(entityType, filters);
    if (records.length === 0) {
      return `# ${this.getEntityDisplayName(entityType)}\n\n无数据\n`;
    }

    const columns = this.getColumnsForEntity(entityType);
    const headers = columns.map(c => c.header || c.key);
    
    let md = `# ${this.getEntityDisplayName(entityType)}\n\n`;
    md += `共 ${records.length} 条记录\n\n`;
    md += `| ${headers.join(' | ')} |\n`;
    md += `| ${headers.map(() => '---').join(' | ')} |\n`;

    for (const record of records) {
      const row = columns.map(col => {
        let value = record[col.key] || '';
        if (typeof value === 'boolean') value = value ? '是' : '否';
        if (value instanceof Date) value = value.toISOString();
        return String(value).replace(/\|/g, '\\|');
      });
      md += `| ${row.join(' | ')} |\n`;
    }

    return md;
  }

  getRecords(entityType, filters = {}) {
    let query;
    switch (entityType) {
      case 'cases':
        query = this.db.prepare(`
          SELECT 
            id, case_number, patient_name, doctor_name, clinic_name,
            status, created_at, updated_at, notes
          FROM cases
          ORDER BY created_at DESC
        `);
        break;
      case 'teeth':
        query = this.db.prepare(`
          SELECT 
            t.id, t.case_id, t.tooth_number, t.tooth_type, 
            t.is_rework, t.rework_count, t.version, t.status,
            c.case_number, c.patient_name
          FROM teeth t
          LEFT JOIN cases c ON t.case_id = c.id
          ORDER BY t.created_at DESC
        `);
        break;
      case 'prescriptions':
        query = this.db.prepare(`
          SELECT * FROM prescriptions ORDER BY created_at DESC
        `);
        break;
      case 'scan_files':
        query = this.db.prepare(`
          SELECT * FROM scan_files ORDER BY created_at DESC
        `);
        break;
      case 'process_steps':
        query = this.db.prepare(`
          SELECT * FROM process_steps ORDER BY step_order, created_at
        `);
        break;
      case 'rework_requests':
        query = this.db.prepare(`
          SELECT * FROM rework_requests ORDER BY request_date DESC
        `);
        break;
      case 'try_in_feedbacks':
        query = this.db.prepare(`
          SELECT * FROM try_in_feedbacks ORDER BY feedback_date DESC
        `);
        break;
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }

    return query.all();
  }

  getColumnsForEntity(entityType) {
    const columnDefs = {
      cases: [
        { key: 'case_number', header: '病例编号' },
        { key: 'patient_name', header: '患者姓名' },
        { key: 'doctor_name', header: '医生姓名' },
        { key: 'clinic_name', header: '诊所名称' },
        { key: 'status', header: '状态' },
        { key: 'created_at', header: '创建时间' }
      ],
      teeth: [
        { key: 'case_number', header: '病例编号' },
        { key: 'patient_name', header: '患者姓名' },
        { key: 'tooth_number', header: '牙位' },
        { key: 'tooth_type', header: '修复类型' },
        { key: 'is_rework', header: '是否返工' },
        { key: 'rework_count', header: '返工次数' },
        { key: 'version', header: '版本' },
        { key: 'status', header: '状态' }
      ],
      prescriptions: [
        { key: 'prescription_number', header: '处方编号' },
        { key: 'doctor_name', header: '医生' },
        { key: 'tooth_numbers', header: '牙位' },
        { key: 'restoration_type', header: '修复类型' },
        { key: 'material', header: '材料' },
        { key: 'shade', header: '颜色' },
        { key: 'due_date', header: '到期日' }
      ],
      scan_files: [
        { key: 'file_name', header: '文件名' },
        { key: 'file_type', header: '文件类型' },
        { key: 'scan_type', header: '扫描类型' },
        { key: 'version', header: '版本' },
        { key: 'is_valid', header: '是否有效' }
      ],
      process_steps: [
        { key: 'step_name', header: '工序名称' },
        { key: 'step_order', header: '顺序' },
        { key: 'status', header: '状态' },
        { key: 'assigned_to', header: '负责人' }
      ],
      rework_requests: [
        { key: 'reason_code', header: '原因代码' },
        { key: 'reason_description', header: '原因描述' },
        { key: 'rework_type', header: '返工类型' },
        { key: 'status', header: '状态' }
      ],
      try_in_feedbacks: [
        { key: 'fit_status', header: '就位情况' },
        { key: 'occlusion_status', header: '咬合情况' },
        { key: 'esthetics_status', header: '美学情况' },
        { key: 'needs_rework', header: '是否需要返工' },
        { key: 'is_followed_up', header: '是否已跟进' }
      ]
    };
    return columnDefs[entityType] || [];
  }

  getEntityDisplayName(entityType) {
    const names = {
      cases: '病例列表',
      teeth: '牙位信息',
      prescriptions: '处方记录',
      scan_files: '口扫文件',
      process_steps: '工序记录',
      rework_requests: '返工申请',
      try_in_feedbacks: '试戴反馈'
    };
    return names[entityType] || entityType;
  }
}
