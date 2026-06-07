import { Router, Request, Response } from 'express';
import { listRules, getRule, toggleRule } from '../services/ruleService.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const rules = listRules();
  res.json({ data: rules });
});

router.get('/:id', (req: Request, res: Response) => {
  const rule = getRule(req.params.id);
  if (!rule) {
    return res.status(404).json({
      error: {
        code: 'RULE_NOT_FOUND',
        message: '找不到对应的边界规则',
        suggestion: '请检查规则ID，或在规则配置页面查看可用规则',
      },
    });
  }
  res.json({ data: rule });
});

router.post('/:id/toggle', (req: Request, res: Response) => {
  const { isActive } = req.body;
  const success = toggleRule(req.params.id, isActive);
  if (!success) {
    return res.status(404).json({
      error: {
        code: 'RULE_NOT_FOUND',
        message: '找不到对应的边界规则',
        suggestion: '请检查规则ID，或在规则配置页面查看可用规则',
      },
    });
  }
  res.json({ data: { success: true } });
});

export default router;
