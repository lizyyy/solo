#!/usr/bin/env node

const calculator = require('../lib/calculator');

console.log('========================================');
console.log('  测试：替代原料累计占用问题修复');
console.log('========================================\n');

const recipes = [
  {
    "recipeId": "BRD001",
    "productName": "产品A",
    "category": "测试",
    "batchSize": 10,
    "unit": "个",
    "ingredients": [
      {
        "itemId": "MAT001",
        "itemName": "原料A",
        "quantityPerBatch": 2.04,
        "unit": "kg"
      }
    ]
  },
  {
    "recipeId": "BRD002",
    "productName": "产品B",
    "category": "测试",
    "batchSize": 10,
    "unit": "个",
    "ingredients": [
      {
        "itemId": "MAT002",
        "itemName": "原料B",
        "quantityPerBatch": 2.04,
        "unit": "kg"
      }
    ]
  }
];

const orders = [
  {
    "orderId": "TEST-001",
    "storeId": "ST001",
    "storeName": "测试门店",
    "items": [
      {
        "productId": "BRD001",
        "productName": "产品A",
        "quantity": 50
      },
      {
        "productId": "BRD002",
        "productName": "产品B",
        "quantity": 50
      }
    ]
  }
];

const inventory = [
  {
    "itemId": "MAT001",
    "itemName": "原料A",
    "unit": "kg",
    "quantity": 0,
    "unitCost": 10,
    "allergens": []
  },
  {
    "itemId": "MAT002",
    "itemName": "原料B",
    "unit": "kg",
    "quantity": 0,
    "unitCost": 10,
    "allergens": []
  },
  {
    "itemId": "MAT003",
    "itemName": "共享替代粉",
    "unit": "kg",
    "quantity": 15,
    "unitCost": 12,
    "allergens": []
  }
];

const substitutes = [
  {
    "substituteId": "SUB001",
    "originalId": "MAT001",
    "originalName": "原料A",
    "substituteId": "MAT003",
    "substituteName": "共享替代粉",
    "conversionRatio": 1,
    "priority": 1,
    "status": "active"
  },
  {
    "substituteId": "SUB002",
    "originalId": "MAT002",
    "originalName": "原料B",
    "substituteId": "MAT003",
    "substituteName": "共享替代粉",
    "conversionRatio": 1,
    "priority": 1,
    "status": "active"
  }
];

const losses = [];

console.log('【测试场景】');
console.log('  产品A需求: 50个，需要原料A: 50 / 10 * 2.04 = 10.2kg');
console.log('  产品B需求: 50个，需要原料B: 50 / 10 * 2.04 = 10.2kg');
console.log('  原料A库存: 0kg（全部缺料）');
console.log('  原料B库存: 0kg（全部缺料）');
console.log('  共享替代粉库存: 15kg');
console.log('  原料A缺10.2kg → 需要替代粉10.2kg');
console.log('  原料B缺10.2kg → 需要替代粉10.2kg');
console.log('  替代粉总共需要: 20.4kg');
console.log('  替代粉实际只有: 15kg');
console.log('  【预期结果】: 应该检测到短缺，canProduce = false');
console.log('  【Bug修复前】: 错误返回 canProduce = true（因为分别检查，都觉得15kg够自己用）\n');

console.log('【开始计算】...\n');

const result = calculator.calculateRequirements(recipes, orders, inventory, substitutes, losses);
const costSummary = calculator.calculateBatchCost(result.productPlan, inventory, result.shortages);

console.log('【计算结果】');
console.log(`  短缺项数: ${result.shortages.length}`);
console.log(`  已使用替代: ${result.substitutions.length} 项`);
console.log(`  canProduce: ${costSummary.canProduce}`);

if (result.shortages.length > 0) {
  console.log('\n  短缺详情:');
  result.shortages.forEach(s => {
    console.log(`    - ${s.itemName}: 需 ${s.required}${s.unit}, 库 ${s.available}${s.unit}, 缺口 ${s.deficit}${s.unit} (${s.deficitPercent}%)`);
  });
}

if (result.substitutions.length > 0) {
  console.log('\n  使用的替代:');
  result.substitutions.forEach(s => {
    console.log(`    - ${s.originalName} → ${s.substituteName}: 用了 ${s.substituteUsed}${'kg'}`);
  });
}

console.log('\n【测试验证】');
const expectedShortageCount = 1;
const expectedCanProduce = false;

const test1Pass = result.shortages.length === expectedShortageCount;
const test2Pass = costSummary.canProduce === expectedCanProduce;

console.log(`  Test 1 - 短缺项数应为 ${expectedShortageCount}: ${test1Pass ? '✅ PASS' : '❌ FAIL'} (实际: ${result.shortages.length})`);
console.log(`  Test 2 - canProduce 应为 ${expectedCanProduce}: ${test2Pass ? '✅ PASS' : '❌ FAIL'} (实际: ${costSummary.canProduce})`);

if (test1Pass && test2Pass) {
  console.log('\n========================================');
  console.log('  ✅ 所有测试通过！Bug已修复！');
  console.log('========================================\n');
  process.exit(0);
} else {
  console.log('\n========================================');
  console.log('  ❌ 测试失败！');
  console.log('========================================\n');
  process.exit(1);
}
