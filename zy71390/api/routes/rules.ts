import { Router, type Request, type Response } from 'express';
import { RuleService } from '../services/RuleService.js';
import type {
  CreateRuleRequest,
  UpdateRuleRequest,
} from '../../shared/types.js';

const router = Router();

const getCurrentUser = (req: Request): string => {
  return (req.headers['x-user'] as string) || 'admin';
};

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const rules = RuleService.getRules();
    res.status(200).json({
      success: true,
      data: rules,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取规则列表失败',
    });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rule = RuleService.getRule(id);

    if (!rule) {
      res.status(404).json({
        success: false,
        error: '规则不存在',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取规则详情失败',
    });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CreateRuleRequest;
    const modifiedBy = getCurrentUser(req);

    if (!body.name || !body.path || !body.method || !body.windowSize || !body.limit || !body.tier || !body.changeReason) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段: name, path, method, windowSize, limit, tier, changeReason',
      });
      return;
    }

    if (typeof body.windowSize !== 'number' || body.windowSize <= 0) {
      res.status(400).json({
        success: false,
        error: 'windowSize 必须是大于 0 的数字',
      });
      return;
    }

    if (typeof body.limit !== 'number' || body.limit <= 0) {
      res.status(400).json({
        success: false,
        error: 'limit 必须是大于 0 的数字',
      });
      return;
    }

    const rule = RuleService.createRule(body, modifiedBy);

    res.status(201).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建规则失败',
    });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body as UpdateRuleRequest;
    const modifiedBy = getCurrentUser(req);

    if (!body.changeReason) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段: changeReason',
      });
      return;
    }

    const rule = RuleService.updateRule(id, body, modifiedBy);

    if (!rule) {
      res.status(404).json({
        success: false,
        error: '规则不存在',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新规则失败',
    });
  }
});

router.get('/:id/versions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const versions = RuleService.getRuleVersions(id);

    res.status(200).json({
      success: true,
      data: versions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取版本历史失败',
    });
  }
});

router.get('/:id/versions/:version', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, version } = req.params;
    const versionNum = parseInt(version, 10);

    if (isNaN(versionNum)) {
      res.status(400).json({
        success: false,
        error: '版本号必须是数字',
      });
      return;
    }

    const ruleVersion = RuleService.getRuleVersion(id, versionNum);

    if (!ruleVersion) {
      res.status(404).json({
        success: false,
        error: '版本不存在',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: ruleVersion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取版本详情失败',
    });
  }
});

router.post('/:id/rollback/:version', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, version } = req.params;
    const modifiedBy = getCurrentUser(req);
    const versionNum = parseInt(version, 10);
    const { reason } = req.body as { reason?: string };

    if (isNaN(versionNum)) {
      res.status(400).json({
        success: false,
        error: '版本号必须是数字',
      });
      return;
    }

    if (!reason) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段: reason',
      });
      return;
    }

    const rule = RuleService.rollbackRule(id, versionNum, modifiedBy, reason);

    if (!rule) {
      res.status(404).json({
        success: false,
        error: '规则或版本不存在',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '回滚版本失败',
    });
  }
});

export default router;
