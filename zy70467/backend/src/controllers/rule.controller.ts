import { Request, Response } from 'express';
import { ruleEngineService } from '../services/ruleEngine.service';
import { asyncHandler } from '../middleware/errorHandler';

export const createRuleVersion = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, logic, createdBy } = req.body;
  const rule = await ruleEngineService.createRuleVersion({
    name,
    description,
    logic,
    createdBy: createdBy || 'admin',
  });
  res.status(201).json({ success: true, data: rule });
});

export const getActiveRule = asyncHandler(async (req: Request, res: Response) => {
  const rule = await ruleEngineService.getActiveRuleVersion();
  res.json({ success: true, data: rule });
});

export const getAllRules = asyncHandler(async (req: Request, res: Response) => {
  const rules = await ruleEngineService.getAllRuleVersions();
  res.json({ success: true, data: rules });
});

export const getRuleById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const rule = await ruleEngineService.getRuleVersionById(id);
  if (!rule) {
    return res.status(404).json({ success: false, error: '规则不存在' });
  }
  res.json({ success: true, data: rule });
});

export const toggleRuleStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const rule = await ruleEngineService.toggleRuleStatus(id, status);
  res.json({ success: true, data: rule });
});
