import { Router, type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { collections } from '../db/index.js';
import { dataService } from '../services/dataService.js';
import { reportGenerator } from '../services/reportGenerator.js';
import { validate, checkIdempotency, saveIdempotencyResponse } from '../middleware/validation.js';
import { reportSchema } from '../schemas/index.js';
import type { ProtectionReport, Gallery, LightSource, Artwork, SamplingData, Exhibition, Risk } from '../../src/types/index.js';

const router = Router();
const RESOURCE_NAME = '保护报告';

router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reports = await dataService.getAll<ProtectionReport>(collections.reports);
    res.status(200).json({
      success: true,
      data: reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()),
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/exhibition/:exhibitionId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reports = await dataService.findByField<ProtectionReport>(
      collections.reports,
      'exhibitionId' as keyof ProtectionReport,
      req.params.exhibitionId
    );
    res.status(200).json({
      success: true,
      data: reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()),
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const report = await dataService.getById<ProtectionReport>(collections.reports, req.params.id, RESOURCE_NAME);
    res.status(200).json({
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/markdown', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const report = await dataService.getById<ProtectionReport>(collections.reports, req.params.id, RESOURCE_NAME);

    const [exhibition, gallery, risks, artworks, lightSources, samplings] = await Promise.all([
      dataService.getById<Exhibition>(collections.exhibitions, report.exhibitionId, '展期'),
      dataService.getById<Gallery>(collections.galleries, 'default', '展厅').catch(() => {
        const allGalleries = dataService.getAll<Gallery>(collections.galleries);
        return allGalleries.then(g => g[0]);
      }),
      dataService.getAll<Risk>(collections.risks),
      dataService.getAll<Artwork>(collections.artworks),
      dataService.getAll<LightSource>(collections.lightSources),
      dataService.getAll<SamplingData>(collections.samplings),
    ]);

    const context = {
      exhibition,
      risks: risks.filter(r => report.riskSummary.totalRisks > 0),
      artworks,
      gallery,
      lightSources,
      samplings,
      generatedBy: report.generatedBy,
      screenshots: report.screenshots,
    };

    const markdown = await reportGenerator.generateReportMarkdown(report, context);

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report-${report.reportNo}.md"`);
    res.status(200).send(markdown);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/generate',
  validate(reportSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { exhibitionId, generatedBy, screenshots } = req.body;

      const [exhibition, gallery, artworks, lightSources, samplings, risks] = await Promise.all([
        dataService.getById<Exhibition>(collections.exhibitions, exhibitionId, '展期'),
        dataService.getById<Gallery>(collections.galleries, 'default', '展厅').catch(() => {
          const allGalleries = dataService.getAll<Gallery>(collections.galleries);
          return allGalleries.then(g => g[0]);
        }),
        dataService.findByField<Artwork>(collections.artworks, 'exhibitionId' as keyof Artwork, exhibitionId),
        dataService.getAll<LightSource>(collections.lightSources),
        dataService.getAll<SamplingData>(collections.samplings),
        dataService.getAll<Risk>(collections.risks),
      ]);

      const report = await reportGenerator.generateReport({
        exhibition,
        risks,
        artworks,
        gallery,
        lightSources,
        samplings,
        generatedBy,
        screenshots,
      });

      await dataService.create<ProtectionReport>(
        collections.reports,
        report,
        RESOURCE_NAME
      );

      res.status(201).json({
        success: true,
        data: report,
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
  validate(reportSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { exhibitionId, generatedBy, screenshots } = req.body;

      const [exhibition, gallery, artworks, lightSources, samplings, risks] = await Promise.all([
        dataService.getById<Exhibition>(collections.exhibitions, exhibitionId, '展期'),
        dataService.getById<Gallery>(collections.galleries, 'default', '展厅').catch(() => {
          const allGalleries = dataService.getAll<Gallery>(collections.galleries);
          return allGalleries.then(g => g[0]);
        }),
        dataService.findByField<Artwork>(collections.artworks, 'exhibitionId' as keyof Artwork, exhibitionId),
        dataService.getAll<LightSource>(collections.lightSources),
        dataService.getAll<SamplingData>(collections.samplings),
        dataService.getAll<Risk>(collections.risks),
      ]);

      const report = await reportGenerator.generateReport({
        exhibition,
        risks,
        artworks,
        gallery,
        lightSources,
        samplings,
        generatedBy,
        screenshots,
      });

      const savedReport = await dataService.create<ProtectionReport>(
        collections.reports,
        report,
        RESOURCE_NAME
      );

      const response = {
        success: true,
        data: savedReport,
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
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: '报告不允许修改',
        },
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
    await dataService.delete<ProtectionReport>(collections.reports, req.params.id, RESOURCE_NAME);
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
