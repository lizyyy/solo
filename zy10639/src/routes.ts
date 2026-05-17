import express, { Request, Response } from 'express';
import { store } from './store';
import { CreateRetestRequest, UpdateRetestRequest, AuditRequest, RetestResultRequest, RetestStatus } from './types';

const router = express.Router();

router.use(express.json());

router.post('/retest', (req: Request, res: Response) => {
  try {
    const data: CreateRetestRequest = req.body;
    
    if (!data.sample || !data.testItems || !data.testItems.length || !data.retestReason || !data.applicant) {
      return res.status(400).json({ 
        error: '参数不完整',
        message: '请提供样本信息、检测项目、重测原因和申请人'
      });
    }

    const result = store.createRequest(data);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/retest', (req: Request, res: Response) => {
  try {
    const { status, sampleId } = req.query;
    const filters: { status?: RetestStatus; sampleId?: string } = {};
    
    if (status) {
      filters.status = status as RetestStatus;
    }
    if (sampleId) {
      filters.sampleId = sampleId as string;
    }

    const requests = store.listRequests(filters);
    res.json({
      success: true,
      data: requests,
      total: requests.length
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/retest/:requestId', (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const request = store.getRequest(requestId);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: '重测申请不存在'
      });
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/retest/:requestId', (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const data: UpdateRetestRequest = req.body;
    const { operator } = req.body;

    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '请提供操作人'
      });
    }

    const result = store.updateRequest(requestId, data, operator);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/retest/:requestId/audit', (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const data: AuditRequest = req.body;

    if (!data.auditor || data.approved === undefined) {
      return res.status(400).json({
        success: false,
        error: '请提供审核人和审核结果'
      });
    }

    const result = store.auditRequest(requestId, data);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/retest/:requestId/withdraw', (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { operator } = req.body;

    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '请提供操作人'
      });
    }

    const result = store.withdrawRequest(requestId, operator);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/retest/:requestId/result', (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const data: RetestResultRequest = req.body;

    if (!data.itemCode || data.success === undefined || !data.operator) {
      return res.status(400).json({
        success: false,
        error: '请提供项目编码、操作人和重测结果'
      });
    }

    const result = store.submitRetestResult(requestId, data);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/retest/:requestId/resubmit', (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { operator } = req.body;

    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '请提供操作人'
      });
    }

    const result = store.resubmitRequest(requestId, operator);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/retest/:requestId/history', (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const history = store.getHistory(requestId);
    
    res.json({
      success: true,
      data: history,
      total: history.length
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/export', (req: Request, res: Response) => {
  try {
    const csv = store.exportToCSV();
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="retest-requests.csv"');
    res.send('\uFEFF' + csv);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/import-bad-row', (req: Request, res: Response) => {
  try {
    const { data, operator } = req.body;
    
    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '请提供操作人'
      });
    }

    const result = store.importBadRow(data, operator);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
