import { Router, type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { collections } from '../db/index.js';
import { dataService } from '../services/dataService.js';
import { validate, checkIdempotency, saveIdempotencyResponse } from '../middleware/validation.js';
import { artworkSchema, artworkUpdateSchema } from '../schemas/index.js';
import type { Artwork } from '../../src/types/index.js';

const router = Router();
const RESOURCE_NAME = '作品';

router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const artworks = await dataService.getAll<Artwork>(collections.artworks);
    res.status(200).json({
      success: true,
      data: artworks,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/gallery/:galleryId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const artworks = await dataService.findByField<Artwork>(
      collections.artworks,
      'galleryId' as keyof Artwork,
      req.params.galleryId
    );
    res.status(200).json({
      success: true,
      data: artworks,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/exhibition/:exhibitionId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const artworks = await dataService.findByField<Artwork>(
      collections.artworks,
      'exhibitionId' as keyof Artwork,
      req.params.exhibitionId
    );
    res.status(200).json({
      success: true,
      data: artworks,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const artwork = await dataService.getById<Artwork>(collections.artworks, req.params.id, RESOURCE_NAME);
    res.status(200).json({
      success: true,
      data: artwork,
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
  validate(artworkSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const artwork = await dataService.create<Artwork>(
        collections.artworks,
        req.body,
        RESOURCE_NAME
      );

      const response = {
        success: true,
        data: artwork,
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
  validate(artworkUpdateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers['x-user-id'] as string || 'anonymous';
      const artwork = await dataService.update<Artwork>(
        collections.artworks,
        req.params.id,
        {
          ...req.body,
          lastModifiedBy: userId,
        },
        RESOURCE_NAME
      );

      res.status(200).json({
        success: true,
        data: artwork,
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
    await dataService.delete<Artwork>(
      collections.artworks,
      req.params.id,
      RESOURCE_NAME,
      {
        beforeDelete: async (artwork) => {
          await dataService.checkArtworkDeletable(artwork);
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
