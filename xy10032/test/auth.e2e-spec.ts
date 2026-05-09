import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          username: `testuser_${Date.now()}`,
          email: `test${Date.now()}@example.com`,
          password: 'password123',
          fullName: '测试用户',
        })
        .expect(201);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.username).toBeDefined();
    });

    it('should fail with invalid data', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          username: '',
          password: '123',
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    const credentials = {
      username: 'admin',
      password: 'password123',
    };

    it('should login successfully with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(credentials)
        .expect(201);

      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user).toBeDefined();
    });

    it('should fail with invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password123',
        });

      const token = loginResponse.body.data.accessToken;

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.username).toBe('admin');
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });
  });
});
