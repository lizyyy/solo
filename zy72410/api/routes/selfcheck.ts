import express from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db/init.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { TrackRepository } from '../repositories/TrackRepository.js';
import { ChangeRepository } from '../repositories/ChangeRepository.js';
import { SelfCheckService } from '../services/SelfCheckService.js';
import type { ApiResponse, SelfCheckResult, SelfCheckType } from '../../shared/types.js';

const router = express.Router();

const db = getDb();
const materialRepo = new MaterialRepository(db);
const trackRepo = new TrackRepository(db);
const changeRepo = new ChangeRepository(db);
const selfCheckService = new SelfCheckService(materialRepo, trackRepo, changeRepo);

router.get('/run-all', async (req: Request, res: Response) => {
  try {
    const results = selfCheckService.runAllChecks();
    const allPassed = results.every(r => r.passed);

    res.json({
      success: true,
      data: results,
      message: allPassed ? '所有自检项通过' : `检测到${results.reduce((acc, r) => acc + r.issue_count, 0)}个问题`
    } as ApiResponse<SelfCheckResult[]>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.get('/:check_type', async (req: Request, res: Response) => {
  try {
    const { check_type } = req.params;
    let result: SelfCheckResult;

    switch (check_type) {
      case 'duplicate':
        result = selfCheckService.checkDuplicateImport();
        break;
      case 'rework':
        result = selfCheckService.checkReworkReasons();
        break;
      case 'recalculate':
        result = selfCheckService.checkRecalculate();
        break;
      case 'export':
        result = selfCheckService.checkExportConsistency();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: '无效的检查类型'
        } as ApiResponse<null>);
    }

    res.json({
      success: true,
      data: result
    } as ApiResponse<SelfCheckResult>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

export default router;
