import { DishShelfVerifier } from '../src/verifier.js';
import { Dish, StoreInventory, HeadquartersNotice } from '../src/types.js';

function createNormalTestData(): { dishes: Dish[], inventory: StoreInventory[], notices: HeadquartersNotice[] } {
  const dishes: Dish[] = [
    {
      dishId: 'D001',
      dishName: '宫保鸡丁预制包',
      dishType: '预制菜',
      status: '上架',
      isCombo: false,
      category: '热菜',
      price: 28.00
    },
    {
      dishId: 'D002',
      dishName: '鱼香肉丝预制包',
      dishType: '预制菜',
      status: '上架',
      isCombo: false,
      category: '热菜',
      price: 26.00
    },
    {
      dishId: 'D003',
      dishName: '超值套餐A',
      dishType: '组合菜',
      status: '上架',
      isCombo: true,
      comboComponents: ['D001', 'D002'],
      category: '套餐',
      price: 68.00
    }
  ];

  const inventory: StoreInventory[] = [
    { storeId: 'S001', storeName: '朝阳门店', dishId: 'D001', dishName: '宫保鸡丁预制包', stockQuantity: 150, unit: '份', lastUpdated: '2024-01-15' },
    { storeId: 'S001', storeName: '朝阳门店', dishId: 'D002', dishName: '鱼香肉丝预制包', stockQuantity: 80, unit: '份', lastUpdated: '2024-01-15' },
    { storeId: 'S002', storeName: '海淀门店', dishId: 'D001', dishName: '宫保鸡丁预制包', stockQuantity: 200, unit: '份', lastUpdated: '2024-01-15' },
    { storeId: 'S002', storeName: '海淀门店', dishId: 'D002', dishName: '鱼香肉丝预制包', stockQuantity: 120, unit: '份', lastUpdated: '2024-01-15' },
    { storeId: 'S003', storeName: '西城门店', dishId: 'D001', dishName: '宫保鸡丁预制包', stockQuantity: 600, unit: '份', lastUpdated: '2024-01-15' }
  ];

  const notices: HeadquartersNotice[] = [
    {
      noticeId: 'N001',
      noticeDate: '2024-01-15',
      noticeType: '下架通知',
      targetDishIds: ['D001', 'D002'],
      reason: '供应商原材料质量问题，召回相关预制菜',
      effectiveDate: '2024-01-16'
    }
  ];

  return { dishes, inventory, notices };
}

function createErrorTestData(): { dishes: Dish[], inventory: StoreInventory[], notices: HeadquartersNotice[] } {
  const dishes: Dish[] = [
    {
      dishId: 'D001',
      dishName: '宫保鸡丁预制包',
      dishType: '预制菜',
      status: '定时上架',
      scheduledOnTime: '2024-01-14',
      isCombo: false,
      category: '热菜',
      price: 28.00
    },
    {
      dishId: 'D003',
      dishName: '超值套餐A',
      dishType: '组合菜',
      status: '上架',
      isCombo: true,
      comboComponents: ['D001', 'D002'],
      category: '套餐',
      price: 68.00
    }
  ];

  const inventory: StoreInventory[] = [
    { storeId: 'S001', storeName: '朝阳门店', dishId: 'D001', dishName: '宫保鸡丁预制包', stockQuantity: 800, unit: '份', lastUpdated: '2024-01-15' }
  ];

  const notices: HeadquartersNotice[] = [
    {
      noticeId: 'N001',
      noticeDate: '2024-01-15',
      noticeType: '下架通知',
      targetDishIds: ['D001', 'D002', 'D999'],
      reason: '供应商原材料质量问题，召回相关预制菜',
      effectiveDate: '2024-01-16'
    }
  ];

  return { dishes, inventory, notices };
}

function runNormalPathTest(): boolean {
  console.log('='.repeat(60));
  console.log('🧪 运行【正常路径】测试');
  console.log('='.repeat(60));
  console.log();

  const { dishes, inventory, notices } = createNormalTestData();
  const verifier = new DishShelfVerifier('2024-01-16');
  verifier.loadData(dishes, inventory, notices);
  const result = verifier.verify();

  let passed = true;

  console.log('📊 测试结果:');
  console.log();

  if (result.summary.totalAffectedDishes === 2) {
    console.log('✅ 正确识别受影响菜品数量 (2个)');
  } else {
    console.log(`❌ 受影响菜品数量错误: 期望 2, 实际 ${result.summary.totalAffectedDishes}`);
    passed = false;
  }

  if (result.summary.totalAffectedStores === 3) {
    console.log('✅ 正确识别受影响门店数量 (3家)');
  } else {
    console.log(`❌ 受影响门店数量错误: 期望 3, 实际 ${result.summary.totalAffectedStores}`);
    passed = false;
  }

  const expectedStockValue = (150 + 200 + 600) * 28 + (80 + 120) * 26;
  if (result.summary.totalStockValue === expectedStockValue) {
    console.log('✅ 正确计算总库存价值');
  } else {
    console.log(`❌ 总库存价值错误: 期望 ${expectedStockValue}, 实际 ${result.summary.totalStockValue}`);
    passed = false;
  }

  if (result.summary.comboDishImpactCount === 2) {
    console.log('✅ 正确识别组合菜影响 (2个菜品都影响组合菜)');
  } else {
    console.log(`❌ 组合菜影响数量错误: 期望 2, 实际 ${result.summary.comboDishImpactCount}`);
    passed = false;
  }

  if (result.summary.highImpactCount === 2) {
    console.log('✅ 正确识别高影响菜品 (组合菜影响 → 高影响)');
  } else {
    console.log(`❌ 高影响菜品数量错误: 期望 2, 实际 ${result.summary.highImpactCount}`);
    passed = false;
  }

  const stockWarnings = result.summary.issues.filter(i => i.type === '库存预警');
  if (stockWarnings.length === 4) {
    console.log('✅ 正确生成库存预警 (4条预警: D001三家门店 + D002海淀门店120份)');
  } else {
    console.log(`❌ 库存预警数量错误: 期望 4, 实际 ${stockWarnings.length}`);
    passed = false;
  }

  const comboIssues = result.summary.issues.filter(i => i.type === '组合菜影响');
  if (comboIssues.length === 2) {
    console.log('✅ 正确生成组合菜影响预警');
  } else {
    console.log(`❌ 组合菜影响预警数量错误: 期望 2, 实际 ${comboIssues.length}`);
    passed = false;
  }

  console.log();
  console.log('🍽️  受影响菜品详情验证:');
  const dishD001 = result.affectedDishes.find(d => d.dishId === 'D001');
  if (dishD001 && dishD001.relatedComboDishes.length === 1 && dishD001.relatedComboDishes[0].dishId === 'D003') {
    console.log('✅ D001 正确关联组合菜 D003');
  } else {
    console.log('❌ D001 组合菜关联错误');
    passed = false;
  }

  console.log();
  return passed;
}

function runErrorPathTest(): boolean {
  console.log('='.repeat(60));
  console.log('🧪 运行【异常路径】测试');
  console.log('='.repeat(60));
  console.log();

  const { dishes, inventory, notices } = createErrorTestData();
  const verifier = new DishShelfVerifier('2024-01-16');
  verifier.loadData(dishes, inventory, notices);
  const result = verifier.verify();

  let passed = true;

  console.log('📊 测试结果:');
  console.log();

  const dataErrors = result.summary.issues.filter(i => i.type === '数据异常');
  const missingDishes = dataErrors.map(e => e.dishId);
  if (dataErrors.length === 2 && missingDishes.includes('D002') && missingDishes.includes('D999')) {
    console.log('✅ 正确识别不存在的菜品 D002 和 D999');
  } else {
    console.log(`❌ 未正确识别不存在的菜品: 期望 [D002, D999], 实际 ${JSON.stringify(missingDishes)}`);
    passed = false;
  }

  if (result.summary.scheduledConflictCount === 1) {
    console.log('✅ 正确识别定时上架冲突');
  } else {
    console.log(`❌ 定时上架冲突数量错误: 期望 1, 实际 ${result.summary.scheduledConflictCount}`);
    passed = false;
  }

  const dishD001 = result.affectedDishes.find(d => d.dishId === 'D001');
  if (dishD001?.scheduledInfo?.conflictDescription) {
    console.log('✅ 正确生成定时上架冲突描述');
    console.log(`   冲突描述: ${dishD001.scheduledInfo.conflictDescription}`);
  } else {
    console.log('❌ 未生成定时上架冲突描述');
    passed = false;
  }

  const severeStockErrors = result.summary.issues.filter(i => i.type === '库存预警' && i.severity === 'error');
  if (severeStockErrors.length === 1) {
    console.log('✅ 正确识别严重库存预警 (库存>500)');
  } else {
    console.log(`❌ 严重库存预警数量错误: 期望 1, 实际 ${severeStockErrors.length}`);
    passed = false;
  }

  const scheduledIssues = result.summary.issues.filter(i => i.type === '定时上架冲突');
  if (scheduledIssues.length === 1 && scheduledIssues[0].severity === 'error') {
    console.log('✅ 定时上架冲突标记为 error 级别');
  } else {
    console.log('❌ 定时上架冲突严重程度错误');
    passed = false;
  }

  console.log();
  return passed;
}

function runPrintReport(normalPassed: boolean, errorPassed: boolean): void {
  console.log('='.repeat(60));
  console.log('📋 菜品上下架表预制菜下架核验 - 测试报告');
  console.log('='.repeat(60));
  console.log();
  console.log(`正常路径测试: ${normalPassed ? '✅ 通过' : '❌ 失败'}`);
  console.log(`异常路径测试: ${errorPassed ? '✅ 通过' : '❌ 失败'}`);
  console.log();
  console.log(`总体结果: ${normalPassed && errorPassed ? '✅ 全部通过' : '❌ 部分失败'}`);
  console.log();
  console.log('='.repeat(60));
}

async function main() {
  console.log();
  console.log('🚀 开始菜品上下架表预制菜下架核验测试');
  console.log();

  const normalPassed = runNormalPathTest();
  const errorPassed = runErrorPathTest();
  
  runPrintReport(normalPassed, errorPassed);

  if (!normalPassed || !errorPassed) {
    process.exit(1);
  }
}

main().catch(console.error);
