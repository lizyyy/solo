import express from 'express';
import { getOperationLogs } from '../services/operationLog.service';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const logs = await getOperationLogs(
      req.query.entity_type as string,
      req.query.entity_id as string
    );
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
