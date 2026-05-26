import { Router, Request, Response } from 'express';
import db from '../config/database';
import { BATCH_STATUS, DETAIL_STATUS } from '../config/constants';
import { authMiddleware } from '../middleware/auth';
import { generateBatchNo, calculateMaterialHash, nowTimestamp, buildPaginationResponse } from '../utils/helpers';

const router = Router();

router.post('/', authMiddleware, (req: Request, res: Response) => {
  const { name, description, materials } = req.body;

  if (!name || !materials || !Array.isArray(materials) || materials.length === 0) {
    return res.status(400).json({ error: '批次名称和材料列表不能为空' });
  }

  const materialHash = calculateMaterialHash(materials);

  const existingBatch = db.prepare(`
    SELECT b.*, 
           (SELECT COUNT(*) FROM deduction_details d WHERE d.batch_id = b.id) as detail_count
    FROM batches b 
    WHERE b.material_hash = ?
  `).get(materialHash) as any;

  if (existingBatch) {
    const details = db.prepare(`
      SELECT d.*, u.real_name as created_by_name, h.real_name as handled_by_name
      FROM deduction_details d
      LEFT JOIN users u ON d.created_by = u.id
      LEFT JOIN users h ON d.handled_by = h.id
      WHERE d.batch_id = ?
    `).all(existingBatch.id);

    return res.json({
      duplicate: true,
      message: '该批材料已存在，返回原有处理结果',
      batch: existingBatch,
      details,
    });
  }

  const tx = db.transaction(() => {
    const batchNo = generateBatchNo();
    const now = nowTimestamp();

    const insertBatch = db.prepare(`
      INSERT INTO batches (batch_no, material_hash, name, description, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertBatch.run(
      batchNo,
      materialHash,
      name,
      description || null,
      BATCH_STATUS.PENDING,
      req.user!.id,
      now,
      now
    );

    const batchId = result.lastInsertRowid as number;

    const insertMaterial = db.prepare(`
      INSERT INTO materials (batch_id, material_type, waybill_no, content, uploaded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const material of materials) {
      if (!material.material_type) {
        throw new Error('材料类型不能为空');
      }
      insertMaterial.run(
        batchId,
        material.material_type,
        material.waybill_no || null,
        material.content || null,
        req.user!.id,
        now
      );
    }

    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);

    return { batch, detail_count: 0 };
  });

  try {
    const result = tx();
    res.status(201).json({
      duplicate: false,
      message: '批次创建成功',
      batch: result.batch,
      details: [],
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.page_size as string) || 20;
  const status = req.query.status as string;
  const keyword = req.query.keyword as string;
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (status) {
    whereClause += ' AND b.status = ?';
    params.push(status);
  }

  if (keyword) {
    whereClause += ' AND (b.batch_no LIKE ? OR b.name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const countResult = db.prepare(`
    SELECT COUNT(*) as total FROM batches b ${whereClause}
  `).get(...params) as any;

  const items = db.prepare(`
    SELECT b.*, 
           u.real_name as created_by_name,
           (SELECT COUNT(*) FROM materials m WHERE m.batch_id = b.id) as material_count,
           (SELECT COUNT(*) FROM deduction_details d WHERE d.batch_id = b.id) as detail_count
    FROM batches b
    LEFT JOIN users u ON b.created_by = u.id
    ${whereClause}
    ORDER BY b.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  res.json(buildPaginationResponse(items, countResult.total, page, pageSize));
});

router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const batchId = parseInt(req.params.id);

  const batch = db.prepare(`
    SELECT b.*, u.real_name as created_by_name, a.real_name as archived_by_name
    FROM batches b
    LEFT JOIN users u ON b.created_by = u.id
    LEFT JOIN users a ON b.archived_by = a.id
    WHERE b.id = ?
  `).get(batchId) as any;

  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  const materials = db.prepare(`
    SELECT m.*, u.real_name as uploaded_by_name
    FROM materials m
    LEFT JOIN users u ON m.uploaded_by = u.id
    WHERE m.batch_id = ?
    ORDER BY m.created_at DESC
  `).all(batchId);

  const details = db.prepare(`
    SELECT d.*, u.real_name as created_by_name, h.real_name as handled_by_name
    FROM deduction_details d
    LEFT JOIN users u ON d.created_by = u.id
    LEFT JOIN users h ON d.handled_by = h.id
    WHERE d.batch_id = ?
    ORDER BY d.created_at DESC
  `).all(batchId);

  const summary = db.prepare(`
    SELECT 
      status,
      exception_type,
      COUNT(*) as count,
      SUM(deduction_amount) as total_amount
    FROM deduction_details
    WHERE batch_id = ?
    GROUP BY status, exception_type
  `).all(batchId);

  res.json({
    batch,
    materials,
    details,
    summary,
  });
});

router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  const batchId = parseInt(req.params.id);
  const { name, description, status } = req.body;

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as any;

  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  const now = nowTimestamp();

  db.prepare(`
    UPDATE batches 
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        updated_at = ?
    WHERE id = ?
  `).run(
    name || null,
    description || null,
    status || null,
    now,
    batchId
  );

  const updatedBatch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);

  res.json({ message: '批次更新成功', batch: updatedBatch });
});

export default router;
