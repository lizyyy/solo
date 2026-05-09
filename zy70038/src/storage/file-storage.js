const fs = require('fs');
const path = require('path');
const config = require('../config');

class FileStorage {
  constructor() {
    this.dataDir = config.dataDir;
    this.ensureDirExists(this.dataDir);
    
    this.files = {
      orders: path.join(this.dataDir, 'orders.json'),
      inventory: path.join(this.dataDir, 'inventory.json'),
      stockOperations: path.join(this.dataDir, 'stock-operations.json'),
      exceptions: path.join(this.dataDir, 'exceptions.json'),
      pickupCodes: path.join(this.dataDir, 'pickup-codes.json')
    };
    
    this.initEmptyFiles();
  }
  
  ensureDirExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  initEmptyFiles() {
    Object.values(this.files).forEach(file => {
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify([], null, 2), 'utf8');
      }
    });
  }
  
  readFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
  
  writeFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
  
  getOrders() {
    return this.readFile(this.files.orders);
  }
  
  saveOrders(orders) {
    this.writeFile(this.files.orders, orders);
  }
  
  getInventory() {
    return this.readFile(this.files.inventory);
  }
  
  saveInventory(inventory) {
    this.writeFile(this.files.inventory, inventory);
  }
  
  getStockOperations() {
    return this.readFile(this.files.stockOperations);
  }
  
  saveStockOperations(operations) {
    this.writeFile(this.files.stockOperations, operations);
  }
  
  getExceptions() {
    return this.readFile(this.files.exceptions);
  }
  
  saveExceptions(exceptions) {
    this.writeFile(this.files.exceptions, exceptions);
  }
  
  getPickupCodes() {
    return this.readFile(this.files.pickupCodes);
  }
  
  savePickupCodes(codes) {
    this.writeFile(this.files.pickupCodes, codes);
  }
}

module.exports = new FileStorage();
