import express from 'express';
import db from '../database';
import inventoryService from '../services/inventoryService';
import { successResponse, errorResponse, formatBusinessTime } from '../utils/business';

const router = express.Router();

router.post('/set', (req, res) => {
  const { storeId, itemId, quantity, minThreshold, operator } = req.body;
  
  if (!storeId || !itemId) {
    return res.status(400).json(errorResponse('ERR-API-001', '缺少必填参数：storeId、itemId'));
  }
  if (typeof quantity !== 'number') {
    return res.status(400).json(errorResponse('ERR-API-002', '库存数量必须是数字'));
  }

  const result = inventoryService.setInventory(
    storeId,
    itemId,
    quantity,
    typeof minThreshold === 'number' ? minThreshold : 0,
    operator || 'API调用者'
  );
  
  res.json(result);
});

router.get('/', (req, res) => {
  const { storeId } = req.query as { storeId?: string };
  
  const inventories = inventoryService.getAllInventories(storeId);
  
  const itemMap = new Map(db.menuItems.map(i => [i.id, i.name]));

  const formatted = inventories.map(inv => ({
    门店ID: inv.storeId,
    商品ID: inv.itemId,
    商品名称: itemMap.get(inv.itemId) || inv.itemId,
    当前库存: `${inv.quantity}件`,
    预警阈值: `${inv.minThreshold}件`,
    库存状态: inv.quantity <= inv.minThreshold ? '库存不足' : '库存充足',
    最后更新人: inv.updatedBy,
    更新时间: formatBusinessTime(inv.updatedAt)
  }));

  res.json(successResponse(
    `获取库存列表成功，共${formatted.length}条记录`,
    formatted
  ));
});

router.get('/stockout', (req, res) => {
  const { storeId } = req.query as { storeId?: string };
  
  const stockouts = inventoryService.getStockoutItems(storeId);
  
  const itemMap = new Map(db.menuItems.map(i => [i.id, i.name]));

  const formatted = stockouts.map(inv => ({
    门店ID: inv.storeId,
    商品ID: inv.itemId,
    商品名称: itemMap.get(inv.itemId) || inv.itemId,
    当前库存: `${inv.quantity}件`,
    预警阈值: `${inv.minThreshold}件`,
    缺口: `${inv.minThreshold - inv.quantity}件`
  }));

  res.json(successResponse(
    `获取缺货列表成功，共${formatted.length}个缺货商品`,
    formatted
  ));
});

export default router;
