import { Router, Request, Response } from 'express';
import { repairPartReturnService } from '../services/repairPartReturn';
import { createSuccessResponse, createErrorResponse, BusinessErrorCode } from '../utils/response';
import { RepairPartReturnStatus } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const result = await repairPartReturnService.create(req.body);
    if (result.success) {
      res.json(createSuccessResponse(result.data, result.message));
    } else if (result.code === 'IDEMPOTENT_CONFLICT') {
      res.json(createErrorResponse('409', result.message, BusinessErrorCode.IDEMPOTENT_CONFLICT, undefined, result.data));
    } else {
      res.json(createErrorResponse('400', result.message, BusinessErrorCode.VALIDATION_ERROR));
    }
  } catch (error) {
    res.status(500).json(createErrorResponse('500', '服务器内部错误'));
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as RepairPartReturnStatus;
    
    const result = await repairPartReturnService.list(page, pageSize, status);
    res.json(createSuccessResponse(result.data, result.message));
  } catch (error) {
    res.status(500).json(createErrorResponse('500', '服务器内部错误'));
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as RepairPartReturnStatus;
    const result = await repairPartReturnService.exportCsv(status);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="repair_part_return_${Date.now()}.csv"`);
    res.send(result.data);
  } catch (error) {
    res.status(500).json(createErrorResponse('500', '服务器内部错误'));
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await repairPartReturnService.getById(req.params.id);
    if (result.success) {
      res.json(createSuccessResponse(result.data, result.message));
    } else {
      res.json(createErrorResponse('404', result.message, BusinessErrorCode.RECORD_NOT_FOUND));
    }
  } catch (error) {
    res.status(500).json(createErrorResponse('500', '服务器内部错误'));
  }
});

router.get('/returnNo/:returnNo', async (req: Request, res: Response) => {
  try {
    const result = await repairPartReturnService.getByReturnNo(req.params.returnNo);
    if (result.success) {
      res.json(createSuccessResponse(result.data, result.message));
    } else {
      res.json(createErrorResponse('404', result.message, BusinessErrorCode.RECORD_NOT_FOUND));
    }
  } catch (error) {
    res.status(500).json(createErrorResponse('500', '服务器内部错误'));
  }
});

router.get('/:id/histories', async (req: Request, res: Response) => {
  try {
    const result = await repairPartReturnService.getHistories(req.params.id);
    if (result.success) {
      res.json(createSuccessResponse(result.data, result.message));
    } else {
      res.json(createErrorResponse('404', result.message, BusinessErrorCode.RECORD_NOT_FOUND));
    }
  } catch (error) {
    res.status(500).json(createErrorResponse('500', '服务器内部错误'));
  }
});

router.post('/:id/ship', async (req: Request, res: Response) => {
  try {
    const result = await repairPartReturnService.ship(req.params.id, req.body);
    if (result.success) {
      res.json(createSuccessResponse(result.data, result.message));
    } else if (result.code === 'INVALID_STATUS_TRANSITION') {
      res.json(createErrorResponse('400', result.message, BusinessErrorCode.INVALID_STATUS_TRANSITION));
    } else if (result.code === 'RECORD_NOT_FOUND') {
      res.json(createErrorResponse('404', result.message, BusinessErrorCode.RECORD_NOT_FOUND));
    } else {
      res.json(createErrorResponse('400', result.message, BusinessErrorCode.VALIDATION_ERROR));
    }
  } catch (error) {
    res.status(500).json(createErrorResponse('500', '服务器内部错误'));
  }
});

router.post('/:id/receive', async (req: Request, res: Response) => {
  try {
    const result = await repairPartReturnService.receive(req.params.id, req.body);
    if (result.success) {
      res.json(createSuccessResponse(result.data, result.message));
    } else if (result.code === 'INVALID_STATUS_TRANSITION') {
      res.json(createErrorResponse('400', result.message, BusinessErrorCode.INVALID_STATUS_TRANSITION));
    } else if (result.code === 'RECORD_NOT_FOUND') {
      res.json(createErrorResponse('404', result.message, BusinessErrorCode.RECORD_NOT_FOUND));
    } else {
      res.json(createErrorResponse('400', result.message, BusinessErrorCode.VALIDATION_ERROR));
    }
  } catch (error) {
    res.status(500).json(createErrorResponse('500', '服务器内部错误'));
  }
});

router.post('/:id/inspect', async (req: Request, res: Response) => {
  try {
    const stockRecovered = req.query.stockRecovered === 'true';
    const result = await repairPartReturnService.inspect(req.params.id, req.body, stockRecovered);
    
    if (result.success) {
      res.json(createSuccessResponse(result.data, result.message));
    } else if (result.code === 'STOCK_RECOVERED_BLOCKED') {
      res.json(createErrorResponse('400', result.message, BusinessErrorCode.VALIDATION_ERROR, result.nextStepHint, result.data));
    } else if (result.code === 'INVALID_STATUS_TRANSITION') {
      res.json(createErrorResponse('400', result.message, BusinessErrorCode.INVALID_STATUS_TRANSITION));
    } else if (result.code === 'RECORD_NOT_FOUND') {
      res.json(createErrorResponse('404', result.message, BusinessErrorCode.RECORD_NOT_FOUND));
    } else {
      res.json(createErrorResponse('400', result.message, BusinessErrorCode.VALIDATION_ERROR));
    }
  } catch (error) {
    res.status(500).json(createErrorResponse('500', '服务器内部错误'));
  }
});

router.post('/:id/stockIn', async (req: Request, res: Response) => {
  try {
    const result = await repairPartReturnService.stockIn(req.params.id, req.body);
    if (result.success) {
      res.json(createSuccessResponse(result.data, result.message));
    } else if (result.code === 'INVALID_STATUS_TRANSITION') {
      res.json(createErrorResponse('400', result.message, BusinessErrorCode.INVALID_STATUS_TRANSITION));
    } else if (result.code === 'RECORD_NOT_FOUND') {
      res.json(createErrorResponse('404', result.message, BusinessErrorCode.RECORD_NOT_FOUND));
    } else {
      res.json(createErrorResponse('400', result.message, BusinessErrorCode.VALIDATION_ERROR));
    }
  } catch (error) {
    res.status(500).json(createErrorResponse('500', '服务器内部错误'));
  }
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName, remark } = req.body;
    const result = await repairPartReturnService.reject(req.params.id, operatorId, operatorName, remark);
    if (result.success) {
      res.json(createSuccessResponse(result.data, result.message));
    } else if (result.code === 'INVALID_STATUS_TRANSITION') {
      res.json(createErrorResponse('400', result.message, BusinessErrorCode.INVALID_STATUS_TRANSITION));
    } else if (result.code === 'RECORD_NOT_FOUND') {
      res.json(createErrorResponse('404', result.message, BusinessErrorCode.RECORD_NOT_FOUND));
    } else {
      res.json(createErrorResponse('400', result.message, BusinessErrorCode.VALIDATION_ERROR));
    }
  } catch (error) {
    res.status(500).json(createErrorResponse('500', '服务器内部错误'));
  }
});

export default router;
