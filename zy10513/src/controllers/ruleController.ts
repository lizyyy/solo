import { Request, Response } from 'express';
import { RuleService } from '../services/RuleService';

const ruleService = new RuleService();

export const createRule = async (req: Request, res: Response) => {
  try {
    const rule = await ruleService.createRule(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getRule = async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    const rule = await ruleService.getRuleById(ruleId);
    if (!rule) {
      return res.status(404).json({ success: false, message: '规则不存在' });
    }
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const listRules = async (req: Request, res: Response) => {
  try {
    const { isActive, page, pageSize } = req.query;
    const result = await ruleService.listRules({
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const updateRule = async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    const rule = await ruleService.updateRule(ruleId, req.body);
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const deleteRule = async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    await ruleService.deleteRule(ruleId);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};
