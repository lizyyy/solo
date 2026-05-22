import { Router, Response } from 'express';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.js';
import { Role } from '../../shared/types.js';
import { getSummaryReport } from '../services/reportService.js';
import { exportReport } from '../services/settlementService.js';
import * as XLSX from 'xlsx';

const router = Router();

router.use(authenticateToken);

router.get('/summary', 
  requirePermission('report:view', Role.PROJECT_MANAGER),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = getSummaryReport();
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

router.get('/export', 
  requirePermission('report:export', Role.PROJECT_MANAGER),
  async (req: AuthRequest, res: Response) => {
    try {
      const batchIds = req.query.batchIds ? (req.query.batchIds as string).split(',') : undefined;
      const wb = exportReport(batchIds);
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `维修异常报表_${new Date().toISOString().slice(0, 10)}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

export default router;
