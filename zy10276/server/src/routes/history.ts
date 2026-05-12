import express from 'express';
import ProcessingHistoryDAO from '../dao/history.dao';

const router = express.Router();

router.get('/violation/:violationId', async (req, res) => {
  try {
    const history = ProcessingHistoryDAO.getByViolationId(req.params.violationId);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
