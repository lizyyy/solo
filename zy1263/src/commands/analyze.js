const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const { initDb, createTables, closeDb } = require('../database');
const { importAll } = require('../importer');
const { runAllAnalyses } = require('../analyzer');
const { exportReport } = require('../exporter');

function loadConfig(configPath) {
  const absolutePath = path.resolve(configPath);
  if (!fs.existsSync(absolutePath)) {
    console.log(`⚠ 配置文件不存在: ${absolutePath}，使用默认配置`);
    return {
      dataDir: './data',
      dbPath: './msa-db.sqlite',
      maxSyncChainLength: 3
    };
  }
  
  const content = fs.readFileSync(absolutePath, 'utf8');
  return yaml.load(content) || {};
}

async function run(options) {
  const config = loadConfig(options.config);
  const outputDir = path.resolve(options.output);
  const format = options.format || 'all';
  
  console.log(`🔬 开始分析微服务架构...`);
  
  const originalCwd = process.cwd();
  const configDir = path.dirname(path.resolve(options.config));
  process.chdir(configDir);
  
  try {
    const dbPath = path.resolve(config.dbPath || './msa-db.sqlite');
    await initDb(dbPath);
    createTables();
    
    console.log(`📥 导入数据...`);
    await importAll({
      dataDir: path.resolve(config.dataDir || './data')
    });
    
    const result = runAllAnalyses({
      maxSyncChainLength: config.maxSyncChainLength || 3
    });
    
    if (result.issues.length > 0) {
      console.log(`\n📤 导出报告...`);
      process.chdir(originalCwd);
      exportReport(result.reportId, outputDir, format);
    } else {
      console.log(`\n✅ 架构健康，未发现问题！`);
    }
    
    return result;
    
  } finally {
    closeDb();
    process.chdir(originalCwd);
  }
}

module.exports = {
  run,
  loadConfig
};
