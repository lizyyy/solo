import { Router, Request, Response } from 'express';
import { WithdrawalService } from '../services/withdrawalService';

export function createWithdrawalRouter(withdrawalService: WithdrawalService): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { groupCreditId, subAccountId, amount, idempotencyKey } = req.body;
      
      if (!idempotencyKey) {
        return res.status(400).json({
          success: false,
          message: '缺少幂等键。请在请求头或请求体中提供 idempotencyKey'
        });
      }

      const result = await withdrawalService.withdraw(
        groupCreditId,
        subAccountId,
        amount,
        idempotencyKey
      );

      const statusCode = result.isDuplicate ? 200 : 201;
      res.status(statusCode).json({
        success: true,
        data: {
          withdrawal: result.withdrawal,
          isDuplicate: result.isDuplicate
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '提款失败';
      const isClientError = message.includes('缺少') || 
                           message.includes('额度不足') || 
                           message.includes('已停用') ||
                           message.includes('不属于该集团');
      
      res.status(isClientError ? 400 : 500).json({
        success: false,
        message
      });
    }
  });

  router.get('/:withdrawalId', async (req: Request, res: Response) => {
    try {
      const { withdrawalId } = req.params;
      const withdrawal = await withdrawalService.getWithdrawalById(withdrawalId);
      res.json({
        success: true,
        data: withdrawal
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : '查询失败'
      });
    }
  });

  router.get('/sub-account/:subAccountId', async (req: Request, res: Response) => {
    try {
      const { subAccountId } = req.params;
      const withdrawals = await withdrawalService.getWithdrawalsBySubAccount(subAccountId);
      res.json({
        success: true,
        data: withdrawals
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '查询失败'
      });
    }
  });

  router.get('/idempotency/:key', async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const withdrawal = await withdrawalService.getByIdempotencyKey(key);
      if (withdrawal) {
        res.json({
          success: true,
          data: {
            exists: true,
            withdrawal
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            exists: false,
            withdrawal: null
          }
        });
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '查询失败'
      });
    }
  });

  return router;
}
