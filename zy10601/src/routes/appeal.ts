import { Router, Request, Response } from 'express';
import { AppealService, AppealFilter } from '../services/AppealService';

const router = Router();
const appealService = new AppealService();

router.get('/', async (req: Request, res: Response) => {
  try {
    const filter: AppealFilter = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      status: req.query.status as string,
      responsiblePerson: req.query.responsiblePerson as string,
      businessObject: req.query.businessObject as string,
      tenantName: req.query.tenantName as string,
      appealCode: req.query.appealCode as string,
      includeBadRecords: req.query.includeBadRecords === 'true'
    };

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await appealService.getAppealList(filter, page, pageSize);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await appealService.getAppealDetail(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/:id/histories', async (req: Request, res: Response) => {
  try {
    const result = await appealService.getAppealHistories(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const { operatorName, requestId } = req.body;
    if (!operatorName || !requestId) {
      return res.status(400).json({ error: 'operatorName 和 requestId 为必填项' });
    }
    const result = await appealService.submitRestorationRequest(
      req.params.id,
      operatorName,
      requestId
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const filter: AppealFilter = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      status: req.query.status as string,
      responsiblePerson: req.query.responsiblePerson as string,
      businessObject: req.query.businessObject as string,
      tenantName: req.query.tenantName as string,
      appealCode: req.query.appealCode as string,
      includeBadRecords: req.query.includeBadRecords === 'true'
    };

    const csv = await appealService.exportToCSV(filter);
    const filename = `申诉导出_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/statistics/summary', async (req: Request, res: Response) => {
  try {
    const result = await appealService.getStatistics();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
