import { Router, type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { collections } from '../db/index.js';
import { dataService } from '../services/dataService.js';
import { validate, checkIdempotency, saveIdempotencyResponse } from '../middleware/validation.js';
import { gallerySchema, galleryUpdateSchema } from '../schemas/index.js';
import type { Gallery } from '../../src/types/index.js';

const router = Router();
const RESOURCE_NAME = '展厅';

router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const galleries = await dataService.getAll<Gallery>(collections.galleries);
    res.status(200).json({
      success: true,
      data: galleries,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const gallery = await dataService.getById<Gallery>(collections.galleries, req.params.id, RESOURCE_NAME);
    res.status(200).json({
      success: true,
      data: gallery,
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
  validate(gallerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const gallery = await dataService.create<Gallery>(
        collections.galleries,
        req.body,
        RESOURCE_NAME,
        {
          beforeCreate: (data) => {
            if (data.walls) {
              data.walls = data.walls.map((wall, index) => ({
                ...wall,
                id: wall.id || `wall_${Date.now()}_${index}`,
              }));
            }
            return data;
          },
        }
      );

      const response = {
        success: true,
        data: gallery,
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
  validate(galleryUpdateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers['x-user-id'] as string || 'anonymous';
      const gallery = await dataService.update<Gallery>(
        collections.galleries,
        req.params.id,
        {
          ...req.body,
          lastModifiedBy: userId,
        },
        RESOURCE_NAME,
        {
          beforeUpdate: (_existing, data) => {
            if (data.walls) {
              data.walls = data.walls.map((wall, index) => ({
                ...wall,
                id: wall.id || `wall_${Date.now()}_${index}`,
              }));
            }
            return data;
          },
        }
      );

      res.status(200).json({
        success: true,
        data: gallery,
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
    await dataService.delete<Gallery>(collections.galleries, req.params.id, RESOURCE_NAME);
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
