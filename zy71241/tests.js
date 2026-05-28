// ==========================================
// 3D打印农场调度 - 测试用例
// ==========================================

const {
  MaterialType,
  NozzleSize,
  FaultType,
  OrderStatus,
  IssueType,
  ReviewStatus,
  Printer,
  MaterialRoll,
  Nozzle,
  Order,
  FaultEvent,
  SchedulingIssue
} = require('./models');

const { SchedulingEngine, ValidationResult } = require('./scheduler');
const { ScoringEngine, ReportExporter, ScoringConfig } = require('./scoring');

// 测试工具函数
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}`);
    console.log(`   错误: ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `期望 ${expected}, 实际 ${actual}`);
  }
}

// ==========================================
// 测试套件 1: 数据模型测试
// ==========================================
console.log('\n' + '='.repeat(60));
console.log('🧪 测试套件 1: 数据模型测试');
console.log('='.repeat(60));

test('Printer - 材料支持检测', () => {
  const printer = new Printer('P1', 'Test Printer', ['PLA', 'ABS'], '0.6mm');
  assertEqual(printer.isMaterialSupported('PLA'), true, '应该支持PLA');
  assertEqual(printer.isMaterialSupported('TPU'), false, '不应该支持TPU');
});

test('Printer - 喷嘴兼容性检测', () => {
  const printer = new Printer('P1', 'Test Printer', ['PLA'], '0.6mm');
  assertEqual(printer.isNozzleCompatible('0.4mm'), true, '0.4mm应该兼容');
  assertEqual(printer.isNozzleCompatible('0.6mm'), true, '0.6mm应该兼容');
  assertEqual(printer.isNozzleCompatible('0.8mm'), false, '0.8mm不应该兼容');
});

test('MaterialRoll - 材料消耗', () => {
  const material = new MaterialRoll('M1', 'PLA', '白色', 1000);
  const result = material.consume(300);
  assertEqual(result.consumed, 300, '应该消耗300mm');
  assertEqual(result.insufficient, false, '不应该材料不足');
  assertEqual(material.remainingLength, 700, '剩余700mm');
});

test('MaterialRoll - 材料耗尽', () => {
  const material = new MaterialRoll('M1', 'PLA', '白色', 500);
  const result = material.consume(800);
  assertEqual(result.consumed, 500, '应该消耗全部500mm');
  assertEqual(result.insufficient, true, '应该标记材料不足');
  assertEqual(material.isEmpty(), true, '材料应该为空');
});

test('Nozzle - 磨损和堵塞风险', () => {
  const nozzle = new Nozzle('N1', '0.4mm', 'brass', 200);
  nozzle.use(180);
  assertEqual(nozzle.getWearPercentage(), 90, '磨损度应为90%');
  assertEqual(nozzle.needsReplacement(), true, '应该需要更换');
});

test('Order - 交期检测', () => {
  const now = new Date();
  const past = new Date(now.getTime() - 1000);
  const future = new Date(now.getTime() + 10000);
  
  const order1 = new Order('O1', 'Test', 'PLA', '0.4mm', 100, 1, past);
  order1.status = OrderStatus.COMPLETED;
  order1.endTime = now;
  assertEqual(order1.isOverdue(now), true, '应该标记为逾期');
  
  const order2 = new Order('O2', 'Test', 'PLA', '0.4mm', 100, 1, future);
  assertEqual(order2.isOverdue(now), false, '不应该逾期');
});

test('FaultEvent - 故障类型和严重性', () => {
  const fault = new FaultEvent('F1', FaultType.NOZZLE_CLOG, 'P1', new Date());
  assertEqual(fault.getTypeName(), '喷嘴堵塞', '类型名称应为喷嘴堵塞');
  assertEqual(fault.getSeverity(), 'low', '严重性应为low');
  assertEqual(fault.getEstimatedDowntime(), 15, '预计停机15分钟');
});

test('SchedulingIssue - 获取类型名称', () => {
  const issue = new SchedulingIssue(
    IssueType.MATERIAL_MISMATCH,
    { orderId: 'O1' },
    '材料错配'
  );
  assertEqual(issue.getTypeName(), '材料错配', '类型名称应为材料错配');
});

// ==========================================
// 测试套件 2: 输入验证测试
// ==========================================
console.log('\n' + '='.repeat(60));
console.log('🧪 测试套件 2: 输入验证测试');
console.log('='.repeat(60));

test('打印机输入验证 - 完整数据', () => {
  const engine = new SchedulingEngine();
  const result = engine.validatePrinterInput({
    id: 'P1',
    name: 'Test Printer',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.4mm'
  });
  assertEqual(result.valid, true, '验证应该通过');
  assertEqual(result.missingFields.length, 0, '没有缺失字段');
});

test('打印机输入验证 - 缺失字段', () => {
  const engine = new SchedulingEngine();
  const result = engine.validatePrinterInput({
    id: '',
    name: '',
    supportedMaterials: [],
    maxNozzleSize: ''
  });
  assertEqual(result.valid, false, '验证应该失败');
  assert(result.missingFields.length > 0, '应该有缺失字段');
  console.log('   缺失字段:', result.missingFields.map(f => f.field).join(', '));
});

test('订单输入验证 - 缺失截止日期警告', () => {
  const engine = new SchedulingEngine();
  const result = engine.validateOrderInput({
    id: 'O1',
    name: 'Test Order',
    requiredMaterial: 'PLA',
    requiredNozzleSize: '0.4mm',
    printLength: 100,
    estimatedHours: 1
  });
  assertEqual(result.valid, true, '验证应该通过');
  assert(result.warnings.length > 0, '应该有警告');
  console.log('   警告:', result.warnings);
});

test('材料输入验证 - 未知材料类型警告', () => {
  const engine = new SchedulingEngine();
  const result = engine.validateMaterialInput({
    id: 'M1',
    materialType: 'UNKNOWN',
    color: '红色',
    totalLength: 1000
  });
  assertEqual(result.valid, true, '验证应该通过');
  assert(result.warnings.length > 0, '应该有警告');
});

// ==========================================
// 测试套件 3: 调度可行性检测
// ==========================================
console.log('\n' + '='.repeat(60));
console.log('🧪 测试套件 3: 调度可行性检测');
console.log('='.repeat(60));

test('材料错配检测', () => {
  const engine = new SchedulingEngine();
  
  engine.addPrinter({
    id: 'P1',
    name: 'Printer 1',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  engine.addMaterial({
    id: 'M1',
    materialType: 'ABS',
    color: '黑色',
    totalLength: 10000
  });
  
  engine.addNozzle({
    id: 'N1',
    size: '0.4mm'
  });
  
  engine.addOrder({
    id: 'O1',
    name: 'Test',
    requiredMaterial: 'PLA',
    requiredNozzleSize: '0.4mm',
    printLength: 500,
    estimatedHours: 2
  });
  
  engine.installMaterial('P1', 'M1');
  engine.installNozzle('P1', 'N1');
  
  const result = engine.checkSchedulingFeasibility('O1', 'P1');
  assertEqual(result.feasible, false, '应该检测到材料错配');
  
  const mismatchIssues = result.issues.filter(i => i.type === IssueType.MATERIAL_MISMATCH);
  assertEqual(mismatchIssues.length, 1, '应该有一个材料错配问题');
  
  const issue = mismatchIssues[0];
  console.log('   影响对象:', JSON.stringify(issue.affectedObjects));
  console.log('   原因:', issue.reason);
});

test('喷嘴不适用检测', () => {
  const engine = new SchedulingEngine();
  
  engine.addPrinter({
    id: 'P1',
    name: 'Printer 1',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  engine.addMaterial({
    id: 'M1',
    materialType: 'PLA',
    color: '白色',
    totalLength: 10000
  });
  
  engine.addNozzle({
    id: 'N1',
    size: '0.8mm'
  });
  
  engine.addOrder({
    id: 'O1',
    name: 'Test',
    requiredMaterial: 'PLA',
    requiredNozzleSize: '0.4mm',
    printLength: 500,
    estimatedHours: 2
  });
  
  engine.installMaterial('P1', 'M1');
  engine.installNozzle('P1', 'N1');
  
  const result = engine.checkSchedulingFeasibility('O1', 'P1');
  assertEqual(result.feasible, false, '应该检测到喷嘴不适用');
  
  const nozzleIssues = result.issues.filter(i => i.type === IssueType.UNSUITABLE_NOZZLE);
  assertEqual(nozzleIssues.length, 1, '应该有一个喷嘴不适用问题');
  console.log('   原因:', nozzleIssues[0].reason);
});

test('材料不足检测', () => {
  const engine = new SchedulingEngine();
  
  engine.addPrinter({
    id: 'P1',
    name: 'Printer 1',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  engine.addMaterial({
    id: 'M1',
    materialType: 'PLA',
    color: '白色',
    totalLength: 100
  });
  
  engine.addNozzle({
    id: 'N1',
    size: '0.4mm'
  });
  
  engine.addOrder({
    id: 'O1',
    name: 'Test',
    requiredMaterial: 'PLA',
    requiredNozzleSize: '0.4mm',
    printLength: 500,
    estimatedHours: 2
  });
  
  engine.installMaterial('P1', 'M1');
  engine.installNozzle('P1', 'N1');
  
  const result = engine.checkSchedulingFeasibility('O1', 'P1');
  assertEqual(result.feasible, false, '应该检测到材料不足');
  
  const materialIssues = result.issues.filter(i => i.type === IssueType.INSUFFICIENT_MATERIAL);
  assertEqual(materialIssues.length, 1, '应该有一个材料不足问题');
  console.log('   原因:', materialIssues[0].reason);
});

test('交期超时预警', () => {
  const engine = new SchedulingEngine();
  const now = new Date();
  
  engine.addPrinter({
    id: 'P1',
    name: 'Printer 1',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  engine.addMaterial({
    id: 'M1',
    materialType: 'PLA',
    color: '白色',
    totalLength: 10000
  });
  
  engine.addNozzle({
    id: 'N1',
    size: '0.4mm'
  });
  
  engine.addOrder({
    id: 'O1',
    name: 'Test',
    requiredMaterial: 'PLA',
    requiredNozzleSize: '0.4mm',
    printLength: 500,
    estimatedHours: 10,
    deadline: new Date(now.getTime() + 2 * 60 * 60 * 1000)
  });
  
  engine.installMaterial('P1', 'M1');
  engine.installNozzle('P1', 'N1');
  
  const result = engine.checkSchedulingFeasibility('O1', 'P1');
  assertEqual(result.feasible, true, '调度应该可行但有警告');
  
  const deadlineIssues = result.issues.filter(i => i.type === IssueType.DEADLINE_MISS);
  assertEqual(deadlineIssues.length, 1, '应该有一个交期超时警告');
  console.log('   原因:', deadlineIssues[0].reason);
});

// ==========================================
// 测试套件 4: 打印执行和故障处理
// ==========================================
console.log('\n' + '='.repeat(60));
console.log('🧪 测试套件 4: 打印执行和故障处理');
console.log('='.repeat(60));

test('完整调度和打印流程', () => {
  const engine = new SchedulingEngine();
  const now = new Date();
  
  engine.addPrinter({
    id: 'P1',
    name: 'Printer 1',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  engine.addMaterial({
    id: 'M1',
    materialType: 'PLA',
    color: '白色',
    totalLength: 10000
  });
  
  engine.addNozzle({
    id: 'N1',
    size: '0.4mm'
  });
  
  engine.addOrder({
    id: 'O1',
    name: 'Test Order',
    requiredMaterial: 'PLA',
    requiredNozzleSize: '0.4mm',
    printLength: 1000,
    estimatedHours: 2,
    deadline: new Date(now.getTime() + 24 * 60 * 60 * 1000)
  });
  
  engine.installMaterial('P1', 'M1');
  engine.installNozzle('P1', 'N1');
  
  const scheduleResult = engine.scheduleOrder('O1', 'P1');
  assertEqual(scheduleResult.success, true, '调度应该成功');
  
  const nozzle = engine.nozzles.get('N1');
  nozzle.usedHours = 0;
  nozzle.clogCount = 0;
  nozzle.cleanCount = 10;
  
  engine.startPrinting('O1');
  
  const progressResult = engine.simulatePrintProgress('O1', 2);
  assertEqual(progressResult.completed, true, '打印应该完成');
  
  const order = engine.orders.get('O1');
  assertEqual(order.status, OrderStatus.COMPLETED, '订单状态应为已完成');
  assertEqual(order.issues.length, 0, '不应该有问题');
  
  const material = engine.materials.get('M1');
  assert(material.remainingLength < 10000, '材料应该被消耗');
  
  console.log('   材料剩余:', material.remainingLength, 'mm');
  console.log('   订单实际用时:', order.actualHours, 'h');
});

test('材料用尽处理', () => {
  const engine = new SchedulingEngine();
  
  engine.addPrinter({
    id: 'P1',
    name: 'Printer 1',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  engine.addMaterial({
    id: 'M1',
    materialType: 'PLA',
    color: '白色',
    totalLength: 1000
  });
  
  engine.addNozzle({
    id: 'N1',
    size: '0.4mm'
  });
  
  engine.addOrder({
    id: 'O1',
    name: 'Test Order',
    requiredMaterial: 'PLA',
    requiredNozzleSize: '0.4mm',
    printLength: 1000,
    estimatedHours: 2
  });
  
  engine.installMaterial('P1', 'M1');
  engine.installNozzle('P1', 'N1');
  
  const scheduleResult = engine.scheduleOrder('O1', 'P1');
  assertEqual(scheduleResult.success, true, '调度应该成功（材料初始足够）');
  
  engine.startPrinting('O1');
  
  const material = engine.materials.get('M1');
  material.remainingLength = 100;
  
  const result = engine.simulatePrintProgress('O1', 1);
  assertEqual(result.success, false, '打印应该失败');
  assertEqual(result.issue, '材料用尽', '问题应该是材料用尽');
  
  const order = engine.orders.get('O1');
  assertEqual(order.status, OrderStatus.PAUSED, '订单应该暂停');
  assertEqual(order.reviewStatus, ReviewStatus.PENDING_REVIEW, '应该标记为待复核');
  
  const materialIssues = order.issues.filter(i => i.type === IssueType.INSUFFICIENT_MATERIAL);
  assertEqual(materialIssues.length, 1, '应该有材料不足问题');
  
  console.log('   材料初始总量:', material.totalLength, 'mm');
  console.log('   打印中断时剩余:', material.remainingLength, 'mm');
  console.log('   待复核备注:', order.reviewNotes);
  console.log('   问题原因:', materialIssues[0].reason);
  console.log('   影响对象:', JSON.stringify(materialIssues[0].affectedObjects));
});

test('喷嘴堵塞处理', () => {
  const engine = new SchedulingEngine();
  
  engine.addPrinter({
    id: 'P1',
    name: 'Printer 1',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  engine.addMaterial({
    id: 'M1',
    materialType: 'PLA',
    color: '白色',
    totalLength: 10000
  });
  
  const nozzle = new Nozzle('N1', '0.4mm', 'brass', 10);
  nozzle.usedHours = 9.5;
  nozzle.clogCount = 2;
  engine.nozzles.set('N1', nozzle);
  
  engine.addOrder({
    id: 'O1',
    name: 'Test Order',
    requiredMaterial: 'PLA',
    requiredNozzleSize: '0.4mm',
    printLength: 1000,
    estimatedHours: 5
  });
  
  engine.installMaterial('P1', 'M1');
  engine.installNozzle('P1', 'N1');
  engine.scheduleOrder('O1', 'P1');
  engine.startPrinting('O1');
  
  let clogOccurred = false;
  for (let i = 0; i < 10 && !clogOccurred; i++) {
    const result = engine.simulatePrintProgress('O1', 0.5);
    if (!result.success && result.issue === '喷嘴堵塞') {
      clogOccurred = true;
    }
  }
  
  const order = engine.orders.get('O1');
  const nozzleAfter = engine.nozzles.get('N1');
  
  console.log('   喷嘴磨损度:', nozzleAfter.getWearPercentage(), '%');
  console.log('   喷嘴堵塞次数:', nozzleAfter.clogCount);
  console.log('   订单状态:', order.status);
  
  if (clogOccurred) {
    assertEqual(order.reviewStatus, ReviewStatus.PENDING_REVIEW, '应该标记为待复核');
    const clogIssues = order.issues.filter(i => i.type === IssueType.NOZZLE_CLOG);
    assert(clogIssues.length > 0, '应该有喷嘴堵塞问题');
    console.log('   堵塞原因:', clogIssues[0].reason);
    console.log('   影响对象:', JSON.stringify(clogIssues[0].affectedObjects));
  }
});

// ==========================================
// 测试套件 5: 评分系统测试
// ==========================================
console.log('\n' + '='.repeat(60));
console.log('🧪 测试套件 5: 评分系统测试');
console.log('='.repeat(60));

test('完美调度评分', () => {
  const engine = new SchedulingEngine();
  const scoring = new ScoringEngine(engine);
  const now = new Date();
  
  engine.addPrinter({
    id: 'P1',
    name: 'Printer 1',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  engine.addMaterial({
    id: 'M1',
    materialType: 'PLA',
    color: '白色',
    totalLength: 10000
  });
  
  engine.addNozzle({
    id: 'N1',
    size: '0.4mm'
  });
  
  engine.addOrder({
    id: 'O1',
    name: 'Test',
    requiredMaterial: 'PLA',
    requiredNozzleSize: '0.4mm',
    printLength: 500,
    estimatedHours: 1,
    deadline: new Date(now.getTime() + 24 * 60 * 60 * 1000)
  });
  
  engine.installMaterial('P1', 'M1');
  engine.installNozzle('P1', 'N1');
  engine.scheduleOrder('O1', 'P1');
  engine.startPrinting('O1');
  engine.simulatePrintProgress('O1', 1);
  
  const report = scoring.calculateScore();
  
  console.log('   总分:', report.totalScore, '/', report.maxScore);
  console.log('   准时交付:', report.scoreBreakdown.onTimeCompletion);
  console.log('   材料利用:', report.scoreBreakdown.materialEfficiency);
  console.log('   质量控制:', report.scoreBreakdown.noQualityIssues);
  
  assert(report.totalScore > 80, '分数应该较高');
  assertEqual(report.pendingReviewItems.length, 0, '不应该有待复核项目');
});

test('有问题的调度评分', () => {
  const engine = new SchedulingEngine();
  const scoring = new ScoringEngine(engine);
  const now = new Date();
  
  engine.addPrinter({
    id: 'P1',
    name: 'Printer 1',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  engine.addMaterial({
    id: 'M1',
    materialType: 'ABS',
    color: '黑色',
    totalLength: 100
  });
  
  engine.addNozzle({
    id: 'N1',
    size: '0.8mm'
  });
  
  engine.addOrder({
    id: 'O1',
    name: 'Test',
    requiredMaterial: 'PLA',
    requiredNozzleSize: '0.4mm',
    printLength: 500,
    estimatedHours: 10,
    deadline: new Date(now.getTime() + 1 * 60 * 60 * 1000)
  });
  
  engine.installMaterial('P1', 'M1');
  engine.installNozzle('P1', 'N1');
  
  const scheduleResult = engine.scheduleOrder('O1', 'P1');
  assertEqual(scheduleResult.success, false, '调度应该失败');
  
  const report = scoring.calculateScore();
  
  console.log('   问题数量:', report.issues.length);
  console.log('   待复核项目:', report.pendingReviewItems.length);
  console.log('   总扣分:', report.scoreBreakdown.penalties?.total || 0);
  
  assert(report.issues.length > 0, '应该有问题记录');
  assert(report.lessonsLearned.length > 0, '应该有经验教训');
});

test('待复核项目收集', () => {
  const engine = new SchedulingEngine();
  const scoring = new ScoringEngine(engine);
  
  engine.addPrinter({
    id: 'P1',
    name: 'Printer 1',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  engine.addMaterial({
    id: 'M1',
    materialType: 'PLA',
    color: '白色',
    totalLength: 100
  });
  
  engine.addNozzle({
    id: 'N1',
    size: '0.4mm'
  });
  
  engine.addOrder({
    id: 'O1',
    name: 'Test',
    requiredMaterial: 'PLA',
    requiredNozzleSize: '0.4mm',
    printLength: 1000,
    estimatedHours: 2
  });
  
  engine.installMaterial('P1', 'M1');
  engine.installNozzle('P1', 'N1');
  engine.scheduleOrder('O1', 'P1');
  engine.startPrinting('O1');
  engine.simulatePrintProgress('O1', 1);
  
  const pendingItems = scoring.collectPendingReviewItems();
  console.log('   待复核项目数:', pendingItems.length);
  pendingItems.forEach((item, idx) => {
    console.log(`   ${idx + 1}. 类型: ${item.type}, ID: ${item.id}`);
  });
  
  assert(pendingItems.length > 0, '应该有待复核项目');
});

// ==========================================
// 测试套件 6: 报告导出测试
// ==========================================
console.log('\n' + '='.repeat(60));
console.log('🧪 测试套件 6: 报告导出测试');
console.log('='.repeat(60));

test('JSON导出', () => {
  const engine = new SchedulingEngine();
  const scoring = new ScoringEngine(engine);
  
  engine.addPrinter({
    id: 'P1',
    name: 'Test Printer',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  const report = scoring.calculateScore();
  const json = ReportExporter.exportToJSON(report);
  
  assert(json.includes('"totalScore"'), '应该包含totalScore字段');
  assert(json.includes('"issues"'), '应该包含issues字段');
  
  const parsed = JSON.parse(json);
  assertEqual(parsed.totalOrders, 0, '总订单数应为0');
});

test('文本导出', () => {
  const engine = new SchedulingEngine();
  const scoring = new ScoringEngine(engine);
  
  engine.addPrinter({
    id: 'P1',
    name: 'Test Printer',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  const report = scoring.calculateScore();
  const text = ReportExporter.exportToText(report);
  
  assert(text.includes('3D打印农场调度报告'), '应该包含报告标题');
  assert(text.includes('评分详情'), '应该包含评分详情');
});

test('CSV导出', () => {
  const engine = new SchedulingEngine();
  const scoring = new ScoringEngine(engine);
  
  engine.addPrinter({
    id: 'P1',
    name: 'Test Printer',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  const report = scoring.calculateScore();
  const csv = ReportExporter.exportToCSV(report);
  
  assert(csv.includes('类别,项目,数值'), '应该包含CSV表头');
  assert(csv.includes('评分,总分'), '应该包含总分记录');
});

test('HTML导出', () => {
  const engine = new SchedulingEngine();
  const scoring = new ScoringEngine(engine);
  
  engine.addPrinter({
    id: 'P1',
    name: 'Test Printer',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  const report = scoring.calculateScore();
  const html = ReportExporter.exportToHTML(report);
  
  assert(html.includes('<html'), '应该是HTML文档');
  assert(html.includes('3D打印农场调度报告'), '应该包含报告标题');
  assert(html.includes('综合评分'), '应该包含综合评分');
});

// ==========================================
// 测试套件 7: 回放功能测试
// ==========================================
console.log('\n' + '='.repeat(60));
console.log('🧪 测试套件 7: 回放功能测试');
console.log('='.repeat(60));

test('状态记录和回放', () => {
  const engine = new SchedulingEngine();
  const scoring = new ScoringEngine(engine);
  
  const state1 = scoring.recordState();
  assertEqual(scoring.replayHistory.length, 1, '应该有1条记录');
  
  engine.addPrinter({
    id: 'P1',
    name: 'Printer 1',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  const state2 = scoring.recordState();
  assertEqual(scoring.replayHistory.length, 2, '应该有2条记录');
  assertEqual(state2.printers.length, 1, '第二条记录应该有1台打印机');
  
  const replayed = scoring.getReplayState(0);
  assertEqual(replayed.printers.length, 0, '回放第一条记录应该没有打印机');
  
  const timeline = scoring.getReplayTimeline();
  assertEqual(timeline.length, 2, '时间线应该有2个点');
  
  console.log('   回放记录数:', scoring.replayHistory.length);
  console.log('   当前回放索引:', scoring.currentReplayIndex);
});

// ==========================================
// 测试套件 8: 边界情况和特殊场景
// ==========================================
console.log('\n' + '='.repeat(60));
console.log('🧪 测试套件 8: 边界情况和特殊场景');
console.log('='.repeat(60));

test('空系统评分', () => {
  const engine = new SchedulingEngine();
  const scoring = new ScoringEngine(engine);
  const report = scoring.calculateScore();
  
  console.log('   空系统评分:', report.totalScore, '/', report.maxScore);
  assertEqual(report.totalOrders, 0, '总订单数应为0');
  assert(report.lessonsLearned.length > 0, '应该有经验教训');
});

test('多种错误累积扣分', () => {
  const engine = new SchedulingEngine();
  const scoring = new ScoringEngine(engine);
  
  engine.issues.push(new SchedulingIssue(IssueType.DEADLINE_MISS, { orderId: 'O1' }, '超时1'));
  engine.issues.push(new SchedulingIssue(IssueType.DEADLINE_MISS, { orderId: 'O2' }, '超时2'));
  engine.issues.push(new SchedulingIssue(IssueType.MATERIAL_MISMATCH, { orderId: 'O1' }, '错配1'));
  
  const report = scoring.calculateScore();
  const penalties = report.scoreBreakdown.penalties;
  
  console.log('   交期超时扣分:', penalties.deadlineMiss);
  console.log('   材料错配扣分:', penalties.materialMismatch);
  console.log('   总扣分:', penalties.total);
  
  assert(penalties.deadlineMiss > 0, '应该有交期超时扣分');
  assert(penalties.materialMismatch > 0, '应该有材料错配扣分');
});

test('故障影响处理', () => {
  const engine = new SchedulingEngine();
  
  engine.addPrinter({
    id: 'P1',
    name: 'Printer 1',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  engine.addMaterial({
    id: 'M1',
    materialType: 'PLA',
    color: '白色',
    totalLength: 10000
  });
  
  engine.addNozzle({
    id: 'N1',
    size: '0.4mm'
  });
  
  engine.addOrder({
    id: 'O1',
    name: 'Test',
    requiredMaterial: 'PLA',
    requiredNozzleSize: '0.4mm',
    printLength: 500,
    estimatedHours: 2
  });
  
  engine.installMaterial('P1', 'M1');
  engine.installNozzle('P1', 'N1');
  engine.scheduleOrder('O1', 'P1');
  engine.startPrinting('O1');
  
  engine.addFaultEvent({
    id: 'F1',
    type: FaultType.POWER_OUTAGE,
    printerId: 'P1'
  });
  
  const order = engine.orders.get('O1');
  assertEqual(order.status, OrderStatus.PAUSED, '订单应该因故障暂停');
  assertEqual(order.reviewStatus, ReviewStatus.PENDING_REVIEW, '应该标记为待复核');
  
  const fault = engine.faultEvents[0];
  assert(fault.affectedOrders.includes('O1'), '故障应该影响订单');
  
  console.log('   订单状态:', order.status);
  console.log('   待复核备注:', order.reviewNotes);
  console.log('   故障影响订单:', fault.affectedOrders);
});

test('故障解决后订单重置', () => {
  const engine = new SchedulingEngine();
  
  engine.addPrinter({
    id: 'P1',
    name: 'Printer 1',
    supportedMaterials: ['PLA'],
    maxNozzleSize: '0.6mm'
  });
  
  engine.addMaterial({
    id: 'M1',
    materialType: 'PLA',
    color: '白色',
    totalLength: 10000
  });
  
  engine.addNozzle({
    id: 'N1',
    size: '0.4mm'
  });
  
  engine.addOrder({
    id: 'O1',
    name: 'Test',
    requiredMaterial: 'PLA',
    requiredNozzleSize: '0.4mm',
    printLength: 500,
    estimatedHours: 2
  });
  
  engine.installMaterial('P1', 'M1');
  engine.installNozzle('P1', 'N1');
  engine.scheduleOrder('O1', 'P1');
  engine.startPrinting('O1');
  
  engine.addFaultEvent({
    id: 'F1',
    type: FaultType.MECHANICAL_FAILURE,
    printerId: 'P1'
  });
  
  engine.resolveFault('F1', '已修复机械故障', 60);
  
  const order = engine.orders.get('O1');
  assertEqual(order.status, OrderStatus.PENDING, '故障解决后订单应重置为待处理');
  assertEqual(order.assignedPrinterId, null, '应该取消打印机分配');
  
  const fault = engine.faultEvents[0];
  assertEqual(fault.resolved, true, '故障应该标记为已解决');
  assertEqual(fault.downtimeMinutes, 60, '停机时间应为60分钟');
  
  console.log('   故障状态:', fault.resolved ? '已解决' : '未解决');
  console.log('   实际停机时间:', fault.downtimeMinutes, '分钟');
});

// ==========================================
// 测试结果汇总
// ==========================================
console.log('\n' + '='.repeat(60));
console.log('📊 测试结果汇总');
console.log('='.repeat(60));
console.log(`✅ 通过: ${passed}`);
console.log(`❌ 失败: ${failed}`);
console.log(`📈 通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
