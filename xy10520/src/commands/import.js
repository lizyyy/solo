const fs = require('fs');
const path = require('path');
const { isInitialized } = require('../config');
const { importStores } = require('../services/storeService');
const { importInspections, importIssues } = require('../services/inspectionService');
const { submitCorrection } = require('../services/correctionService');
const { submitReinspection } = require('../services/reinspectionService');

function loadJsonFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }
  const content = fs.readFileSync(absolutePath, 'utf-8');
  return JSON.parse(content);
}

function printImportResults(type, results) {
  console.log(`\n=== ${type} 导入结果 ===`);
  console.log(`成功: ${results.success.length} 条`);
  console.log(`跳过: ${results.skipped.length} 条`);
  console.log(`失败: ${results.failed.length} 条`);
  
  if (results.skipped.length > 0) {
    console.log('\n跳过原因:');
    for (const item of results.skipped) {
      console.log(`  - ${JSON.stringify(item.input)}: ${item.reason}`);
    }
  }
  
  if (results.failed.length > 0) {
    console.log('\n失败原因:');
    for (const item of results.failed) {
      console.log(`  - ${JSON.stringify(item.input)}: ${item.reason}`);
    }
  }
  
  console.log('');
}

function importCmd(type, filePath, options = {}) {
  if (!isInitialized()) {
    console.log('[错误] 系统未初始化，请先运行: inspect init');
    return false;
  }
  
  const operator = options.operator || 'system';
  
  try {
    const data = loadJsonFile(filePath);
    const items = Array.isArray(data) ? data : [data];
    
    let results;
    switch (type) {
      case 'stores':
        results = importStores(items, operator);
        printImportResults('门店', results);
        break;
        
      case 'inspections':
        results = importInspections(items, operator);
        printImportResults('巡店记录', results);
        break;
        
      case 'issues':
        results = importIssues(items, operator);
        printImportResults('巡店问题', results);
        break;
        
      case 'corrections':
        console.log('\n=== 整改反馈导入结果 ===');
        let corrSuccess = 0, corrSkipped = 0, corrFailed = 0;
        for (const item of items) {
          const result = submitCorrection(item, operator);
          if (result.skipped) {
            corrSkipped++;
            console.log(`  [跳过] ${result.reason}`);
          } else if (result.success) {
            corrSuccess++;
            console.log(`  [成功] 提交整改: ${result.success.id}`);
          } else {
            corrFailed++;
            console.log(`  [失败] ${result.failed.reason}`);
          }
        }
        console.log(`成功: ${corrSuccess} 条, 跳过: ${corrSkipped} 条, 失败: ${corrFailed} 条`);
        break;
        
      case 'reinspections':
        console.log('\n=== 复查结果导入结果 ===');
        let reinsSuccess = 0, reinsSkipped = 0, reinsFailed = 0;
        for (const item of items) {
          const result = submitReinspection(item, operator);
          if (result.skipped) {
            reinsSkipped++;
            console.log(`  [跳过] ${result.reason}`);
          } else if (result.success) {
            reinsSuccess++;
            console.log(`  [成功] 提交复查: ${result.success.id} (${result.success.result})`);
          } else {
            reinsFailed++;
            console.log(`  [失败] ${result.failed.reason}`);
          }
        }
        console.log(`成功: ${reinsSuccess} 条, 跳过: ${reinsSkipped} 条, 失败: ${reinsFailed} 条`);
        break;
        
      default:
        console.log('[错误] 未知的导入类型: ' + type);
        console.log('支持的类型: stores, inspections, issues, corrections, reinspections');
        return false;
    }
    
    return true;
  } catch (e) {
    console.log('[错误] 导入失败:', e.message);
    return false;
  }
}

module.exports = { importCmd };
