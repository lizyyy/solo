import { Router, type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { collections } from '../db/index.js';
import { dataService } from '../services/dataService.js';
import { validate, checkIdempotency, saveIdempotencyResponse } from '../middleware/validation.js';
import { samplingSchema, samplingUpdateSchema } from '../schemas/index.js';
import type { SamplingData } from '../../src/types/index.js';

const router = Router();
const RESOURCE_NAME = '采样数据';

router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const samplings = await dataService.getAll<SamplingData>(collections.samplings);
    res.status(200).json({
      success: true,
      data: samplings,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/point/:samplingPointId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const samplings = await dataService.findByField<SamplingData>(
      collections.samplings,
      'samplingPointId' as keyof SamplingData,
      req.params.samplingPointId
    );
    res.status(200).json({
      success: true,
      data: samplings.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()),
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sampling = await dataService.getById<SamplingData>(collections.samplings, req.params.id, RESOURCE_NAME);
    res.status(200).json({
      success: true,
      data: sampling,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  checkIdempotency,
  validate(samplingSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sampling = await dataService.create<SamplingData>(
        collections.samplings,
        req.body,
        RESOURCE_NAME
      );

      const response = {
        success: true,
        data: sampling,
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      };

      const idempotencyKey = req.headers['idempotency-key'] as string;
      if (idempotencyKey) {
        await saveIdempotencyResponse(idempotencyKey, response);
      }

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  validate(samplingUpdateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sampling = await dataService.update<SamplingData>(
        collections.samplings,
        req.params.id,
        req.body,
        RESOURCE_NAME
      );

      res.status(200).json({
        success: true,
        data: sampling,
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await dataService.delete<SamplingData>(collections.samplings, req.params.id, RESOURCE_NAME);
    res.status(200).json({
      success: true,
      message: `${RESOURCE_NAME}已删除`,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
