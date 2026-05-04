import { Command } from 'commander';
import { initDb, getDbPath } from '../db.js';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const program = new Command();

program
  .command('init')
  .description('初始化PCB检查工作区')
  .option('-f, --force', '强制重新初始化')
  .action(async (options) => {
    const dbPath = getDbPath();
    const dataDir = join(process.cwd(), '.pcbcheck');
    
    if (existsSync(dbPath) && !options.force) {
      console.log('工作区已存在，使用 --force 强制重新初始化');
      return;
    }
    
    try {
      const db = initDb();
      console.log(`数据库初始化成功: ${dbPath}`);
      
      const configPath = join(dataDir, 'config.json');
      if (!existsSync(configPath)) {
        const defaultConfig = {
          version: '1.0.0',
          settings: {
            defaultPasteExpiryDays: 90,
            maxPasteUsageCount: 10,
            reflowProfile: {
              leadFree: {
                peakTempMin: 245,
                peakTempMax: 255,
                soakTimeMin: 60,
                soakTimeMax: 120,
                reflowTimeMin: 40,
                reflowTimeMax: 60
              },
              leaded: {
                peakTempMin: 220,
                peakTempMax: 230,
                soakTimeMin: 60,
                soakTimeMax: 90,
                reflowTimeMin: 30,
                reflowTimeMax: 50
              }
            }
          }
        };
        writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log(`配置文件创建成功: ${configPath}`);
      }
      
      db.close();
