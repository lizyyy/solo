import express from 'express';
import db from '../database/db';
import ViolationService from '../services/violation.service';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM import_batches ORDER BY created_at DESC
    `);
    const batches = stmt.all();
    res.json({ success: true, data: batches });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { data, fileName, importedBy } = req.body;
    const result = await ViolationService.importViolations(data, fileName, importedBy);
    res.json({ success: true, data: result, message: `成功导入 ${result.successful} 条记录` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
