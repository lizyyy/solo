import { Router, type Request, type Response } from 'express';
import { selfCheckService } from '../services/selfCheckService.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const result = selfCheckService.runAllChecks();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: '自检失败' });
  }
});

router.get('/duplicate', (req: Request, res: Response) => {
  try {
    const result = selfCheckService.checkDuplicateImport();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: '重复导入检测失败' });
  }
});

router.get('/name-issue', (req: Request, res: Response) => {
  try {
    const result = selfCheckService.checkCommunityNameIssue();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: '小区新旧名检测失败' });
  }
});

router.get('/recalc', (req: Request, res: Response) => {
  try {
    const result = selfCheckService.checkRecalcConsistency();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: '补录重算验证失败' });
  }
});

router.get('/export-consistency', (req: Request, res: Response) => {
  try {
    const result = selfCheckService.checkExportConsistency();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: '导出一致性校验失败' });
  }
});

export default router;
