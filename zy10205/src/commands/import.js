const fs = require('fs');
const path = require('path');
const orderManager = require('../core/order-manager');
const inventoryManager = require('../core/inventory-manager');
const deliveryManager = require('../core/delivery-manager');
const chalk = require('chalk');

function parseJSONFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function importOrders(filePath) {
  const data = parseJSONFile(filePath);
  const orders = Array.isArray(data) ? data : [data];
  
  let successCount = 0;
  let duplicateCount = 0;
  const errors = [];
  
  orders.forEach(orderData => {
    const result = orderManager.importOrder(orderData);
    if (result.success) {
      successCount++;
      console.log(chalk.green(`✓ 订单 ${orderData.orderId} 导入成功`));
    } else if (result.duplicate) {
      duplicateCount++;
      console.log(chalk.yellow(`⚠ 订单 ${orderData.orderId} 已存在，跳过`));
    } else {
      errors.push({ orderId: orderData.orderId, message: result.message });
      console.log(chalk.red(`✗ 订单 ${orderData.orderId} 导入失败: ${result.message}`));
    }
  });
  
  console.log('');
  console.log(chalk.bold('📊 导入结果:'));
  console.log(`  成功: ${successCount} 个`);
  console.log(`  重复: ${duplicateCount} 个`);
  console.log(`  失败: ${errors.length} 个`);
  
  return { successCount, duplicateCount, errors };
}

function importInventory(filePath) {
  const data = parseJSONFile(filePath);
  const items = Array.isArray(data) ? data : [data];
  
  const inventory = inventoryManager.getInventory();
  const existingNames = inventory.map(i => i.flowerName);
  
  let updatedCount = 0;
  let addedCount = 0;
  
  items.forEach(item => {
    if (existingNames.includes(item.flowerName)) {
      inventoryManager.updateFlowerStock(item.flowerName, item.quantity);
      updatedCount++;
    } else {
      inventoryManager.updateFlowerStock(item.flowerName, item.quantity);
      addedCount++;
    }
  });
  
  console.log(chalk.green('✅ 库存导入成功！'));
  console.log(`  新增: ${addedCount} 种`);
  console.log(`  更新: ${updatedCount} 种`);
  
  return { addedCount, updatedCount };
}

function importBouquetSpecs(filePath) {
  const data = parseJSONFile(filePath);
  const specs = Array.isArray(data) ? data : [data];
  const existingSpecs = orderManager.getBouquetSpecs();
  const existingIds = existingSpecs.map(s => s.specId);
  
  let addedCount = 0;
  let updatedCount = 0;
  
  specs.forEach(spec => {
    if (existingIds.includes(spec.specId)) {
      const index = existingSpecs.findIndex(s => s.specId === spec.specId);
      existingSpecs[index] = spec;
      updatedCount++;
    } else {
      existingSpecs.push(spec);
      addedCount++;
    }
  });
  
  orderManager.saveBouquetSpecs(existingSpecs);
  orderManager.addHistory('import_bouquet_specs', { addedCount, updatedCount });
  
  console.log(chalk.green('✅ 花束规格导入成功！'));
  console.log(`  新增: ${addedCount} 个`);
  console.log(`  更新: ${updatedCount} 个`);
  
  return { addedCount, updatedCount };
}

function importReplacements(filePath) {
  const data = parseJSONFile(filePath);
  const replacements = Array.isArray(data) ? data : [data];
  const existing = inventoryManager.getReplacements();
  const existingFlowers = existing.map(r => r.originalFlower);
  
  let addedCount = 0;
  let updatedCount = 0;
  
  replacements.forEach(replacement => {
    if (existingFlowers.includes(replacement.originalFlower)) {
      const index = existing.findIndex(r => r.originalFlower === replacement.originalFlower);
      existing[index] = replacement;
      updatedCount++;
    } else {
      existing.push(replacement);
      addedCount++;
    }
  });
  
  inventoryManager.saveReplacements(existing);
  orderManager.addHistory('import_replacements', { addedCount, updatedCount });
  
  console.log(chalk.green('✅ 可替换花材导入成功！'));
  console.log(`  新增: ${addedCount} 种`);
  console.log(`  更新: ${updatedCount} 种`);
  
  return { addedCount, updatedCount };
}

function importDeliverySlots(filePath) {
  const data = parseJSONFile(filePath);
  const slots = Array.isArray(data) ? data : [data];
  const existing = deliveryManager.getDeliverySlots();
  const existingIds = existing.map(s => s.slotId);
  
  let addedCount = 0;
  let updatedCount = 0;
  
  slots.forEach(slot => {
    if (existingIds.includes(slot.slotId)) {
      const index = existing.findIndex(s => s.slotId === slot.slotId);
      existing[index] = slot;
      updatedCount++;
    } else {
      existing.push(slot);
      addedCount++;
    }
  });
  
  deliveryManager.saveDeliverySlots(existing);
  orderManager.addHistory('import_delivery_slots', { addedCount, updatedCount });
  
  console.log(chalk.green('✅ 配送时段导入成功！'));
  console.log(`  新增: ${addedCount} 个`);
  console.log(`  更新: ${updatedCount} 个`);
  
  return { addedCount, updatedCount };
}

function importCards(filePath) {
  const data = parseJSONFile(filePath);
  const cards = Array.isArray(data) ? data : [data];
  const existing = orderManager.getCards();
  
  cards.forEach(card => {
    existing.push({
      ...card,
      importedAt: new Date().toISOString()
    });
  });
  
  orderManager.saveCards(existing);
  orderManager.addHistory('import_cards', { count: cards.length });
  
  console.log(chalk.green('✅ 卡片导入成功！'));
  console.log(`  新增: ${cards.length} 个`);
  
  return { count: cards.length };
}

function handleImport(type, filePath) {
  const absolutePath = path.resolve(filePath);
  
  try {
    switch (type) {
      case 'orders':
        return importOrders(absolutePath);
      case 'inventory':
        return importInventory(absolutePath);
      case 'specs':
        return importBouquetSpecs(absolutePath);
      case 'replacements':
        return importReplacements(absolutePath);
      case 'slots':
        return importDeliverySlots(absolutePath);
      case 'cards':
        return importCards(absolutePath);
      default:
        console.log(chalk.red(`❌ 未知的导入类型: ${type}`));
        console.log('可用类型: orders, inventory, specs, replacements, slots, cards');
        return null;
    }
  } catch (error) {
    console.log(chalk.red(`❌ 导入失败: ${error.message}`));
    return null;
  }
}

module.exports = {
  handleImport,
  importOrders,
  importInventory,
  importBouquetSpecs,
  importReplacements,
  importDeliverySlots,
  importCards
};
