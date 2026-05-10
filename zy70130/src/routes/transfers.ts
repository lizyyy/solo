import { Router, Request, Response } from 'express';
import { transferService } from '../services/transferService';
import { auditService } from '../services/auditService';
import { TransferStatus } from '../types';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { collectionId, fromUserId, toUserId, requestId } = req.body;
    if (!collectionId || !fromUserId || !toUserId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    const transfer = transferService.createTransfer({
      collectionId,
      fromUserId,
      toUserId,
      requestId,
    });
    res.json(transfer);
  } catch (error: any) {
    const riskCheck = (error as any).riskCheck;
    res.status(400).json({
      error: error.message,
      riskCheck,
    });
  }
});

router.get('/:transferId', (req: Request, res: Response) => {
  const detail = transferService.getTransferDetail(req.params.transferId);
  if (!detail) {
    return res.status(404).json({ error: '转赠记录不存在' });
  }
  res.json(detail);
});

router.post('/:transferId/approve', (req: Request, res: Response) => {
  try {
    const { operatorId } = req.body;
    if (!operatorId) {
      return res.status(400).json({ error: '缺少操作者ID' });
    }
    const transfer = transferService.approveTransfer(req.params.transferId, operatorId);
    res.json(transfer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:transferId/cancel', (req: Request, res: Response) => {
  try {
    const { operatorId } = req.body;
    if (!operatorId) {
      return res.status(400).json({ error: '缺少操作者ID' });
    }
    const transfer = transferService.cancelTransfer(req.params.transferId, operatorId);
    res.json(transfer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:transferId/revoke', (req: Request, res: Response) => {
  try {
    const { adminId, reason } = req.body;
    if (!adminId || !reason) {
      return res.status(400).json({ error: '缺少管理员ID或撤销原因' });
    }
    const transfer = transferService.revokeTransfer(
      req.params.transferId,
      adminId,
      reason
    );
    res.json(transfer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:transferId/status', (req: Request, res: Response) => {
  try {
    const { newStatus, adminId, reason } = req.body;
    if (!newStatus || !adminId || !reason) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    const validStatuses = Object.values(TransferStatus);
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: '无效的状态值' });
    }
    const transfer = transferService.manualCorrectTransfer(
      req.params.transferId,
      newStatus as TransferStatus,
      adminId,
      reason
    );
    res.json(transfer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:transferId/audit', (req: Request, res: Response) => {
  const logs = auditService.getAuditLogsByTarget('transfer', req.params.transferId);
  res.json(logs);
});

export default router;
