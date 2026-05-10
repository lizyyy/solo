import { Router, Request, Response } from 'express';
import { ExportService } from '../services/ExportService';

const router = Router();

router.get('/leads', async (req: Request, res: Response) => {
  try {
    const { status, assignedTo } = req.query;
    const filters: any = {};
    
    if (status) filters.status = status;
    if (assignedTo) filters.assignedTo = assignedTo;

    const buffer = await ExportService.exportLeadsToExcel(filters);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `展会线索_${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('导出线索失败:', error);
    res.status(500).json({ error: '导出线索失败' });
  }
});

export default router;
