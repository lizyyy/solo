const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJSON(filePath, defaultValue = []) {
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return defaultValue;
  }
}

function writeJSON(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getConfigPath() {
  return path.join(DATA_DIR, 'config.json');
}

function getOrdersPath() {
  return path.join(DATA_DIR, 'orders', 'orders.json');
}

function getInventoryPath() {
  return path.join(DATA_DIR, 'inventory', 'inventory.json');
}

function getReplacementsPath() {
  return path.join(DATA_DIR, 'replacements', 'replacements.json');
}

function getDeliverySlotsPath() {
  return path.join(DATA_DIR, 'delivery', 'slots.json');
}

function getHistoryPath() {
  return path.join(DATA_DIR, 'history', 'history.json');
}

function getConfirmationsPath() {
  return path.join(DATA_DIR, 'confirmations', 'confirmations.json');
}

function getBouquetSpecsPath() {
  return path.join(DATA_DIR, 'orders', 'bouquet-specs.json');
}

function getCardsPath() {
  return path.join(DATA_DIR, 'orders', 'cards.json');
}

module.exports = {
  DATA_DIR,
  ensureDir,
  readJSON,
  writeJSON,
  getConfigPath,
  getOrdersPath,
  getInventoryPath,
  getReplacementsPath,
  getDeliverySlotsPath,
  getHistoryPath,
  getConfirmationsPath,
  getBouquetSpecsPath,
  getCardsPath
};
