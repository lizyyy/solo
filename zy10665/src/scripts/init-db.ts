import fs from 'fs';
import path from 'path';
import { createTables } from '../db/schema';
import { closeDB } from '../db';

async function init() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  console.log('创建数据库表...');
  await createTables();
  console.log('数据库初始化完成！');
  await closeDB();
}

init().catch(console.error);
