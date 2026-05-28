import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Artwork, LightSource, Exhibition, SamplingData, Gallery } from '@/types';
import createMockApp from '../mockServer';

describe('缺字段集成测试', () => {
  const { app, resetData } = createMockApp();

  beforeEach(() => {
    resetData();
  });

  describe('缺少必填字段返回400', () => {
    it('创建作品缺少必填字段应返回400', async () => {
      const incompleteArtwork = {
        galleryId: 'gallery-001',
        name: '测试作品'
      };

      const response = await request(app)
        .post('/api/artworks')
        .send(incompleteArtwork);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('创建光源缺少必填字段应返回400', async () => {
      const incompleteLightSource = {
        galleryId: 'gallery-001',
        name: '测试光源'
      };

      const response = await request(app)
        .post('/api/light-sources')
        .send(incompleteLightSource);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('创建展览缺少必填字段应返回400', async () => {
      const incompleteExhibition = {
        name: '测试展览'
      };

      const response = await request(app)
        .post('/api/exhibitions')
        .send(incompleteExhibition);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('创建采样数据缺少必填字段应返回400', async () => {
      const incompleteSamplingData = {
        samplingPointId: 'sp-001'
      };

      const response = await request(app)
        .post('/api/sampling-data')
        .send(incompleteSamplingData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('创建展厅缺少必填字段应返回400', async () => {
      const incompleteGallery = {
        name: '测试展厅'
      };

      const response = await request(app)
        .post('/api/galleries')
        .send(incompleteGallery);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('空请求体应返回400', async () => {
      const response = await request(app)
        .post('/api/artworks')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('错误响应包含缺失字段信息', () => {
    it('作品缺失字段应在错误详情中列出', async () => {
      const incompleteArtwork = {
        galleryId: 'gallery-001',
        name: '测试作品'
      };

      const response = await request(app)
        .post('/api/artworks')
        .send(incompleteArtwork);

      expect(response.body.error.details).toBeDefined();
      expect(response.body.error.details['id']).toBeDefined();
      expect(response.body.error.details['registrationNo']).toBeDefined();
      expect(response.body.error.details['lightResistanceGrade']).toBeDefined();
      expect(response.body.error.details['createdBy']).toBeDefined();
    });

    it('光源缺失字段应在错误详情中列出', async () => {
      const incompleteLightSource = {
        name: '测试光源'
      };

      const response = await request(app)
        .post('/api/light-sources')
        .send(incompleteLightSource);

      expect(response.body.error.details).toBeDefined();
      expect(response.body.error.details['id']).toBeDefined();
      expect(response.body.error.details['galleryId']).toBeDefined();
      expect(response.body.error.details['type']).toBeDefined();
      expect(response.body.error.details['intensity']).toBeDefined();
    });

    it('展览缺失字段应在错误详情中列出', async () => {
      const incompleteExhibition = {
        name: '测试展览',
        startDate: '2024-01-01'
      };

      const response = await request(app)
        .post('/api/exhibitions')
        .send(incompleteExhibition);

      expect(response.body.error.details).toBeDefined();
      expect(response.body.error.details['endDate']).toBeDefined();
      expect(response.body.error.details['responsiblePerson']).toBeDefined();
    });

    it('错误详情应包含字段错误信息', async () => {
      const artworkWithoutName = {
        id: 'artwork-001',
        galleryId: 'gallery-001',
        registrationNo: 'WH-001',
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
        .send(artworkWithoutName);

      expect(response.body.error.details['name']).toContain('不能为空');
    });

    it('多个缺失字段应全部列出', async () => {
      const almostEmpty = {
        id: 'test-id'
      };

      const response = await request(app)
        .post('/api/artworks')
        .send(almostEmpty);

      const missingFields = Object.keys(response.body.error.details);
      expect(missingFields.length).toBeGreaterThan(5);
      expect(missingFields).toContain('galleryId');
      expect(missingFields).toContain('registrationNo');
      expect(missingFields).toContain('name');
      expect(missingFields).toContain('lightResistanceGrade');
    });
  });

  describe('字段类型错误识别', () => {
    it('字符串字段传入数字应返回400', async () => {
      const invalidArtwork = {
        id: 123,
        galleryId: 'gallery-001',
        registrationNo: 'WH-001',
        name: '测试作品',
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
      expect(response.body.error.details['id']).toContain('Expected string, received number');
    });

    it('数字字段传入字符串应返回400', async () => {
      const invalidArtwork = {
        id: 'artwork-001',
        galleryId: 'gallery-001',
        registrationNo: 'WH-001',
        name: '测试作品',
        lightResistanceGrade: 'ISO 15426 Grade 1',
        posX: 'not-a-number',
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
      expect(response.body.error.details['posX']).toBeDefined();
    });

    it('枚举值传入非法值应返回400', async () => {
      const invalidArtwork = {
        id: 'artwork-001',
        galleryId: 'gallery-001',
        registrationNo: 'WH-001',
        name: '测试作品',
        lightResistanceGrade: 'INVALID_GRADE',
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
      expect(response.body.error.details['lightResistanceGrade']).toBeDefined();
    });

    it('日期格式错误应返回400', async () => {
      const invalidExhibition = {
        id: 'exhibition-001',
        name: '测试展览',
        startDate: 'invalid-date',
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
      expect(response.body.error.details['startDate']).toContain('格式');
    });

    it('结束日期早于开始日期应返回400', async () => {
      const invalidExhibition = {
        id: 'exhibition-001',
        name: '测试展览',
        startDate: '2024-12-31',
        endDate: '2024-01-01',
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
      expect(response.body.error.details['endDate']).toContain('不能早于');
    });

    it('每日开放时长超过24小时应返回400', async () => {
      const invalidExhibition = {
        id: 'exhibition-001',
        name: '测试展览',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        dailyOpenHours: 25,
        responsiblePerson: '测试人',
        status: 'planning',
        createdBy: 'test-user',
        createdAt: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/exhibitions')
        .send(invalidExhibition);

      expect(response.status).toBe(400);
      expect(response.body.error.details['dailyOpenHours']).toContain('24');
    });

    it('负数尺寸应返回400', async () => {
      const invalidArtwork = {
        id: 'artwork-001',
        galleryId: 'gallery-001',
        registrationNo: 'WH-001',
        name: '测试作品',
        lightResistanceGrade: 'ISO 15426 Grade 1',
        posX: 0,
        posY: 1.5,
        posZ: 0,
        width: -1,
        height: 1,
        protectionLevel: '一级',
        createdBy: 'test-user',
        createdAt: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/artworks')
        .send(invalidArtwork);

      expect(response.status).toBe(400);
      expect(response.body.error.details['width']).toContain('大于0');
    });

    it('光源强度为负应返回400', async () => {
      const invalidLightSource = {
        id: 'light-001',
        galleryId: 'gallery-001',
        name: '测试光源',
        type: 'spot',
        power: 30,
        intensity: -100,
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
      expect(response.body.error.details['intensity']).toContain('负');
    });

    it('采样值为负应返回400', async () => {
      const invalidSamplingData = {
        id: 'sd-001',
        samplingPointId: 'sp-001',
        measuredValue: -50,
        measuredAt: new Date().toISOString(),
        instrumentId: 'INS-001',
        instrumentCalibrationStatus: 'valid',
        measuredBy: 'test-user'
      };

      const response = await request(app)
        .post('/api/sampling-data')
        .send(invalidSamplingData);

      expect(response.status).toBe(400);
      expect(response.body.error.details['measuredValue']).toContain('负');
    });
  });

  describe('嵌套对象验证', () => {
    it('墙体嵌套对象缺少字段应返回400', async () => {
      const invalidGallery = {
        id: 'gallery-001',
        name: '测试展厅',
        width: 10,
        height: 4,
        depth: 10,
        walls: [
          {
            id: 'wall-001'
          }
        ],
        material: '混凝土',
        createdBy: 'test-user',
        createdAt: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/galleries')
        .send(invalidGallery);

      expect(response.status).toBe(400);
      expect(response.body.error.details['walls.0.start']).toBeDefined();
      expect(response.body.error.details['walls.0.end']).toBeDefined();
    });

    it('墙体点位坐标类型错误应返回400', async () => {
      const invalidGallery = {
        id: 'gallery-001',
        name: '测试展厅',
        width: 10,
        height: 4,
        depth: 10,
        walls: [
          {
            id: 'wall-001',
            start: { x: 'invalid', y: 0, z: 0 },
            end: { x: 10, y: 0, z: 0 },
            height: 4,
            thickness: 0.3,
            material: '混凝土',
            opacity: 1
          }
        ],
        material: '混凝土',
        createdBy: 'test-user',
        createdAt: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/galleries')
        .send(invalidGallery);

      expect(response.status).toBe(400);
      expect(response.body.error.details['walls.0.start.x']).toBeDefined();
    });
  });
});
