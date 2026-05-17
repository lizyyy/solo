import fs from 'fs';
import path from 'path';
import { sequelize } from '../models';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function migrate() {
  try {
    console.log('开始数据库迁移...');
    
    await sequelize.authenticate();
    console.log('数据库连接成功');

    await sequelize.sync({ alter: true });
    console.log('所有模型已同步到数据库');

    console.log('数据库迁移完成!');
    process.exit(0);
  } catch (error) {
    console.error('数据库迁移失败:', error);
    process.exit(1);
  }
}

migrate();
