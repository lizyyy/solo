import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Artwork, LightSource } from '@/types';
import createMockApp from '../mockServer';

describe('重复提交集成测试', () => {
  const { app, resetData, getDataStore } = createMockApp();

  beforeEach(() => {
    resetData();
  });

  describe('同一作品重复提交（带相同幂等键）', () => {
    const validArtwork: Omit<Artwork, 'id' | 'createdAt'> = {
      galleryId: 'gallery-001',
      exhibitionId: 'exhibition-001',
      registrationNo: 'WH-TEST-0001',
      name: '测试书画作品',
      lightResistanceGrade: 'ISO 15426 Grade 1',
      posX: 0,
      posY: 1.5,
      posZ: 0,
      width: 1.5,
      height: 1.2,
      protectionLevel: '一级',
      createdBy: 'test-user'
    };

    it('首次提交应成功（201）', async () => {
      const idempotencyKey = 'artwork-idemp-001';

      const response = await request(app)
        .post('/api/artworks')
        .set('x-idempotency-key', idempotencyKey)
        .send(validArtwork);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.registrationNo).toBe(validArtwork.registrationNo);
    });

    it('重复提交相同幂等键应返回409', async () => {
      const idempotencyKey = 'artwork-idemp-002';

      await request(app)
        .post('/api/artworks')
        .set('x-idempotency-key', idempotencyKey)
        .send(validArtwork);

      const duplicateResponse = await request(app)
        .post('/api/artworks')
        .set('x-idempotency-key', idempotencyKey)
        .send(validArtwork);

      expect(duplicateResponse.status).toBe(409);
      expect(duplicateResponse.body.success).toBe(false);
      expect(duplicateResponse.body.error.code).toBe('DUPLICATE_SUBMISSION');
      expect(duplicateResponse.body.error.message).toContain('幂等键');
    });

    it('不同幂等键的相同数据应成功提交', async () => {
      const artworkData = { ...validArtwork, registrationNo: 'WH-TEST-0002' };

      const response1 = await request(app)
        .post('/api/artworks')
        .set('x-idempotency-key', 'key-1')
        .send(artworkData);

      const response2 = await request(app)
        .post('/api/artworks')
        .set('x-idempotency-key', 'key-2')
        .send({ ...artworkData, registrationNo: 'WH-TEST-0003' });

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(getDataStore().artworks).toHaveLength(2);
    });

    it('空幂等键不应触发重复检测', async () => {
      const artworkData = { ...validArtwork, registrationNo: 'WH-TEST-0004' };

      const response1 = await request(app)
        .post('/api/artworks')
        .send(artworkData);

      const response2 = await request(app)
        .post('/api/artworks')
        .send({ ...artworkData, registrationNo: 'WH-TEST-0005' });

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
    });
  });

  describe('同一光源重复提交', () => {
    const validLightSource: Omit<LightSource, 'id' | 'createdAt'> = {
      galleryId: 'gallery-001',
      name: '测试轨道射灯',
      type: 'spot',
      power: 30,
      intensity: 2500,
      posX: 0,
      posY: 3.5,
      posZ: -2,
      angleX: -60,
      angleY: 0,
      angleZ: 0,
      beamAngle: 30,
      colorTemperature: 3200,
      createdBy: 'test-user'
    };

    it('首次提交光源应成功（201）', async () => {
      const response = await request(app)
        .post('/api/light-sources')
        .send(validLightSource);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(validLightSource.name);
    });

    it('同一展厅下同名光源重复提交应返回409', async () => {
      await request(app)
        .post('/api/light-sources')
        .send(validLightSource);

      const duplicateResponse = await request(app)
        .post('/api/light-sources')
        .send(validLightSource);

      expect(duplicateResponse.status).toBe(409);
      expect(duplicateResponse.body.success).toBe(false);
      expect(duplicateResponse.body.error.code).toBe('DUPLICATE_LIGHT_SOURCE');
    });

    it('不同展厅下同名光源应允许提交', async () => {
      await request(app)
        .post('/api/light-sources')
        .send(validLightSource);

      const differentGalleryResponse = await request(app)
        .post('/api/light-sources')
        .send({
          ...validLightSource,
          galleryId: 'gallery-002'
        });

      expect(differentGalleryResponse.status).toBe(201);
    });

    it('同一光源不同名称应允许提交', async () => {
      await request(app)
        .post('/api/light-sources')
        .send(validLightSource);

      const differentNameResponse = await request(app)
        .post('/api/light-sources')
        .send({
          ...validLightSource,
          name: '测试轨道射灯2号'
        });

      expect(differentNameResponse.status).toBe(201);
    });

    it('带幂等键的光源重复提交应返回409', async () => {
      const idempotencyKey = 'light-idemp-001';

      await request(app)
        .post('/api/light-sources')
        .set('x-idempotency-key', idempotencyKey)
        .send({ ...validLightSource, name: '唯一名称光源' });

      const duplicateResponse = await request(app)
        .post('/api/light-sources')
        .set('x-idempotency-key', idempotencyKey)
        .send({ ...validLightSource, name: '唯一名称光源' });

      expect(duplicateResponse.status).toBe(409);
      expect(duplicateResponse.body.error.code).toBe('DUPLICATE_SUBMISSION');
    });
  });

  describe('重复提交不创建新记录', () => {
    it('幂等键重复提交时，数据库记录数不应增加', async () => {
      const artwork: Omit<Artwork, 'id' | 'createdAt'> = {
        galleryId: 'gallery-001',
        registrationNo: 'WH-TEST-0010',
        name: '测试作品',
        lightResistanceGrade: 'ISO 15426 Grade 2',
        posX: 0,
        posY: 1.5,
        posZ: 0,
        width: 1,
        height: 1,
        protectionLevel: '二级',
        createdBy: 'test-user'
      };

      const idempotencyKey = 'count-test-001';

      await request(app)
        .post('/api/artworks')
        .set('x-idempotency-key', idempotencyKey)
        .send(artwork);

      expect(getDataStore().artworks).toHaveLength(1);

      await request(app)
        .post('/api/artworks')
        .set('x-idempotency-key', idempotencyKey)
        .send(artwork);

      expect(getDataStore().artworks).toHaveLength(1);
    });

    it('业务主键重复时，数据库记录数不应增加', async () => {
      const lightSource: Omit<LightSource, 'id' | 'createdAt'> = {
        galleryId: 'gallery-001',
        name: '计数测试光源',
        type: 'spot',
        power: 30,
        intensity: 2500,
        posX: 0,
        posY: 3,
        posZ: 0,
        angleX: -90,
        angleY: 0,
        angleZ: 0,
        beamAngle: 30,
        colorTemperature: 3200,
        createdBy: 'test-user'
      };

      await request(app)
        .post('/api/light-sources')
        .send(lightSource);

      expect(getDataStore().lightSources).toHaveLength(1);

      await request(app)
        .post('/api/light-sources')
        .send(lightSource);

      expect(getDataStore().lightSources).toHaveLength(1);
    });

    it('多次重复提交后，数据保持一致', async () => {
      const artwork: Omit<Artwork, 'id' | 'createdAt'> = {
        galleryId: 'gallery-001',
        registrationNo: 'WH-TEST-0020',
        name: '一致性测试作品',
        lightResistanceGrade: 'ISO 15426 Grade 1',
        posX: 0,
        posY: 1.5,
        posZ: 0,
        width: 1,
        height: 1,
        protectionLevel: '一级',
        createdBy: 'test-user'
      };

      const idempotencyKey = 'consistency-test-001';

      const firstResponse = await request(app)
        .post('/api/artworks')
        .set('x-idempotency-key', idempotencyKey)
        .send(artwork);

      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/artworks')
          .set('x-idempotency-key', idempotencyKey)
          .send(artwork);
      }

      const listResponse = await request(app).get('/api/artworks');

      expect(listResponse.body.data).toHaveLength(1);
      expect(listResponse.body.data[0].id).toBe(firstResponse.body.data.id);
      expect(listResponse.body.data[0].registrationNo).toBe(artwork.registrationNo);
    });

    it('不同类型资源的幂等键互不影响', async () => {
      const idempotencyKey = 'shared-key-001';

      const artwork: Omit<Artwork, 'id' | 'createdAt'> = {
        galleryId: 'gallery-001',
        registrationNo: 'WH-TEST-0030',
        name: '共享键作品',
        lightResistanceGrade: 'ISO 15426 Grade 1',
        posX: 0,
        posY: 1.5,
        posZ: 0,
        width: 1,
        height: 1,
        protectionLevel: '一级',
        createdBy: 'test-user'
      };

      const lightSource: Omit<LightSource, 'id' | 'createdAt'> = {
        galleryId: 'gallery-001',
        name: '共享键光源',
        type: 'spot',
        power: 30,
        intensity: 2500,
        posX: 0,
        posY: 3,
        posZ: 0,
        angleX: -90,
        angleY: 0,
        angleZ: 0,
        beamAngle: 30,
        colorTemperature: 3200,
        createdBy: 'test-user'
      };

      const artworkResponse = await request(app)
        .post('/api/artworks')
        .set('x-idempotency-key', idempotencyKey)
        .send(artwork);

      const lightSourceResponse = await request(app)
        .post('/api/light-sources')
        .set('x-idempotency-key', idempotencyKey)
        .send(lightSource);

      expect(artworkResponse.status).toBe(201);
      expect(lightSourceResponse.status).toBe(201);
      expect(getDataStore().artworks).toHaveLength(1);
      expect(getDataStore().lightSources).toHaveLength(1);
    });
  });
});
