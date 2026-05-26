import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../config/database';
import { UPLOAD_DIR } from '../config/constants';
import { authMiddleware } from '../middleware/auth';
import { nowTimestamp } from '../utils/helpers';

const router = Router();

const uploadDir = path.resolve(UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}-${random}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

router.post('/upload', authMiddleware, upload.single('file'), (req: Request, res: Response) => {
  const batchId = parseInt(req.body.batch_id);
  const materialType = req.body.material_type;
  const waybillNo = req.body.waybill_no;

  if (!batchId || !materialType) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(400).json({ error: '批次ID和材料类型不能为空' });
  }

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  if (!batch) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(404).json({ error: '批次不存在' });
  }

  if (!req.file) {
    return res.status(400).json({ error: '请选择要上传的文件' });
  }

  const now = nowTimestamp();

  const result = db.prepare(`
    INSERT INTO materials (batch_id, material_type, waybill_no, file_name, file_path, file_size, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    batchId,
    materialType,
    waybillNo || null,
    req.file.originalname,
    req.file.path,
    req.file.size,
    req.user!.id,
    now
  );

  const material = db.prepare(`
    SELECT m.*, u.real_name as uploaded_by_name
    FROM materials m
    LEFT JOIN users u ON m.uploaded_by = u.id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);

  db.prepare('UPDATE batches SET updated_at = ? WHERE id = ?').run(now, batchId);

  res.status(201).json({
    message: '文件上传成功',
    material,
  });
});

router.post('/register', authMiddleware, (req: Request, res: Response) => {
  const { batch_id, material_type, waybill_no, content } = req.body;

  if (!batch_id || !material_type) {
    return res.status(400).json({ error: '批次ID和材料类型不能为空' });
  }

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batch_id);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  const now = nowTimestamp();

  const result = db.prepare(`
    INSERT INTO materials (batch_id, material_type, waybill_no, content, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    batch_id,
    material_type,
    waybill_no || null,
    content || null,
    req.user!.id,
    now
  );

  const material = db.prepare(`
    SELECT m.*, u.real_name as uploaded_by_name
    FROM materials m
    LEFT JOIN users u ON m.uploaded_by = u.id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);

  db.prepare('UPDATE batches SET updated_at = ? WHERE id = ?').run(now, batch_id);

  res.status(201).json({
    message: '材料登记成功',
    material,
  });
});

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const batchId = parseInt(req.query.batch_id as string);

  if (!batchId) {
    return res.status(400).json({ error: '批次ID不能为空' });
  }

  const materials = db.prepare(`
    SELECT m.*, u.real_name as uploaded_by_name
    FROM materials m
    LEFT JOIN users u ON m.uploaded_by = u.id
    WHERE m.batch_id = ?
    ORDER BY m.created_at DESC
  `).all(batchId);

  res.json({ items: materials });
});

router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const materialId = parseInt(req.params.id);

  const material = db.prepare(`
    SELECT m.*, u.real_name as uploaded_by_name
    FROM materials m
    LEFT JOIN users u ON m.uploaded_by = u.id
    WHERE m.id = ?
  `).get(materialId);

  if (!material) {
    return res.status(404).json({ error: '材料不存在' });
  }

  res.json(material);
});

router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  const materialId = parseInt(req.params.id);

  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId) as any;
  if (!material) {
    return res.status(404).json({ error: '材料不存在' });
  }

  const tx = db.transaction(() => {
    if (material.file_path && fs.existsSync(material.file_path)) {
      fs.unlinkSync(material.file_path);
    }

    db.prepare('DELETE FROM materials WHERE id = ?').run(materialId);
    db.prepare('UPDATE batches SET updated_at = ? WHERE id = ?').run(nowTimestamp(), material.batch_id);
  });

  tx();

  res.json({ message: '材料删除成功' });
});

export default router;
