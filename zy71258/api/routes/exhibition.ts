import { Router, type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { collections } from '../db/index.js';
import { dataService } from '../services/dataService.js';
import { validate, checkIdempotency, saveIdempotencyResponse } from '../middleware/validation.js';
import { exhibitionSchema, exhibitionUpdateSchema } from '../schemas/index.js';
import type { Exhibition } from '../../src/types/index.js';

const router = Router();
const RESOURCE_NAME = '展期';

router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const exhibitions = await dataService.getAll<Exhibition>(collections.exhibitions);
    res.status(200).json({
      success: true,
      data: exhibitions.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const exhibition = await dataService.getById<Exhibition>(collections.exhibitions, req.params.id, RESOURCE_NAME);
    res.status(200).json({
      success: true,
      data: exhibition,
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
  validate(exhibitionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const exhibition = await dataService.create<Exhibition>(
        collections.exhibitions,
        req.body,
        RESOURCE_NAME
      );

      const response = {
        success: true,
        data: exhibition,
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
  validate(exhibitionUpdateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const exhibition = await dataService.update<Exhibition>(
        collections.exhibitions,
        req.params.id,
        req.body,
        RESOURCE_NAME,
        {
          beforeUpdate: async (existing, data) => {
            if (existing.status === 'ended') {
              await dataService.checkExhibitionModifiable(existing);
            }
            return data;
          },
        }
      );

      res.status(200).json({
        success: true,
        data: exhibition,
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
    await dataService.delete<Exhibition>(
      collections.exhibitions,
      req.params.id,
      RESOURCE_NAME,
      {
        beforeDelete: async (exhibition) => {
          await dataService.checkExhibitionModifiable(exhibition);
        },
      }
    );

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
