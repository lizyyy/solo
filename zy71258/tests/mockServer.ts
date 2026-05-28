import express, { type Request, type Response, type NextFunction } from 'express';
import type {
  Artwork, LightSource, Exhibition, Risk, SamplingData,
  Gallery, ProtectionReport, ApiResponse
} from '@/types';
import {
  artworkSchema, lightSourceSchema, exhibitionSchema,
  riskSchema, samplingDataSchema, gallerySchema,
  protectionReportSchema, idempotencySchema,
  validateData, formatValidationError
} from '@/utils/validation';
import { v4 as uuidv4 } from 'uuid';

interface DataStore {
  artworks: Artwork[];
  lightSources: LightSource[];
  exhibitions: Exhibition[];
  risks: Risk[];
  samplingData: SamplingData[];
  galleries: Gallery[];
  reports: ProtectionReport[];
  idempotencyKeys: Set<string>;
}

const createMockApp = () => {
  const app = express();
  app.use(express.json());

  const dataStore: DataStore = {
    artworks: [],
    lightSources: [],
    exhibitions: [],
    risks: [],
    samplingData: [],
    galleries: [],
    reports: [],
    idempotencyKeys: new Set()
  };

  const createResponse = <T>(data?: T, error?: ApiResponse<null>['error']): ApiResponse<T> => ({
    success: !error,
    data,
    error,
    timestamp: new Date().toISOString(),
    requestId: uuidv4()
  });

  const idempotencyMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers['x-idempotency-key'] as string;

    if (idempotencyKey) {
      const validation = validateData(idempotencySchema, { idempotencyKey });
      if (!validation.success) {
        return res.status(400).json(createResponse(null, {
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: '幂等键格式无效',
          details: formatValidationError(validation.error!)
        }));
      }

      if (dataStore.idempotencyKeys.has(idempotencyKey)) {
        return res.status(409).json(createResponse(null, {
          code: 'DUPLICATE_SUBMISSION',
          message: '重复提交，该幂等键已被使用'
        }));
      }

      dataStore.idempotencyKeys.add(idempotencyKey);
    }

    next();
  };

  const autoFillArtwork = (body: Partial<Artwork>, defaults: Partial<Artwork> = {}): Artwork => ({
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...defaults,
    ...body
  } as Artwork);

  const autoFillLightSource = (body: Partial<LightSource>, defaults: Partial<LightSource> = {}): LightSource => ({
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...defaults,
    ...body
  } as LightSource);

  const autoFillExhibition = (body: Partial<Exhibition>, defaults: Partial<Exhibition> = {}): Exhibition => ({
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...defaults,
    ...body
  } as Exhibition);

  const autoFillGallery = (body: Partial<Gallery>, defaults: Partial<Gallery> = {}): Gallery => ({
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...defaults,
    ...body
  } as Gallery);

  const autoFillSamplingData = (body: Partial<SamplingData>, defaults: Partial<SamplingData> = {}): SamplingData => ({
    id: uuidv4(),
    measuredAt: new Date().toISOString(),
    ...defaults,
    ...body
  } as SamplingData);

  const autoFillRisk = (body: Partial<Risk>, defaults: Partial<Risk> = {}): Risk => ({
    id: uuidv4(),
    detectedAt: new Date().toISOString(),
    ...defaults,
    ...body
  } as Risk);

  const autoFillProtectionReport = (body: Partial<ProtectionReport>, defaults: Partial<ProtectionReport> = {}): ProtectionReport => ({
    id: uuidv4(),
    generatedAt: new Date().toISOString(),
    ...defaults,
    ...body
  } as ProtectionReport);

  app.post('/api/artworks', idempotencyMiddleware, (req: Request, res: Response) => {
    const data = autoFillArtwork(req.body);
    const validation = validateData(artworkSchema, data);

    if (!validation.success) {
      return res.status(400).json(createResponse(null, {
        code: 'VALIDATION_ERROR',
        message: '数据验证失败',
        details: formatValidationError(validation.error!)
      }));
    }

    const existing = dataStore.artworks.find(a => a.registrationNo === validation.data!.registrationNo);
    if (existing) {
      return res.status(409).json(createResponse(null, {
        code: 'DUPLICATE_ARTWORK',
        message: '该文物登记号已存在'
      }));
    }

    dataStore.artworks.push(validation.data as Artwork);
    res.status(201).json(createResponse(validation.data as Artwork));
  });

  app.post('/api/light-sources', idempotencyMiddleware, (req: Request, res: Response) => {
    const data = autoFillLightSource(req.body);
    const validation = validateData(lightSourceSchema, data);

    if (!validation.success) {
      return res.status(400).json(createResponse(null, {
        code: 'VALIDATION_ERROR',
        message: '数据验证失败',
        details: formatValidationError(validation.error!)
      }));
    }

    const existing = dataStore.lightSources.find(
      l => l.galleryId === validation.data!.galleryId && l.name === validation.data!.name
    );
    if (existing) {
      return res.status(409).json(createResponse(null, {
        code: 'DUPLICATE_LIGHT_SOURCE',
        message: '该展厅下已存在同名光源'
      }));
    }

    dataStore.lightSources.push(validation.data as LightSource);
    res.status(201).json(createResponse(validation.data as LightSource));
  });

  app.post('/api/exhibitions', idempotencyMiddleware, (req: Request, res: Response) => {
    const data = autoFillExhibition(req.body, { status: 'planning' });
    const validation = validateData(exhibitionSchema, data);

    if (!validation.success) {
      return res.status(400).json(createResponse(null, {
        code: 'VALIDATION_ERROR',
        message: '数据验证失败',
        details: formatValidationError(validation.error!)
      }));
    }

    dataStore.exhibitions.push(validation.data as Exhibition);
    res.status(201).json(createResponse(validation.data as Exhibition));
  });

  app.post('/api/risks/:id/acknowledge', (req: Request, res: Response) => {
    const risk = dataStore.risks.find(r => r.id === req.params.id);

    if (!risk) {
      return res.status(404).json(createResponse(null, {
        code: 'NOT_FOUND',
        message: '风险记录不存在'
      }));
    }

    if (risk.status !== 'detected') {
      return res.status(409).json(createResponse(null, {
        code: 'INVALID_STATE',
        message: `当前状态为 ${risk.status}，不允许重复确认`
      }));
    }

    risk.status = 'acknowledged';
    risk.acknowledgedBy = req.body.acknowledgedBy || 'test-user';
    risk.acknowledgedAt = new Date().toISOString();

    res.json(createResponse(risk));
  });

  app.put('/api/exhibitions/:id', (req: Request, res: Response) => {
    const exhibition = dataStore.exhibitions.find(e => e.id === req.params.id);

    if (!exhibition) {
      return res.status(404).json(createResponse(null, {
        code: 'NOT_FOUND',
        message: '展览不存在'
      }));
    }

    if (exhibition.status === 'ended') {
      return res.status(409).json(createResponse(null, {
        code: 'EXHIBITION_ENDED',
        message: '已结束的展览不允许修改'
      }));
    }

    Object.assign(exhibition, req.body);
    res.json(createResponse(exhibition));
  });

  app.delete('/api/reports/:id', (req: Request, res: Response) => {
    const reportIndex = dataStore.reports.findIndex(r => r.id === req.params.id);

    if (reportIndex === -1) {
      return res.status(404).json(createResponse(null, {
        code: 'NOT_FOUND',
        message: '报告不存在'
      }));
    }

    const report = dataStore.reports[reportIndex];
    if (report.generatedAt) {
      return res.status(409).json(createResponse(null, {
        code: 'REPORT_GENERATED',
        message: '已生成的报告不允许删除'
      }));
    }

    dataStore.reports.splice(reportIndex, 1);
    res.status(204).send();
  });

  app.delete('/api/artworks/:id', (req: Request, res: Response) => {
    const artwork = dataStore.artworks.find(a => a.id === req.params.id);

    if (!artwork) {
      return res.status(404).json(createResponse(null, {
        code: 'NOT_FOUND',
        message: '作品不存在'
      }));
    }

    const exhibition = dataStore.exhibitions.find(e => e.id === artwork.exhibitionId);
    if (exhibition && exhibition.status === 'ongoing') {
      return res.status(409).json(createResponse(null, {
        code: 'EXHIBITION_ONGOING',
        message: '展期中的作品不允许删除'
      }));
    }

    const index = dataStore.artworks.findIndex(a => a.id === req.params.id);
    dataStore.artworks.splice(index, 1);
    res.status(204).send();
  });

  app.get('/api/artworks', (_req: Request, res: Response) => {
    res.json(createResponse(dataStore.artworks));
  });

  app.get('/api/artworks/:id', (req: Request, res: Response) => {
    const artwork = dataStore.artworks.find(a => a.id === req.params.id);
    if (!artwork) {
      return res.status(404).json(createResponse(null, {
        code: 'NOT_FOUND',
        message: '作品不存在'
      }));
    }
    res.json(createResponse(artwork));
  });

  app.put('/api/artworks/:id', (req: Request, res: Response) => {
    const artwork = dataStore.artworks.find(a => a.id === req.params.id);
    if (!artwork) {
      return res.status(404).json(createResponse(null, {
        code: 'NOT_FOUND',
        message: '作品不存在'
      }));
    }

    const validation = validateData(artworkSchema, { ...artwork, ...req.body });
    if (!validation.success) {
      return res.status(400).json(createResponse(null, {
        code: 'VALIDATION_ERROR',
        message: '数据验证失败',
        details: formatValidationError(validation.error!)
      }));
    }

    Object.assign(artwork, req.body);
    artwork.lastModifiedAt = new Date().toISOString();
    res.json(createResponse(artwork));
  });

  app.get('/api/light-sources', (_req: Request, res: Response) => {
    res.json(createResponse(dataStore.lightSources));
  });

  app.post('/api/galleries', idempotencyMiddleware, (req: Request, res: Response) => {
    const data = autoFillGallery(req.body);
    const validation = validateData(gallerySchema, data);

    if (!validation.success) {
      return res.status(400).json(createResponse(null, {
        code: 'VALIDATION_ERROR',
        message: '数据验证失败',
        details: formatValidationError(validation.error!)
      }));
    }

    dataStore.galleries.push(validation.data as Gallery);
    res.status(201).json(createResponse(validation.data as Gallery));
  });

  app.post('/api/sampling-data', idempotencyMiddleware, (req: Request, res: Response) => {
    const data = autoFillSamplingData(req.body);
    const validation = validateData(samplingDataSchema, data);

    if (!validation.success) {
      return res.status(400).json(createResponse(null, {
        code: 'VALIDATION_ERROR',
        message: '数据验证失败',
        details: formatValidationError(validation.error!)
      }));
    }

    dataStore.samplingData.push(validation.data as SamplingData);
    res.status(201).json(createResponse(validation.data as SamplingData));
  });

  app.get('/api/risks', (_req: Request, res: Response) => {
    res.json(createResponse(dataStore.risks));
  });

  app.post('/api/risks', idempotencyMiddleware, (req: Request, res: Response) => {
    const data = autoFillRisk(req.body, { status: 'detected' });
    const validation = validateData(riskSchema, data);

    if (!validation.success) {
      return res.status(400).json(createResponse(null, {
        code: 'VALIDATION_ERROR',
        message: '数据验证失败',
        details: formatValidationError(validation.error!)
      }));
    }

    dataStore.risks.push(validation.data as Risk);
    res.status(201).json(createResponse(validation.data as Risk));
  });

  app.post('/api/reports', idempotencyMiddleware, (req: Request, res: Response) => {
    const data = autoFillProtectionReport(req.body);
    const validation = validateData(protectionReportSchema, data);

    if (!validation.success) {
      return res.status(400).json(createResponse(null, {
        code: 'VALIDATION_ERROR',
        message: '数据验证失败',
        details: formatValidationError(validation.error!)
      }));
    }

    dataStore.reports.push(validation.data as ProtectionReport);
    res.status(201).json(createResponse(validation.data as ProtectionReport));
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json(createResponse({ status: 'ok' }));
  });

  const resetData = () => {
    dataStore.artworks = [];
    dataStore.lightSources = [];
    dataStore.exhibitions = [];
    dataStore.risks = [];
    dataStore.samplingData = [];
    dataStore.galleries = [];
    dataStore.reports = [];
    dataStore.idempotencyKeys.clear();
  };

  const getDataStore = () => dataStore;

  return { app, resetData, getDataStore };
};

export default createMockApp;
