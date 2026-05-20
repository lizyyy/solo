import { Router, Request, Response } from 'express';
import { reviewService } from '../services/reviewService';

const router = Router();

router.post('/records/:id/approve', async (req: Request, res: Response) => {
  try {
    const { userId, userName, comment } = req.body;

    const updated = await reviewService.approveRecord(
      req.params.id,
      userId,
      userName,
      comment || ''
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: '账单记录不存在' });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/records/:id/reject', async (req: Request, res: Response) => {
  try {
    const { userId, userName, comment } = req.body;

    const updated = await reviewService.rejectRecord(
      req.params.id,
      userId,
      userName,
      comment || ''
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: '账单记录不存在' });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/records/:id/request-info', async (req: Request, res: Response) => {
  try {
    const { userId, userName, comment } = req.body;

    const updated = await reviewService.requestMoreInfo(
      req.params.id,
      userId,
      userName,
      comment || ''
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: '账单记录不存在' });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/records/:id/modify', async (req: Request, res: Response) => {
  try {
    const { userId, userName, comment, modifications } = req.body;

    const updated = await reviewService.modifyRecord(
      req.params.id,
      userId,
      userName,
      comment || '',
      modifications
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: '账单记录不存在' });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/records/:id/comment', async (req: Request, res: Response) => {
  try {
    const { userId, userName, comment } = req.body;

    const updated = await reviewService.addComment(
      req.params.id,
      userId,
      userName,
      comment || ''
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: '账单记录不存在' });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/records/:id/history', async (req: Request, res: Response) => {
  try {
    const history = reviewService.getReviewHistory(req.params.id);

    if (!history) {
      return res.status(404).json({ success: false, error: '账单记录不存在' });
    }

    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/pending', async (req: Request, res: Response) => {
  try {
    const records = reviewService.getPendingRecords();
    res.json({ success: true, data: records });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const stats = reviewService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
