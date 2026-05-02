import { DataParser } from '../js/dataParser.js';
import { RiskCalculator } from '../js/riskCalculator.js';
import { InteractionState } from '../js/interactionState.js';
import { StorageExporter } from '../js/storageExporter.js';

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message}\n  期望值: ${expected}\n  实际值: ${actual}`);
    }
  }

  assertTrue(condition, message = '') {
    if (!condition) {
      throw new Error(message || '断言失败');
    }
  }

  assertFalse(condition, message = '') {
    if (condition) {
      throw new Error(message || '断言失败');
    }
  }

  assertContains(array, item, message = '') {
    if (!array.includes(item)) {
      throw new Error(message || `数组中未找到: ${item}`);
    }
  }

  async run() {
    console.log('🧪 开始运行测试...\n');
    
    for (const { name, fn } of this.tests) {
      try {
        await fn();
        this.passed++;
        console.log(`✅ 通过: ${name}`);
      } catch (error) {
        this.failed++;
        console.log(`❌ 失败: ${name}`);
        console.log(`   ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 测试结果: ${this.passed} 通过, ${this.failed} 失败`);
    console.log('='.repeat(50));
    
    return { passed: this.passed, failed: this.failed };
  }
}

const runner = new TestRunner();

runner.test('DataParser: 应该正确初始化', () => {
  const parser = new DataParser();
  runner.assertTrue(parser.elevationData === null);
  runner.assertTrue(parser.facilities.cableCars.length === 0);
  runner.assertTrue(parser.facilities.guardrails.length === 0);
  runner.assertTrue(parser.photos.length === 0);
  runner.assertTrue(parser.hazards.length === 0);
});

runner.test('DataParser: 应该正确解析CSV高程数据', async () => {
  const parser = new DataParser();
  const csvData = `x,y,elevation,slope
0,0,1800,5
5,0,1802,6
10,0,1805,8`;

  const result = await parser.parseElevationCSV(csvData);
  
  runner.assertEqual(result.points.length, 3);
  runner.assertEqual(result.points[0].x, 0);
  runner.assertEqual(result.points[0].y, 0);
  runner.assertEqual(result.points[0].z, 1800);
  runner.assertEqual(result.points[0].slope, 5);
  runner.assertEqual(result.gridSize.cols, 3);
  runner.assertEqual(result.bounds.minX, 0);
  runner.assertEqual(result.bounds.maxX, 10);
});

runner.test('DataParser: 应该正确解析GeoJSON设施数据', () => {
  const parser = new DataParser();
  const geoJSON = {
    type: 'FeatureCollection',
    features: [
      {
        properties: { id: 'cable_1', name: '测试缆车', type: 'cableCar' },
        geometry: { type: 'LineString', coordinates: [[0, 0, 100], [10, 10, 150]] }
      },
      {
        properties: { id: 'guard_1', name: '测试护栏', type: 'guardrail' },
        geometry: { type: 'LineString', coordinates: [[5, 5, 110], [15, 15, 160]] }
      }
    ]
  };

  const result = parser.parseFacilitiesGeoJSON(geoJSON);
  
  runner.assertEqual(result.cableCars.length, 1);
  runner.assertEqual(result.guardrails.length, 1);
  runner.assertEqual(result.cableCars[0].name, '测试缆车');
  runner.assertEqual(result.guardrails[0].name, '测试护栏');
  runner.assertEqual(result.cableCars[0].coordinates.length, 2);
});

runner.test('DataParser: 应该正确解析隐患记录', () => {
  const parser = new DataParser();
  const hazardsData = [
    {
      id: 'h1',
      type: 'ice',
      location: { x: 10, y: 20, z: 1800 },
      severity: 'high',
      description: '结冰区域'
    },
    {
      id: 'h2',
      type: 'pit',
      location: { x: 30, y: 40, z: 1820 },
      severity: 'medium',
      description: '坑洼区域'
    }
  ];

  const result = parser.parseHazardsRecord(hazardsData);
  
  runner.assertEqual(result.length, 2);
  runner.assertEqual(result[0].type, 'ice');
  runner.assertEqual(result[0].location.x, 10);
  runner.assertEqual(result[1].severity, 'medium');
});

runner.test('DataParser: 应该正确验证数据', async () => {
  const parser = new DataParser();
  
  let validation = parser.validateData();
  runner.assertFalse(validation.isValid);
  runner.assertContains(validation.errors, '缺少高程数据');
  
  const csvData = `x,y,elevation,slope
0,0,1800,5
5,0,1802,6`;
  await parser.parseElevationCSV(csvData);
  
  validation = parser.validateData();
  runner.assertTrue(validation.isValid);
});

runner.test('RiskCalculator: 应该正确初始化', () => {
  const calculator = new RiskCalculator();
  runner.assertTrue(calculator.thresholds !== undefined);
  runner.assertTrue(calculator.colorMaps !== undefined);
});

runner.test('RiskCalculator: 应该正确计算坡度风险', () => {
  const calculator = new RiskCalculator();
  
  const lowRisk = calculator.calculateSlopeRisk(10);
  runner.assertEqual(lowRisk.level, 'low');
  runner.assertTrue(lowRisk.value < 0.33);
  
  const mediumRisk = calculator.calculateSlopeRisk(20);
  runner.assertEqual(mediumRisk.level, 'medium');
  runner.assertTrue(mediumRisk.value >= 0.33 && mediumRisk.value < 0.66);
  
  const highRisk = calculator.calculateSlopeRisk(30);
  runner.assertEqual(highRisk.level, 'high');
  
  const criticalRisk = calculator.calculateSlopeRisk(40);
  runner.assertEqual(criticalRisk.level, 'critical');
});

runner.test('RiskCalculator: 应该正确计算结冰风险', () => {
  const calculator = new RiskCalculator();
  
  const lowRiskPoint = { slope: 10, aspect: 180, flowAccumulation: 50 };
  const lowRisk = calculator.calculateIceRisk(lowRiskPoint);
  runner.assertTrue(lowRisk.value >= 0);
  
  const highRiskPoint = { slope: 30, aspect: 0, flowAccumulation: 500 };
  const highRisk = calculator.calculateIceRisk(highRiskPoint);
  runner.assertTrue(highRisk.value > lowRisk.value);
});

runner.test('RiskCalculator: 应该正确计算综合风险', () => {
  const calculator = new RiskCalculator();
  
  const safePoint = { slope: 5, aspect: 180, flowAccumulation: 50 };
  const safeRisk = calculator.calculateCompositeRisk(safePoint);
  runner.assertEqual(safeRisk.level, 'low');
  
  const dangerPoint = { slope: 45, aspect: 0, flowAccumulation: 500 };
  const dangerRisk = calculator.calculateCompositeRisk(dangerPoint);
  runner.assertTrue(dangerRisk.value > safeRisk.value);
});

runner.test('RiskCalculator: 应该正确获取颜色', () => {
  const calculator = new RiskCalculator();
  
  const point = { slope: 20, aspect: 180, flowAccumulation: 100, z: 1800 };
  
  const slopeColor = calculator.getColorForPoint(point, 'slope');
  runner.assertTrue(slopeColor.r !== undefined);
  runner.assertTrue(slopeColor.g !== undefined);
  runner.assertTrue(slopeColor.b !== undefined);
  
  const iceColor = calculator.getColorForPoint(point, 'ice');
  runner.assertTrue(iceColor.r !== undefined);
  
  const compositeColor = calculator.getColorForPoint(point, 'composite');
  runner.assertTrue(compositeColor.r !== undefined);
});

runner.test('RiskCalculator: 应该正确返回图例', () => {
  const calculator = new RiskCalculator();
  
  const slopeLegend = calculator.getRiskLegend('slope');
  runner.assertTrue(slopeLegend.length > 0);
  runner.assertTrue(slopeLegend[0].color !== undefined);
  runner.assertTrue(slopeLegend[0].label !== undefined);
  
  const iceLegend = calculator.getRiskLegend('ice');
  runner.assertTrue(iceLegend.length > 0);
});

runner.test('InteractionState: 应该正确初始化', () => {
  const state = new InteractionState();
  
  runner.assertEqual(state.getMode(), 'view');
  runner.assertEqual(state.getHazards().length, 0);
  runner.assertEqual(state.getRouteWaypoints().length, 0);
});

runner.test('InteractionState: 应该正确切换模式', () => {
  const state = new InteractionState();
  
  state.setMode('mark_hazard');
  runner.assertEqual(state.getMode(), 'mark_hazard');
  
  state.setMode('plan_route');
  runner.assertEqual(state.getMode(), 'plan_route');
  
  state.setMode('view');
  runner.assertEqual(state.getMode(), 'view');
});

runner.test('InteractionState: 切换无效模式应该抛出错误', () => {
  const state = new InteractionState();
  try {
    state.setMode('invalid_mode');
    runner.assertTrue(false, '应该抛出错误');
  } catch (error) {
    runner.assertTrue(error.message.includes('无效模式'));
  }
});

runner.test('InteractionState: 应该正确添加和删除隐患', () => {
  const state = new InteractionState();
  
  const hazard = state.addHazard({
    type: 'ice',
    location: { x: 10, y: 20, z: 1800 },
    severity: 'high',
    description: '测试结冰'
  });
  
  runner.assertEqual(state.getHazards().length, 1);
  runner.assertEqual(hazard.type, 'ice');
  runner.assertTrue(hazard.id !== undefined);
  
  const deleted = state.deleteHazard(hazard.id);
  runner.assertEqual(deleted.id, hazard.id);
  runner.assertEqual(state.getHazards().length, 0);
});

runner.test('InteractionState: 应该正确更新隐患', () => {
  const state = new InteractionState();
  
  const hazard = state.addHazard({
    type: 'ice',
    location: { x: 10, y: 20, z: 1800 },
    severity: 'medium',
    description: '测试'
  });
  
  state.updateHazard(hazard.id, {
    severity: 'high',
    description: '更新后的描述'
  });
  
  const updated = state.getHazards()[0];
  runner.assertEqual(updated.severity, 'high');
  runner.assertEqual(updated.description, '更新后的描述');
});

runner.test('InteractionState: 应该正确筛选隐患', () => {
  const state = new InteractionState();
  
  state.addHazard({ type: 'ice', severity: 'high', status: 'pending' });
  state.addHazard({ type: 'pit', severity: 'medium', status: 'in_progress' });
  state.addHazard({ type: 'ice', severity: 'low', status: 'resolved' });
  
  const iceHazards = state.getHazards({ type: 'ice' });
  runner.assertEqual(iceHazards.length, 2);
  
  const highHazards = state.getHazards({ severity: 'high' });
  runner.assertEqual(highHazards.length, 1);
  
  const pendingHazards = state.getHazards({ status: 'pending' });
  runner.assertEqual(pendingHazards.length, 1);
});

runner.test('InteractionState: 应该正确添加和删除路线点', () => {
  const state = new InteractionState();
  
  state.addRouteWaypoint({ x: 0, y: 0, z: 1800 });
  state.addRouteWaypoint({ x: 10, y: 10, z: 1810 });
  state.addRouteWaypoint({ x: 20, y: 20, z: 1820 });
  
  runner.assertEqual(state.getRouteWaypoints().length, 3);
  
  const waypoints = state.getRouteWaypoints();
  runner.assertEqual(waypoints[0].name, '点位 1');
  runner.assertEqual(waypoints[2].name, '点位 3');
  
  state.deleteRouteWaypoint(waypoints[1].id);
  runner.assertEqual(state.getRouteWaypoints().length, 2);
  runner.assertEqual(state.getRouteWaypoints()[1].name, '点位 2');
});

runner.test('InteractionState: 应该正确插入路线点', () => {
  const state = new InteractionState();
  
  state.addRouteWaypoint({ x: 0, y: 0, z: 1800 });
  state.addRouteWaypoint({ x: 20, y: 20, z: 1820 });
  
  state.insertRouteWaypoint(1, { x: 10, y: 10, z: 1810 });
  
  const waypoints = state.getRouteWaypoints();
  runner.assertEqual(waypoints.length, 3);
  runner.assertEqual(waypoints[1].location.x, 10);
});

runner.test('InteractionState: 应该正确计算路线距离', () => {
  const state = new InteractionState();
  
  runner.assertEqual(state.calculateRouteDistance(), 0);
  
  state.addRouteWaypoint({ x: 0, y: 0, z: 0 });
  state.addRouteWaypoint({ x: 100, y: 0, z: 0 });
  
  const distance = state.calculateRouteDistance();
  runner.assertEqual(distance, 100);
});

runner.test('InteractionState: 应该正确预估路线时间', () => {
  const state = new InteractionState();
  
  state.addRouteWaypoint({ x: 0, y: 0, z: 0 });
  state.addRouteWaypoint({ x: 1000, y: 0, z: 0 });
  
  const estimate = state.estimateRouteTime(10);
  runner.assertEqual(estimate.distance, 1);
  runner.assertTrue(estimate.travelTimeMinutes > 0);
});

runner.test('InteractionState: 应该正确获取和加载状态', () => {
  const state = new InteractionState();
  
  state.addHazard({ type: 'ice', location: { x: 10, y: 20, z: 1800 } });
  state.addRouteWaypoint({ x: 0, y: 0, z: 1800 });
  state.setMode('mark_hazard');
  
  const savedState = state.getState();
  runner.assertEqual(savedState.mode, 'mark_hazard');
  runner.assertEqual(savedState.hazards.length, 1);
  runner.assertEqual(savedState.routeWaypoints.length, 1);
  
  const newState = new InteractionState();
  newState.loadState(savedState);
  
  runner.assertEqual(newState.getMode(), 'mark_hazard');
  runner.assertEqual(newState.getHazards().length, 1);
  runner.assertEqual(newState.getRouteWaypoints().length, 1);
});

runner.test('InteractionState: 应该正确获取统计信息', () => {
  const state = new InteractionState();
  
  state.addHazard({ type: 'ice', severity: 'high', status: 'pending' });
  state.addHazard({ type: 'pit', severity: 'medium', status: 'in_progress' });
  state.addHazard({ type: 'rock', severity: 'critical', status: 'pending' });
  state.addRouteWaypoint({ x: 0, y: 0, z: 0 });
  state.addRouteWaypoint({ x: 100, y: 0, z: 0 });
  
  const stats = state.getStatistics();
  
  runner.assertEqual(stats.hazards.total, 3);
  runner.assertEqual(stats.hazards.bySeverity.critical, 1);
  runner.assertEqual(stats.hazards.bySeverity.high, 1);
  runner.assertEqual(stats.hazards.byStatus.pending, 2);
  runner.assertEqual(stats.route.waypointCount, 2);
  runner.assertEqual(stats.route.distance, 100);
});

runner.test('StorageExporter: 应该正确初始化', () => {
  const exporter = new StorageExporter();
  runner.assertTrue(exporter.currentProjectId === null);
});

runner.test('StorageExporter: 应该正确导出JSON', () => {
  const exporter = new StorageExporter();
  
  const hazards = [
    {
      id: 'h1',
      type: 'ice',
      location: { x: 10, y: 20, z: 1800 },
      severity: 'high',
      description: '测试',
      radius: 5,
      photos: ['p1'],
      notes: '备注',
      timestamp: '2024-01-01T00:00:00Z',
      status: 'pending'
    }
  ];
  
  const json = exporter.exportHazardsJSON(hazards);
  const parsed = JSON.parse(json);
  
  runner.assertEqual(parsed.version, '1.0');
  runner.assertEqual(parsed.hazards.length, 1);
  runner.assertEqual(parsed.hazards[0].id, 'h1');
});

runner.test('StorageExporter: 应该正确导出和导入', () => {
  const exporter = new StorageExporter();
  
  const hazards = [
    { id: 'h1', type: 'ice', location: { x: 10, y: 20, z: 1800 }, severity: 'high' }
  ];
  
  const json = exporter.exportHazardsJSON(hazards, {
    includeRoute: true,
    routeWaypoints: [{ location: { x: 0, y: 0, z: 0 } }]
  });
  
  const imported = exporter.importJSON(json);
  
  runner.assertEqual(imported.hazards.length, 1);
  runner.assertEqual(imported.routeWaypoints.length, 1);
});

runner.test('StorageExporter: 导入无效JSON应该抛出错误', () => {
  const exporter = new StorageExporter();
  
  try {
    exporter.importJSON('{"invalid": true}');
    runner.assertTrue(false, '应该抛出错误');
  } catch (error) {
    runner.assertTrue(error.message.includes('JSON格式不正确'));
  }
});

runner.test('StorageExporter: 应该正确导出Markdown报告', () => {
  const exporter = new StorageExporter();
  
  const exportData = {
    project: { name: '测试项目' },
    hazards: [
      {
        id: 'h1',
        type: 'ice',
        location: { x: 10, y: 20, z: 1800 },
        severity: 'high',
        description: '测试结冰区域',
        radius: 8,
        notes: '需要处理',
        timestamp: '2024-01-15T08:30:00Z',
        status: 'pending'
      }
    ],
    route: [
      { name: '起点', location: { x: 0, y: 0, z: 1800 } },
      { name: '终点', location: { x: 50, y: 50, z: 1830 } }
    ],
    statistics: {
      hazards: { total: 1, bySeverity: { low: 0, medium: 0, high: 1, critical: 0 } },
      route: { waypointCount: 2, estimatedTime: { distance: 0.1, totalMinutes: 10 } }
    },
    riskAreas: []
  };
  
  const markdown = exporter.exportMarkdownReport(exportData);
  
  runner.assertTrue(markdown.includes('# 雪道隐患巡检报告'));
  runner.assertTrue(markdown.includes('测试项目'));
  runner.assertTrue(markdown.includes('测试结冰区域'));
  runner.assertTrue(markdown.includes('高风险'));
});

console.log('\n' + '='.repeat(50));
console.log('🚀 开始运行模块测试...');
console.log('='.repeat(50) + '\n');

runner.run().then((result) => {
  if (result.failed === 0) {
    console.log('\n🎉 所有测试通过！');
    process.exit(0);
  } else {
    console.log('\n⚠️ 部分测试失败！');
    process.exit(1);
  }
});
