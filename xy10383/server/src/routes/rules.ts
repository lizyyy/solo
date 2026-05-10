import { Router, Request, Response } from 'express';
import { AssignmentRuleModel } from '../models/AssignmentRule';
import { IAssignmentRule } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const rules = await AssignmentRuleModel.find().sort({ priority: -1 }).lean();
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('获取分配规则列表失败:', error);
    res.status(500).json({ error: '获取分配规则列表失败' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, enabled, priority, conditions, actions } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '缺少规则名称' });
    }

    const newRule: Partial<IAssignmentRule> = {
      id: uuidv4(),
      name,
      description: description || '',
      enabled: enabled !== false,
      priority: priority || 0,
      conditions: conditions || {},
      actions: actions || { autoAssign: true, needsReview: false }
    };

    const created = await AssignmentRuleModel.create(newRule);
    res.json({ success: true, data: created.toObject() });
  } catch (error) {
    console.error('创建分配规则失败:', error);
    res.status(500).json({ error: '创建分配规则失败' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, enabled, priority, conditions, actions } = req.body;
    
    const update: any = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (enabled !== undefined) update.enabled = enabled;
    if (priority !== undefined) update.priority = priority;
    if (conditions !== undefined) update.conditions = conditions;
    if (actions !== undefined) update.actions = actions;

    const updated = await AssignmentRuleModel.findOneAndUpdate(
      { id: req.params.id },
      { $set: update },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: '分配规则不存在' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('更新分配规则失败:', error);
    res.status(500).json({ error: '更新分配规则失败' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await AssignmentRuleModel.deleteOne({ id: req.params.id });
    
    if (deleted.deletedCount === 0) {
      return res.status(404).json({ error: '分配规则不存在' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('删除分配规则失败:', error);
    res.status(500).json({ error: '删除分配规则失败' });
  }
});

export default router;
