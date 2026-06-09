import { Router, type Request, type Response } from 'express';
import { getReplaceActions, updateAction } from '../services/actionService.js';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const query = req.query as Record<string, unknown>;

  const filter: {
    batchId?: string;
    overrideId?: string;
    page?: number;
    pageSize?: number;
  } = {};

  if (typeof query.batchId === 'string' && query.batchId) {
    filter.batchId = query.batchId;
  }
  if (typeof query.overrideId === 'string' && query.overrideId) {
    filter.overrideId = query.overrideId;
  }
  if (typeof query.page === 'string' && query.page) {
    filter.page = parseInt(query.page, 10);
  }
  if (typeof query.pageSize === 'string' && query.pageSize) {
    filter.pageSize = parseInt(query.pageSize, 10);
  }

  const result = getReplaceActions(filter);

  res.json({
    success: true,
    data: result.data,
    pagination: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    },
  });
});

router.patch('/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const patch = req.body ?? {};

  const updated = updateAction(id, patch);

  if (!updated) {
    res.status(404).json({
      success: false,
      error: 'Action not found',
    });
    return;
  }

  res.json({
    success: true,
    data: updated,
  });
});

export default router;
