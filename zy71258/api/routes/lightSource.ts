import { Router, type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { collections } from '../db/index.js';
import { dataService } from '../services/dataService.js';
import { validate, checkIdempotency, saveIdempotencyResponse } from '../middleware/validation.js';
import { lightSourceSchema, lightSourceUpdateSchema } from '../schemas/index.js';
import type { LightSource } from '../../src/types/index.js';

const router = Router();
const RESOURCE_NAME = '光源';

router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const lightSources = await dataService.getAll<LightSource>(collections.lightSources);
    res.status(200).json({
      success: true,
      data: lightSources,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/gallery/:galleryId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const lightSources = await dataService.findByField<LightSource>(
      collections.lightSources,
      'galleryId' as keyof LightSource,
      req.params.galleryId
    );
    res.status(200).json({
      success: true,
      data: lightSources,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const lightSource = await dataService.getById<LightSource>(collections.lightSources, req.params.id, RESOURCE_NAME);
    res.status(200).json({
      success: true,
      data: lightSource,
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
  validate(lightSourceSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const lightSource = await dataService.create<LightSource>(
        collections.lightSources,
        req.body,
        RESOURCE_NAME
      );

      const response = {
        success: true,
        data: lightSource,
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
  validate(lightSourceUpdateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const lightSource = await dataService.update<LightSource>(
        collections.lightSources,
        req.params.id,
        req.body,
        RESOURCE_NAME
      );

      res.status(200).json({
        success: true,
        data: lightSource,
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
    await dataService.delete<LightSource>(collections.lightSources, req.params.id, RESOURCE_NAME);
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
