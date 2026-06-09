import express from 'express';
import { getHistoryAll } from '../services/materialService';
import type { HistoryAction } from '../../shared/types';

const router = express.Router();

router.get('/', (req, res) => {
  const action = req.query.action as HistoryAction | undefined;
  const keyword = (req.query.keyword as string) || '';
  const page = parseInt((req.query.page as string) || '1', 10);
  const pageSize = parseInt((req.query.pageSize as string) || '50', 10);
  res.json(getHistoryAll({ action, keyword, page, pageSize }));
});

export default router;
