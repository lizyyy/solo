process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.JWT_EXPIRES_IN = '1h';

const db = require('../src/db');

beforeAll(async () => {
  await db.migrate.latest();
});

afterEach(async () => {
  await db('disputes').del();
  await db('inspection_reports').del();
  await db('inspection_items').del();
  await db('payment_records').del();
  await db('logistics').del();
  await db('orders').del();
  await db('products').del();
  await db('users').del();
});

afterAll(async () => {
  await db.migrate.rollback();
  await db.destroy();
});
