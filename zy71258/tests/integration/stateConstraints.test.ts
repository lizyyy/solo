import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Risk, Exhibition, Artwork, ProtectionReport } from '@/types';
import createMockApp from '../mockServer';

describe('状态约束集成测试', () => {
  const { app, resetData, getDataStore } = createMockApp();

  beforeEach(() => {
    resetData();
  });

  describe('已确认的风险不允许重复确认', () => {
    const createTestRisk = async (status: 'detected' | 'acknowledged' | 'resolved' = 'detected'): Promise<string> => {
      const risk: Omit<Risk, 'id'> = {
        type: 'over_illumination',
        severity: 'high',
        status,
        description: '测试风险',
        posX: 0,
        posY: 1.5,
        posZ: 0,
        artworkId: 'artwork-001',
        measuredValue: 100,
        threshold: 50,
        exceedRatio: 100,
        evidence: { notes: '测试证据' },
        detectedAt: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/risks')
        .send(risk);

      return response.body.data.id;
    };

    it('detected状态的风险允许确认', async () => {
      const riskId = await createTestRisk('detected');

      const response = await request(app)
        .post(`/api/risks/${riskId}/acknowledge`)
        .send({ acknowledgedBy: 'test-user' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('acknowledged');
      expect(response.body.data.acknowledgedBy).toBe('test-user');
      expect(response.body.data.acknowledgedAt).toBeDefined();
    });

    it('acknowledged状态的风险不允许重复确认', async () => {
      const riskId = await createTestRisk('acknowledged');

      const response = await request(app)
        .post(`/api/risks/${riskId}/acknowledge`)
        .send({ acknowledgedBy: 'test-user' });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_STATE');
      expect(response.body.error.message).toContain('acknowledged');
      expect(response.body.error.message).toContain('不允许重复确认');
    });

    it('resolved状态的风险不允许确认', async () => {
      const riskId = await createTestRisk('resolved');

      const response = await request(app)
        .post(`/api/risks/${riskId}/acknowledge`)
        .send({ acknowledgedBy: 'test-user' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('INVALID_STATE');
      expect(response.body.error.message).toContain('resolved');
    });

    it('确认后风险状态应持久化', async () => {
      const riskId = await createTestRisk('detected');

      await request(app)
        .post(`/api/risks/${riskId}/acknowledge`)
        .send({ acknowledgedBy: 'test-user' });

      const listResponse = await request(app).get('/api/risks');
      const updatedRisk = listResponse.body.data.find((r: Risk) => r.id === riskId);

      expect(updatedRisk.status).toBe('acknowledged');
      expect(updatedRisk.acknowledgedBy).toBe('test-user');
    });

    it('不存在的风险确认应返回404', async () => {
      const response = await request(app)
        .post('/api/risks/non-existent-id/acknowledge')
        .send({ acknowledgedBy: 'test-user' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('已结束的展期不允许修改', () => {
    const createTestExhibition = async (status: 'planning' | 'ongoing' | 'ended' = 'planning'): Promise<string> => {
      const exhibition: Omit<Exhibition, 'id' | 'createdAt'> = {
        name: '测试展览',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        dailyOpenHours: 8,
        responsiblePerson: '测试人',
        status,
        createdBy: 'test-user'
      };

      const response = await request(app)
        .post('/api/exhibitions')
        .send(exhibition);

      return response.body.data.id;
    };

    it('planning状态的展览允许修改', async () => {
      const exhibitionId = await createTestExhibition('planning');

      const response = await request(app)
        .put(`/api/exhibitions/${exhibitionId}`)
        .send({
          name: '修改后的展览名称',
          dailyOpenHours: 10
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('修改后的展览名称');
      expect(response.body.data.dailyOpenHours).toBe(10);
    });

    it('ongoing状态的展览允许修改', async () => {
      const exhibitionId = await createTestExhibition('ongoing');

      const response = await request(app)
        .put(`/api/exhibitions/${exhibitionId}`)
        .send({
          name: '修改后的展览名称'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('修改后的展览名称');
    });

    it('ended状态的展览不允许修改', async () => {
      const exhibitionId = await createTestExhibition('ended');

      const response = await request(app)
        .put(`/api/exhibitions/${exhibitionId}`)
        .send({
          name: '尝试修改已结束展览'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EXHIBITION_ENDED');
      expect(response.body.error.message).toContain('已结束');
      expect(response.body.error.message).toContain('不允许修改');
    });

    it('修改后展览数据应持久化', async () => {
      const exhibitionId = await createTestExhibition('planning');

      await request(app)
        .put(`/api/exhibitions/${exhibitionId}`)
        .send({
          name: '持久化测试展览',
          dailyOpenHours: 12
        });

      const store = getDataStore();
      const updatedExhibition = store.exhibitions.find(e => e.id === exhibitionId);

      expect(updatedExhibition?.name).toBe('持久化测试展览');
      expect(updatedExhibition?.dailyOpenHours).toBe(12);
    });

    it('不存在的展览修改应返回404', async () => {
      const response = await request(app)
        .put('/api/exhibitions/non-existent-id')
        .send({ name: '测试' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('已生成的报告不允许删除', () => {
    const createTestReport = async (hasGeneratedAt: boolean = true): Promise<string> => {
      const report: Omit<ProtectionReport, 'id'> = {
        exhibitionId: 'exhibition-001',
        reportNo: 'RPT-2024-001',
        generatedAt: hasGeneratedAt ? new Date().toISOString() : '',
        riskSummary: {
          totalRisks: 0,
          overIllumination: 0,
          cumulativeLeak: 0,
          lightPenetration: 0,
          bySeverity: { low: 0, medium: 0, high: 0, critical: 0 }
        },
        recommendations: [],
        screenshots: [],
        dataSources: [],
        generatedBy: 'test-user'
      };

      const response = await request(app)
        .post('/api/reports')
        .send(report);

      return response.body.data.id;
    };

    it('未生成的报告允许删除', async () => {
      const reportId = await createTestReport(false);
      getDataStore().reports[0].generatedAt = '';

      const response = await request(app)
        .delete(`/api/reports/${reportId}`);

      expect(response.status).toBe(204);
    });

    it('已生成的报告不允许删除', async () => {
      const reportId = await createTestReport(true);

      const response = await request(app)
        .delete(`/api/reports/${reportId}`);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('REPORT_GENERATED');
      expect(response.body.error.message).toContain('已生成');
      expect(response.body.error.message).toContain('不允许删除');
    });

    it('删除后报告应从数据库移除', async () => {
      const reportId = await createTestReport(false);
      getDataStore().reports[0].generatedAt = '';

      expect(getDataStore().reports).toHaveLength(1);

      await request(app)
        .delete(`/api/reports/${reportId}`);

      expect(getDataStore().reports).toHaveLength(0);
    });

    it('已生成的报告删除后仍保留在数据库', async () => {
      const reportId = await createTestReport(true);

      expect(getDataStore().reports).toHaveLength(1);

      await request(app)
        .delete(`/api/reports/${reportId}`);

      expect(getDataStore().reports).toHaveLength(1);
      expect(getDataStore().reports[0].id).toBe(reportId);
    });

    it('不存在的报告删除应返回404', async () => {
      const response = await request(app)
        .delete('/api/reports/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('展期中的作品不允许删除', () => {
    const createTestArtwork = async (exhibitionId?: string, exhibitionStatus?: 'planning' | 'ongoing' | 'ended'): Promise<string> => {
      if (exhibitionId && exhibitionStatus) {
        const exhibition: Omit<Exhibition, 'id' | 'createdAt'> = {
          name: '关联展览',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          dailyOpenHours: 8,
          responsiblePerson: '测试人',
          status: exhibitionStatus,
          createdBy: 'test-user'
        };

        const exResponse = await request(app)
          .post('/api/exhibitions')
          .send({
            ...exhibition,
            id: `exhibition-${Date.now()}`,
            createdAt: new Date().toISOString()
          });

        if (exResponse.body.success) {
          exhibitionId = exResponse.body.data.id;
        }
      }

      const artwork: Artwork = {
        id: `artwork-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        galleryId: 'gallery-001',
        exhibitionId,
        registrationNo: `WH-${Date.now()}`,
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
        .send(artwork);

      return response.body.data?.id || '';
    };

    it('未关联展览的作品允许删除', async () => {
      const artworkId = await createTestArtwork();

      const response = await request(app)
        .delete(`/api/artworks/${artworkId}`);

      expect(response.status).toBe(204);
    });

    it('关联planning状态展览的作品允许删除', async () => {
      const artworkId = await createTestArtwork(undefined, 'planning');

      const response = await request(app)
        .delete(`/api/artworks/${artworkId}`);

      expect(response.status).toBe(204);
    });

    it('关联ongoing状态展览的作品不允许删除', async () => {
      const artworkId = await createTestArtwork(undefined, 'ongoing');

      const response = await request(app)
        .delete(`/api/artworks/${artworkId}`);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EXHIBITION_ONGOING');
      expect(response.body.error.message).toContain('展期');
      expect(response.body.error.message).toContain('不允许删除');
    });

    it('关联ended状态展览的作品允许删除', async () => {
      const artworkId = await createTestArtwork(undefined, 'ended');

      const response = await request(app)
        .delete(`/api/artworks/${artworkId}`);

      expect(response.status).toBe(204);
    });

    it('删除后作品应从数据库移除', async () => {
      const artworkId = await createTestArtwork();

      expect(getDataStore().artworks).toHaveLength(1);

      await request(app)
        .delete(`/api/artworks/${artworkId}`);

      expect(getDataStore().artworks).toHaveLength(0);
    });

    it('展期中的作品删除后仍保留在数据库', async () => {
      const artworkId = await createTestArtwork(undefined, 'ongoing');

      expect(getDataStore().artworks).toHaveLength(1);

      await request(app)
        .delete(`/api/artworks/${artworkId}`);

      expect(getDataStore().artworks).toHaveLength(1);
      expect(getDataStore().artworks[0].id).toBe(artworkId);
    });

    it('不存在的作品删除应返回404', async () => {
      const response = await request(app)
        .delete('/api/artworks/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
