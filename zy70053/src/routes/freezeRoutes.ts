import { Router, Request, Response } from 'express';
import { FreezeService } from '../services/freezeService';

export function createFreezeRouter(freezeService: FreezeService): Router {
  const router = Router();

  router.post('/freeze', async (req: Request, res: Response) => {
    try {
      const { groupCreditId, amount, reason, subAccountId } = req.body;
      
      const freezeRecord = await freezeService.freeze(
        groupCreditId,
        amount,
        reason,
        subAccountId
      );

      res.status(201).json({
        success: true,
        data: freezeRecord
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '冻结失败';
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

  router.post('/unfreeze', async (req: Request, res: Response) => {
    try {
      const { freezeRecordId } = req.body;
      
      const freezeRecord = await freezeService.unfreeze(freezeRecordId);

      res.json({
        success: true,
        data: freezeRecord
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '解冻失败';
      const isClientError = message.includes('缺少') || 
                           message.includes('已释放') ||
                           message.includes('不存在');
      
      res.status(isClientError ? 400 : 500).json({
        success: false,
        message
      });
    }
  });

  router.get('/:freezeRecordId', async (req: Request, res: Response) => {
    try {
      const { freezeRecordId } = req.params;
      const freezeRecord = await freezeService.getFreezeRecordById(freezeRecordId);
      res.json({
        success: true,
        data: freezeRecord
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : '查询失败'
      });
    }
  });

  router.get('/active/group/:groupCreditId', async (req: Request, res: Response) => {
    try {
      const { groupCreditId } = req.params;
      const freezeRecords = await freezeService.getActiveFreezes(groupCreditId);
      res.json({
        success: true,
        data: freezeRecords
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '查询失败'
      });
    }
  });

  router.get('/active/sub-account/:subAccountId', async (req: Request, res: Response) => {
    try {
      const { subAccountId } = req.params;
      const freezeRecords = await freezeService.getActiveFreezesBySubAccount(subAccountId);
      res.json({
        success: true,
        data: freezeRecords
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '查询失败'
      });
    }
  });

  return router;
}
