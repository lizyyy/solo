import { Router, Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import { ledgerService } from '../services/ledgerService';
import { store } from '../dataStore/inMemoryStore';
import { ValidationError } from '../utils/errors';

const router = Router();

function successResponse<T>(req: Request, data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date(),
    requestId: req.requestId
  };
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ledgers = await ledgerService.getAll();
    res.json(successResponse(req, ledgers));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ledger = await ledgerService.getById(req.params.id);
    res.json(successResponse(req, ledger));
  } catch (error) {
    next(error);
  }
});

router.get('/requisition/:requisitionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ledgers = await ledgerService.getByRequisitionId(req.params.requisitionId);
    res.json(successResponse(req, ledgers));
  } catch (error) {
    next(error);
  }
});

router.get('/range', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new ValidationError('开始日期和结束日期不能为空');
    }

    const ledgers = await ledgerService.getByDateRange(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json(successResponse(req, ledgers));
  } catch (error) {
    next(error);
  }
});

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;

    let dateRange: { start: Date; end: Date } | undefined;
    if (startDate && endDate) {
      dateRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      };
    }

    const summary = await ledgerService.getSummary(dateRange);
    res.json(successResponse(req, summary));
  } catch (error) {
    next(error);
  }
});

router.get('/violations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unresolved = store.violationRecordsStore().findUnresolved();
    res.json(successResponse(req, unresolved));
  } catch (error) {
    next(error);
  }
});

router.post('/violations/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resolverId, resolverName, resolutionNotes } = req.body;

    if (!resolverId || !resolverName) {
      throw new ValidationError('解决人ID和姓名不能为空');
    }

    const updated = store.violationRecordsStore().update(req.params.id, {
      isResolved: true,
      resolvedAt: new Date(),
      resolvedById: resolverId
    });

    res.json(successResponse(req, updated));
  } catch (error) {
    next(error);
  }
});

export default router;
