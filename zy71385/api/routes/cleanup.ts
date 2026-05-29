import { Router, type Request, type Response } from 'express';
import type { CleanupLog } from '../../src/types';

const router = Router();

let mockCleanupLogs: CleanupLog[] = [];

const generateId = () => Math.random().toString(36).substring(2, 11);

router.get('/logs', (req: Request, res: Response) => {
  const { flagId, action, page = 1, pageSize = 20 } = req.query;
  
  let result = [...mockCleanupLogs];
  
  if (flagId) {
    result = result.filter(l => l.flagId === flagId);
  }
  
  if (action) {
    const actions = String(action).split(',');
    result = result.filter(l => actions.includes(l.action));
  }
  
  result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  const total = result.length;
  const start = (Number(page) - 1) * Number(pageSize);
  const end = start + Number(pageSize);
  const paginated = result.slice(start, end);
  
  res.json({
    success: true,
    data: paginated,
    pagination: {
      page: Number(page),
      pageSize: Number(pageSize),
      total,
      totalPages: Math.ceil(total / Number(pageSize)),
    },
  });
});

router.get('/logs/:id', (req: Request, res: Response) => {
  const log = mockCleanupLogs.find(l => l.id === req.params.id);
  if (!log) {
    return res.status(404).json({
      success: false,
      error: 'Cleanup log not found',
    });
  }
  res.json({
    success: true,
    data: log,
  });
});

router.post('/execute', (req: Request, res: Response) => {
  const { flagIds, note, operator = '当前用户' } = req.body;
  const now = new Date().toISOString();
  
  const logs: CleanupLog[] = flagIds.map((flagId: string) => ({
    id: `log-${generateId()}`,
    flagId,
    action: 'delete',
    operator,
    timestamp: now,
    beforeSnapshot: req.body.flags?.find((f: any) => f.id === flagId) || {},
    afterSnapshot: { ...req.body.flags?.find((f: any) => f.id === flagId), status: 'inactive' },
    note: note || '批量清理过期开关',
  }));
  
  mockCleanupLogs = [...logs, ...mockCleanupLogs];
  
  res.json({
    success: true,
    data: logs,
    count: logs.length,
  });
});

router.post('/rollback/:logId', (req: Request, res: Response) => {
  const log = mockCleanupLogs.find(l => l.id === req.params.logId);
  if (!log) {
    return res.status(404).json({
      success: false,
      error: 'Cleanup log not found',
    });
  }
  
  const rollbackLog: CleanupLog = {
    id: `log-${generateId()}`,
    flagId: log.flagId,
    action: 'rollback',
    operator: req.body.operator || '当前用户',
    timestamp: new Date().toISOString(),
    beforeSnapshot: log.afterSnapshot,
    afterSnapshot: log.beforeSnapshot,
    note: '回滚清理操作',
  };
  
  mockCleanupLogs = [rollbackLog, ...mockCleanupLogs];
  
  res.json({
    success: true,
    data: rollbackLog,
    restoredData: log.beforeSnapshot,
  });
});

router.get('/deletion-list', (req: Request, res: Response) => {
  const { flags, assessments } = req.body;
  
  const safeToDelete = flags.filter((f: any) => {
    const assessment = assessments.find((a: any) => a.flagId === f.id);
    return assessment?.suggestedAction === 'safe_delete';
  });
  
  const needVerify = flags.filter((f: any) => {
    const assessment = assessments.find((a: any) => a.flagId === f.id);
    return assessment?.suggestedAction === 'verify_first';
  });
  
  const doNotDelete = flags.filter((f: any) => {
    const assessment = assessments.find((a: any) => a.flagId === f.id);
    return assessment?.suggestedAction === 'do_not_delete';
  });
  
  res.json({
    success: true,
    data: {
      safeToDelete,
      needVerify,
      doNotDelete,
      summary: {
        total: flags.length,
        safeToDelete: safeToDelete.length,
        needVerify: needVerify.length,
        doNotDelete: doNotDelete.length,
      },
    },
  });
});

router.get('/statistics', (req: Request, res: Response) => {
  const today = new Date().toDateString();
  
  const todayDeleted = mockCleanupLogs.filter(
    l => l.action === 'delete' && new Date(l.timestamp).toDateString() === today
  ).length;
  
  const todayRollback = mockCleanupLogs.filter(
    l => l.action === 'rollback' && new Date(l.timestamp).toDateString() === today
  ).length;
  
  const totalDeleted = mockCleanupLogs.filter(l => l.action === 'delete').length;
  const totalRollback = mockCleanupLogs.filter(l => l.action === 'rollback').length;
  
  const byOperator: Record<string, number> = {};
  mockCleanupLogs.forEach(l => {
    byOperator[l.operator] = (byOperator[l.operator] || 0) + 1;
  });
  
  res.json({
    success: true,
    data: {
      todayDeleted,
      todayRollback,
      totalDeleted,
      totalRollback,
      byOperator,
      totalLogs: mockCleanupLogs.length,
    },
  });
});

export default router;
