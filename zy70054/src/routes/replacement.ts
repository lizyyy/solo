import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types';
import { ServiceError } from '../errors';
import * as service from '../services/replacement-service';

const router = Router();

function handleError(res: Response, error: unknown): void {
  if (error instanceof ServiceError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      timestamp: Date.now()
    };
    res.status(400).json(response);
    return;
  }

  console.error('Unexpected error:', error);
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误'
    },
    timestamp: Date.now()
  };
  res.status(500).json(response);
}

function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: Date.now()
  };
}

router.post('/create', (req: Request, res: Response) => {
  try {
    const result = service.create(req.body);
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/freeze', (req: Request, res: Response) => {
  try {
    const result = service.freezeCard(req.body);
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/logistics', (req: Request, res: Response) => {
  try {
    const result = service.updateLogistics(req.body);
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/activate', (req: Request, res: Response) => {
  try {
    const result = service.activateCard(req.body);
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/reject', (req: Request, res: Response) => {
  try {
    const result = service.rejectStep(req.body);
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/compensate', (req: Request, res: Response) => {
  try {
    const result = service.applyCompensation(req.body);
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/customer-service', (req: Request, res: Response) => {
  try {
    const result = service.addCustomerServiceNote(req.body);
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const result = service.getById(req.params.id);
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id/stuck-point', (req: Request, res: Response) => {
  try {
    const result = service.getStuckPoint(req.params.id);
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id/history', (req: Request, res: Response) => {
  try {
    const result = service.getHistory(req.params.id);
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id/status', (req: Request, res: Response) => {
  try {
    const result = service.getOverallStatus(req.params.id);
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/user/:userId', (req: Request, res: Response) => {
  try {
    const result = service.getByUserId(req.params.userId);
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
