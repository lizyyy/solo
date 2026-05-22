import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

process.env.NODE_ENV = 'test';
process.env.DB_PATH = './data/test.db';

beforeAll(() => {
  const dbDir = path.dirname(process.env.DB_PATH!);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
});

afterAll(() => {
  if (fs.existsSync(process.env.DB_PATH!)) {
    fs.unlinkSync(process.env.DB_PATH!);
  }
});
