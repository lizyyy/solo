import { Router, Request, Response } from 'express';
import { validationService } from '../services/validationService';
import { idempotentService } from '../services/idempotentService';
import { sendSuccess, sendError } from '../middleware/response';

const router = Router();

router.post('/validate', (req: Request, res: Response) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'] as string;
    
    if (idempotencyKey) {
      const cached = idempotentService.getCachedResponse(idempotencyKey);
      if (cached) {
        return res.status(cached.statusCode).json({
          success: true,
          data: cached.body
        });
      }
    }
    
    const { 
      ticketCode, gateId, gateName, 
      operatorId, operatorName,
      requestId, validationTime
    } = req.body;
    
    if (!ticketCode || !gateId || !gateName) {
      return sendError(res, 'MISSING_FIELDS', '缺少必填字段');
    }
    if (!operatorId || !operatorName) {
      return sendError(res, 'MISSING_OPERATOR', '缺少操作者信息');
    }
    
    const result = validationService.validateTicket({
      ticketCode,
      gateId,
      gateName,
      operatorId,
      operatorName,
      requestId,
      validationTime
    });
    
    const responseData = {
      success: result.success,
      record: result.record,
      failureReason: result.failureReason
    };
    
    if (idempotencyKey) {
      idempotentService.recordRequest({
        idempotencyKey,
        method: req.method,
        path: req.path,
        requestBody: req.body,
        responseBody: responseData,
        statusCode: 200,
        operatorId
      });
    }
    
    sendSuccess(res, responseData);
  } catch (err: any) {
    sendError(res, 'VALIDATION_FAILED', err.message || '核销失败');
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const status = req.query.status as string | undefined;
    const source = req.query.source as string | undefined;
    const gateId = req.query.gateId as string | undefined;
    
    const result = validationService.findAll(page, pageSize, {
      status: status as any,
      source: source as any,
      gateId
    });
    
    sendSuccess(res, result);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const record = validationService.findById(req.params.id);
    if (!record) {
      return sendError(res, 'NOT_FOUND', '核销记录不存在', 404);
    }
    sendSuccess(res, record);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.post('/offline-package', (req: Request, res: Response) => {
  try {
    const { gateId, gateName, operatorId, operatorName, validHours } = req.body;
    
    if (!gateId || !gateName || validHours === undefined) {
      return sendError(res, 'MISSING_FIELDS', '缺少必填字段');
    }
    if (!operatorId || !operatorName) {
      return sendError(res, 'MISSING_OPERATOR', '缺少操作者信息');
    }
    
    const pkg = validationService.createOfflinePackage({
      gateId,
      gateName,
      operatorId,
      operatorName,
      validHours
    });
    
    sendSuccess(res, pkg, 201);
  } catch (err: any) {
    sendError(res, 'CREATE_FAILED', err.message || '创建离线包失败');
  }
});

router.post('/offline-package/upload', (req: Request, res: Response) => {
  try {
    const { packageId, validations, operatorId, operatorName } = req.body;
    
    if (!packageId || !validations || !Array.isArray(validations)) {
      return sendError(res, 'MISSING_FIELDS', '缺少必填字段');
    }
    if (!operatorId || !operatorName) {
      return sendError(res, 'MISSING_OPERATOR', '缺少操作者信息');
    }
    
    const result = validationService.uploadOfflinePackage({
      packageId,
      validations,
      operatorId,
      operatorName
    });
    
    sendSuccess(res, result);
  } catch (err: any) {
    sendError(res, 'UPLOAD_FAILED', err.message || '上传离线包失败');
  }
});

router.get('/offline-package', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    
    const result = validationService.findAllOfflinePackages(page, pageSize);
    
    sendSuccess(res, result);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/offline-package/:packageId', (req: Request, res: Response) => {
  try {
    const pkg = validationService.findOfflinePackageByPackageId(req.params.packageId);
    if (!pkg) {
      return sendError(res, 'NOT_FOUND', '离线核销包不存在', 404);
    }
    sendSuccess(res, pkg);
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

router.get('/stats/event/:eventId', (req: Request, res: Response) => {
  try {
    const eventName = req.query.eventName as string || '未知活动';
    const stats = validationService.getEventStats(req.params.eventId);
    
    sendSuccess(res, {
      eventId: req.params.eventId,
      eventName,
      ...stats
    });
  } catch (err: any) {
    sendError(res, 'QUERY_FAILED', err.message || '查询失败');
  }
});

export default router;
