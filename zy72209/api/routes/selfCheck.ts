import express from 'express';
import { selfCheckService } from '../services/selfCheckService';
import type { SelfCheckType } from '../../shared/types';
import crypto from 'crypto';

const router = express.Router();

router.get('/', async (req, res) => {
  const checksParam = req.query.checks as string;
  let results;
  
  if (checksParam) {
    const checkTypes = checksParam.split(',') as SelfCheckType[];
    results = await Promise.all(checkTypes.map(check => selfCheckService.runCheck(check)));
  } else {
    results = await selfCheckService.runAllChecks();
  }
  
  res.json({
    success: true,
    data: results,
    timestamp: new Date().toISOString(),
    dataHash: crypto.createHash('md5').update(JSON.stringify(results)).digest('hex')
  });
});

router.get('/:checkType', async (req, res) => {
  const checkType = req.params.checkType as SelfCheckType;
  
  const validTypes: SelfCheckType[] = ['duplicate_import', 'name_inconsistency', 'recalculation', 'export_consistency'];
  
  if (!validTypes.includes(checkType)) {
    return res.status(400).json({
      success: false,
      message: `无效的检查类型，有效值: ${validTypes.join(', ')}`,
      timestamp: new Date().toISOString(),
      dataHash: ''
    });
  }
  
  const result = await selfCheckService.runCheck(checkType);
  
  res.json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
    dataHash: crypto.createHash('md5').update(JSON.stringify(result)).digest('hex')
  });
});

export default router;
