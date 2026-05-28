import { Router, type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { collections } from '../db/index.js';
import { dataService } from '../services/dataService.js';
import { riskEngine } from '../services/riskEngine.js';
import { validate, checkIdempotency, saveIdempotencyResponse } from '../middleware/validation.js';
import { riskSchema, riskUpdateSchema, riskAcknowledgeSchema, riskResolveSchema, riskDetectionSchema } from '../schemas/index.js';
import type { Risk, Gallery, LightSource, Artwork, SamplingData, Exhibition } from '../../src/types/index.js';

const router = Router();
const RESOURCE_NAME = '风险';

router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const risks = await dataService.getAll<Risk>(collections.risks);
    res.status(200).json({
      success: true,
      data: risks.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()),
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/artwork/:artworkId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const risks = await dataService.findByField<Risk>(
      collections.risks,
      'artworkId' as keyof Risk,
      req.params.artworkId
    );
    res.status(200).json({
      success: true,
      data: risks.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()),
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const risk = await dataService.getById<Risk>(collections.risks, req.params.id, RESOURCE_NAME);
    res.status(200).json({
      success: true,
      data: risk,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/detect',
  validate(riskDetectionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { galleryId, exhibitionId } = req.body;

      const [gallery, lightSources, artworks, samplings, exhibitions] = await Promise.all([
        dataService.getById<Gallery>(collections.galleries, galleryId, '展厅'),
        dataService.findByField<LightSource>(collections.lightSources, 'galleryId' as keyof LightSource, galleryId),
        dataService.findByField<Artwork>(collections.artworks, 'galleryId' as keyof Artwork, galleryId),
        dataService.getAll<SamplingData>(collections.samplings),
        dataService.getAll<Exhibition>(collections.exhibitions),
      ]);

      const risks = await riskEngine.detectRisks({
        gallery,
        lightSources,
        artworks,
        samplings,
        exhibitions,
      });

      for (const risk of risks) {
        await dataService.create<Risk>(collections.risks, risk, RESOURCE_NAME);
      }

      const calculationTimeMs = Date.now() - startTime;
      const summary = {
        totalRisks: risks.length,
        overIllumination: risks.filter(r => r.type === 'over_illumination').length,
        cumulativeLeak: risks.filter(r => r.type === 'cumulative_leak').length,
        lightPenetration: risks.filter(r => r.type === 'light_penetration').length,
      };

      res.status(200).json({
        success: true,
        data: {
          summary,
          risks,
          timestamp: new Date().toISOString(),
          calculationTimeMs,
        },
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  checkIdempotency,
  validate(riskSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const risk = await dataService.create<Risk>(
        collections.risks,
        req.body,
        RESOURCE_NAME
      );

      const response = {
        success: true,
        data: risk,
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

router.post(
  '/:id/acknowledge',
  validate(riskAcknowledgeSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { acknowledgedBy } = req.body;
      const risk = await dataService.update<Risk>(
        collections.risks,
        req.params.id,
        {
          status: 'acknowledged',
          acknowledgedBy,
          acknowledgedAt: new Date().toISOString(),
        },
        RESOURCE_NAME,
        {
          beforeUpdate: async (existing) => {
            await dataService.checkRiskAcknowledgable(existing);
            return existing;
          },
        }
      );

      res.status(200).json({
        success: true,
        data: risk,
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/resolve',
  validate(riskResolveSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { resolution } = req.body;
      const risk = await dataService.update<Risk>(
        collections.risks,
        req.params.id,
        {
          status: 'resolved',
          resolution,
          resolvedAt: new Date().toISOString(),
        },
        RESOURCE_NAME
      );

      res.status(200).json({
        success: true,
        data: risk,
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  validate(riskUpdateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const risk = await dataService.update<Risk>(
        collections.risks,
        req.params.id,
        req.body,
        RESOURCE_NAME,
        {
          beforeUpdate: async (existing, data) => {
            if (data.status && (data.status === 'acknowledged' || data.status === 'resolved')) {
              await dataService.checkRiskAcknowledgable(existing);
            }
            return data;
          },
        }
      );

      res.status(200).json({
        success: true,
        data: risk,
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
    await dataService.delete<Risk>(collections.risks, req.params.id, RESOURCE_NAME);
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
