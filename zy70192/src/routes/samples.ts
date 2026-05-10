import { Router, Request, Response } from 'express';
import { successResponse, errorResponse, AppError } from '../utils/response';
import * as sampleService from '../services/sampleService';
import * as historyService from '../services/historyService';

const router = Router();
const DEFAULT_OPERATOR = 'system';

const getOperator = (req: Request): string => {
  return req.header('x-operator') || DEFAULT_OPERATOR;
};

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, supplier, category, quantity, unitPrice } = req.body;
    
    if (!name || !supplier || !category) {
      return res.status(400).json(errorResponse('缺少必要参数: name, supplier, category'));
    }

    if (quantity !== undefined && (typeof quantity !== 'number' || quantity < 0)) {
      return res.status(400).json(errorResponse('quantity 必须是非负数字'));
    }

    if (unitPrice !== undefined && (typeof unitPrice !== 'number' || unitPrice < 0)) {
      return res.status(400).json(errorResponse('unitPrice 必须是非负数字'));
    }

    const sample = sampleService.createSample(
      { name, supplier, category, quantity: quantity || 1, unitPrice: unitPrice || 0 },
      getOperator(req)
    );

    res.status(201).json(successResponse(sample, '样品创建成功'));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Create sample error:', error);
    res.status(500).json(errorResponse('创建样品失败'));
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const { status, category, supplier, isFrozen, keyword, page, pageSize } = req.query;
    
    const result = sampleService.listSamples(
      {
        status: status as any,
        category: category as string,
        supplier: supplier as string,
        isFrozen: isFrozen === 'true' ? true : isFrozen === 'false' ? false : undefined,
        keyword: keyword as string
      },
      parseInt(page as string) || 1,
      parseInt(pageSize as string) || 20
    );

    res.json(successResponse(result));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('List samples error:', error);
    res.status(500).json(errorResponse('获取样品列表失败'));
  }
});

router.get('/summary', (req: Request, res: Response) => {
  try {
    const summary = sampleService.getSampleSummary();
    res.json(successResponse(summary));
  } catch (error) {
    console.error('Get sample summary error:', error);
    res.status(500).json(errorResponse('获取汇总信息失败'));
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const sample = sampleService.getSampleById(req.params.id);
    res.json(successResponse(sample));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Get sample error:', error);
    res.status(500).json(errorResponse('获取样品信息失败'));
  }
});

router.get('/by-no/:sampleNo', (req: Request, res: Response) => {
  try {
    const sample = sampleService.getSampleByNo(req.params.sampleNo);
    res.json(successResponse(sample));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Get sample by no error:', error);
    res.status(500).json(errorResponse('获取样品信息失败'));
  }
});

router.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json(errorResponse('缺少参数: status'));
    }

    const sample = sampleService.updateSampleStatus(
      req.params.id,
      status,
      getOperator(req)
    );

    res.json(successResponse(sample, '状态更新成功'));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Update sample status error:', error);
    res.status(500).json(errorResponse('更新状态失败'));
  }
});

router.patch('/:id/info', (req: Request, res: Response) => {
  try {
    const { name, supplier, category, quantity, unitPrice } = req.body;

    const sample = sampleService.updateSampleInfo(
      req.params.id,
      { name, supplier, category, quantity, unitPrice },
      getOperator(req)
    );

    res.json(successResponse(sample, '样品信息更新成功'));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Update sample info error:', error);
    res.status(500).json(errorResponse('更新样品信息失败'));
  }
});

router.post('/:id/freeze', (req: Request, res: Response) => {
  try {
    const sample = sampleService.freezeSample(req.params.id, getOperator(req));
    res.json(successResponse(sample, '样品已冻结'));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Freeze sample error:', error);
    res.status(500).json(errorResponse('冻结样品失败'));
  }
});

router.post('/:id/unfreeze', (req: Request, res: Response) => {
  try {
    const sample = sampleService.unfreezeSample(req.params.id, getOperator(req));
    res.json(successResponse(sample, '样品已解冻'));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Unfreeze sample error:', error);
    res.status(500).json(errorResponse('解冻样品失败'));
  }
});

router.get('/:id/history', (req: Request, res: Response) => {
  try {
    const history = historyService.getHistoryByEntity('SAMPLE', req.params.id);
    res.json(successResponse(history));
  } catch (error) {
    console.error('Get sample history error:', error);
    res.status(500).json(errorResponse('获取历史记录失败'));
  }
});

export default router;
