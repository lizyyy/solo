import * as path from 'path';
import * as fs from 'fs';
import { DatabaseService } from './src/services/database';
import { ImportService } from './src/services/import';
import { RiskDetectionService } from './src/services/risk-detection';
import { ExportService } from './src/services/export';

const dataDir = path.join(__dirname, '..', 'test-data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'climbing-reviewer.json');
const examplesDir = path.join(__dirname, '..', 'examples');

async function runTests() {
  console.log('=== 室内攀岩馆线路定线复盘器 - 服务测试 ===\n');

  const dbService = new DatabaseService(dbPath);
  const importService = new ImportService(dbService);
  const riskService = new RiskDetectionService(dbService);
  const exportService = new ExportService(dbService, riskService);

  console.log('1. 测试数据导入...');
  
  const wallZonesPath = path.join(examplesDir, 'wall-zones.json');
  const zonesCount = importService.importWallZones(wallZonesPath);
  console.log(`   ✓ 导入墙面分区: ${zonesCount} 个区域`);

  const routesPath = path.join(examplesDir, 'routes.csv');
  const routesCount = await importService.importRoutes(routesPath);
  console.log(`   ✓ 导入线路数据: ${routesCount} 条线路`);

  const wearPath = path.join(examplesDir, 'wear-records.csv');
  const wearCount = await importService.importWearRecords(wearPath);
  console.log(`   ✓ 导入磨损记录: ${wearCount} 条记录`);

  const feedbackPath = path.join(examplesDir, 'feedback.csv');
  const feedbackCount = await importService.importFeedback(feedbackPath);
  console.log(`   ✓ 导入会员反馈: ${feedbackCount} 条反馈\n`);

  console.log('2. 测试数据查询...');
  const allZones = dbService.getWallZones();
  const allRoutes = dbService.getAllRoutes();
  const allHolds = dbService.getAllHolds();
  const allFeedback = dbService.getAllFeedback();
  console.log(`   ✓ 墙面分区: ${allZones.length} 个`);
  console.log(`   ✓ 线路总数: ${allRoutes.length} 条`);
  console.log(`   ✓ 抓点总数: ${allHolds.length} 个`);
  console.log(`   ✓ 会员反馈: ${allFeedback.length} 条\n`);

  console.log('3. 测试风险检测...');
  const riskReport = riskService.detectAllRisks();
  console.log(`   检测到风险总数: ${riskReport.totalRisks} 项`);
  console.log(`   - 难度断层风险: ${riskReport.byType.difficulty_gap} 项`);
  console.log(`   - 抓点过期风险: ${riskReport.byType.hold_expired} 项`);
  console.log(`   - 儿童线路冲突: ${riskReport.byType.children_conflict} 项`);
  
  if (riskReport.risks.length > 0) {
    console.log('\n   风险详情 (前3项):');
    riskReport.risks.slice(0, 3).forEach((r, i) => {
      console.log(`     ${i + 1}. [${r.severity}] ${r.title}`);
    });
  }
  console.log('');

  console.log('4. 测试导出功能...');
  
  const markdownResult = exportService.exportMarkdownReview();
  const csvResult = exportService.exportMaintenanceList();
  const jsonResult = exportService.exportAuditPackage();
  
  const markdownPath = path.join(dataDir, markdownResult.filename);
  const csvPath = path.join(dataDir, csvResult.filename);
  const jsonPath = path.join(dataDir, jsonResult.filename);
  
  fs.writeFileSync(markdownPath, markdownResult.content, 'utf-8');
  fs.writeFileSync(csvPath, csvResult.content, 'utf-8');
  fs.writeFileSync(jsonPath, jsonResult.content, 'utf-8');
  
  console.log(`   ✓ Markdown 复盘报告: ${markdownPath}`);
  console.log(`   ✓ CSV 维护清单: ${csvPath}`);
  console.log(`   ✓ JSON 审计包: ${jsonPath}\n`);

  console.log('5. 测试线路编辑...');
  const newRouteId = dbService.saveRoute({
    name: '测试线路 - 简单斜坡',
    code: 'TEST-001',
    color: '#3498db',
    difficulty: 3,
    difficultyLabel: 'V3',
    zoneCode: 'zone-b',
    holdPositions: JSON.stringify([{x: 100, y: 200}, {x: 150, y: 300}]),
    startPosition: JSON.stringify({x: 100, y: 200}),
    endPosition: JSON.stringify({x: 150, y: 300}),
    setDate: new Date().toISOString().split('T')[0],
    isChildrenRoute: false,
    notes: '测试创建的线路'
  });
  console.log(`   ✓ 创建新线路 ID: ${newRouteId}`);
  
  const testRoute = dbService.getRouteByCode('TEST-001');
  console.log(`   ✓ 查询线路: ${testRoute?.name}\n`);

  console.log('6. 测试复核意见...');
  const reviewId = dbService.saveReview({
    reviewDate: new Date().toISOString(),
    reviewer: '测试定线员',
    routeCode: 'TEST-001',
    holdCode: '',
    reviewType: 'route_check',
    findings: '线路起点设置合理，但终点难度略高',
    recommendations: '建议降低终点抓点位置',
    priority: 'medium',
    resolved: false,
    resolvedDate: '',
    resolver: '',
    resolutionNotes: ''
  });
  console.log(`   ✓ 创建复核意见 ID: ${reviewId}`);
  
  const unresolved = dbService.getUnresolvedReviews();
  console.log(`   ✓ 待处理复核: ${unresolved.length} 条\n`);

  console.log('=== 测试完成 ===');
  console.log(`\n测试数据目录: ${dataDir}`);
  console.log('数据库文件已持久化，可以重新运行测试验证数据保存。\n');
  
  dbService.close();
}

runTests().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
