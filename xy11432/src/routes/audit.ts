import { Router, Request, Response } from 'express';
import {
  runAllAuditChecks,
  checkDuplicateImports,
  checkPermissionInterception,
  checkExceptionRetention,
  checkRestartHistory,
  checkExportConsistency,
  checkFrozenItems,
  checkOrphanedRecords,
} from '../services/audit';

const router = Router();

router.get('/all', (req: Request, res: Response) => {
  const results = runAllAuditChecks();
  res.json({
    success: true,
    data: results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
    },
  });
});

router.get('/duplicate-imports', (req: Request, res: Response) => {
  const result = checkDuplicateImports();
  res.json({
    success: true,
    data: result,
  });
});

router.get('/permission-interception', (req: Request, res: Response) => {
  const result = checkPermissionInterception();
  res.json({
    success: true,
    data: result,
  });
});

router.get('/exception-retention', (req: Request, res: Response) => {
  const result = checkExceptionRetention();
  res.json({
    success: true,
    data: result,
  });
});

router.get('/restart-history', (req: Request, res: Response) => {
  const result = checkRestartHistory();
  res.json({
    success: true,
    data: result,
  });
});

router.get('/export-consistency', (req: Request, res: Response) => {
  const result = checkExportConsistency();
  res.json({
    success: true,
    data: result,
  });
});

router.get('/frozen-items', (req: Request, res: Response) => {
  const result = checkFrozenItems();
  res.json({
    success: true,
    data: result,
  });
});

router.get('/orphaned-records', (req: Request, res: Response) => {
  const result = checkOrphanedRecords();
  res.json({
    success: true,
    data: result,
  });
});

export default router;
