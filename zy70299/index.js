#!/usr/bin/env node

const { BillBoardManager } = require('./src/billboard-manager');
const { InspectionImporter } = require('./src/inspection-importer');
const { RiskAssessor } = require('./src/risk-assessor');
const { ReportGenerator } = require('./src/report-generator');

const manager = new BillBoardManager();
const importer = new InspectionImporter(manager);
const assessor = new RiskAssessor();
const reporter = new ReportGenerator();

function showHelp() {
  console.log(`
户外广告牌巡检 CLI 使用说明

从空数据到最终报表的完整流程：

1. 初始化广告牌档案
   os-inspect init

2. 导入广告牌档案（CSV 或 JSON）
   os-inspect import-signs <文件路径>
   示例: os-inspect import-signs ./samples/signs.json
         os-inspect import-signs ./samples/signs.csv

3. 导入巡检记录（CSV 或 JSON）
   os-inspect import-inspections <文件路径>
   示例: os-inspect import-inspections ./samples/inspections.json
         os-inspect import-inspections ./samples/inspections.csv

4. 执行风险评估
   os-inspect assess

5. 生成报表
   os-inspect report [--json|--csv] [--output <文件路径>]
   示例: os-inspect report
         os-inspect report --json
         os-inspect report --csv --output ./report.csv

6. 查看统计信息
   os-inspect stats

其他命令:
   os-inspect list-signs              列出所有广告牌
   os-inspect list-inspections        列出所有巡检记录
   os-inspect clear                   清除所有数据
   os-inspect help                    显示此帮助信息

数据主线:
  广告牌档案 → 巡检记录(锈蚀/照明) → 风险评分(含合同到期) → 复核结果
  `);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init':
      await manager.init();
      console.log('✅ 已初始化数据目录');
      console.log('📁 数据目录: ./data');
      console.log('📋 请先导入广告牌档案: os-inspect import-signs <文件路径>');
      break;

    case 'import-signs':
      if (args.length < 2) {
        console.error('❌ 请指定文件路径');
        console.log('用法: os-inspect import-signs <文件路径>');
        process.exit(1);
      }
      await importer.importSigns(args[1]);
      break;

    case 'import-inspections':
      if (args.length < 2) {
        console.error('❌ 请指定文件路径');
        console.log('用法: os-inspect import-inspections <文件路径>');
        process.exit(1);
      }
      await importer.importInspections(args[1]);
      break;

    case 'assess':
      const allSigns = await manager.getAllSigns();
      const allInspections = await manager.getAllInspections();
      const results = assessor.assessAll(allSigns, allInspections);
      await manager.saveRiskResults(results);
      console.log(`\n✅ 风险评估完成！`);
      console.log(`📊 共评估 ${results.length} 个广告牌`);
      console.log(`⚠️  需要人工确认: ${results.filter(r => r.needsReview).length} 个`);
      console.log('\n💡 查看结果: os-inspect report');
      break;

    case 'report':
      const format = args.includes('--json') ? 'json' : args.includes('--csv') ? 'csv' : 'console';
      const outputIndex = args.indexOf('--output');
      const outputPath = outputIndex > -1 ? args[outputIndex + 1] : null;
      
      const signs = await manager.getAllSigns();
      const inspections = await manager.getAllInspections();
      const riskResults = await manager.getRiskResults();
      
      if (riskResults.length === 0) {
        console.log('⚠️  未找到风险评估结果，请先执行: os-inspect assess');
        process.exit(1);
      }
      
      await reporter.generateReport(signs, inspections, riskResults, format, outputPath);
      break;

    case 'stats':
      const statsSigns = await manager.getAllSigns();
      const statsInspections = await manager.getAllInspections();
      const statsRisk = await manager.getRiskResults();
      
      console.log('\n📊 数据统计');
      console.log('='.repeat(50));
      console.log(`广告牌总数: ${statsSigns.length}`);
      console.log(`巡检记录数: ${statsInspections.length}`);
      console.log(`风险评估数: ${statsRisk.length}`);
      
      if (statsRisk.length > 0) {
        const highRisk = statsRisk.filter(r => r.riskLevel === 'high').length;
        const mediumRisk = statsRisk.filter(r => r.riskLevel === 'medium').length;
        const lowRisk = statsRisk.filter(r => r.riskLevel === 'low').length;
        const needsReview = statsRisk.filter(r => r.needsReview).length;
        
        console.log(`\n风险等级分布:`);
        console.log(`  🔴 高风险: ${highRisk}`);
        console.log(`  🟡 中风险: ${mediumRisk}`);
        console.log(`  🟢 低风险: ${lowRisk}`);
        console.log(`\n⚠️  需要人工确认: ${needsReview}`);
      }
      console.log('');
      break;

    case 'list-signs':
      const listSigns = await manager.getAllSigns();
      if (listSigns.length === 0) {
        console.log('⚠️  暂无广告牌数据');
      } else {
        console.log('\n📋 广告牌列表');
        console.log('='.repeat(80));
        listSigns.forEach(sign => {
          const daysLeft = getDaysUntilContractEnd(sign.contractEndDate);
          console.log(`ID: ${sign.id}`);
          console.log(`  位置: ${sign.location}`);
          console.log(`  合同到期: ${sign.contractEndDate}${daysLeft <= 30 ? ` (${daysLeft}天)` : ''}`);
          console.log('');
        });
      }
      break;

    case 'list-inspections':
      const listInsp = await manager.getAllInspections();
      if (listInsp.length === 0) {
        console.log('⚠️  暂无巡检记录');
      } else {
        console.log('\n📝 巡检记录列表');
        console.log('='.repeat(80));
        listInsp.forEach(ins => {
          console.log(`日期: ${ins.date} | 广告牌: ${ins.signId}`);
          console.log(`  锈蚀程度: ${ins.rustLevel} | 照明状态: ${ins.lightingStatus}`);
          console.log(`  巡检员: ${ins.inspector}`);
          console.log('');
        });
      }
      break;

    case 'clear':
      await manager.clearAll();
      console.log('🗑️  已清除所有数据');
      break;

    case 'help':
    case '--help':
    case '-h':
    default:
      showHelp();
  }
}

function getDaysUntilContractEnd(endDate) {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

main().catch(console.error);
