import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

process.env.NODE_ENV = 'test';

jest.setTimeout(30000);

afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});
