import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { ReplayHistory } from '../entities/ReplayHistory';
import { In } from 'typeorm';

const router = Router();
const historyRepository = AppDataSource.getRepository(ReplayHistory);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, status, contractId, startDate, endDate } = req.query;
    const where: any = {};

    if (status) where.status = status;
    if (contractId) where.contractId = contractId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.$gte = new Date(startDate as string);
      if (endDate) where.createdAt.$lte = new Date(endDate as string);
    }

    const [histories, total] = await historyRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });

    res.json({
      success: true, data: histories, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const allHistories = await historyRepository.find();
    
    const stats = {
      total: allHistories.length,
      success: allHistories.filter(h => h.status === 'success').length,
      failed: allHistories.filter(h => h.status === 'failed').length,
      noMatch: allHistories.filter(h => h.status === 'no_match').length,
      compensated: allHistories.filter(h => h.isCompensated).length,
      averageDelay: allHistories.length > 0
        ? Math.round(allHistories.reduce((sum, h) => sum + h.responseDelay, 0) / allHistories.length)
        : 0
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const { status, startDate, endDate, format = 'json' } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.$gte = new Date(startDate as string);
      if (endDate) where.createdAt.$lte = new Date(endDate as string);
    }

    const histories = await historyRepository.find({
      where,
      order: { createdAt: 'DESC' }
    });

    if (format === 'csv') {
      const csv = [
        'id,contractId,sceneId,requestMethod,requestPath,status,responseStatusCode,responseDelay,failureReason,isCompensated,createdAt'
      ];
      histories.forEach(h => {
        csv.push([
          h.id,
          h.contractId || '',
          h.sceneId || '',
          h.requestMethod,
          h.requestPath,
          h.status,
          h.responseStatusCode,
          h.responseDelay,
          `"${(h.failureReason || '').replace(/"/g, '""')}"`,
          h.isCompensated,
          h.createdAt.toISOString()
        ].join(','));
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=replay-history.csv');
      res.send(csv.join('\n'));
    } else {
      res.json({
        success: true,
        data: histories,
        exportedAt: new Date().toISOString(),
        count: histories.length
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/batch-compensate', async (req: Request, res: Response) => {
  try {
    const { ids, responseBody, statusCode, compensatedBy } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid ids format' });
    }

    const histories = await historyRepository.findBy({ id: In(ids) });
    const results = [];

    for (const history of histories) {
      if (history.isCompensated) {
        results.push({ id: history.id, success: false, error: 'Already compensated' });
        continue;
      }

      history.isCompensated = true;
      history.compensatedAt = new Date();
      history.compensatedBy = compensatedBy || 'manual';
      history.status = 'compensated';

      if (responseBody) {
        history.compensationData = { originalResponseBody: history.responseBody, newResponseBody: responseBody };
        history.responseBody = responseBody;
      }
      if (statusCode) {
        history.responseStatusCode = statusCode;
      }

      await historyRepository.save(history);
      results.push({ id: history.id, success: true });
    }

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const history = await historyRepository.findOneBy({ id: req.params.id });
    if (!history) {
      return res.status(404).json({ success: false, error: 'History not found' });
    }

    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/:id/compensate', async (req: Request, res: Response) => {
  try {
    const { responseBody, statusCode, compensatedBy } = req.body;

    const history = await historyRepository.findOneBy({ id: req.params.id });
    if (!history) {
      return res.status(404).json({ success: false, error: 'History not found' });
    }

    if (history.isCompensated) {
      return res.status(400).json({ success: false, error: 'Already compensated' });
    }

    history.isCompensated = true;
    history.compensatedAt = new Date();
    history.compensatedBy = compensatedBy || 'manual';
    history.status = 'compensated';
    
    if (responseBody) {
      history.compensationData = { originalResponseBody: history.responseBody, newResponseBody: responseBody };
      history.responseBody = responseBody;
    }
    if (statusCode) {
      history.responseStatusCode = statusCode;
    }

    await historyRepository.save(history);

    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
