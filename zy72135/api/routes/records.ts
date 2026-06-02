import { Router } from 'express';
import {
  getAllRecords,
  getRecordById,
  getRecordVersions,
  updateRecordService,
  supplementRecordService,
} from '../services/recordService';
import type { FilterState } from '../../shared/types';

const router = Router();

router.get('/', (req, res) => {
  const filters: FilterState = {
    status: req.query.status as FilterState['status'],
    source: req.query.source as FilterState['source'],
    searchKeyword: req.query.searchKeyword as string,
    dateFrom: req.query.dateFrom as string,
    dateTo: req.query.dateTo as string,
  };

  Object.keys(filters).forEach((key) => {
    if ((filters as any)[key] === undefined || (filters as any)[key] === '') {
      delete (filters as any)[key];
    }
  });

  const records = getAllRecords(Object.keys(filters).length > 0 ? filters : undefined);
  res.json(records);
});

router.get('/:id', (req, res) => {
  const record = getRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }
  res.json(record);
});

router.get('/:id/versions', (req, res) => {
  const versions = getRecordVersions(req.params.id);
  res.json(versions);
});

router.put('/:id', (req, res) => {
  const modifiedBy = req.body.modifiedBy || '小孟';
  const updates = req.body;
  delete updates.modifiedBy;

  const record = updateRecordService(req.params.id, updates, modifiedBy);
  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }
  res.json(record);
});

router.post('/:id/supplement', (req, res) => {
  const modifiedBy = req.body.modifiedBy || '小孟';
  const oldChannelInfo = req.body.oldChannelInfo || '';

  const record = supplementRecordService(req.params.id, oldChannelInfo, modifiedBy);
  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }
  res.json(record);
});

export default router;
