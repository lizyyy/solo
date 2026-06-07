import { Router, type Request, type Response } from 'express';
import { exportService } from '../services/exportService.js';

const router = Router();

router.get('/detail', (req: Request, res: Response) => {
  try {
    const { workbook } = exportService.exportDetail();
    const buffer = exportService.downloadWorkbook(workbook, '道路开挖恢复验收明细.xlsx');
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=道路开挖恢复验收明细.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, error: '导出明细失败' });
  }
});

router.get('/summary', (req: Request, res: Response) => {
  try {
    const { workbook } = exportService.exportSummary();
    const buffer = exportService.downloadWorkbook(workbook, '道路开挖恢复验收摘要.xlsx');
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=道路开挖恢复验收摘要.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, error: '导出摘要失败' });
  }
});

router.get('/detail/preview', (req: Request, res: Response) => {
  try {
    const { data } = exportService.exportDetail();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取明细预览失败' });
  }
});

router.get('/summary/preview', (req: Request, res: Response) => {
  try {
    const { data } = exportService.exportSummary();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取摘要预览失败' });
  }
});

export default router;
