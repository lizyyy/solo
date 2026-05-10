const storage = require('../storage/file');
const { v4: uuidv4 } = require('uuid');
const orderManager = require('./order-manager');

function getInventory() {
  return storage.readJSON(storage.getInventoryPath(), []);
}

function saveInventory(inventory) {
  storage.writeJSON(storage.getInventoryPath(), inventory);
}

function getReplacements() {
  return storage.readJSON(storage.getReplacementsPath(), []);
}

function saveReplacements(replacements) {
  storage.writeJSON(storage.getReplacementsPath(), replacements);
}

function getFlowerStock(flowerName) {
  const inventory = getInventory();
  const item = inventory.find(i => i.flowerName === flowerName);
  return item ? item.quantity : 0;
}

function updateFlowerStock(flowerName, quantity, isAdd = false) {
  const inventory = getInventory();
  const index = inventory.findIndex(i => i.flowerName === flowerName);
  
  if (index === -1) {
    inventory.push({
      id: uuidv4(),
      flowerName,
      quantity,
      unit: '枝',
      updatedAt: new Date().toISOString()
    });
  } else {
    if (isAdd) {
      inventory[index].quantity += quantity;
    } else {
      inventory[index].quantity = quantity;
    }
    inventory[index].updatedAt = new Date().toISOString();
  }
  
  saveInventory(inventory);
}

function getReplacementOptions(originalFlower) {
  const replacements = getReplacements();
  const replacement = replacements.find(r => r.originalFlower === originalFlower);
  return replacement ? replacement.options : [];
}

function calculateFlowerRequirements() {
  const orders = orderManager.getOrders();
  const bouquetSpecs = orderManager.getBouquetSpecs();
  const requirements = {};
  
  orders.forEach(order => {
    if (order.status === 'cancelled') return;
    
    order.bouquets.forEach(bouquet => {
      const spec = bouquetSpecs.find(s => s.specId === bouquet.specId);
      if (spec) {
        spec.flowers.forEach(flower => {
          const flowerName = flower.name;
          const needed = flower.quantity * bouquet.quantity;
          requirements[flowerName] = (requirements[flowerName] || 0) + needed;
        });
      }
    });
  });
  
  return requirements;
}

function checkInventoryStatus() {
  const requirements = calculateFlowerRequirements();
  const inventory = getInventory();
  const status = [];
  
  Object.entries(requirements).forEach(([flowerName, required]) => {
    const stock = getFlowerStock(flowerName);
    const shortage = Math.max(0, required - stock);
    
    status.push({
      flowerName,
      required,
      stock,
      shortage,
      hasShortage: shortage > 0,
      replacementOptions: getReplacementOptions(flowerName)
    });
  });
  
  return {
    summary: status,
    totalShortage: status.reduce((sum, s) => sum + s.shortage, 0),
    flowersWithShortage: status.filter(s => s.hasShortage).map(s => s.flowerName)
  };
}

module.exports = {
  getInventory,
  saveInventory,
  getReplacements,
  saveReplacements,
  getFlowerStock,
  updateFlowerStock,
  getReplacementOptions,
  calculateFlowerRequirements,
  checkInventoryStatus
};
