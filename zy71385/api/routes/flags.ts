import { Router, type Request, type Response } from 'express';
import type { FeatureFlag, FlagWithDetails } from '../../src/types';

const router = Router();

let mockFlags: FlagWithDetails[] = [];

const generateId = () => Math.random().toString(36).substring(2, 11);

router.get('/', (req: Request, res: Response) => {
  const { page = 1, pageSize = 10, search, riskLevel, status, owner } = req.query;
  
  let result = [...mockFlags];
  
  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter(f => 
      f.name.toLowerCase().includes(q) ||
      f.key.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      (f.owner && f.owner.toLowerCase().includes(q))
    );
  }
  
  if (riskLevel) {
    const levels = String(riskLevel).split(',');
    result = result.filter(f => f.riskLevel && levels.includes(f.riskLevel));
  }
  
  if (status) {
    const statuses = String(status).split(',');
    result = result.filter(f => statuses.includes(f.status));
  }
  
  if (owner) {
    result = result.filter(f => f.owner === owner);
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

router.get('/:id', (req: Request, res: Response) => {
  const flag = mockFlags.find(f => f.id === req.params.id);
  if (!flag) {
    return res.status(404).json({
      success: false,
      error: 'Flag not found',
    });
  }
  res.json({
    success: true,
    data: flag,
  });
});

router.post('/', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const newFlag: FlagWithDetails = {
    ...req.body,
    id: `flag-${generateId()}`,
    createdAt: now,
    updatedAt: now,
    codeReferences: [],
    environmentStatuses: [],
    riskReasons: [],
  };
  mockFlags = [newFlag, ...mockFlags];
  res.status(201).json({
    success: true,
    data: newFlag,
  });
});

router.put('/:id', (req: Request, res: Response) => {
  const index = mockFlags.findIndex(f => f.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Flag not found',
    });
  }
  const updatedFlag = {
    ...mockFlags[index],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  mockFlags[index] = updatedFlag;
  res.json({
    success: true,
    data: updatedFlag,
  });
});

router.delete('/:id', (req: Request, res: Response) => {
  const index = mockFlags.findIndex(f => f.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Flag not found',
    });
  }
  const deletedFlag = mockFlags[index];
  mockFlags = mockFlags.filter(f => f.id !== req.params.id);
  res.json({
    success: true,
    data: deletedFlag,
  });
});

router.post('/bulk-delete', (req: Request, res: Response) => {
  const { ids } = req.body;
  const deleted = mockFlags.filter(f => ids.includes(f.id));
  mockFlags = mockFlags.filter(f => !ids.includes(f.id));
  res.json({
    success: true,
    data: deleted,
    count: deleted.length,
  });
});

router.get('/statistics', (req: Request, res: Response) => {
  const byRiskLevel: Record<string, number> = {
    low: 0,
    medium: 0,
    high: 0,
    blocker: 0,
  };
  
  let safeToDelete = 0;
  let highRisk = 0;
  let pending = 0;
  
  mockFlags.forEach(f => {
    if (f.riskLevel) {
      byRiskLevel[f.riskLevel]++;
      if (f.suggestedAction === 'safe_delete') safeToDelete++;
      if (f.riskLevel === 'high' || f.riskLevel === 'blocker') highRisk++;
      if (f.status === 'pending_cleanup') pending++;
    }
  });
  
  res.json({
    success: true,
    data: {
      total: mockFlags.length,
      safeToDelete,
      highRisk,
      pending,
      byRiskLevel,
    },
  });
});

export default router;
