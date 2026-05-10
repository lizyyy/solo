import express from 'express';
import db from '../database';
import historyService from '../services/historyService';
import { successResponse } from '../utils/business';
import { SourceType } from '../types';

const router = express.Router();

router.get('/', (req, res) => {
  const { storeId, itemId, channelId, startTime, endTime, source } = req.query as {
    storeId?: string;
    itemId?: string;
    channelId?: string;
    startTime?: string;
    endTime?: string;
    source?: string;
  };

  const result = historyService.queryHistory(
    storeId,
    itemId,
    channelId,
    startTime,
    endTime,
    source as SourceType | undefined
  );

  const storeMap = new Map(db.stores.map(s => [s.id, s.name]));
  const itemMap = new Map(db.menuItems.map(i => [i.id, i.name]));
  const channelMap = new Map(db.channels.map(c => [c.id, c.name]));

  const formattedRecords = result.records.map(r => historyService.formatHistoryRecord(
    r,
    storeMap.get(r.storeId) || r.storeId,
    itemMap.get(r.itemId) || r.itemId,
    channelMap.get(r.channelId) || r.channelId
  ));

  res.json(successResponse(
    `查询历史记录成功，共${result.summary.total}条`,
    {
      汇总统计: {
        总记录数: result.summary.total,
        系统自动操作: result.summary.autoChanges,
        人工操作: result.summary.manualChanges,
        上架操作: result.summary.onlineCount,
        下架停售操作: result.summary.offlineCount
      },
      记录明细: formattedRecords
    }
  ));
});

export default router;
