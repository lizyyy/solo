import express, { Request, Response, Router } from 'express';
import {
  createRetestRule,
  getRetestRules,
  getRetestRuleById,
  updateRetestRule,
  deleteRetestRule,
} from '../services/retestRuleService';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      rule_code,
      rule_name,
      item_code,
      fail_threshold,
      retest_count,
      retest_window_hours,
      action_on_fail,
      description,
      is_active,
    } = req.body;

    if (!rule_code || !rule_name) {
      return res.status(400).json({ error: '缺少必填字段: rule_code, rule_name' });
    }

    const rule = await createRetestRule({
      rule_code,
      rule_name,
      item_code,
      fail_threshold,
      retest_count: retest_count || 1,
      retest_window_hours: retest_window_hours || 24,
      action_on_fail: action_on_fail || 'review',
      description,
      is_active: is_active !== undefined ? is_active : true,
    });

    res.status(201).json({ success: true, rule });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.active === 'true';
    const rules = await getRetestRules(activeOnly);
    res.json(rules);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const rule = await getRetestRuleById(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: '复检规则不存在' });
    }
    res.json(rule);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updated = await updateRetestRule(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: '复检规则不存在' });
    }
    res.json({ success: true, rule: updated });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const success = await deleteRetestRule(req.params.id);
    if (!success) {
      return res.status(404).json({ error: '复检规则不存在' });
    }
    res.json({ success: true, message: '复检规则已删除' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
