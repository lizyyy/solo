import express from 'express';
import * as queryService from '../services/queryService';
import * as auditService from '../services/auditService';

const router = express.Router();

router.get('/:accountId/summary', async (req, res) => {
  try {
    const result = await queryService.getAccountSummary(req.params.accountId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:accountId/report', async (req, res) => {
  try {
    const result = await auditService.exportAccountDetailReport(req.params.accountId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=account-${req.params.accountId}-report.json`);
    res.send(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
