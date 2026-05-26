import express, { Request, Response, Router } from 'express';
import multer from 'multer';
import { importSampleCsv, importInspectionJson, getImportRecords, getImportRecord } from '../services/importService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/csv', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }
    if (!req.body.imported_by) {
      return res.status(400).json({ error: '请提供导入人信息 imported_by' });
    }

    const content = req.file.buffer.toString('utf-8');
    const result = await importSampleCsv(content, req.file.originalname, req.body.imported_by);

    res.json({
      success: true,
      import_id: result.importRecord.id,
      record_count: result.importRecord.record_count,
      success_count: result.importRecord.success_count,
      error_count: result.importRecord.error_count,
      errors: result.errors,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/json', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传JSON文件' });
    }
    if (!req.body.imported_by) {
      return res.status(400).json({ error: '请提供导入人信息 imported_by' });
    }

    const content = req.file.buffer.toString('utf-8');
    const result = await importInspectionJson(content, req.file.originalname, req.body.imported_by);

    res.json({
      success: true,
      import_id: result.importRecord.id,
      record_count: result.importRecord.record_count,
      success_count: result.importRecord.success_count,
      error_count: result.importRecord.error_count,
      errors: result.errors,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const records = await getImportRecords();
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const record = await getImportRecord(req.params.id);
    if (!record) {
      return res.status(404).json({ error: '导入记录不存在' });
    }
    res.json(record);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
