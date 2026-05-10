import express from 'express';
import db from '../database';
import channelStatusService from '../services/channelStatusService';
import { StatusType, OfflineReason, SourceType } from '../types';
import { successResponse, errorResponse, formatBusinessTime, statusDesc } from '../utils/business';

const router = express.Router();

router.get('/', (req, res) => {
  const channels = [...db.channels].sort((a, b) => a.id.localeCompare(b.id));
  res.json(successResponse(
    `获取渠道列表成功，共${channels.length}个渠道`,
    channels.map(ch => ({
      渠道ID: ch.id,
      渠道名称: ch.name,
      渠道代码: ch.code,
      状态: ch.isActive ? '启用' : '禁用',
      创建时间: formatBusinessTime(ch.createdAt)
    }))
  ));
});

router.get('/stores', (req, res) => {
  const stores = [...db.stores].sort((a, b) => a.id.localeCompare(b.id));
  res.json(successResponse(
    `获取门店列表成功，共${stores.length}个门店`,
    stores.map(st => ({
      门店ID: st.id,
      门店名称: st.name,
      门店代码: st.code,
      地址: st.address,
      状态: st.isActive ? '营业中' : '已关闭',
      创建时间: formatBusinessTime(st.createdAt)
    }))
  ));
});

router.get('/items', (req, res) => {
  const items = [...db.menuItems].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.id.localeCompare(b.id);
  });
  res.json(successResponse(
    `获取商品列表成功，共${items.length}个商品`,
    items.map(it => ({
      商品ID: it.id,
      商品名称: it.name,
      商品代码: it.code,
      分类: it.category,
      价格: `¥${it.price.toFixed(2)}`,
      描述: it.description,
      创建时间: formatBusinessTime(it.createdAt)
    }))
  ));
});

router.get('/status', (req, res) => {
  const { storeId, itemId, channelId } = req.query as { storeId?: string; itemId?: string; channelId?: string };
  
  const statuses = channelStatusService.getAllStatuses(storeId, itemId, channelId);
  
  const storeMap = new Map(db.stores.map(s => [s.id, s.name]));
  const itemMap = new Map(db.menuItems.map(i => [i.id, i.name]));
  const channelMap = new Map(db.channels.map(c => [c.id, c.name]));

  const formatted = statuses.map(s => channelStatusService.formatStatus(
    s,
    storeMap.get(s.storeId) || s.storeId,
    itemMap.get(s.itemId) || s.itemId,
    channelMap.get(s.channelId) || s.channelId
  ));

  res.json(successResponse(
    `获取渠道状态成功，共${formatted.length}条记录`,
    formatted
  ));
});

router.post('/status/online', (req, res) => {
  const { storeId, itemId, channelId, operator, remark } = req.body;
  
  if (!storeId || !itemId || !channelId) {
    return res.status(400).json(errorResponse('ERR-API-001', '缺少必填参数：storeId、itemId、channelId'));
  }

  const result = channelStatusService.manualOnline(
    storeId,
    itemId,
    channelId,
    operator || 'API调用者',
    remark || ''
  );
  
  res.json(result);
});

router.post('/status/offline', (req, res) => {
  const { storeId, itemId, channelId, reason, operator, remark } = req.body;
  
  if (!storeId || !itemId || !channelId) {
    return res.status(400).json(errorResponse('ERR-API-001', '缺少必填参数：storeId、itemId、channelId'));
  }

  const validReasons = [OfflineReason.MANUAL, OfflineReason.COMPLIANCE];
  if (!reason || !validReasons.includes(reason as OfflineReason)) {
    return res.status(400).json(errorResponse('ERR-API-002', `下架原因无效，可选：${validReasons.join('、')}`));
  }

  const result = channelStatusService.manualOffline(
    storeId,
    itemId,
    channelId,
    reason as OfflineReason.MANUAL | OfflineReason.COMPLIANCE,
    operator || 'API调用者',
    remark || ''
  );
  
  res.json(result);
});

export default router;
