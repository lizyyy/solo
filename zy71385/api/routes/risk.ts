import { Router, type Request, type Response } from 'express';
import type { RiskAssessment, RuleConfig } from '../../src/types';
import { assessRisk, getDefaultRules } from '../../src/utils/riskCalculator';

const router = Router();

const mockRiskAssessments: RiskAssessment[] = [];
const mockRules: RuleConfig[] = getDefaultRules();

router.get('/assessments', (req: Request, res: Response) => {
  const { flagId, level } = req.query;
  
  let result = [...mockRiskAssessments];
  
  if (flagId) {
    result = result.filter(a => a.flagId === flagId);
  }
  
  if (level) {
    const levels = String(level).split(',');
    result = result.filter(a => levels.includes(a.level));
  }
  
  res.json({
    success: true,
    data: result,
  });
});

router.get('/assessments/:id', (req: Request, res: Response) => {
  const assessment = mockRiskAssessments.find(a => a.id === req.params.id);
  if (!assessment) {
    return res.status(404).json({
      success: false,
      error: 'Risk assessment not found',
    });
  }
  res.json({
    success: true,
    data: assessment,
  });
});

router.post('/assess', (req: Request, res: Response) => {
  const { flag, codeReferences, environmentStatuses } = req.body;
  
  const assessment = assessRisk(flag, codeReferences, environmentStatuses, mockRules);
  
  const existingIndex = mockRiskAssessments.findIndex(a => a.flagId === flag.id);
  if (existingIndex !== -1) {
    mockRiskAssessments[existingIndex] = assessment;
  } else {
    mockRiskAssessments.push(assessment);
  }
  
  res.json({
    success: true,
    data: assessment,
  });
});

router.post('/assess-all', (req: Request, res: Response) => {
  const { flags, codeReferences, environmentStatuses } = req.body;
  
  const assessments = flags.map((flag: any) => {
    const refs = codeReferences.filter((r: any) => r.flagId === flag.id);
    const envs = environmentStatuses.filter((e: any) => e.flagId === flag.id);
    const assessment = assessRisk(flag, refs, envs, mockRules);
    
    const existingIndex = mockRiskAssessments.findIndex(a => a.flagId === flag.id);
    if (existingIndex !== -1) {
      mockRiskAssessments[existingIndex] = assessment;
    } else {
      mockRiskAssessments.push(assessment);
    }
    
    return assessment;
  });
  
  res.json({
    success: true,
    data: assessments,
    count: assessments.length,
  });
});

router.get('/rules', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: mockRules,
  });
});

router.put('/rules/:ruleKey', (req: Request, res: Response) => {
  const { value } = req.body;
  const index = mockRules.findIndex(r => r.ruleKey === req.params.ruleKey);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Rule not found',
    });
  }
  
  mockRules[index] = {
    ...mockRules[index],
    value,
    updatedAt: new Date().toISOString(),
  };
  
  res.json({
    success: true,
    data: mockRules[index],
  });
});

router.post('/rules/:ruleKey/toggle', (req: Request, res: Response) => {
  const index = mockRules.findIndex(r => r.ruleKey === req.params.ruleKey);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Rule not found',
    });
  }
  
  mockRules[index] = {
    ...mockRules[index],
    enabled: !mockRules[index].enabled,
    updatedAt: new Date().toISOString(),
  };
  
  res.json({
    success: true,
    data: mockRules[index],
  });
});

router.get('/statistics', (req: Request, res: Response) => {
  const byLevel: Record<string, number> = {
    low: 0,
    medium: 0,
    high: 0,
    blocker: 0,
  };
  
  mockRiskAssessments.forEach(a => {
    byLevel[a.level]++;
  });
  
  const withDynamicRef = mockRiskAssessments.filter(a => 
    a.reasons.some(r => r.code === 'DYNAMIC_REF_DETECTED' || r.code === 'SUSPECTED_DYNAMIC_REF')
  ).length;
  
  const withGrayUsers = mockRiskAssessments.filter(a => 
    a.reasons.some(r => r.code === 'HIGH_GRAY_USERS' || r.code === 'GRAY_USERS_EXIST')
  ).length;
  
  const missingOwner = mockRiskAssessments.filter(a => 
    a.reasons.some(r => r.code === 'MISSING_OWNER')
  ).length;
  
  const safeToDelete = mockRiskAssessments.filter(a => 
    a.suggestedAction === 'safe_delete'
  ).length;
  
  res.json({
    success: true,
    data: {
      byLevel,
      withDynamicRef,
      withGrayUsers,
      missingOwner,
      safeToDelete,
      totalAssessments: mockRiskAssessments.length,
      enabledRules: mockRules.filter(r => r.enabled).length,
      totalRules: mockRules.length,
    },
  });
});

export default router;
