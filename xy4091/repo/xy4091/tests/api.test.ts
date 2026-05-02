import request from 'supertest';
import { initApp } from '../src/app';
import { closeDatabase } from '../src/storage/database';
import { Express } from 'express';

let app: Express;

beforeAll(async () => {
  process.env.DB_PATH = ':memory:';
  app = await initApp();
});

afterAll(() => {
  closeDatabase();
});

describe('Health Check', () => {
  it('should return health status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
  });
});

describe('Wards API', () => {
  let wardId: string;

  it('should create a ward', async () => {
    const response = await request(app)
      .post('/api/wards')
      .send({
        name: '测试病区',
        code: 'TEST-001',
        department: '测试科室',
        floor: 1,
        contactPerson: '测试医生',
        contactPhone: '13800138000',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('测试病区');
    wardId = response.body.data.id;
  });

  it('should get ward by id', async () => {
    const response = await request(app).get(`/api/wards/${wardId}`);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(wardId);
  });

  it('should get all wards', async () => {
    const response = await request(app).get('/api/wards');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});

describe('Blood Bags API', () => {
  let bloodBagId: string;

  it('should create a blood bag', async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const response = await request(app)
      .post('/api/blood-bags')
      .send({
        bloodType: 'A+',
        componentType: 'RED_CELL',
        volume: 200,
        donorId: 'D-TEST-001',
        collectionDate: pastDate,
        expiryDate: futureDate,
        crossMatchStatus: 'COMPATIBLE',
        initialTemperature: 4.0,
        notes: '测试血袋',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.bloodType).toBe('A+');
    expect(response.body.data.status).toBe('AVAILABLE');
    bloodBagId = response.body.data.id;
  });

  it('should get blood bag by id', async () => {
    const response = await request(app).get(`/api/blood-bags/${bloodBagId}`);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(bloodBagId);
  });

  it('should get all blood bags with filters', async () => {
    const response = await request(app).get('/api/blood-bags?bloodType=A%2B&status=AVAILABLE');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('should add temperature record', async () => {
    const response = await request(app)
      .post(`/api/blood-bags/${bloodBagId}/temperature`)
      .send({
        temperature: 3.8,
        location: '血库检查',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.temperatureRecords.length).toBeGreaterThan(0);
  });

  it('should reserve a blood bag', async () => {
    const response = await request(app)
      .post(`/api/blood-bags/${bloodBagId}/reserve`)
      .send({
        operator: '测试操作员',
        notes: '测试预留',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('RESERVED');
  });

  it('should release a blood bag', async () => {
    const response = await request(app)
      .post(`/api/blood-bags/${bloodBagId}/release`)
      .send({
        operator: '测试操作员',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('AVAILABLE');
  });
});

describe('Applications API', () => {
  let wardId: string;
  let applicationId: string;
  let bloodBagId1: string;
  let bloodBagId2: string;

  beforeAll(async () => {
    const wardResponse = await request(app)
      .post('/api/wards')
      .send({
        name: '申请测试病区',
        code: 'APP-TEST-001',
        department: '测试科室',
        floor: 2,
      });
    wardId = wardResponse.body.data.id;

    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const bag1Response = await request(app)
      .post('/api/blood-bags')
      .send({
        bloodType: 'B+',
        componentType: 'RED_CELL',
        volume: 200,
        donorId: 'D-APP-001',
        collectionDate: pastDate,
        expiryDate: futureDate,
        crossMatchStatus: 'COMPATIBLE',
        initialTemperature: 4.0,
      });
    bloodBagId1 = bag1Response.body.data.id;

    const bag2Response = await request(app)
      .post('/api/blood-bags')
      .send({
        bloodType: 'B+',
        componentType: 'RED_CELL',
        volume: 200,
        donorId: 'D-APP-002',
        collectionDate: pastDate,
        expiryDate: futureDate,
        crossMatchStatus: 'COMPATIBLE',
        initialTemperature: 3.9,
      });
    bloodBagId2 = bag2Response.body.data.id;
  });

  it('should create an application', async () => {
    const response = await request(app)
      .post('/api/applications')
      .send({
        wardId: wardId,
        patientName: '测试患者',
        patientId: 'P-TEST-001',
        bloodType: 'B+',
        componentType: 'RED_CELL',
        quantity: 2,
        urgency: 'URGENT',
        clinicalDiagnosis: '测试诊断',
        crossMatchRequired: true,
        requestedBy: '测试医生',
        notes: '测试申请',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.patientName).toBe('测试患者');
    expect(response.body.data.status).toBe('PENDING');
    applicationId = response.body.data.id;
  });

  it('should get matching blood bags for application', async () => {
    const response = await request(app).get(`/api/applications/${applicationId}/match`);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.matchedBags).toBeDefined();
  });

  it('should get application by id', async () => {
    const response = await request(app).get(`/api/applications/${applicationId}`);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(applicationId);
  });
});

describe('Audit API', () => {
  it('should get audit logs', async () => {
    const response = await request(app).get('/api/audit');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});

describe('Reports API', () => {
  it('should get blood type compatibility info', async () => {
    const response = await request(app).get('/api/reports/blood-type-compatibility');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });

  it('should export inventory to CSV', async () => {
    const response = await request(app).get('/api/reports/inventory/csv');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('csv');
  });

  it('should generate shift report', async () => {
    const response = await request(app).get('/api/reports/shift-report');
    expect(response.status).toBe(200);
  });
});
