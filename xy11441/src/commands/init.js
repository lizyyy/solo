const { initDb, getDbPath } = require('../utils/database');
const { printSuccess, printInfo } = require('../utils/helpers');
const path = require('path');
const fs = require('fs');

async function initCommand(options) {
  printInfo('正在初始化生鲜分拣损耗巡检工具...');
  
  const force = options.force || false;
  const dbPath = getDbPath();
  
  if (force && fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    printInfo('已删除旧数据库');
  }
  
  initDb();
  
  printSuccess('数据库初始化完成');
  printInfo(`数据库位置: ${dbPath}`);
  
  const dataDir = path.join(process.cwd(), 'data', 'imports');
  const exportDir = path.join(process.cwd(), 'data', 'exports');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  
  printInfo(`导入目录: ${dataDir}`);
  printInfo(`导出目录: ${exportDir}`);
  
  printSuccess('初始化完成!');
  printInfo('默认管理员账号: admin / admin123 (角色: 主管)');
  printInfo('请使用 `fli login` 登录后开始使用');
}

module.exports = initCommand;
