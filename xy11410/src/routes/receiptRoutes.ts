import { Router, Request, Response } from 'express';
import { receiptService } from '../services/ReceiptService';
import { stateMachineService } from '../services/StateMachineService';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const receipt = await receiptService.createReceipt(req.body);
    res.json({ success: true, data: receipt });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const receipt = await receiptService.getReceipt(req.params.id);
    if (!receipt) {
      return res.status(404).json({ success: false, error: '回执记录不存在' });
    }
    res.json({ success: true, data: receipt });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await receiptService.getReceiptList({
      franchiseId: req.query.franchiseId as string,
      status: req.query.status as any,
      recordStatus: req.query.recordStatus as any,
      batchId: req.query.batchId as string,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const result = await receiptService.submitForReview(
      req.params.id,
      req.body.operator
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/review', async (req: Request, res: Response) => {
  try {
    const { decision, reason, operator } = req.body;
    const result = await receiptService.reviewDecision(
      req.params.id,
      decision,
      reason,
      operator
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/freeze', async (req: Request, res: Response) => {
  try {
    const { reason, operator } = req.body;
    const result = await receiptService.freezeSettlement(
      req.params.id,
      reason,
      operator
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/unfreeze', async (req: Request, res: Response) => {
  try {
    const { reason, operator } = req.body;
    const result = await receiptService.unfreezeSettlement(
      req.params.id,
      reason,
      operator
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { reason, operator } = req.body;
    const result = await receiptService.cancelReceipt(
      req.params.id,
      reason,
      operator
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    const result = await receiptService.archiveReceipt(
      req.params.id,
      req.body.operator
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/correct', async (req: Request, res: Response) => {
  try {
    const { updateData, reason, operator } = req.body;
    const result = await receiptService.correctReceipt(
      req.params.id,
      updateData,
      reason,
      operator
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const history = await stateMachineService.getTransitionHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/attachments', async (req: Request, res: Response) => {
  try {
    const attachment = await receiptService.addAttachment(req.params.id, req.body);
    res.json({ success: true, data: attachment });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/attachments', async (req: Request, res: Response) => {
  try {
    const attachments = await receiptService.getAttachments(req.params.id);
    res.json({ success: true, data: attachments });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
