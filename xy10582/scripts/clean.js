'use strict';

const path = require('path');
const fs = require('fs-extra');
const { DIRS } = require('../src/utils/constants');

async function clean() {
  const workspace = process.cwd();
  
  console.log('清理工作区数据...');
  
  const dataDir = path.join(workspace, DIRS.DATA);
  const reportsDir = path.join(workspace, DIRS.REPORTS);
  const archivedDir = path.join(workspace, DIRS.ARCHIVED);
  
  const dirs = [dataDir, reportsDir, archivedDir];
  
  for (const dir of dirs) {
    if (await fs.pathExists(dir)) {
      await fs.remove(dir);
      console.log(`已删除: ${path.relative(workspace, dir)}`);
    }
  }
  
  console.log('清理完成');
}

clean().catch(err => {
  console.error('清理失败:', err.message);
  process.exit(1);
});
