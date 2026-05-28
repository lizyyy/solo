import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Artwork, LightSource, Gallery, SamplingData, Risk, Exhibition } from '@/types';
import createMockApp from '../mockServer';

describe('API接口测试', () => {
  const { app, resetData, getDataStore } = createMockApp();

  beforeEach(() => {
    resetData();
  });

  describe('健康检查接口', () => {
    it('GET /api/health 应返回200', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ok');
    });
  });

  describe('作品CRUD接口', () => {
    const validArtwork: Omit<Artwork, 'id' | 'createdAt'> = {
      galleryId: 'gallery-001',
      exhibitionId: 'exhibition-001',
      registrationNo: 'WH-CRUD-001',
      name: 'CRUD测试作品',
      lightResistanceGrade: 'ISO 15426 Grade 2',
      posX: 1,
      posY: 1.5,
      posZ: 2,
      width: 1.2,
      height: 1.8,
      protectionLevel: '二级',
      createdBy: 'test-user'
    };

    it('POST /api/artworks 创建作品应返回201', async () => {
      const response = await request(app)
        .post('/api/artworks')
        .send(validArtwork);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.registrationNo).toBe(validArtwork.registrationNo);
      expect(response.body.data.name).toBe(validArtwork.name);
    });

    it('GET /api/artworks 获取作品列表应返回200', async () => {
      await request(app).post('/api/artworks').send({
        ...validArtwork,
        registrationNo: 'WH-LIST-001'
      });
      await request(app).post('/api/artworks').send({
        ...validArtwork,
        registrationNo: 'WH-LIST-002'
      });

      const response = await request(app).get('/api/artworks');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('GET /api/artworks/:id 获取单个作品应返回200', async () => {
      const createResponse = await request(app)
        .post('/api/artworks')
        .send(validArtwork);

      const artworkId = createResponse.body.data.id;
      const response = await request(app).get(`/api/artworks/${artworkId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(artworkId);
      expect(response.body.data.registrationNo).toBe(validArtwork.registrationNo);
    });

    it('PUT /api/artworks/:id 更新作品应返回200', async () => {
      const createResponse = await request(app)
        .post('/api/artworks')
        .send(validArtwork);

      const artworkId = createResponse.body.data.id;
      const response = await request(app)
        .put(`/api/artworks/${artworkId}`)
        .send({
          name: '更新后的作品名称',
          posX: 5,
          posY: 2
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('更新后的作品名称');
      expect(response.body.data.posX).toBe(5);
      expect(response.body.data.lastModifiedAt).toBeDefined();
    });

    it('DELETE /api/artworks/:id 删除作品应返回204', async () => {
      const createResponse = await request(app)
        .post('/api/artworks')
        .send({ ...validArtwork, exhibitionId: undefined });

      const artworkId = createResponse.body.data.id;
      const response = await request(app).delete(`/api/artworks/${artworkId}`);

      expect(response.status).toBe(204);

      const getResponse = await request(app).get(`/api/artworks/${artworkId}`);
      expect(getResponse.status).toBe(404);
    });

    it('GET /api/artworks/:id 不存在的作品应返回404', async () => {
      const response = await request(app).get('/api/artworks/non-existent-id');
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('光源CRUD接口', () => {
    const validLightSource: Omit<LightSource, 'id' | 'createdAt'> = {
      galleryId: 'gallery-001',
      name: 'CRUD测试光源',
      type: 'spot',
      power: 50,
      intensity: 3000,
      posX: 2,
      posY: 3.5,
      posZ: -1,
      angleX: -60,
      angleY: 15,
      angleZ: 0,
      beamAngle: 25,
      colorTemperature: 4000,
      calibrationCertNo: 'CAL-CRUD-001',
      calibrationDate: '2024-01-01',
      createdBy: 'test-user'
    };

    it('POST /api/light-sources 创建光源应返回201', async () => {
      const response = await request(app)
        .post('/api/light-sources')
        .send(validLightSource);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.name).toBe(validLightSource.name);
    });

    it('GET /api/light-sources 获取光源列表应返回200', async () => {
      await request(app).post('/api/light-sources').send({
        ...validLightSource,
        name: '光源1'
      });
      await request(app).post('/api/light-sources').send({
        ...validLightSource,
        name: '光源2'
      });

      const response = await request(app).get('/api/light-sources');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('创建光源时相同名称在同一展厅应返回409', async () => {
      await request(app)
        .post('/api/light-sources')
        .send(validLightSource);

      const response = await request(app)
        .post('/api/light-sources')
        .send(validLightSource);

      expect(response.status).toBe(409);
    });
  });

  describe('展厅CRUD接口', () => {
    const validGallery: Omit<Gallery, 'id' | 'createdAt'> = {
      name: 'CRUD测试展厅',
      width: 15,
      height: 4,
      depth: 10,
      walls: [
        {
          id: 'wall-crud-1',
          start: { x: -7.5, y: 0, z: -5 },
          end: { x: 7.5, y: 0, z: -5 },
          height: 4,
          thickness: 0.3,
          material: '混凝土',
          opacity: 1
        }
      ],
      material: '乳胶漆',
      createdBy: 'test-user'
    };

    it('POST /api/galleries 创建展厅应返回201', async () => {
      const response = await request(app)
        .post('/api/galleries')
        .send(validGallery);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(validGallery.name);
      expect(response.body.data.walls).toHaveLength(1);
    });

    it('POST /api/galleries 无效墙体数据应返回400', async () => {
      const invalidGallery = {
        ...validGallery,
        walls: [
          {
            id: 'wall-invalid',
            start: { x: 'invalid', y: 0, z: 0 },
            end: { x: 10, y: 0, z: 0 },
            height: 4,
            thickness: 0.3,
            material: '混凝土',
            opacity: 1
          }
        ]
      };

      const response = await request(app)
        .post('/api/galleries')
        .send(invalidGallery);

      expect(response.status).toBe(400);
    });
  });

  describe('采样数据CRUD接口', () => {
    const validSamplingData: Omit<SamplingData, 'id'> = {
      samplingPointId: 'sp-crud-001',
      measuredValue: 75.5,
      measuredAt: new Date().toISOString(),
      instrumentId: 'INS-CRUD-001',
      instrumentCalibrationStatus: 'valid',
      measuredBy: 'test-user'
    };

    it('POST /api/sampling-data 创建采样数据应返回201', async () => {
      const response = await request(app)
        .post('/api/sampling-data')
        .send(validSamplingData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.measuredValue).toBe(75.5);
    });

    it('POST /api/sampling-data 负值应返回400', async () => {
      const invalidData = {
        ...validSamplingData,
        measuredValue: -10
      };

      const response = await request(app)
        .post('/api/sampling-data')
        .send(invalidData);

      expect(response.status).toBe(400);
    });
  });

  describe('风险CRUD接口', () => {
    const validRisk: Omit<Risk, 'id'> = {
      type: 'over_illumination',
      severity: 'high',
      status: 'detected',
      description: 'CRUD测试风险',
      posX: 1,
      posY: 1.5,
      posZ: 2,
      artworkId: 'artwork-crud-001',
      measuredValue: 150,
      threshold: 50,
      exceedRatio: 200,
      evidence: {
        notes: '测试风险证据'
      },
      detectedAt: new Date().toISOString()
    };

    it('POST /api/risks 创建风险应返回201', async () => {
      const response = await request(app)
        .post('/api/risks')
        .send(validRisk);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('over_illumination');
    });

    it('GET /api/risks 获取风险列表应返回200', async () => {
      await request(app).post('/api/risks').send(validRisk);
      await request(app).post('/api/risks').send({
        ...validRisk,
        type: 'cumulative_leak',
        severity: 'medium'
      });

      const response = await request(app).get('/api/risks');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('数据校验', () => {
    it('作品名称为空应返回400', async () => {
      const invalidArtwork = {
        id: 'artwork-validate-001',
        galleryId: 'gallery-001',
        registrationNo: 'WH-VAL-001',
        name: '',
        lightResistanceGrade: 'ISO 15426 Grade 1',
        posX: 0,
        posY: 1.5,
        posZ: 0,
        width: 1,
        height: 1,
        protectionLevel: '一级',
        createdBy: 'test-user',
        createdAt: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/artworks')
        .send(invalidArtwork);

      expect(response.status).toBe(400);
      expect(response.body.error.details['name']).toBeDefined();
    });

    it('光源类型无效应返回400', async () => {
      const invalidLightSource = {
        id: 'light-validate-001',
        galleryId: 'gallery-001',
        name: '测试光源',
        type: 'invalid_type',
        power: 30,
        intensity: 2000,
        posX: 0,
        posY: 3,
        posZ: 0,
        angleX: -90,
        angleY: 0,
        angleZ: 0,
        beamAngle: 30,
        colorTemperature: 3200,
        createdBy: 'test-user',
        createdAt: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/light-sources')
        .send(invalidLightSource);

      expect(response.status).toBe(400);
      expect(response.body.error.details['type']).toBeDefined();
    });

    it('展览日期无效应返回400', async () => {
      const invalidExhibition = {
        id: 'exhibition-validate-001',
        name: '测试展览',
        startDate: '2024-13-01',
        endDate: '2024-12-31',
        dailyOpenHours: 8,
        responsiblePerson: '测试人',
        status: 'planning',
        createdBy: 'test-user',
        createdAt: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/exhibitions')
        .send(invalidExhibition);

      expect(response.status).toBe(400);
      expect(response.body.error.details['startDate']).toBeDefined();
    });

    it('风险类型无效应返回400', async () => {
      const invalidRisk = {
        id: 'risk-validate-001',
        type: 'invalid_type',
        severity: 'high',
        status: 'detected',
        description: '测试风险',
        posX: 0,
        posY: 1.5,
        posZ: 0,
        measuredValue: 100,
        threshold: 50,
        exceedRatio: 100,
        evidence: {},
        detectedAt: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/risks')
        .send(invalidRisk);

      expect(response.status).toBe(400);
      expect(response.body.error.details['type']).toBeDefined();
    });
  });

  describe('状态流转', () => {
    it('风险状态从detected流转到acknowledged', async () => {
      const risk: Omit<Risk, 'id'> = {
        type: 'over_illumination',
        severity: 'medium',
        status: 'detected',
        description: '状态流转测试风险',
        posX: 0,
        posY: 1.5,
        posZ: 0,
        measuredValue: 80,
        threshold: 50,
        exceedRatio: 60,
        evidence: {},
        detectedAt: new Date().toISOString()
      };

      const createResponse = await request(app)
        .post('/api/risks')
        .send(risk);

      const riskId = createResponse.body.data.id;
      expect(createResponse.body.data.status).toBe('detected');

      const acknowledgeResponse = await request(app)
        .post(`/api/risks/${riskId}/acknowledge`)
        .send({ acknowledgedBy: 'operator-001' });

      expect(acknowledgeResponse.status).toBe(200);
      expect(acknowledgeResponse.body.data.status).toBe('acknowledged');
      expect(acknowledgeResponse.body.data.acknowledgedBy).toBe('operator-001');
      expect(acknowledgeResponse.body.data.acknowledgedAt).toBeDefined();
    });

    it('展览状态从planning到ongoing允许修改', async () => {
      const exhibition: Omit<Exhibition, 'id' | 'createdAt'> = {
        name: '状态流转测试展览',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        dailyOpenHours: 8,
        responsiblePerson: '测试人',
        status: 'planning',
        createdBy: 'test-user'
      };

      const createResponse = await request(app)
        .post('/api/exhibitions')
        .send(exhibition);

      const exhibitionId = createResponse.body.data.id;

      const updateResponse = await request(app)
        .put(`/api/exhibitions/${exhibitionId}`)
        .send({ status: 'ongoing', dailyOpenHours: 10 });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.status).toBe('ongoing');
      expect(updateResponse.body.data.dailyOpenHours).toBe(10);
    });

    it('展览状态流转到ended后不允许修改', async () => {
      const exhibition: Omit<Exhibition, 'id' | 'createdAt'> = {
        name: '状态流转测试展览',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        dailyOpenHours: 8,
        responsiblePerson: '测试人',
        status: 'ended',
        createdBy: 'test-user'
      };

      const createResponse = await request(app)
        .post('/api/exhibitions')
        .send(exhibition);

      const exhibitionId = createResponse.body.data.id;

      const updateResponse = await request(app)
        .put(`/api/exhibitions/${exhibitionId}`)
        .send({ name: '尝试修改' });

      expect(updateResponse.status).toBe(409);
    });

    it('作品更新应记录修改时间', async () => {
      const artwork: Omit<Artwork, 'id' | 'createdAt'> = {
        galleryId: 'gallery-001',
        registrationNo: 'WH-STATUS-001',
        name: '状态流转测试作品',
        lightResistanceGrade: 'ISO 15426 Grade 1',
        posX: 0,
        posY: 1.5,
        posZ: 0,
        width: 1,
        height: 1,
        protectionLevel: '一级',
        createdBy: 'test-user'
      };

      const createResponse = await request(app)
        .post('/api/artworks')
        .send(artwork);

      const artworkId = createResponse.body.data.id;
      expect(createResponse.body.data.lastModifiedAt).toBeUndefined();

      const updateResponse = await request(app)
        .put(`/api/artworks/${artworkId}`)
        .send({ name: '修改后的作品' });

      expect(updateResponse.body.data.lastModifiedAt).toBeDefined();
    });
  });

  describe('API响应格式', () => {
    it('成功响应应包含标准格式', async () => {
      const response = await request(app).get('/api/health');

      expect(response.body.success).toBe(true);
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.requestId).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('错误响应应包含标准格式', async () => {
      const response = await request(app).get('/api/non-existent-endpoint');

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBeDefined();
      expect(response.body.error.message).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.requestId).toBeDefined();
    });

    it('验证错误响应应包含details字段', async () => {
      const response = await request(app)
        .post('/api/artworks')
        .send({});

      expect(response.body.error.details).toBeDefined();
      expect(typeof response.body.error.details).toBe('object');
    });
  });
});
