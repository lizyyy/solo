import { Router, Request, Response } from 'express';
import { successResponse, errorResponse, AppError } from '../utils/response';
import * as finalizationService from '../services/finalizationService';

const router = Router();
const DEFAULT_OPERATOR = 'system';

const getOperator = (req: Request): string => {
  return req.header('x-operator') || DEFAULT_OPERATOR;
};

router.post('/finalize', (req: Request, res: Response) => {
  try {
    const { sampleId, finalQuantity, finalUnitPrice, remarks, attachments } = req.body;
    
    if (!sampleId || finalQuantity === undefined || finalUnitPrice === undefined) {
      return res.status(400).json(errorResponse('缺少必要参数: sampleId, finalQuantity, finalUnitPrice'));
    }

    const record = finalizationService.finalizeSample(
      { sampleId, finalQuantity, finalUnitPrice, remarks, attachments },
      getOperator(req)
    );

    res.status(201).json(successResponse(record, '样品定版成功'));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Finalize sample error:', error);
    res.status(500).json(errorResponse('样品定版失败'));
  }
});

router.get('/finalizations', (req: Request, res: Response) => {
  try {
    const { sampleId, approvedBy, startTime, endTime, page, pageSize } = req.query;
    
    const result = finalizationService.listFinalizations(
      {
        sampleId: sampleId as string,
        approvedBy: approvedBy as string,
        startTime: startTime as string,
        endTime: endTime as string
      },
      parseInt(page as string) || 1,
      parseInt(pageSize as string) || 20
    );

    res.json(successResponse(result));
  } catch (error) {
    console.error('List finalizations error:', error);
    res.status(500).json(errorResponse('获取定版记录列表失败'));
  }
});

router.get('/finalizations/:id', (req: Request, res: Response) => {
  try {
    const record = finalizationService.getFinalizationById(req.params.id);
    res.json(successResponse(record));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Get finalization error:', error);
    res.status(500).json(errorResponse('获取定版记录失败'));
  }
});

router.get('/finalizations/sample/:sampleId', (req: Request, res: Response) => {
  try {
    const record = finalizationService.getFinalizationBySample(req.params.sampleId);
    if (!record) {
      return res.status(404).json(errorResponse('该样品没有定版记录'));
    }
    res.json(successResponse(record));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Get finalization by sample error:', error);
    res.status(500).json(errorResponse('获取样品定版记录失败'));
  }
});

router.post('/returns', (req: Request, res: Response) => {
  try {
    const { sampleId, returnType, returnReason, returnQuantity, trackingNo, remarks } = req.body;
    
    if (!sampleId || !returnType || !returnReason || !returnQuantity) {
      return res.status(400).json(errorResponse('缺少必要参数: sampleId, returnType, returnReason, returnQuantity'));
    }

    const record = finalizationService.createReturnRecord(
      { sampleId, returnType, returnReason, returnQuantity, trackingNo, remarks },
      getOperator(req)
    );

    res.status(201).json(successResponse(record, '退样记录创建成功'));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Create return record error:', error);
    res.status(500).json(errorResponse('创建退样记录失败'));
  }
});

router.get('/returns', (req: Request, res: Response) => {
  try {
    const { sampleId, returnType, returnedBy, startTime, endTime, isReceived, page, pageSize } = req.query;
    
    const result = finalizationService.listReturnRecords(
      {
        sampleId: sampleId as string,
        returnType: returnType as any,
        returnedBy: returnedBy as string,
        startTime: startTime as string,
        endTime: endTime as string,
        isReceived: isReceived === 'true' ? true : isReceived === 'false' ? false : undefined
      },
      parseInt(page as string) || 1,
      parseInt(pageSize as string) || 20
    );

    res.json(successResponse(result));
  } catch (error) {
    console.error('List return records error:', error);
    res.status(500).json(errorResponse('获取退样记录列表失败'));
  }
});

router.get('/returns/:id', (req: Request, res: Response) => {
  try {
    const record = finalizationService.getReturnRecordById(req.params.id);
    res.json(successResponse(record));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Get return record error:', error);
    res.status(500).json(errorResponse('获取退样记录失败'));
  }
});

router.get('/returns/sample/:sampleId', (req: Request, res: Response) => {
  try {
    const records = finalizationService.getReturnRecordsBySample(req.params.sampleId);
    res.json(successResponse(records));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Get return records by sample error:', error);
    res.status(500).json(errorResponse('获取样品退样记录失败'));
  }
});

router.post('/returns/:id/confirm', (req: Request, res: Response) => {
  try {
    const record = finalizationService.confirmReturnReceipt(req.params.id, getOperator(req));
    res.json(successResponse(record, '退样签收确认成功'));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Confirm return receipt error:', error);
    res.status(500).json(errorResponse('确认退样签收失败'));
  }
});

export default router;
