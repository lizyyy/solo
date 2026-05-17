import { Router, Request, Response } from 'express';
import { ApprovalService } from '../services/ApprovalService';
import { ExportService } from '../services/ExportService';
import { ApprovalStatus } from '../types/enums';

const router = Router();
const approvalService = new ApprovalService();
const exportService = new ExportService();

router.post('/import', async (req: Request, res: Response) => {
  try {
    const { records, operatorId, operatorName } = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'records 必须是数组' });
    }

    if (!operatorId || !operatorName) {
      return res.status(400).json({ error: 'operatorId 和 operatorName 不能为空' });
    }

    const result = await approvalService.batchImport(records, operatorId, operatorName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:orderId/remark', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { signId, remark, operatorId, operatorName } = req.body;

    if (!signId || !remark || !operatorId || !operatorName) {
      return res.status(400).json({ error: '参数不完整' });
    }

    const result = await approvalService.addRemark(orderId, signId, remark, operatorId, operatorName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/list', async (req: Request, res: Response) => {
  try {
    const { page, pageSize, status, orderNo, applicantName, isTimeout } = req.query;

    const result = await approvalService.getList({
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      status: status as ApprovalStatus,
      orderNo: orderNo as string,
      applicantName: applicantName as string,
      isTimeout: isTimeout ? isTimeout === 'true' : undefined
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const result = await approvalService.getDetail(orderId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:orderId/history', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const result = await approvalService.getHistory(orderId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:orderId/transfer', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { signId, transferToId, transferToName, operatorId, operatorName } = req.body;

    if (!signId || !transferToId || !transferToName || !operatorId || !operatorName) {
      return res.status(400).json({ error: '参数不完整' });
    }

    const result = await approvalService.transferSign(orderId, signId, transferToId, transferToName, operatorId, operatorName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:orderId/withdraw', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { operatorId, operatorName } = req.body;

    if (!operatorId || !operatorName) {
      return res.status(400).json({ error: 'operatorId 和 operatorName 不能为空' });
    }

    const result = await approvalService.withdrawOrder(orderId, operatorId, operatorName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:orderId/resubmit', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { operatorId, operatorName } = req.body;

    if (!operatorId || !operatorName) {
      return res.status(400).json({ error: 'operatorId 和 operatorName 不能为空' });
    }

    const result = await approvalService.resubmitOrder(orderId, operatorId, operatorName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const { status, orderNo, applicantName, isTimeout } = req.query;

    const csv = await exportService.exportToCSV({
      status: status as string,
      orderNo: orderNo as string,
      applicantName: applicantName as string,
      isTimeout: isTimeout ? isTimeout === 'true' : undefined
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="approval_records_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:orderId/export', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const result = await exportService.exportSingleOrder(orderId);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="approval_${orderId}_${Date.now()}.json"`);
    res.send(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
