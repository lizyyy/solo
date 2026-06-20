import { Router, type Request, type Response } from 'express';
import { applyFilters } from '../services/scheduleService.js';
import { signFilters, toCSV } from '../services/exportService.js';
import type { ScheduleListFilters } from '../../shared/types.js';

const router = Router();

function parseFilters(body: Record<string, unknown>): ScheduleListFilters {
  const filters: ScheduleListFilters = {};

  if (typeof body.dateFrom === 'string' && body.dateFrom) {
    filters.dateFrom = body.dateFrom;
  }
  if (typeof body.dateTo === 'string' && body.dateTo) {
    filters.dateTo = body.dateTo;
  }
  if (Array.isArray(body.batchIds)) {
    filters.batchIds = body.batchIds as string[];
  } else if (typeof body.batchIds === 'string' && body.batchIds) {
    filters.batchIds = body.batchIds.split(',');
  }
  if (Array.isArray(body.statuses)) {
    filters.statuses = body.statuses as ScheduleListFilters['statuses'];
  } else if (typeof body.statuses === 'string' && body.statuses) {
    filters.statuses = body.statuses.split(',') as ScheduleListFilters['statuses'];
  }
  if (body.isOverridden !== undefined) {
    filters.isOverridden = body.isOverridden === true || body.isOverridden === 'true';
  }
  if (Array.isArray(body.elevatorNos)) {
    filters.elevatorNos = body.elevatorNos as string[];
  } else if (typeof body.elevatorNos === 'string' && body.elevatorNos) {
    filters.elevatorNos = body.elevatorNos.split(',');
  }
  if (Array.isArray(body.partNos)) {
    filters.partNos = body.partNos as string[];
  } else if (typeof body.partNos === 'string' && body.partNos) {
    filters.partNos = body.partNos.split(',');
  }

  return filters;
}

router.post('/schedules', (req: Request, res: Response): void => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const filters = parseFilters(body.filters ? (body.filters as Record<string, unknown>) : body);

  const result = applyFilters(filters);
  const items = result.items;
  const batches = result.batches;
  const signaturePayload = signFilters(filters, result.matchedItemIds, result.matchedBatchIds);

  const csv = toCSV(items, batches);

  const signatureMeta = {
    signature: signaturePayload.signature,
    exportedAt: signaturePayload.exportedAt,
    matchedItemCount: result.matchedItemIds.length,
    matchedBatchCount: result.matchedBatchIds.length,
  };

  res.setHeader('X-Filter-Signature', signaturePayload.signature);
  res.setHeader('X-Filter-Signature-Meta', encodeURIComponent(JSON.stringify(signatureMeta)));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=schedules.csv');

  res.send(csv);
});

export default router;
