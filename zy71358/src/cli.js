#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const MetadataAuditor = require('./auditor');
const AuditReporter = require('./reporter');

const args = process.argv.slice(2);

function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           数字藏品元数据审计 - 命令行工具                     ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  用法:                                                       ║
║    npm run cli -- <命令> [选项]                              ║
║                                                              ║
║  命令:                                                       ║
║    audit <json文件>    执行审计并输出结果                     ║
║    export <json文件>   审计并导出报告 (json/csv/pdf/all)      ║
║    demo                使用示例数据运行审计演示               ║
║    server              启动API服务                           ║
║    help                显示帮助信息                          ║
║                                                              ║
║  选项:                                                       ║
║    --format <格式>     导出格式: json|csv|pdf|all            ║
║    --output <目录>     报告输出目录                          ║
║    --no-strict         非严格模式 (元数据缺失仅警告)         ║
║    --port <端口>       服务端口 (默认3000)                   ║
║                                                              ║
║  示例:                                                       ║
║    npm run cli -- demo                                       ║
║    npm run cli -- audit ./data/metadata.json                 ║
║    npm run cli -- export ./data.json --format all            ║
║    npm run cli -- server --port 8080                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

function getSampleData() {
  return [
    {
      tokenId: "NFT-001",
      name: "数字山水 #1",
      creator: "张艺术",
      imageHash: "a1b2c3d4e5f6g7h8",
      metadata: { name: "数字山水 #1", description: "中国山水画", image: "ipfs://..." },
      rights: { version: "v2.0", expiryDate: "2027-12-31" }
    },
    {
      tokenId: "NFT-001",
      name: "数字山水 #1 (重复)",
      creator: "张艺术",
      imageHash: "a1b2c3d4e5f6g7h8",
      metadata: { name: "数字山水 #1", description: "中国山水画", image: "ipfs://..." },
      rights: { version: "v2.0", expiryDate: "2027-12-31" }
    },
    {
      tokenId: "NFT-002",
      name: "赛博朋克城市",
      creator: "李设计",
      imageHash: "wrong_hash_value",
      metadata: { name: "赛博朋克城市", description: "" },
      rights: { version: "v1.0", expiryDate: "2020-01-01" }
    },
    {
      tokenId: "NFT-003",
      name: "抽象几何 #3",
      creator: "王创意",
      metadata: { name: "抽象几何 #3" },
      rights: { version: "v1.5", expiryDate: "2026-06-15" }
    },
    {
      name: "缺失编号作品",
      creator: "佚名",
      imageHash: "xyz789",
      metadata: { name: "缺失编号", description: "测试作品", image: "..." },
      rights: { version: "v1.0" }
    }
  ];
}

function printResults(results) {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 审计结果摘要');
  console.log('═'.repeat(60));
  
  const summary = results.summary || results;
  const total = summary.total || results.total || 0;
  const passed = summary.passed || results.passed || 0;
  const failed = summary.failed || results.failed || 0;
  const warnings = summary.warnings || results.warnings || 0;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(2) + '%' : '0%';
  const anomalyCount = results.anomalies?.length || summary.anomalyCount || 0;
  
  console.log(`
  审计ID:    ${results.auditId}
  审计时间:  ${new Date(results.auditTime).toLocaleString()}
  
  总计项目:  ${total}
  通过:      ${passed}
  未通过:    ${failed}
  通过率:    ${passRate}
  警告数:    ${warnings}
  异常数:    ${anomalyCount}
  `);

  const breakdown = summary.anomalyBreakdown || results.summary || {};
  console.log('📈 异常统计:');
  console.log(`  哈希校验失败: ${breakdown.hashFailures || 0}`);
  console.log(`  编号重复:     ${breakdown.duplicateIds || 0}`);
  console.log(`  权益过期:     ${breakdown.expiredRights || 0}`);
  console.log(`  元数据缺失:   ${breakdown.missingMetadata || 0}`);

  if (results.anomalies.length > 0) {
    console.log('\n' + '═'.repeat(60));
    console.log('⚠️  异常清单 (前20条)');
    console.log('═'.repeat(60));
    
    results.anomalies.slice(0, 20).forEach((a, idx) => {
      const typeIcon = a.type === 'error' ? '❌' : '⚠️';
      console.log(`${typeIcon} #${idx + 1} [${a.tokenId || 'N/A'}] ${a.name || '未知'}: ${a.message || a.type}`);
    });
    
    if (results.anomalies.length > 20) {
      console.log(`... 还有 ${results.anomalies.length - 20} 条异常`);
    }
  }
  
  console.log('═'.repeat(60) + '\n');
}

async function runAudit(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    console.error('❌ 文件不存在:', filePath);
    process.exit(1);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    console.error('❌ JSON解析失败:', e.message);
    process.exit(1);
  }
  
  const items = data.items || data;
  console.log(`📂 加载了 ${items.length} 条数据`);
  
  const auditor = new MetadataAuditor(options);
  const results = await auditor.auditBatch(items);
  
  printResults({
    auditId: results.auditId,
    auditTime: results.auditTime,
    summary: auditor.getSummary(),
    anomalies: results.anomalies
  });
  
  return results;
}

async function runExport(filePath, options = {}) {
  const results = await runAudit(filePath, options);
  
  const outputDir = options.outputDir || './reports';
  const reporter = new AuditReporter(results, outputDir);
  
  const format = options.format || 'json';
  let outputs;
  
  switch (format.toLowerCase()) {
    case 'csv':
      outputs = [await reporter.exportCsv()];
      break;
    case 'pdf':
      outputs = [await reporter.exportPdf()];
      break;
    case 'all':
      outputs = await reporter.exportAll();
      break;
    default:
      outputs = [reporter.exportJson()];
  }
  
  console.log('📄 导出的报告文件:');
  outputs.forEach(o => console.log(`   - ${o.path}`));
  console.log('');
}

async function runDemo() {
  console.log('🎬 运行审计演示 (包含各种异常情况)\n');
  
  const items = getSampleData();
  console.log(`📋 示例数据包含 ${items.length} 条记录，其中包含:`);
  console.log(`   - 编号重复 (NFT-001 出现2次)`);
  console.log(`   - 哈希不匹配 (NFT-002)`);
  console.log(`   - 权益过期 (NFT-002)`);
  console.log(`   - 元数据缺失 (NFT-003)`);
  console.log(`   - 缺少链上编号 (最后一条)\n`);
  
  const auditor = new MetadataAuditor();
  const results = await auditor.auditBatch(items);
  
  printResults({
    auditId: results.auditId,
    auditTime: results.auditTime,
    summary: auditor.getSummary(),
    anomalies: results.anomalies
  });
  
  console.log('💡 提示: 使用 export 命令可导出完整报告\n');
}

function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      options.format = args[i + 1];
    }
    if (args[i] === '--output' && args[i + 1]) {
      options.outputDir = args[i + 1];
    }
    if (args[i] === '--no-strict') {
      options.strictMode = false;
    }
    if (args[i] === '--port' && args[i + 1]) {
      options.port = parseInt(args[i + 1]);
    }
  }
  return options;
}

async function main() {
  const command = args[0];
  const options = parseOptions(args);
  
  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
      
    case 'demo':
      await runDemo();
      break;
      
    case 'audit':
      if (!args[1]) {
        console.error('❌ 请指定JSON文件路径');
        console.log('   用法: npm run cli -- audit <json文件>');
        process.exit(1);
      }
      await runAudit(args[1], options);
      break;
      
    case 'export':
      if (!args[1]) {
        console.error('❌ 请指定JSON文件路径');
        console.log('   用法: npm run cli -- export <json文件> --format all');
        process.exit(1);
      }
      await runExport(args[1], options);
      break;
      
    case 'server':
      process.env.PORT = options.port || 3000;
      require('./server');
      break;
      
    default:
      showHelp();
  }
}

main().catch(console.error);
