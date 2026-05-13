import db from './database';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';

export interface Supplier {
  id?: string;
  code: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface SampleBatch {
  id?: string;
  batch_no: string;
  supplier_id: string;
  product_name: string;
  sample_type?: string;
  quantity?: number;
  receive_date?: string;
  status?: string;
  version?: string;
}

export interface ReviewScore {
  id?: string;
  batch_id: string;
  reviewer: string;
  review_date: string;
  appearance_score?: number;
  quality_score?: number;
  function_score?: number;
  packaging_score?: number;
  total_score?: number;
  comments?: string;
  result?: string;
  version?: string;
}

export interface RectificationOpinion {
  id?: string;
  batch_id: string;
  item: string;
  description?: string;
  requirement?: string;
  deadline?: string;
  responsible_person?: string;
  status?: string;
}

export interface ReshipLogistics {
  id?: string;
  batch_id: string;
  tracking_no?: string;
  courier_company?: string;
  ship_date?: string;
  receive_date?: string;
  status?: string;
  remarks?: string;
}

export interface VersionFinalization {
  id?: string;
  batch_id: string;
  final_version: string;
  finalizer: string;
  finalize_date: string;
  remarks?: string;
}

const logChange = (tableName: string, recordId: string, fieldName: string, oldValue: any, newValue: any, changedBy: string) => {
  const stmt = db.prepare(`
    INSERT INTO change_logs (id, table_name, record_id, field_name, old_value, new_value, changed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(uuidv4(), tableName, recordId, fieldName, String(oldValue), String(newValue), changedBy);
};

export const SupplierService = {
  getAll: () => db.prepare('SELECT * FROM suppliers ORDER BY created_at DESC').all(),
  
  create: (supplier: Supplier, changedBy: string = 'system') => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO suppliers (id, code, name, contact_person, phone, email, address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, supplier.code, supplier.name, supplier.contact_person, supplier.phone, supplier.email, supplier.address);
    return { id, ...supplier };
  },

  update: (id: string, supplier: Partial<Supplier>, changedBy: string = 'system') => {
    const old = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any;
    if (!old) throw new Error('Supplier not found');

    const fields = Object.keys(supplier).filter(k => supplier[k as keyof Supplier] !== undefined);
    if (fields.length === 0) return old;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => supplier[f as keyof Supplier]);
    
    fields.forEach(field => {
      if (old[field] !== supplier[field as keyof Supplier]) {
        logChange('suppliers', id, field, old[field], supplier[field as keyof Supplier], changedBy);
      }
    });

    const stmt = db.prepare(`UPDATE suppliers SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    stmt.run([...values, id]);
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  }
};

export const SampleBatchService = {
  getAll: (filters?: any) => {
    let query = `
      SELECT sb.*, s.name as supplier_name, s.code as supplier_code
      FROM sample_batches sb
      LEFT JOIN suppliers s ON sb.supplier_id = s.id
    `;
    const params: any[] = [];
    
    if (filters) {
      const conditions: string[] = [];
      if (filters.batch_no) {
        conditions.push('sb.batch_no LIKE ?');
        params.push(`%${filters.batch_no}%`);
      }
      if (filters.supplier_id) {
        conditions.push('sb.supplier_id = ?');
        params.push(filters.supplier_id);
      }
      if (filters.status) {
        conditions.push('sb.status = ?');
        params.push(filters.status);
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
    }
    
    query += ' ORDER BY sb.created_at DESC';
    return db.prepare(query).all(params);
  },

  getById: (id: string) => {
    return db.prepare(`
      SELECT sb.*, s.name as supplier_name, s.code as supplier_code
      FROM sample_batches sb
      LEFT JOIN suppliers s ON sb.supplier_id = s.id
      WHERE sb.id = ?
    `).get(id);
  },

  validateBatch: (batchNo: string) => {
    const batch = db.prepare('SELECT * FROM sample_batches WHERE batch_no = ?').get(batchNo);
    if (!batch) {
      return { valid: false, message: '批次不存在', batch: null };
    }
    const review = db.prepare('SELECT * FROM review_scores WHERE batch_id = ? ORDER BY version DESC LIMIT 1').get((batch as any).id);
    const finalization = db.prepare('SELECT * FROM version_finalizations WHERE batch_id = ?').get((batch as any).id);
    
    return {
      valid: true,
      message: '批次校验通过',
      batch,
      latestReview: review,
      finalization
    };
  },

  create: (batch: SampleBatch, changedBy: string = 'system') => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO sample_batches (id, batch_no, supplier_id, product_name, sample_type, quantity, receive_date, status, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, batch.batch_no, batch.supplier_id, batch.product_name, batch.sample_type, batch.quantity, batch.receive_date, batch.status || 'pending', batch.version || '1.0');
    return { id, ...batch };
  },

  update: (id: string, batch: Partial<SampleBatch>, changedBy: string = 'system') => {
    const old = db.prepare('SELECT * FROM sample_batches WHERE id = ?').get(id) as any;
    if (!old) throw new Error('Batch not found');

    const fields = Object.keys(batch).filter(k => batch[k as keyof SampleBatch] !== undefined);
    if (fields.length === 0) return old;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => batch[f as keyof SampleBatch]);
    
    fields.forEach(field => {
      if (old[field] !== batch[field as keyof SampleBatch]) {
        logChange('sample_batches', id, field, old[field], batch[field as keyof SampleBatch], changedBy);
      }
    });

    const stmt = db.prepare(`UPDATE sample_batches SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    stmt.run([...values, id]);
    return db.prepare('SELECT * FROM sample_batches WHERE id = ?').get(id);
  }
};

export const ReviewScoreService = {
  getByBatchId: (batchId: string) => {
    return db.prepare('SELECT * FROM review_scores WHERE batch_id = ? ORDER BY version DESC').all(batchId);
  },

  create: (score: ReviewScore, changedBy: string = 'system') => {
    const id = uuidv4();
    const total = (score.appearance_score || 0) + (score.quality_score || 0) + (score.function_score || 0) + (score.packaging_score || 0);
    const stmt = db.prepare(`
      INSERT INTO review_scores (id, batch_id, reviewer, review_date, appearance_score, quality_score, function_score, packaging_score, total_score, comments, result, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, score.batch_id, score.reviewer, score.review_date, score.appearance_score, score.quality_score, score.function_score, score.packaging_score, total, score.comments, score.result, score.version || '1.0');
    return { id, ...score, total_score: total };
  },

  update: (id: string, score: Partial<ReviewScore>, changedBy: string = 'system') => {
    const old = db.prepare('SELECT * FROM review_scores WHERE id = ?').get(id) as any;
    if (!old) throw new Error('Review not found');

    const fields = Object.keys(score).filter(k => score[k as keyof ReviewScore] !== undefined);
    if (fields.length === 0) return old;

    fields.forEach(field => {
      if (old[field] !== score[field as keyof ReviewScore]) {
        logChange('review_scores', id, field, old[field], score[field as keyof ReviewScore], changedBy);
      }
    });

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => score[f as keyof ReviewScore]);

    const stmt = db.prepare(`UPDATE review_scores SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    stmt.run([...values, id]);
    return db.prepare('SELECT * FROM review_scores WHERE id = ?').get(id);
  }
};

export const RectificationOpinionService = {
  getByBatchId: (batchId: string) => {
    return db.prepare('SELECT * FROM rectification_opinions WHERE batch_id = ? ORDER BY created_at DESC').all(batchId);
  },

  create: (opinion: RectificationOpinion, changedBy: string = 'system') => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO rectification_opinions (id, batch_id, item, description, requirement, deadline, responsible_person, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, opinion.batch_id, opinion.item, opinion.description, opinion.requirement, opinion.deadline, opinion.responsible_person, opinion.status || 'pending');
    return { id, ...opinion };
  },

  advance: (id: string, status: string, changedBy: string = 'system') => {
    const old = db.prepare('SELECT * FROM rectification_opinions WHERE id = ?').get(id) as any;
    if (!old) throw new Error('Opinion not found');

    if (old.status !== status) {
      logChange('rectification_opinions', id, 'status', old.status, status, changedBy);
    }

    const stmt = db.prepare('UPDATE rectification_opinions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(status, id);
    return db.prepare('SELECT * FROM rectification_opinions WHERE id = ?').get(id);
  }
};

export const ReshipLogisticsService = {
  getByBatchId: (batchId: string) => {
    return db.prepare('SELECT * FROM reship_logistics WHERE batch_id = ? ORDER BY created_at DESC').all(batchId);
  },

  create: (logistics: ReshipLogistics, changedBy: string = 'system') => {
    const existing = db.prepare('SELECT * FROM reship_logistics WHERE batch_id = ? AND tracking_no = ?').get(logistics.batch_id, logistics.tracking_no);
    if (existing) return existing;

    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO reship_logistics (id, batch_id, tracking_no, courier_company, ship_date, receive_date, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, logistics.batch_id, logistics.tracking_no, logistics.courier_company, logistics.ship_date, logistics.receive_date, logistics.status || 'transit', logistics.remarks);
    return { id, ...logistics };
  }
};

export const VersionFinalizationService = {
  getByBatchId: (batchId: string) => {
    return db.prepare('SELECT * FROM version_finalizations WHERE batch_id = ?').get(batchId);
  },

  create: (finalization: VersionFinalization, changedBy: string = 'system') => {
    const existing = db.prepare('SELECT * FROM version_finalizations WHERE batch_id = ? AND final_version = ?').get(finalization.batch_id, finalization.final_version);
    if (existing) return existing;

    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO version_finalizations (id, batch_id, final_version, finalizer, finalize_date, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, finalization.batch_id, finalization.final_version, finalization.finalizer, finalization.finalize_date, finalization.remarks);
    
    db.prepare('UPDATE sample_batches SET status = ?, version = ? WHERE id = ?').run('finalized', finalization.final_version, finalization.batch_id);
    
    return { id, ...finalization };
  }
};

export const StatisticsService = {
  getOverview: () => {
    const totalBatches = db.prepare('SELECT COUNT(*) as count FROM sample_batches').get() as any;
    const pending = db.prepare('SELECT COUNT(*) as count FROM sample_batches WHERE status = ?').get('pending') as any;
    const reviewing = db.prepare('SELECT COUNT(*) as count FROM sample_batches WHERE status = ?').get('reviewing') as any;
    const finalized = db.prepare('SELECT COUNT(*) as count FROM sample_batches WHERE status = ?').get('finalized') as any;
    const avgScore = db.prepare('SELECT AVG(total_score) as avg FROM review_scores').get() as any;

    return {
      totalBatches: totalBatches.count,
      pending: pending.count,
      reviewing: reviewing.count,
      finalized: finalized.count,
      avgScore: Math.round(avgScore.avg || 0)
    };
  }
};

export const ChangeLogService = {
  getByRecord: (tableName: string, recordId: string) => {
    return db.prepare('SELECT * FROM change_logs WHERE table_name = ? AND record_id = ? ORDER BY changed_at DESC').all(tableName, recordId);
  }
};

export const ExportService = {
  generateReport: async (filters?: { responsible_person?: string; start_date?: string; end_date?: string }) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('样品评审报告');

    worksheet.columns = [
      { header: '批次号', key: 'batch_no', width: 15 },
      { header: '供应商', key: 'supplier_name', width: 20 },
      { header: '产品名称', key: 'product_name', width: 20 },
      { header: '评审人', key: 'reviewer', width: 12 },
      { header: '评审日期', key: 'review_date', width: 12 },
      { header: '外观评分', key: 'appearance_score', width: 10 },
      { header: '质量评分', key: 'quality_score', width: 10 },
      { header: '功能评分', key: 'function_score', width: 10 },
      { header: '包装评分', key: 'packaging_score', width: 10 },
      { header: '总分', key: 'total_score', width: 10 },
      { header: '评审结果', key: 'result', width: 10 },
      { header: '责任人', key: 'responsible_person', width: 12 },
      { header: '处理时间', key: 'created_at', width: 20 },
      { header: '版本', key: 'version', width: 10 }
    ];

    let query = `
      SELECT 
        sb.batch_no,
        s.name as supplier_name,
        sb.product_name,
        rs.reviewer,
        rs.review_date,
        rs.appearance_score,
        rs.quality_score,
        rs.function_score,
        rs.packaging_score,
        rs.total_score,
        rs.result,
        ro.responsible_person,
        rs.created_at,
        rs.version
      FROM review_scores rs
      LEFT JOIN sample_batches sb ON rs.batch_id = sb.id
      LEFT JOIN suppliers s ON sb.supplier_id = s.id
      LEFT JOIN rectification_opinions ro ON rs.batch_id = ro.batch_id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (filters?.responsible_person) {
      conditions.push('ro.responsible_person = ?');
      params.push(filters.responsible_person);
    }
    if (filters?.start_date) {
      conditions.push('rs.created_at >= ?');
      params.push(filters.start_date);
    }
    if (filters?.end_date) {
      conditions.push('rs.created_at <= ?');
      params.push(filters.end_date);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const rows = db.prepare(query).all(params);
    rows.forEach((row: any) => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
};
