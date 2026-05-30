import { Router, type Request, type Response } from 'express';
import { ModificationService } from '../services/ModificationService.js';
import type { EntityType } from '../../shared/types.js';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { entityType, entityId } = req.query as {
      entityType?: EntityType;
      entityId?: string;
    };

    if (entityType && !['rule', 'customer', 'whitelist'].includes(entityType)) {
      res.status(400).json({
        success: false,
        error: 'entityType 必须是 rule, customer, whitelist 之一',
      });
      return;
    }

    const modifications = ModificationService.getModifications(entityType, entityId);

    res.status(200).json({
      success: true,
      data: modifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取修改历史失败',
    });
  }
});

export default router;
