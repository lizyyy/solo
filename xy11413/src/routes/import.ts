import { Router } from 'express';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import {
  createImportSource,
  importOrderItems,
  importWasteRecords,
  importHeadquarterPrices,
  importSupplementRecords
} from '../services/importService';
import { SourceType } from '../types';

const router = Router();

router.post('/:sourceType', authenticate, requirePermission('import'), async (req: AuthenticatedRequest, res) => {
  try {
    const sourceType = req.params.sourceType as SourceType;
    const { fileName, records } = req.body;
    const importedBy = req.user?.username || 'system';

    if (!['order', 'waste', 'price', 'supplement'].includes(sourceType)) {
      res.status(400).json({ error: '无效的数据源类型', code: 'INVALID_SOURCE_TYPE' });
      return;
    }

    if (!fileName || !records || !Array.isArray(records)) {
      res.status(400).json({ error: '缺少必要参数', code: 'MISSING_PARAMS' });
      return;
    }

    const fileContent = JSON.stringify(records);
    const sourceId = await createImportSource(fileName, fileContent, sourceType, importedBy);

    let result;
    switch (sourceType) {
      case 'order':
        result = await importOrderItems(sourceId, records, fileName);
        break;
      case 'waste':
        result = await importWasteRecords(sourceId, records, fileName);
        break;
      case 'price':
        result = await importHeadquarterPrices(sourceId, records, fileName);
        break;
      case 'supplement':
        result = await importSupplementRecords(sourceId, records, fileName);
        break;
    }

    res.json({
      success: true,
      data: {
        ...result,
        sourceType,
        fileName,
        importedBy
      }
    });
  } catch (error) {
    console.error('导入失败:', error);
    res.status(500).json({ 
      error: '导入失败', 
      code: 'IMPORT_FAILED',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

export default router;
