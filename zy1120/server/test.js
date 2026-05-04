const {
  calculateTotalDuration,
  calculateCost,
  getTotalWeight,
  calculateCapacityUtilization,
  checkHeatingRisk,
  checkCoolingRisk,
  checkGlazeMaturity,
  checkCapacityRisk,
  checkBodyHoldTime,
  checkDurationAndCost,
  runRiskCheck,
  validateCurve,
  THICKNESS_THRESHOLD
} = require('./firingCalculator');

console.log('========================================');
console.log('  陶艺小窑烧成曲线预演工具 - 测试示例');
console.log('========================================\n');

const testKiln = {
  id: 'test-kiln-1',
  name: '测试窑炉',
  power: 6.0,
  capacity: 0.05,
  max_temperature: 1300
};

const testBodyNormal = {
  id: 'body-normal',
  name: '普通陶泥',
  max_heating_rate: 300,
  max_cooling_rate: 200,
  min_hold_time: 0.5,
  safe_heating_rate_for_thick: 150
};

const testBodyHighAlumina = {
  id: 'body-high-alumina',
  name: '高铝瓷泥',
  max_heating_rate: 200,
  max_cooling_rate: 150,
  min_hold_time: 1.0,
  safe_heating_rate_for_thick: 100
};

const testGlazeTransparent = {
  id: 'glaze-transparent',
  name: '透明釉(中温)',
  min_firing_temp: 1220,
  max_firing_temp: 1260,
  optimal_firing_temp: 1240,
  hold_time_required: 0.5,
  cooling_sensitivity: 'low'
};

const testGlazeCopperRed = {
  id: 'glaze-copper-red',
  name: '铜红釉',
  min_firing_temp: 1250,
  max_firing_temp: 1280,
  optimal_firing_temp: 1265,
  hold_time_required: 1.0,
  cooling_sensitivity: 'high'
};

const testPieces = [
  {
    id: 'piece-1',
    name: '薄胎茶杯',
    body_id: 'body-normal',
    glaze_id: 'glaze-transparent',
    thickness: 0.4,
    weight: 0.3
  },
  {
    id: 'piece-2',
    name: '厚壁雕塑',
    body_id: 'body-high-alumina',
    glaze_id: 'glaze-copper-red',
    thickness: 1.5,
    weight: 1.2
  },
  {
    id: 'piece-3',
    name: '中温盘子',
    body_id: 'body-normal',
    glaze_id: 'glaze-transparent',
    thickness: 0.5,
    weight: 0.4
  }
];

const testBodies = [testBodyNormal, testBodyHighAlumina];
const testGlazes = [testGlazeTransparent, testGlazeCopperRed];

function runTests() {
  console.log('【测试1】基础计算功能');
  console.log('----------------------------------------');

  const testStages = [
    { stage_type: 'heating', start_temp: 25, target_temp: 600, heating_rate: 200, description: '低温升温' },
    { stage_type: 'heating', start_temp: 600, target_temp: 1240, heating_rate: 150, description: '高温升温' },
    { stage_type: 'holding', start_temp: 1240, hold_duration: 1, description: '保温' },
    { stage_type: 'cooling', start_temp: 1240, target_temp: 800, cooling_rate: 100, description: '快速降温' },
    { stage_type: 'cooling', start_temp: 800, target_temp: 200, cooling_rate: 80, description: '缓慢降温' }
  ];

  const durationResult = calculateTotalDuration(testStages, testKiln, testPieces);
  console.log(`总时长计算: ${durationResult.totalDuration.toFixed(2)} 小时`);

  const cost = calculateCost(durationResult.totalDuration, testKiln, 1.0);
  console.log(`电费计算: ¥${cost.toFixed(2)} (电价1元/度)`);

  const totalWeight = getTotalWeight(testPieces);
  console.log(`作品总重量: ${totalWeight} kg`);

  const capacityUtil = calculateCapacityUtilization(testKiln, testPieces);
  console.log(`容量利用率: ${(capacityUtil * 100).toFixed(1)}%\n`);

  console.log('【测试2】曲线验证功能');
  console.log('----------------------------------------');

  const validCurve = validateCurve(testStages, testKiln);
  console.log(`曲线有效性: ${validCurve.valid ? '✓ 有效' : '✗ 无效'}`);
  if (validCurve.warnings.length > 0) {
    console.log('警告:', validCurve.warnings);
  }

  const invalidStages = [
    { stage_type: 'heating', start_temp: 100, target_temp: 50, heating_rate: 200 }
  ];
  const invalidResult = validateCurve(invalidStages, testKiln);
  console.log(`无效曲线检测: ${!invalidResult.valid ? '✓ 正确检测到无效' : '✗ 未能检测'}`);
  if (invalidResult.errors.length > 0) {
    console.log('错误:', invalidResult.errors);
  }
  console.log('');

  console.log('【测试3】风险检查功能');
  console.log('----------------------------------------');

  console.log('--- 厚坯升温过快风险 ---');
  const fastHeatingStage = { stage_type: 'heating', start_temp: 25, target_temp: 600, heating_rate: 300 };
  const thickPiece = testPieces[1];
  const thickBody = testBodyHighAlumina;
  const heatingRisks = checkHeatingRisk(fastHeatingStage, thickPiece, thickBody);
  console.log(`厚坯(1.5cm)在300°C/小时升温下:`);
  if (heatingRisks.length > 0) {
    console.log(`  ✓ 检测到风险: ${heatingRisks[0].message}`);
    console.log(`  风险等级: ${heatingRisks[0].risk_level}`);
    console.log(`  详情: ${heatingRisks[0].details}`);
  } else {
    console.log('  ✗ 未检测到风险（预期应该有风险）');
  }

  console.log('\n--- 薄坯安全升温 ---');
  const thinPiece = testPieces[0];
  const safeHeatingStage = { stage_type: 'heating', start_temp: 25, target_temp: 600, heating_rate: 200 };
  const safeHeatingRisks = checkHeatingRisk(safeHeatingStage, thinPiece, testBodyNormal);
  console.log(`薄坯(0.4cm)在200°C/小时升温下:`);
  if (safeHeatingRisks.length === 0) {
    console.log('  ✓ 无风险（预期正确）');
  } else {
    console.log('  ✗ 意外检测到风险');
  }

  console.log('\n--- 釉料温度过低风险 ---');
  const lowTempStages = [
    { stage_type: 'heating', start_temp: 25, target_temp: 1100, heating_rate: 200 },
    { stage_type: 'holding', start_temp: 1100, hold_duration: 1 }
  ];
  const glazeRisks = checkGlazeMaturity(lowTempStages, testGlazeCopperRed, thickPiece);
  console.log(`铜红釉(最低1250°C)在最高1100°C下:`);
  const highRisk = glazeRisks.find(r => r.risk_level === 'high');
  if (highRisk) {
    console.log(`  ✓ 检测到高风险: ${highRisk.message}`);
  } else {
    console.log('  ✗ 未检测到高风险（预期应该有）');
  }

  console.log('\n--- 装窑容量风险 ---');
  const heavyPieces = [
    { ...testPieces[1], weight: 10 },
    { ...testPieces[1], weight: 10 },
    { ...testPieces[1], weight: 10 }
  ];
  const capacityRisks = checkCapacityRisk(testKiln, heavyPieces);
  console.log(`超重作品(30kg)在50升窑炉中:`);
  const overloadRisk = capacityRisks.find(r => r.risk_type === 'capacity_overload');
  if (overloadRisk) {
    console.log(`  ✓ 检测到容量超载风险`);
    console.log(`  详情: ${overloadRisk.details}`);
  } else {
    console.log('  ✗ 未检测到超载风险');
  }

  console.log('\n--- 保温时间不足 ---');
  const shortHoldStages = [
    { stage_type: 'holding', start_temp: 1240, hold_duration: 0.3 }
  ];
  const holdRisks = checkBodyHoldTime(shortHoldStages, testBodyHighAlumina, thickPiece);
  console.log(`高铝瓷泥(需保温1小时)只保温0.3小时:`);
  if (holdRisks.length > 0) {
    console.log(`  ✓ 检测到保温不足风险: ${holdRisks[0].message}`);
  } else {
    console.log('  ✗ 未检测到风险');
  }

  console.log('\n--- 降温过快风险（高敏感度釉料）---');
  const fastCoolingStage = { stage_type: 'cooling', start_temp: 1240, target_temp: 800, cooling_rate: 300 };
  const coolingRisks = checkCoolingRisk(fastCoolingStage, thickPiece, thickBody, testGlazeCopperRed);
  console.log(`铜红釉(高敏感度)在300°C/小时降温下:`);
  const highCoolingRisk = coolingRisks.find(r => r.risk_level === 'high');
  if (highCoolingRisk) {
    console.log(`  ✓ 检测到高风险`);
    console.log(`  详情: ${highCoolingRisk.details}`);
  } else {
    console.log('  ✗ 未检测到高风险');
  }

  console.log('\n【测试4】完整风险检查');
  console.log('----------------------------------------');

  const testPlan = {
    id: 'test-plan-1',
    name: '测试方案',
    electricity_price: 1.0,
    expected_max_duration: 8,
    expected_max_cost: 50
  };

  const riskyStages = [
    { stage_type: 'heating', start_temp: 25, target_temp: 600, heating_rate: 300 },
    { stage_type: 'heating', start_temp: 600, target_temp: 1200, heating_rate: 250 },
    { stage_type: 'holding', start_temp: 1200, hold_duration: 0.5 },
    { stage_type: 'cooling', start_temp: 1200, target_temp: 200, cooling_rate: 250 }
  ];

  const allRisks = runRiskCheck(testPlan, testKiln, testPieces, riskyStages, testBodies, testGlazes);
  
  const durationCostRisks = checkDurationAndCost(
    { ...testPlan, estimated_duration: 10, estimated_cost: 80 },
    10, 80
  );

  console.log(`风险数量: ${allRisks.length + durationCostRisks.length}`);
  console.log(`高风险: ${allRisks.filter(r => r.risk_level === 'high').length}`);
  console.log(`中风险: ${allRisks.filter(r => r.risk_level === 'medium').length}`);
  console.log(`低风险: ${allRisks.filter(r => r.risk_level === 'low').length}`);

  console.log('\n【测试5】边界情况');
  console.log('----------------------------------------');

  console.log('--- 厚度阈值测试 ---');
  console.log(`厚坯阈值: ${THICKNESS_THRESHOLD}cm`);
  console.log(`厚度0.9cm: ${0.9 >= THICKNESS_THRESHOLD ? '厚坯' : '普通坯'}`);
  console.log(`厚度1.0cm: ${1.0 >= THICKNESS_THRESHOLD ? '厚坯' : '普通坯'}`);
  console.log(`厚度1.1cm: ${1.1 >= THICKNESS_THRESHOLD ? '厚坯' : '普通坯'}`);

  console.log('\n--- 空作品列表 ---');
  const emptyDuration = calculateTotalDuration(testStages, testKiln, []);
  console.log(`空作品列表时长: ${emptyDuration.totalDuration.toFixed(2)} 小时`);

  const emptyCapacity = calculateCapacityUtilization(testKiln, []);
  console.log(`空作品容量利用率: ${(emptyCapacity * 100).toFixed(1)}%`);

  console.log('\n========================================');
  console.log('  测试完成！');
  console.log('========================================');
}

runTests();
