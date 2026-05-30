import { Router, type Request, type Response } from 'express';
import { CustomerService } from '../services/CustomerService.js';
import type {
  UpdateCustomerTierRequest,
  AddWhitelistRequest,
} from '../../shared/types.js';

const router = Router();

const getCurrentUser = (req: Request): string => {
  return (req.headers['x-user'] as string) || 'admin';
};

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const customers = CustomerService.getCustomers();
    res.status(200).json({
      success: true,
      data: customers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取客户列表失败',
    });
  }
});

router.put('/:id/tier', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body as UpdateCustomerTierRequest;
    const modifiedBy = getCurrentUser(req);

    if (!body.tier || !body.reason) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段: tier, reason',
      });
      return;
    }

    if (!['S', 'A', 'B', 'C'].includes(body.tier)) {
      res.status(400).json({
        success: false,
        error: 'tier 必须是 S, A, B, C 之一',
      });
      return;
    }

    const customer = CustomerService.updateCustomerTier(id, body.tier, body.reason, modifiedBy);

    if (!customer) {
      res.status(404).json({
        success: false,
        error: '客户不存在',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新客户层级失败',
    });
  }
});

router.get('/whitelist', async (req: Request, res: Response): Promise<void> => {
  try {
    const whitelist = CustomerService.getWhitelist();
    res.status(200).json({
      success: true,
      data: whitelist,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取白名单失败',
    });
  }
});

router.post('/whitelist', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as AddWhitelistRequest;
    const modifiedBy = getCurrentUser(req);

    if (!body.customerId || !body.reason) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段: customerId, reason',
      });
      return;
    }

    const customer = CustomerService.addToWhitelist(body, modifiedBy);

    if (!customer) {
      res.status(404).json({
        success: false,
        error: '客户不存在',
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '添加白名单失败',
    });
  }
});

router.delete('/whitelist/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const modifiedBy = getCurrentUser(req);
    const { reason } = req.body as { reason?: string };

    if (!reason) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段: reason',
      });
      return;
    }

    const customer = CustomerService.removeFromWhitelist(id, reason, modifiedBy);

    if (!customer) {
      res.status(404).json({
        success: false,
        error: '客户不存在',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { message: '已从白名单中移除' },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '移除白名单失败',
    });
  }
});

export default router;
