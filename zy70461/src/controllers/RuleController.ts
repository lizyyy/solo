import { Request, Response } from 'express';
import { RuleVersionDAO } from '../models/RuleVersionDAO';
import { RuleEngineService } from '../services/RuleEngineService';

export class RuleController {
  static createRule(req: Request, res: Response) {
    try {
      const { version, name, description, rules, effectiveFrom } = req.body;
      const createdBy = req.headers['x-user'] as string || 'system';

      const rule = RuleEngineService.createNewRuleVersion(
        version,
        name,
        description,
        rules,
        new Date(effectiveFrom),
        createdBy
      );

      res.status(201).json({ success: true, data: rule });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static getRule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const rule = RuleVersionDAO.getById(id);
      
      if (!rule) {
        return res.status(404).json({ success: false, error: '规则不存在' });
      }

      res.json({ success: true, data: rule });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static getActiveRule(req: Request, res: Response) {
    try {
      const rule = RuleVersionDAO.getActiveRule();
      res.json({ success: true, data: rule });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static getAllRules(req: Request, res: Response) {
    try {
      const rules = RuleVersionDAO.getAll();
      res.json({ success: true, data: rules });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static getRuleByDate(req: Request, res: Response) {
    try {
      const { date } = req.query;
      const rule = RuleVersionDAO.getByDate(new Date(date as string));
      res.json({ success: true, data: rule });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
