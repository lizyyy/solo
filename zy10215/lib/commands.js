const fs = require('fs');
const path = require('path');
const store = require('./store');
const calculator = require('./calculator');

const VALID_IMPORT_TYPES = ['recipes', 'orders', 'inventory', 'substitutes', 'losses'];

function getTimestamp() {
  return new Date().toISOString();
}

function checkDataExists(dataDir) {
  if (!fs.existsSync(dataDir)) {
    throw new Error(`数据目录不存在: ${dataDir}。请先运行 'bakery init' 初始化。`);
  }
}

function checkDuplicateImport(dataDir, type, data) {
  const logs = store.readJson(dataDir, 'importLogs', []);
  const dataHash = store.hashData(data);
  
  const existing = logs.find(l => 
    l.type === type && 
    l.dataHash === dataHash
  );
  
  if (existing) {
    return {
      isDuplicate: true,
      existingEntry: existing
    };
  }
  
  return { isDuplicate: false };
}

function checkOrdersAlreadyProcessed(dataDir, orders) {
  const batches = store.readJson(dataDir, 'batches', []);
  const orderIds = orders.map(o => o.orderId);
  const processedOrderIds = new Set();
  
  batches.forEach(batch => {
    if (batch.orderIds) {
      batch.orderIds.forEach(id => processedOrderIds.add(id));
    }
  });
  
  const alreadyProcessed = orderIds.filter(id => processedOrderIds.has(id));
  return alreadyProcessed;
}

async function init(dataDir) {
  console.log(`\n初始化数据目录: ${dataDir}`);
  
  store.ensureDir(dataDir);
  
  const data = {
    recipes: [],
    orders: [],
    inventory: [],
    substitutes: [],
    losses: [],
    batches: [],
    importLogs: []
  };
  
  Object.keys(data).forEach(key => {
    store.writeJson(dataDir, key, data[key]);
  });
  
  const exampleDir = path.join(process.cwd(), 'examples');
  if (!fs.existsSync(exampleDir)) {
    console.log('\n提示: 可将示例数据放入 ./examples 目录');
    console.log('数据格式参考项目中的 examples 目录');
  }
  
  console.log('\n✓ 初始化完成');
  console.log(`  数据目录: ${dataDir}`);
  console.log('  可执行的下一步:');
  console.log('    bakery import recipes ./examples/recipes.json');
  console.log('    bakery import inventory ./examples/inventory.json');
  console.log('    bakery import orders ./examples/orders.json');
  console.log('    bakery import substitutes ./examples/substitutes.json');
}

async function doImport(dataDir, type, filePath, force) {
  checkDataExists(dataDir);
  
  if (!VALID_IMPORT_TYPES.includes(type)) {
    throw new Error(`无效的导入类型: ${type}。有效类型: ${VALID_IMPORT_TYPES.join(', ')}`);
  }
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  
  let importData;
  try {
    importData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    throw new Error(`文件格式错误: ${e.message}`);
  }
  
  if (!Array.isArray(importData)) {
    throw new Error('导入数据必须是数组格式');
  }
  
  console.log(`\n导入 ${type} 数据...`);
  console.log(`  来源文件: ${filePath}`);
  console.log(`  数据条数: ${importData.length}`);
  
  const dupCheck = checkDuplicateImport(dataDir, type, importData);
  if (dupCheck.isDuplicate && !force) {
    throw new Error(
      `检测到重复导入。相同数据已于 ${dupCheck.existingEntry.timestamp} 导入。\n` +
      `  使用 --force 选项可强制覆盖。`
    );
  }
  
  if (type === 'orders') {
    const processed = checkOrdersAlreadyProcessed(dataDir, importData);
    if (processed.length > 0 && !force) {
      throw new Error(
        `以下订单已在之前的批次中使用: ${processed.join(', ')}\n` +
        `  使用 --force 选项可强制重新导入（不推荐）。`
      );
    }
  }
  
  const existing = store.readJson(dataDir, type, []);
  
  if (type === 'recipes' || type === 'inventory' || type === 'substitutes') {
    const idKey = type === 'recipes' ? 'recipeId' : 'itemId';
    const existingMap = new Map(existing.map(e => [e[idKey], e]));
    let updated = 0;
    let added = 0;
    
    importData.forEach(item => {
      if (existingMap.has(item[idKey])) {
        const idx = existing.findIndex(e => e[idKey] === item[idKey]);
        existing[idx] = { ...existing[idx], ...item, updatedAt: getTimestamp() };
        updated++;
      } else {
        existing.push({ ...item, createdAt: getTimestamp(), updatedAt: getTimestamp() });
        added++;
      }
    });
    
    store.writeJson(dataDir, type, existing);
    console.log(`  新增: ${added} 条, 更新: ${updated} 条`);
  } else if (type === 'orders' || type === 'losses') {
    const idKey = type === 'orders' ? 'orderId' : 'lossId';
    const existingIds = new Set(existing.map(e => e[idKey]));
    let added = 0;
    let skipped = 0;
    
    importData.forEach(item => {
      if (existingIds.has(item[idKey])) {
        skipped++;
      } else {
        if (!item.createdAt) item.createdAt = getTimestamp();
        existing.push(item);
        existingIds.add(item[idKey]);
        added++;
      }
    });
    
    store.writeJson(dataDir, type, existing);
    if (skipped > 0) {
      console.log(`  新增: ${added} 条, 跳过重复: ${skipped} 条`);
    } else {
      console.log(`  追加: ${added} 条`);
    }
  }
  
  const logs = store.readJson(dataDir, 'importLogs', []);
  logs.push({
    type,
    filePath,
    dataHash: store.hashData(importData),
    recordCount: importData.length,
    timestamp: getTimestamp(),
    forced: force || false
  });
  store.writeJson(dataDir, 'importLogs', logs);
  
  console.log(`✓ ${type} 数据导入完成`);
}

async function doValidate(dataDir) {
  checkDataExists(dataDir);
  
  console.log('\n══════════════════════════════════════════════');
  console.log('          生产批次校验 & 生产单预览');
  console.log('══════════════════════════════════════════════\n');
  
  const recipes = store.readJson(dataDir, 'recipes', []);
  const orders = store.readJson(dataDir, 'orders', []);
  const inventory = store.readJson(dataDir, 'inventory', []);
  const substitutes = store.readJson(dataDir, 'substitutes', []);
  const losses = store.readJson(dataDir, 'losses', []);
  
  if (recipes.length === 0) throw new Error('没有配方数据，请先导入配方');
  if (orders.length === 0) throw new Error('没有订单数据，请先导入订单');
  if (inventory.length === 0) throw new Error('没有库存数据，请先导入库存');
  
  const pendingOrders = orders.filter(o => o.status !== 'processed' && !o.processedAt);
  if (pendingOrders.length === 0) {
    console.log('✓ 所有订单都已处理完成。没有待处理的订单。');
    return;
  }
  
  console.log(`待处理订单: ${pendingOrders.length} 个门店订单`);
  pendingOrders.forEach(o => {
    const totalItems = o.items.reduce((s, i) => s + i.quantity, 0);
    console.log(`  - ${o.storeName} (${o.orderId}): ${totalItems} 件商品`);
  });
  
  const result = calculator.calculateRequirements(recipes, pendingOrders, inventory, substitutes, losses);
  const costSummary = calculator.calculateBatchCost(result.productPlan, inventory, result.shortages);
  
  const batchNo = store.getBatchNumber(dataDir);
  const generatedAt = getTimestamp();
  
  const validationResult = {
    batchNo,
    generatedAt,
    status: 'validating',
    orders: pendingOrders,
    orderIds: pendingOrders.map(o => o.orderId),
    productPlan: result.productPlan,
    shortages: result.shortages,
    substitutions: result.substitutions,
    allergenWarnings: result.allergenWarnings,
    roundingVariances: result.roundingVariances,
    costSummary
  };
  
  store.writeJson(dataDir, 'lastValidate', validationResult);
  
  console.log('\n──────────────────────────────────────────────');
  console.log('【1】产品生产计划');
  console.log('──────────────────────────────────────────────\n');
  
  result.productPlan.forEach(plan => {
    console.log(`${plan.productName}`);
    console.log(`  需求: ${plan.demand} 件 | 批次规格: ${plan.batchSize} 件/批`);
    console.log(`  理论倍率: ${plan.exactMultiplier} | 实际取整: ${plan.roundedMultiplier} 倍`);
    console.log(`  实际产出: ${plan.actualOutput} 件 (超产: +${plan.surplus} 件, +${plan.surplusPercent}%)`);
    console.log(`  每批成本: ¥${plan.costPerBatch} | 预计成本: ¥${plan.roundedCost}`);
    if (plan.costVariance !== 0) {
      console.log(`  倍率取整偏差: +¥${plan.costVariance} (+${plan.costVariancePercent}%)`);
    }
    console.log(`  损耗率: ${plan.lossRate}%`);
    console.log('  门店分配:');
    plan.storeOrders.forEach(o => {
      console.log(`    - ${o.storeName}: ${o.quantity} 件`);
    });
    console.log('');
  });
  
  console.log('\n──────────────────────────────────────────────');
  console.log('【2】原料需求与库存校验');
  console.log('──────────────────────────────────────────────\n');
  
  Object.values(result.ingredientRequirements).forEach(req => {
    const needed = Math.ceil(req.required * 1000) / 1000;
    const status = req.available >= needed ? '✓ 充足' : '✗ 不足';
    console.log(`${req.itemName}: 需 ${needed} ${req.unit}, 库 ${req.available} ${req.unit} [${status}]`);
    
    if (req.substitutions.length > 0) {
      console.log('  可替代原料:');
      req.substitutions.forEach(sub => {
        const canCover = sub.available >= sub.needed ? '✓ 可覆盖' : '✗ 仍不足';
        console.log(`    - ${sub.substituteName}: 需 ${sub.needed}, 库 ${sub.available} [${canCover}]`);
      });
    }
    console.log('');
  });
  
  if (result.allergenWarnings.length > 0) {
    console.log('\n──────────────────────────────────────────────');
    console.log('【⚠️ 3】过敏标识警告');
    console.log('──────────────────────────────────────────────\n');
    
    result.allergenWarnings.forEach(warn => {
      console.log(`⚠ ${warn.reason}`);
      console.log(`  原原料: ${warn.originalName} (过敏原: ${warn.originalAllergens.join(', ') || '无'})`);
      console.log(`  替代原料: ${warn.substituteName} (过敏原: 未标注)`);
      console.log('  建议: 在使用该替代原料前，请确认过敏原信息！\n');
    });
  }
  
  if (result.substitutions.length > 0) {
    console.log('\n──────────────────────────────────────────────');
    console.log('【4】替代原料使用方案');
    console.log('──────────────────────────────────────────────\n');
    
    result.substitutions.forEach(sub => {
      console.log(`${sub.originalName} → ${sub.substituteName}`);
      console.log(`  原缺量: ${sub.originalDeficit} | 替代用量: ${sub.substituteUsed} | 换算比: ${sub.conversionRatio}`);
      console.log('');
    });
  }
  
  if (result.shortages.length > 0) {
    console.log('\n──────────────────────────────────────────────');
    console.log('【❌ 5】原料短缺 - 无法满足生产');
    console.log('──────────────────────────────────────────────\n');
    
    result.shortages.forEach(short => {
      console.log(`❌ ${short.itemName}`);
      console.log(`   需求: ${short.required} ${short.unit}`);
      console.log(`   库存: ${short.available} ${short.unit}`);
      console.log(`   缺口: ${short.deficit} ${short.unit} (${short.deficitPercent}%)`);
      console.log('');
    });
  }
  
  if (result.roundingVariances.length > 0) {
    console.log('\n──────────────────────────────────────────────');
    console.log('【6】倍率取整导致的成本偏差');
    console.log('──────────────────────────────────────────────\n');
    
    result.roundingVariances.forEach(v => {
      console.log(`${v.productName}`);
      console.log(`  理论成本: ¥${v.exactCost} | 实际成本: ¥${v.roundedCost}`);
      console.log(`  偏差: +¥${v.costVariance} (+${v.costVariancePercent}%)`);
      console.log(`  超产: +${v.surplus} 件 (+${v.surplusPercent}%)`);
      console.log('');
    });
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('【汇总】批次成本分析');
  console.log('══════════════════════════════════════════════\n');
  
  console.log(`批次号: ${batchNo}`);
  console.log(`产品种类: ${costSummary.productCount} 种`);
  console.log(`理论总成本: ¥${costSummary.totalExactCost}`);
  console.log(`实际总成本: ¥${costSummary.totalRoundedCost}`);
  console.log(`倍率取整偏差: ¥${costSummary.totalCostVariance} (+${costSummary.variancePercent}%)`);
  console.log(`原料短缺: ${costSummary.shortageCount} 项`);
  
  if (costSummary.canProduce) {
    console.log('\n✅ 校验通过，可以生产！');
    console.log(`执行: bakery confirm ${batchNo}`);
  } else {
    console.log('\n❌ 校验失败，存在原料短缺！');
    console.log('请先补充短缺原料，或调整订单后重新校验。');
  }
  
  console.log('');
  return validationResult;
}

async function doConfirm(dataDir, batchNo) {
  checkDataExists(dataDir);
  
  const lastValidate = store.readJson(dataDir, 'lastValidate', null);
  if (!lastValidate) {
    throw new Error('没有待确认的校验结果。请先执行 bakery validate。');
  }
  
  if (lastValidate.batchNo !== batchNo) {
    throw new Error(`批次号不匹配。当前待确认批次是 ${lastValidate.batchNo}，不是 ${batchNo}。`);
  }
  
  const batches = store.readJson(dataDir, 'batches', []);
  if (batches.find(b => b.batchNo === batchNo)) {
    throw new Error(`批次 ${batchNo} 已存在，不能重复确认。`);
  }
  
  if (!lastValidate.costSummary.canProduce) {
    throw new Error('该批次存在原料短缺，无法确认生产。请先解决缺料问题。');
  }
  
  console.log(`\n确认批次 ${batchNo}...`);
  
  const inventory = store.readJson(dataDir, 'inventory', []);
  const recipes = store.readJson(dataDir, 'recipes', []);
  const substitutes = store.readJson(dataDir, 'substitutes', []);
  const losses = store.readJson(dataDir, 'losses', []);
  
  const ingredientUsage = {};
  
  lastValidate.productPlan.forEach(plan => {
    const recipe = recipes.find(r => r.recipeId === plan.productId);
    if (!recipe) return;
    
    const lossRate = calculator.getLossRate(losses, plan.productId);
    const adjustedMultiplier = plan.roundedMultiplier * (1 + lossRate);
    
    recipe.ingredients.forEach(ing => {
      if (!ingredientUsage[ing.itemId]) {
        ingredientUsage[ing.itemId] = {
          itemId: ing.itemId,
          itemName: ing.itemName,
          unit: ing.unit,
          originalUsage: 0,
          substitutionUsed: false,
          substituteDetails: null
        };
      }
      ingredientUsage[ing.itemId].originalUsage += ing.quantityPerBatch * adjustedMultiplier;
    });
  });
  
  const substitutionsApplied = [];
  
  Object.keys(ingredientUsage).forEach(itemId => {
    const usage = ingredientUsage[itemId];
    const inv = inventory.find(i => i.itemId === itemId);
    
    if (!inv) return;
    
    const needed = Math.ceil(usage.originalUsage * 1000) / 1000;
    
    if (inv.quantity >= needed) {
      inv.quantity -= needed;
      usage.actualDeducted = needed;
    } else {
      const subInfo = lastValidate.substitutions.find(s => s.originalId === itemId);
      if (subInfo) {
        const subInv = inventory.find(i => i.itemId === subInfo.substituteId);
        if (subInv && subInv.quantity >= subInfo.substituteUsed) {
          inv.quantity = 0;
          subInv.quantity -= subInfo.substituteUsed;
          usage.substitutionUsed = true;
          usage.substituteDetails = subInfo;
          usage.originalDeducted = inv.quantity + needed;
          substitutionsApplied.push(subInfo);
        }
      }
    }
  });
  
  store.writeJson(dataDir, 'inventory', inventory);
  
  const orders = store.readJson(dataDir, 'orders', []);
  lastValidate.orderIds.forEach(orderId => {
    const order = orders.find(o => o.orderId === orderId);
    if (order) {
      order.status = 'processed';
      order.processedAt = getTimestamp();
      order.batchNo = batchNo;
    }
  });
  store.writeJson(dataDir, 'orders', orders);
  
  const batch = {
    batchNo,
    createdAt: getTimestamp(),
    status: 'confirmed',
    orderIds: lastValidate.orderIds,
    productPlan: lastValidate.productPlan,
    ingredientUsage,
    substitutionsApplied,
    costSummary: lastValidate.costSummary,
    originalShortages: lastValidate.shortages,
    allergenWarnings: lastValidate.allergenWarnings,
    roundingVariances: lastValidate.roundingVariances
  };
  
  batches.push(batch);
  store.writeJson(dataDir, 'batches', batches);
  
  const emptyValidate = null;
  store.writeJson(dataDir, 'lastValidate', emptyValidate);
  
  console.log('\n✓ 批次确认成功！');
  console.log(`  批次号: ${batchNo}`);
  console.log(`  产品: ${lastValidate.productPlan.length} 种`);
  console.log(`  总成本: ¥${lastValidate.costSummary.totalRoundedCost}`);
  console.log(`  使用替代: ${substitutionsApplied.length} 项`);
  console.log(`  处理订单: ${lastValidate.orderIds.length} 个`);
  
  return batch;
}

async function doQuery(dataDir, type, options) {
  checkDataExists(dataDir);
  
  switch (type) {
    case 'batches':
      queryBatches(dataDir, options);
      break;
    case 'orders':
      queryOrders(dataDir, options);
      break;
    case 'inventory':
      queryInventory(dataDir, options);
      break;
    default:
      throw new Error(`无效的查询类型: ${type}`);
  }
}

function queryBatches(dataDir, options) {
  const batches = store.readJson(dataDir, 'batches', []);
  
  let filtered = batches;
  if (options.date) {
    filtered = batches.filter(b => b.batchNo.includes(options.date));
  }
  
  console.log(`\n══════════════════════════════════════════════`);
  console.log('          批次历史查询');
  console.log(`══════════════════════════════════════════════\n`);
  
  if (filtered.length === 0) {
    console.log('没有找到匹配的批次记录。');
    return;
  }
  
  filtered.forEach(batch => {
    console.log(`批次号: ${batch.batchNo}`);
    console.log(`创建时间: ${batch.createdAt}`);
    console.log(`状态: ${batch.status}`);
    console.log(`产品数: ${batch.productPlan.length} 种`);
    console.log(`总成本: ¥${batch.costSummary.totalRoundedCost}`);
    console.log(`成本偏差: ¥${batch.costSummary.totalCostVariance} (+${batch.costSummary.variancePercent}%)`);
    console.log(`订单数: ${batch.orderIds.length} 个`);
    console.log(`替代原料: ${batch.substitutionsApplied.length} 项`);
    console.log('');
  });
}

function queryOrders(dataDir, options) {
  const orders = store.readJson(dataDir, 'orders', []);
  
  let filtered = orders;
  if (options.date) {
    filtered = orders.filter(o => (o.createdAt || '').includes(options.date));
  }
  
  console.log(`\n══════════════════════════════════════════════`);
  console.log('          订单历史查询');
  console.log(`══════════════════════════════════════════════\n`);
  
  if (filtered.length === 0) {
    console.log('没有找到匹配的订单。');
    return;
  }
  
  filtered.forEach(order => {
    const total = order.items.reduce((s, i) => s + i.quantity, 0);
    console.log(`订单号: ${order.orderId}`);
    console.log(`门店: ${order.storeName}`);
    console.log(`创建时间: ${order.createdAt}`);
    console.log(`状态: ${order.status || 'pending'}`);
    console.log(`总数量: ${total} 件`);
    if (order.batchNo) {
      console.log(`生产批次: ${order.batchNo}`);
    }
    console.log('商品明细:');
    order.items.forEach(item => {
      console.log(`  - ${item.productName}: ${item.quantity} 件`);
    });
    console.log('');
  });
}

function queryInventory(dataDir, options) {
  const inventory = store.readJson(dataDir, 'inventory', []);
  
  console.log(`\n══════════════════════════════════════════════`);
  console.log('          当前库存状态');
  console.log(`══════════════════════════════════════════════\n`);
  
  if (inventory.length === 0) {
    console.log('库存为空。');
    return;
  }
  
  inventory.forEach(inv => {
    const allergens = inv.allergens && inv.allergens.length > 0 
      ? ` (过敏原: ${inv.allergens.join(', ')})` 
      : '';
    console.log(`${inv.itemName} (${inv.itemId})`);
    console.log(`  库存: ${inv.quantity} ${inv.unit}`);
    console.log(`  单价: ¥${inv.unitCost}/${inv.unit}${allergens}`);
    if (inv.updatedAt) {
      console.log(`  更新时间: ${inv.updatedAt}`);
    }
    console.log('');
  });
}

async function doExport(dataDir, type, outputPath) {
  checkDataExists(dataDir);
  
  let exportData;
  let fileName;
  
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  switch (type) {
    case 'production':
      const lastValidate = store.readJson(dataDir, 'lastValidate', null);
      if (!lastValidate) {
        throw new Error('没有可导出的生产单。请先执行 bakery validate。');
      }
      exportData = {
        batchNo: lastValidate.batchNo,
        generatedAt: lastValidate.generatedAt,
        productPlan: lastValidate.productPlan,
        shortages: lastValidate.shortages,
        substitutions: lastValidate.substitutions,
        costSummary: lastValidate.costSummary,
        canProduce: lastValidate.costSummary.canProduce
      };
      fileName = `production-${lastValidate.batchNo}.json`;
      break;
      
    case 'batches':
      exportData = store.readJson(dataDir, 'batches', []);
      fileName = `batches-export-${Date.now()}.json`;
      break;
      
    case 'shortages':
      const val = store.readJson(dataDir, 'lastValidate', null);
      if (!val) {
        throw new Error('没有可导出的缺料数据。请先执行 bakery validate。');
      }
      exportData = {
        batchNo: val.batchNo,
        generatedAt: val.generatedAt,
        shortages: val.shortages,
        allergenWarnings: val.allergenWarnings
      };
      fileName = `shortages-${val.batchNo}.json`;
      break;
      
    default:
      throw new Error(`无效的导出类型: ${type}`);
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');
  
  console.log(`\n✓ 导出成功`);
  console.log(`  类型: ${type}`);
  console.log(`  路径: ${outputPath}`);
  console.log(`  数据条数: ${Array.isArray(exportData) ? exportData.length : 1}`);
}

module.exports = {
  init,
  import: doImport,
  validate: doValidate,
  confirm: doConfirm,
  query: doQuery,
  export: doExport
};
