const fs = require('fs');
const path = require('path');

const Product = require('../models/Product');
const Location = require('../models/Location');
const Inventory = require('../models/Inventory');
const Carrier = require('../models/Carrier');
const Order = require('../models/Order');
const Wave = require('../models/Wave');
const InventoryLock = require('../models/InventoryLock');

class Store {
  constructor(dataDir) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data');
    this.ensureDataDir();
    this.products = new Map();
    this.locations = new Map();
    this.inventories = new Map();
    this.carriers = new Map();
    this.orders = new Map();
    this.waves = new Map();
    this.locks = new Map();
    this.load();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  getFilePath(name) {
    return path.join(this.dataDir, `${name}.json`);
  }

  load() {
    this._loadFromFile('products', Product, this.products);
    this._loadFromFile('locations', Location, this.locations);
    this._loadFromFile('inventories', Inventory, this.inventories);
    this._loadFromFile('carriers', Carrier, this.carriers);
    this._loadFromFile('orders', Order, this.orders);
    this._loadFromFile('waves', Wave, this.waves);
    this._loadFromFile('locks', InventoryLock, this.locks);
  }

  _loadFromFile(fileName, ModelClass, map) {
    const filePath = this.getFilePath(fileName);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const itemData of data) {
        const instance = new ModelClass(itemData);
        map.set(this._getId(instance), instance);
      }
    }
  }

  _getId(instance) {
    if (instance instanceof Product) return instance.productId;
    if (instance instanceof Location) return instance.locationId;
    if (instance instanceof Inventory) return instance.inventoryId;
    if (instance instanceof Carrier) return instance.carrierId;
    if (instance instanceof Order) return instance.orderId;
    if (instance instanceof Wave) return instance.waveId;
    if (instance instanceof InventoryLock) return instance.lockId;
    return null;
  }

  save() {
    this._saveToFile('products', this.products);
    this._saveToFile('locations', this.locations);
    this._saveToFile('inventories', this.inventories);
    this._saveToFile('carriers', this.carriers);
    this._saveToFile('orders', this.orders);
    this._saveToFile('waves', this.waves);
    this._saveToFile('locks', this.locks);
  }

  _saveToFile(fileName, map) {
    const filePath = this.getFilePath(fileName);
    const data = Array.from(map.values()).map(item => item.toJSON());
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  addProduct(data) {
    const product = new Product(data);
    this.products.set(product.productId, product);
    return product;
  }

  addLocation(data) {
    const location = new Location(data);
    this.locations.set(location.locationId, location);
    return location;
  }

  addInventory(data) {
    const inventory = new Inventory(data);
    this.inventories.set(inventory.inventoryId, inventory);
    return inventory;
  }

  addCarrier(data) {
    const carrier = new Carrier(data);
    this.carriers.set(carrier.carrierId, carrier);
    return carrier;
  }

  addOrder(data) {
    const order = new Order(data);
    const existing = this.orders.get(order.orderId);
    if (existing) {
      order.waveId = existing.waveId;
      if (order.status === Order.STATUS.PENDING) {
        order.status = existing.status;
        order.exceptionReasons = existing.exceptionReasons;
      }
    }
    this.orders.set(order.orderId, order);
    return order;
  }

  addWave(data) {
    const wave = new Wave(data);
    this.waves.set(wave.waveId, wave);
    return wave;
  }

  addLock(data) {
    const lock = new InventoryLock(data);
    this.locks.set(lock.lockId, lock);
    return lock;
  }

  getOrderById(orderId) {
    return this.orders.get(orderId);
  }

  getOrderByNumber(orderNumber) {
    const orderId = Order.generateId(orderNumber);
    return this.orders.get(orderId);
  }

  getCarrierByCode(carrierCode) {
    const carrierId = Carrier.generateId(carrierCode, '');
    return this.carriers.get(carrierId);
  }

  getInventoryByLocationCode(locationCode) {
    const inventoryId = Inventory.generateId(locationCode);
    return this.inventories.get(inventoryId);
  }

  getLocationsBySku(sku) {
    return Array.from(this.locations.values()).filter(
      loc => loc.sku === sku.toUpperCase()
    );
  }

  getInventoriesBySku(sku) {
    const upperSku = sku.toUpperCase();
    return Array.from(this.inventories.values()).filter(
      inv => inv.sku === upperSku
    );
  }

  getActiveLocksByOrder(orderId) {
    return Array.from(this.locks.values()).filter(
      lock => lock.orderId === orderId && lock.isActive
    );
  }

  getActiveLocksByWave(waveId) {
    return Array.from(this.locks.values()).filter(
      lock => lock.waveId === waveId && lock.isActive
    );
  }

  getWaveById(waveId) {
    return this.waves.get(waveId);
  }

  getLockById(lockId) {
    return this.locks.get(lockId);
  }

  getAllOrders() {
    return Array.from(this.orders.values());
  }

  getAllWaves() {
    return Array.from(this.waves.values());
  }

  getAllLocks() {
    return Array.from(this.locks.values());
  }

  getAllProducts() {
    return Array.from(this.products.values());
  }

  getAllLocations() {
    return Array.from(this.locations.values());
  }

  getAllInventories() {
    return Array.from(this.inventories.values());
  }

  getAllCarriers() {
    return Array.from(this.carriers.values());
  }
}

module.exports = Store;
