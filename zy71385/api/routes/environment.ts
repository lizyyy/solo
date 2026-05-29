import { Router, type Request, type Response } from 'express';
import type { EnvironmentStatus } from '../../src/types';

const router = Router();

const mockEnvironmentStatuses: EnvironmentStatus[] = [];

router.get('/', (req: Request, res: Response) => {
  const { flagId, environment } = req.query;
  
  let result = [...mockEnvironmentStatuses];
  
  if (flagId) {
    result = result.filter(e => e.flagId === flagId);
  }
  
  if (environment) {
    result = result.filter(e => e.environment === environment);
  }
  
  res.json({
    success: true,
    data: result,
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const status = mockEnvironmentStatuses.find(e => e.id === req.params.id);
  if (!status) {
    return res.status(404).json({
      success: false,
      error: 'Environment status not found',
    });
  }
  res.json({
    success: true,
    data: status,
  });
});

router.put('/:id', (req: Request, res: Response) => {
  const index = mockEnvironmentStatuses.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Environment status not found',
    });
  }
  const updated = {
    ...mockEnvironmentStatuses[index],
    ...req.body,
    lastChecked: new Date().toISOString(),
  };
  mockEnvironmentStatuses[index] = updated;
  res.json({
    success: true,
    data: updated,
  });
});

router.get('/compare/:flagId', (req: Request, res: Response) => {
  const statuses = mockEnvironmentStatuses.filter(e => e.flagId === req.params.flagId);
  
  const inconsistencies: string[] = [];
  
  if (statuses.length >= 2) {
    const first = statuses[0];
    statuses.slice(1).forEach(status => {
      if (status.enabled !== first.enabled) {
        inconsistencies.push(`开关状态在 ${status.environment} 环境与 ${first.environment} 环境不一致`);
      }
      if (status.value !== first.value) {
        inconsistencies.push(`开关值在 ${status.environment} 环境与 ${first.environment} 环境不一致`);
      }
      if (Math.abs(status.grayPercentage - first.grayPercentage) > 0.01) {
        inconsistencies.push(`灰度比例在 ${status.environment} 环境与 ${first.environment} 环境不一致`);
      }
    });
  }
  
  const maxGrayUsers = Math.max(...statuses.map(s => s.grayUsers), 0);
  
  res.json({
    success: true,
    data: {
      statuses,
      hasInconsistencies: inconsistencies.length > 0,
      inconsistencies,
      maxGrayUsers,
      hasGrayUsers: maxGrayUsers > 0,
      allEnabled: statuses.every(s => s.enabled && s.grayPercentage === 100),
    },
  });
});

router.get('/statistics', (req: Request, res: Response) => {
  const totalFlags = new Set(mockEnvironmentStatuses.map(e => e.flagId)).size;
  const withGrayUsers = new Set(
    mockEnvironmentStatuses.filter(e => e.grayUsers > 0).map(e => e.flagId)
  ).size;
  const inconsistentFlags = new Set(
    mockEnvironmentStatuses
      .filter(e => e.environment === 'production')
      .filter(e => {
        const devStatus = mockEnvironmentStatuses.find(
          s => s.flagId === e.flagId && s.environment === 'dev'
        );
        return devStatus && (devStatus.enabled !== e.enabled || devStatus.value !== e.value);
      })
      .map(e => e.flagId)
  ).size;
  
  const byEnvironment: Record<string, { enabled: number; disabled: number; total: number }> = {
    dev: { enabled: 0, disabled: 0, total: 0 },
    staging: { enabled: 0, disabled: 0, total: 0 },
    production: { enabled: 0, disabled: 0, total: 0 },
  };
  
  mockEnvironmentStatuses.forEach(e => {
    byEnvironment[e.environment].total++;
    if (e.enabled) {
      byEnvironment[e.environment].enabled++;
    } else {
      byEnvironment[e.environment].disabled++;
    }
  });
  
  res.json({
    success: true,
    data: {
      totalFlags,
      withGrayUsers,
      inconsistentFlags,
      byEnvironment,
      totalGrayUsers: mockEnvironmentStatuses.reduce((sum, e) => sum + e.grayUsers, 0),
    },
  });
});

export default router;
