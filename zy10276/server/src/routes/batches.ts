import express from 'express';
import db from '../database/db';

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

export default router;
