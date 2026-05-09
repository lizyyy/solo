const { initDatabase } = require('../src/database/schema');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await initDatabase();
});

afterAll((done) => {
  const db = require('../src/config/database');
  db.close(done);
});
