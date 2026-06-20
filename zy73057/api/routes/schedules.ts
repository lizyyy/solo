import { Router, type Request, type Response } from 'express';
import {
  applyFilters,
  getBatchDetail,
  rerunBatch,
  getSnapshots,
} from '../services/scheduleService.js';
import type { ScheduleListFilters } from '../../shared/types.js';

const router = Router();

function parseFilters(query: Record<string, unknown>): ScheduleListFilters {
  const filters: ScheduleListFilters = {};

  if (typeof query.dateFrom === 'string' && query.dateFrom) {
    filters.dateFrom = query.dateFrom;
  }
  if (typeof query.dateTo === 'string' && query.dateTo) {
    filters.dateTo = query.dateTo;
  }
  if (typeof query.batchIds === 'string' && query.batchIds) {
    filters.batchIds = query.batchIds.split(',');
  } else if (Array.isArray(query.batchIds)) {
    filters.batchIds = query.batchIds as string[];
  }
  if (typeof query.statuses === 'string' && query.statuses) {
    filters.statuses = query.statuses.split(',') as ScheduleListFilters['statuses'];
  } else if (Array.isArray(query.statuses)) {
    filters.statuses = query.statuses as ScheduleListFilters['statuses'];
  }
  if (query.isOverridden !== undefined) {
    filters.isOverridden = query.isOverridden === 'true' || query.isOverridden === true;
  }
  if (typeof query.elevatorNos === 'string' && query.elevatorNos) {
    filters.elevatorNos = query.elevatorNos.split(',');
  } else if (Array.isArray(query.elevatorNos)) {
    filters.elevatorNos = query.elevatorNos as string[];
  }
  if (typeof query.partNos === 'string' && query.partNos) {
    filters.partNos = query.partNos.split(',');
  } else if (Array.isArray(query.partNos)) {
    filters.partNos = query.partNos as string[];
  }

  return filters;
}

router.get('/', (req: Request, res: Response): void => {
  const filters = parseFilters(req.query as Record<string, unknown>);
  const result = applyFilters(filters);

  res.json({
    success: true,
    data: {
      batches: result.batches,
      items: result.items,
      matchedBatchIds: result.matchedBatchIds,
      matchedItemIds: result.matchedItemIds,
    },
  });
});

router.get('/:batchId', (req: Request, res: Response): void => {
  const { batchId } = req.params;
  const detail = getBatchDetail(batchId);

  if (!detail) {
    res.status(404).json({
      success: false,
      error: 'Batch not found',
    });
    return;
  }

  res.json({
    success: true,
    data: detail,
  });
});

router.post('/:batchId/rerun', (req: Request, res: Response): void => {
  const { batchId } = req.params;
  const { supplementaryPhotos = [] } = req.body ?? {};

  const result = rerunBatch(batchId, { supplementaryPhotos });

  if (!result) {
    res.status(404).json({
      success: false,
      error: 'Batch not found',
    });
    return;
  }

  res.json({
    success: true,
    data: result,
  });
});

router.get('/:batchId/snapshots', (req: Request, res: Response): void => {
  const { batchId } = req.params;
  const snapshots = getSnapshots(batchId);

  res.json({
    success: true,
    data: snapshots,
  });
});

export default router;
