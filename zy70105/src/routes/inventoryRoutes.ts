import { Router, Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import { inventoryService } from '../services/inventoryService';
import { store } from '../dataStore/inMemoryStore';
import { ValidationError } from '../utils/errors';

const router = Router();

function successResponse<T>(req: Request, data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date(),
    requestId: req.requestId
  };
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inventories = await inventoryService.getAll();
    res.json(successResponse(req, inventories));
  } catch (error) {
    next(error);
  }
});

router.get('/pesticide/:pesticideId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inventories = await inventoryService.getByPesticideId(req.params.pesticideId);
    res.json(successResponse(req, inventories));
  } catch (error) {
    next(error);
  }
});

router.get('/pesticide/:pesticideId/total', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const total = await inventoryService.getTotalQuantity(req.params.pesticideId);
    res.json(successResponse(req, { pesticideId: req.params.pesticideId, totalQuantity: total }));
  } catch (error) {
    next(error);
  }
});

router.get('/pesticide/:pesticideId/availability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quantity } = req.query;
    
    if (!quantity) {
      throw new ValidationError('需求数量不能为空');
    }

    const result = await inventoryService.checkAvailability(
      req.params.pesticideId,
      Number(quantity)
    );

    res.json(successResponse(req, result));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      pesticideId,
      batchNumber,
      quantity,
      unit,
      expiryDate,
      warehouse,
      inboundDate,
      supplier
    } = req.body;

    if (!pesticideId || !batchNumber || quantity == null || !expiryDate) {
      throw new ValidationError('农药ID、批次号、数量和过期日期不能为空');
    }

    const inventory = await inventoryService.createInventory({
      pesticideId,
      batchNumber,
      quantity: Number(quantity),
      unit: unit || 'KG',
      expiryDate: new Date(expiryDate),
      warehouse: warehouse || '默认仓库',
      inboundDate: inboundDate ? new Date(inboundDate) : new Date(),
      supplier: supplier || ''
    });

    res.status(201).json(successResponse(req, inventory));
  } catch (error) {
    next(error);
  }
});

export default router;
