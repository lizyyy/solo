import { Router, Request, Response } from 'express';
import { CreditService } from '../services/creditService';

export function createCreditRouter(creditService: CreditService): Router {
  const router = Router();

  router.post('/groups', async (req: Request, res: Response) => {
    try {
      const { name, totalLimit } = req.body;
      const groupCredit = await creditService.createGroupCredit(name, totalLimit);
      res.status(201).json({
        success: true,
        data: groupCredit
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '创建集团额度失败'
      });
    }
  });

  router.post('/groups/:groupId/sub-accounts', async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const { name } = req.body;
      const subAccount = await creditService.createSubAccount(groupId, name);
      res.status(201).json({
        success: true,
        data: subAccount
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '创建子账户失败'
      });
    }
  });

  router.get('/groups/:groupId', async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const data = await creditService.getGroupCreditWithSubAccounts(groupId);
      res.json({
        success: true,
        data: {
          groupCredit: data.groupCredit,
          subAccounts: data.subAccounts
        }
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : '查询失败'
      });
    }
  });

  router.put('/groups/:groupId/limit', async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const { newTotalLimit } = req.body;
      const groupCredit = await creditService.adjustGroupLimit(groupId, newTotalLimit);
      res.json({
        success: true,
        data: groupCredit
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '调整额度失败'
      });
    }
  });

  router.get('/sub-accounts/:subAccountId', async (req: Request, res: Response) => {
    try {
      const { subAccountId } = req.params;
      const subAccount = await creditService.getSubAccountById(subAccountId);
      res.json({
        success: true,
        data: subAccount
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : '查询失败'
      });
    }
  });

  return router;
}
