import { Router, type Request, type Response } from 'express';
import type { CodeReference, ScanTask, ScanConfig } from '../../src/types';

const router = Router();

const mockCodeReferences: CodeReference[] = [];
let mockScanTasks: ScanTask[] = [];

const generateId = () => Math.random().toString(36).substring(2, 11);

router.get('/references', (req: Request, res: Response) => {
  const { flagId, matchType, page = 1, pageSize = 20 } = req.query;
  
  let result = [...mockCodeReferences];
  
  if (flagId) {
    result = result.filter(r => r.flagId === flagId);
  }
  
  if (matchType) {
    const types = String(matchType).split(',');
    result = result.filter(r => types.includes(r.matchType));
  }
  
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

router.get('/references/:id', (req: Request, res: Response) => {
  const ref = mockCodeReferences.find(r => r.id === req.params.id);
  if (!ref) {
    return res.status(404).json({
      success: false,
      error: 'Code reference not found',
    });
  }
  res.json({
    success: true,
    data: ref,
  });
});

router.get('/tasks', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: mockScanTasks,
  });
});

router.get('/tasks/:id', (req: Request, res: Response) => {
  const task = mockScanTasks.find(t => t.id === req.params.id);
  if (!task) {
    return res.status(404).json({
      success: false,
      error: 'Scan task not found',
    });
  }
  res.json({
    success: true,
    data: task,
  });
});

router.post('/tasks', async (req: Request, res: Response) => {
  const config: ScanConfig = req.body;
  
  const task: ScanTask = {
    id: `scan-${generateId()}`,
    status: 'running',
    config,
    startedAt: new Date().toISOString(),
    progress: 0,
  };
  
  mockScanTasks = [task, ...mockScanTasks];
  
  res.status(201).json({
    success: true,
    data: task,
  });
  
  setTimeout(() => {
    const taskIndex = mockScanTasks.findIndex(t => t.id === task.id);
    if (taskIndex !== -1) {
      mockScanTasks[taskIndex] = {
        ...mockScanTasks[taskIndex],
        status: 'completed',
        progress: 100,
        finishedAt: new Date().toISOString(),
      };
    }
  }, 3000);
});

router.get('/statistics', (req: Request, res: Response) => {
  const stats = {
    totalReferences: mockCodeReferences.length,
    staticReferences: mockCodeReferences.filter(r => r.matchType === 'static').length,
    dynamicReferences: mockCodeReferences.filter(r => r.matchType === 'dynamic').length,
    suspectedReferences: mockCodeReferences.filter(r => r.matchType === 'suspected').length,
    completedTasks: mockScanTasks.filter(t => t.status === 'completed').length,
    runningTasks: mockScanTasks.filter(t => t.status === 'running').length,
    failedTasks: mockScanTasks.filter(t => t.status === 'failed').length,
  };
  
  res.json({
    success: true,
    data: stats,
  });
});

export default router;
