import db from '../db/index.js';

export interface ReportHistoryRecord {
  id: string;
  reportId: string;
  templateId: string;
  templateName: string;
  fileName: string;
  fileFormat: string;
  recordCount: number;
  fileSize: number;
  operatorId: string;
  operatorName: string;
  filters: string;
  status: string;
  createdAt: string;
}

const FIELD_MAP: Record<string, keyof ReportHistoryRecord> = {
  id: 'id',
  report_id: 'reportId',
  template_id: 'templateId',
  template_name: 'templateName',
  file_name: 'fileName',
  file_format: 'fileFormat',
  record_count: 'recordCount',
  file_size: 'fileSize',
  operator_id: 'operatorId',
  operator_name: 'operatorName',
  filters: 'filters',
  status: 'status',
  created_at: 'createdAt',
};

function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function rowToRecord(row: any): ReportHistoryRecord {
  const record: any = {};
  Object.keys(FIELD_MAP).forEach(dbField => {
    const camelField = FIELD_MAP[dbField];
    record[camelField] = row[dbField];
  });
  return record as ReportHistoryRecord;
}

export const ReportHistoryDAO = {
  list(
    filters?: Record<string, any>,
    page: number = 1,
    pageSize: number = 10
  ): { list: ReportHistoryRecord[]; total: number } {
    const offset = (page - 1) * pageSize;
    const params: any[] = [];
    
    let whereSql = '';
    if (filters && Object.keys(filters).length > 0) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          conditions.push(`${camelToSnake(key)} = ?`);
          params.push(value);
        }
      }
      if (conditions.length > 0) {
        whereSql = `WHERE ${conditions.join(' AND ')}`;
      }
    }

    const rows = db.prepare(`
      SELECT * FROM report_history
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all([...params, pageSize, offset]);

    const totalRow: any = db.prepare(`
      SELECT COUNT(*) as count FROM report_history
      ${whereSql}
    `).get(params);

    return {
      list: rows.map(rowToRecord),
      total: totalRow?.count || 0,
    };
  },

  getById(id: string): ReportHistoryRecord | null {
    const row = db.prepare(`
      SELECT * FROM report_history WHERE id = ?
    `).get(id);

    return row ? rowToRecord(row) : null;
  },

  getByReportId(reportId: string): ReportHistoryRecord | null {
    const row = db.prepare(`
      SELECT * FROM report_history WHERE report_id = ?
    `).get(reportId);

    return row ? rowToRecord(row) : null;
  },

  create(record: Omit<ReportHistoryRecord, 'createdAt'>): ReportHistoryRecord {
    const now = new Date().toISOString();
    const params = [
      record.id,
      record.reportId,
      record.templateId,
      record.templateName,
      record.fileName,
      record.fileFormat || 'csv',
      record.recordCount || 0,
      record.fileSize || 0,
      record.operatorId,
      record.operatorName,
      record.filters,
      record.status || 'completed',
    ];

    db.prepare(`
      INSERT INTO report_history (
        id, report_id, template_id, template_name, file_name, file_format,
        record_count, file_size, operator_id, operator_name, filters, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run([...params, now]);

    const created = ReportHistoryDAO.getById(record.id);
    if (!created) {
      throw new Error('Failed to create report history record');
    }
    return created;
  },

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM report_history WHERE id = ?').run(id);
    return (result.changes || 0) > 0;
  },
};

export default ReportHistoryDAO;
