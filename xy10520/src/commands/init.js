const { DEFAULT_DATA_DIR, CONFIG_FILE, DEFAULT_CONFIG, ensureDir, isInitialized, writeConfig } = require('../config');
const { saveStores, saveInspections, saveIssues, saveCorrections, saveReinspections, saveScores, saveLogs } = require('../storage');

function init(options = {}) {
  if (isInitialized() && !options.force) {
    console.log('[错误] 系统已初始化，如需重新初始化请使用 --force 参数');
    console.log(`数据目录: ${DEFAULT_DATA_DIR}`);
    return false;
  }
  
  ensureDir(DEFAULT_DATA_DIR);
  writeConfig({ ...DEFAULT_CONFIG });
  
  saveStores([]);
  saveInspections([]);
  saveIssues([]);
  saveCorrections([]);
  saveReinspections([]);
  saveScores([]);
  saveLogs([]);
  
  console.log('[成功] 巡店问题整改系统初始化完成');
  console.log(`数据目录: ${DEFAULT_DATA_DIR}`);
  console.log('配置文件:', CONFIG_FILE);
  console.log('');
  console.log('默认配置:');
  console.log(`  - 默认整改期限: ${DEFAULT_CONFIG.defaultCorrectionDays} 天`);
  console.log(`  - 逾期扣分: ${DEFAULT_CONFIG.overduePenaltyPoints} 分`);
  console.log(`  - 复查不通过扣分: ${DEFAULT_CONFIG.reinspectionFailPenalty} 分`);
  console.log(`  - 基础评分: ${DEFAULT_CONFIG.totalBaseScore} 分`);
  
  return true;
}

module.exports = { init };
