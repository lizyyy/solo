const fs = require('fs');
const path = require('path');

// 导入各模块
const { readCsv } = require('./readers/csv-reader');
const { readXlsx } = require('./readers/xlsx-reader');
const { readJson } = require('./readers/json-reader');
const { readMarkdown } = require('./readers/md-reader');
const { normalizeAll } = require('./normalizer');
const { analyzeAll } = require('./analyzer');
const { generateReports, SEVERITY_DISPLAY } = require('./reporter');

/**
 * 扫描目录中的所有支持的文件
 * @param {string} dirPath - 目录路径
 * @returns {Object} 找到的文件路径
 */
function scanDirectory(dirPath) {
  const result = {
    quote: null,      // quote.csv 或 quote.xlsx
    contract: null,   // contract.md
    catalog: null,    // catalog.json
    approval: null,   // approval-notes.json
    allFiles: []      // 所有找到的文件
  };
  
  if (!fs.existsSync(dirPath)) {
    throw new Error(`目录不存在: ${dirPath}`);
  }
  
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    const stats = fs.statSync(fullPath);
    
    if (!stats.isFile()) return;
    
    const lowerFile = file.toLowerCase();
    
    result.allFiles.push({
      name: file,
      path: fullPath,
      size: stats.size
    });
    
    // 识别报价单文件
    if (lowerFile === 'quote.csv' || lowerFile.endsWith('_quote.csv')) {
      result.quote = { path: fullPath, type: 'csv', name: file };
    } else if (lowerFile === 'quote.xlsx' || lowerFile.endsWith('_quote.xlsx')) {
      result.quote = { path: fullPath, type: 'xlsx', name: file };
    }
    
    // 识别合同文件
    if (lowerFile === 'contract.md' || lowerFile.endsWith('_contract.md')) {
      result.contract = { path: fullPath, type: 'markdown', name: file };
    }
    
    // 识别产品目录文件
    if (lowerFile === 'catalog.json' || lowerFile.endsWith('_catalog.json')) {
      result.catalog = { path: fullPath, type: 'json', subtype: 'catalog', name: file };
    }
    
    // 识别审批备注文件
    if (lowerFile === 'approval-notes.json' || lowerFile === 'approval.json' || lowerFile.endsWith('_approval.json')) {
      result.approval = { path: fullPath, type: 'json', subtype: 'approval', name: file };
    }
  });
  
  return result;
}

/**
 * 读取所有数据源
 * @param {Object} fileInfo - 扫描得到的文件信息
 * @returns {Object} 读取后的数据
 */
async function readAllSources(fileInfo) {
  const sources = {
    quote: null,
    contract: null,
    catalog: null,
    approval: null,
    readErrors: []
  };
  
  // 读取报价单
  if (fileInfo.quote) {
    try {
      if (fileInfo.quote.type === 'csv') {
        sources.quote = await readCsv(fileInfo.quote.path);
      } else if (fileInfo.quote.type === 'xlsx') {
        sources.quote = await readXlsx(fileInfo.quote.path);
      }
    } catch (error) {
      sources.readErrors.push({
        file: fileInfo.quote.name,
        error: error.error || error.message || '未知错误',
        type: 'quote_read_error'
      });
    }
  }
  
  // 读取合同
  if (fileInfo.contract) {
    try {
      sources.contract = await readMarkdown(fileInfo.contract.path);
    } catch (error) {
      sources.readErrors.push({
        file: fileInfo.contract.name,
        error: error.error || error.message || '未知错误',
        type: 'contract_read_error'
      });
    }
  }
  
  // 读取产品目录
  if (fileInfo.catalog) {
    try {
      sources.catalog = await readJson(fileInfo.catalog.path, 'catalog');
    } catch (error) {
      sources.readErrors.push({
        file: fileInfo.catalog.name,
        error: error.error || error.message || '未知错误',
        type: 'catalog_read_error'
      });
    }
  }
  
  // 读取审批备注
  if (fileInfo.approval) {
    try {
      sources.approval = await readJson(fileInfo.approval.path, 'approval');
    } catch (error) {
      sources.readErrors.push({
        file: fileInfo.approval.name,
        error: error.error || error.message || '未知错误',
        type: 'approval_read_error'
      });
    }
  }
  
  return sources;
}

/**
 * 执行完整的差异核对流程
 * @param {string} dirPath - 目录路径
 * @param {Object} options - 选项
 * @returns {Object} 完整结果
 */
async function runReconciliation(dirPath, options = {}) {
  const result = {
    success: false,
    scanResult: null,
    sources: null,
    normalized: null,
    analysis: null,
    reports: null,
    errors: [],
    warnings: []
  };
  
  try {
    // 1. 扫描目录
    console.log(`📂 扫描目录: ${dirPath}`);
    result.scanResult = scanDirectory(dirPath);
    
    if (result.scanResult.allFiles.length === 0) {
      result.warnings.push('目录中没有找到任何文件');
      console.log('⚠️  目录中没有找到任何文件');
    } else {
      console.log(`✅ 找到 ${result.scanResult.allFiles.length} 个文件`);
      
      // 显示找到的特定文件
      if (result.scanResult.quote) {
        console.log(`   - 报价单: ${result.scanResult.quote.name}`);
      }
      if (result.scanResult.contract) {
        console.log(`   - 合同: ${result.scanResult.contract.name}`);
      }
      if (result.scanResult.catalog) {
        console.log(`   - 产品目录: ${result.scanResult.catalog.name}`);
      }
      if (result.scanResult.approval) {
        console.log(`   - 审批备注: ${result.scanResult.approval.name}`);
      }
    }
    
    // 2. 读取数据源
    console.log('\n📖 读取数据源...');
    result.sources = await readAllSources(result.scanResult);
    
    if (result.sources.readErrors.length > 0) {
      result.sources.readErrors.forEach(err => {
        result.errors.push(err);
        console.log(`   ❌ 读取错误 [${err.file}]: ${err.error}`);
      });
    }
    
    // 3. 归一化数据
    console.log('\n🔄 归一化数据...');
    result.normalized = normalizeAll({
      quote: result.sources.quote,
      contract: result.sources.contract,
      catalog: result.sources.catalog,
      approval: result.sources.approval
    });
    
    // 收集归一化过程中的警告
    if (result.normalized.warnings && result.normalized.warnings.length > 0) {
      result.warnings = [...result.warnings, ...result.normalized.warnings];
      console.log(`   ⚠️  ${result.normalized.warnings.length} 个数据警告`);
    }
    
    // 4. 差异分析
    console.log('\n🔍 差异分析...');
    result.analysis = analyzeAll(result.normalized);
    
    console.log(`   发现 ${result.analysis.summary.totalIssues} 个问题:`);
    Object.entries(SEVERITY_DISPLAY).forEach(([key, display]) => {
      const count = result.analysis.summary.bySeverity[key] || 0;
      if (count > 0) {
        console.log(`      ${display.emoji} ${display.name}: ${count} 个`);
      }
    });
    
    // 5. 生成报告
    console.log('\n📄 生成报告...');
    result.reports = generateReports(result.analysis);
    console.log('   ✅ 报告生成完成');
    
    result.success = true;
    
  } catch (error) {
    result.errors.push({
      error: error.message || error.error || '未知错误',
      stack: error.stack
    });
    console.log(`❌ 执行失败: ${error.message || error.error}`);
  }
  
  return result;
}

/**
 * 导出报告到文件
 * @param {Object} reports - 报告对象
 * @param {string} outputDir - 输出目录
 * @param {string} baseName - 基础文件名
 */
async function exportReports(reports, outputDir, baseName = 'reconciliation-report') {
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = require('dayjs')().format('YYYYMMDD-HHmmss');
  const results = [];
  
  // 导出JSON
  if (reports.json) {
    const jsonPath = path.join(outputDir, `${baseName}-${timestamp}.json`);
    fs.writeFileSync(jsonPath, reports.json, 'utf-8');
    results.push({ type: 'json', path: jsonPath });
    console.log(`   📄 JSON报告: ${jsonPath}`);
  }
  
  // 导出Markdown
  if (reports.markdown) {
    const mdPath = path.join(outputDir, `${baseName}-${timestamp}.md`);
    fs.writeFileSync(mdPath, reports.markdown, 'utf-8');
    results.push({ type: 'markdown', path: mdPath });
    console.log(`   📄 Markdown报告: ${mdPath}`);
  }
  
  // 导出HTML
  if (reports.html) {
    const htmlPath = path.join(outputDir, `${baseName}-${timestamp}.html`);
    fs.writeFileSync(htmlPath, reports.html, 'utf-8');
    results.push({ type: 'html', path: htmlPath });
    console.log(`   📄 HTML报告: ${htmlPath}`);
  }
  
  return results;
}

/**
 * 在控制台打印简要结果
 * @param {Object} result - 完整结果
 */
function printSummary(result) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 差异核对结果摘要');
  console.log('='.repeat(60));
  
  if (!result.success) {
    console.log('\n❌ 执行过程中发生错误:');
    result.errors.forEach(err => {
      console.log(`   - ${err.error || err.message}`);
    });
    return;
  }
  
  if (!result.analysis) {
    console.log('\n⚠️  没有分析结果');
    return;
  }
  
  const summary = result.analysis.summary;
  
  console.log(`\n📊 问题统计: ${summary.totalIssues} 个问题`);
  console.log('');
  
  Object.entries(SEVERITY_DISPLAY).forEach(([key, display]) => {
    const count = summary.bySeverity[key] || 0;
    const bar = '█'.repeat(Math.min(count, 20)) + '░'.repeat(Math.max(0, 20 - count));
    console.log(`   ${display.emoji} ${display.name.padEnd(12)}: ${String(count).padStart(3)} ${bar}`);
  });
  
  // 按类型统计
  if (Object.keys(summary.byType).length > 0) {
    console.log('\n📑 按问题类型:');
    Object.entries(summary.byType).forEach(([type, count]) => {
      const displayName = require('./reporter').ISSUE_TYPE_DISPLAY[type] || type;
      console.log(`   - ${displayName}: ${count} 个`);
    });
  }
  
  // 确认话术
  if (result.reports && result.reports.copyTexts) {
    const copyTexts = result.reports.copyTexts;
    
    console.log('\n💬 可复制的确认话术:');
    
    if (copyTexts.summary) {
      console.log('\n【问题摘要】');
      console.log('─'.repeat(40));
      console.log(copyTexts.summary);
    }
    
    if (summary.totalIssues > 0) {
      console.log('\n' + '─'.repeat(60));
      console.log('💡 建议: ');
      
      if (summary.bySeverity.critical > 0) {
        console.log(`   🔴 有 ${summary.bySeverity.critical} 个问题需要立即与客户确认`);
      }
      if (summary.bySeverity.high > 0) {
        console.log(`   🟠 有 ${summary.bySeverity.high} 个问题需要内部确认`);
      }
      if (summary.bySeverity.medium > 0) {
        console.log(`   🟡 建议修订 ${summary.bySeverity.medium} 个问题`);
      }
      if (summary.bySeverity.low > 0) {
        console.log(`   🔵 建议检查 ${summary.bySeverity.low} 个问题`);
      }
      
      console.log('\n📄 请查看详细报告了解具体问题和建议');
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

module.exports = {
  scanDirectory,
  readAllSources,
  runReconciliation,
  exportReports,
  printSummary
};
