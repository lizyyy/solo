import express from 'express';
import db from '../database';
import menuVersionService from '../services/menuVersionService';
import { successResponse, errorResponse, formatBusinessTime } from '../utils/business';

const router = express.Router();

router.post('/', (req, res) => {
  const { version, description, itemIds, createdBy } = req.body;
  
  if (!version || !itemIds || !Array.isArray(itemIds)) {
    return res.status(400).json(errorResponse('ERR-API-001', '缺少必填参数或格式错误：version、itemIds(数组)'));
  }

  const result = menuVersionService.createVersion(
    version,
    description || '',
    itemIds,
    createdBy || 'API调用者'
  );
  
  res.json(result);
});

router.get('/', (req, res) => {
  const versions = menuVersionService.getAllVersions();
  
  const itemMap = new Map(db.menuItems.map(i => [i.id, i.name]));

  const formatted = versions.map(v => ({
    版本ID: v.id,
    版本号: v.version,
    描述: v.description || '-',
    商品数量: v.itemIds.length,
    商品列表: v.itemIds.map(id => itemMap.get(id) || id).join('、'),
    创建人: v.createdBy,
    创建时间: formatBusinessTime(v.createdAt),
    是否活跃: v.isActive ? '是（当前版本）' : '否'
  }));

  res.json(successResponse(
    `获取菜单版本列表成功，共${formatted.length}个版本`,
    formatted
  ));
});

router.get('/active', (req, res) => {
  const version = menuVersionService.getActiveVersion();
  
  if (!version) {
    return res.json(successResponse('当前没有活跃的菜单版本'));
  }

  const items = menuVersionService.getVersionItems(version.id);
  
  res.json(successResponse(
    `当前活跃版本：${version.version}`,
    {
      版本ID: version.id,
      版本号: version.version,
      描述: version.description || '-',
      创建人: version.createdBy,
      创建时间: formatBusinessTime(version.createdAt),
      商品数量: items.length,
      商品明细: items.map(it => ({
        商品ID: it.id,
        商品名称: it.name,
        分类: it.category,
        价格: `¥${it.price.toFixed(2)}`
      }))
    }
  ));
});

router.post('/:versionId/activate', (req, res) => {
  const { versionId } = req.params;
  const { operator } = req.body;

  const result = menuVersionService.activateVersion(
    versionId,
    operator || 'API调用者'
  );
  
  res.json(result);
});

export default router;
