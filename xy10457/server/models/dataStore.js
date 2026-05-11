const { v4: uuidv4 } = require('uuid');
const sampleData = require('../data/sampleData');

let products = [...sampleData.products];
let inventory = JSON.parse(JSON.stringify(sampleData.inventory));
let orders = JSON.parse(JSON.stringify(sampleData.orders));
let exchanges = [];
let exchangeTimelines = [];
let inventoryLogs = [];

const EXCHANGE_STATUS = {
  PENDING: 'pending',
  RETURN_RECEIVED: 'return_received',
  QUALITY_PASSED: 'quality_passed',
  QUALITY_FAILED: 'quality_failed',
  DIFFERENCE_PAID: 'difference_paid',
  DIFFERENCE_REFUNDED: 'difference_refunded',
  SHIPPED: 'shipped',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

function addTimeline(exchangeId, action, operator, description) {
  const timeline = {
    id: uuidv4(),
    exchangeId,
    action,
    operator,
    description,
    createdAt: new Date().toISOString()
  };
  exchangeTimelines.push(timeline);
  return timeline;
}

function addInventoryLog(inventoryId, type, quantity, reason, operator) {
  const log = {
    id: uuidv4(),
    inventoryId,
    type,
    quantity,
    reason,
    operator,
    createdAt: new Date().toISOString()
  };
  inventoryLogs.push(log);
  return log;
}

function checkDuplicateExchange(orderId, orderItemId) {
  const existing = exchanges.find(
    e => e.orderId === orderId && 
         e.orderItemId === orderItemId && 
         e.status !== EXCHANGE_STATUS.CANCELLED
  );
  return !!existing;
}

function checkInventory(productId, size, color, quantity = 1) {
  const inv = inventory.find(
    i => i.productId === productId && 
         i.size === size && 
         i.color === color
  );
  return inv && inv.quantity >= quantity;
}

function getInventory(productId, size, color) {
  return inventory.find(
    i => i.productId === productId && 
         i.size === size && 
         i.color === color
  );
}

function updateInventory(productId, size, color, quantity, operator, reason) {
  const inv = getInventory(productId, size, color);
  if (!inv) return null;
  
  const oldQuantity = inv.quantity;
  inv.quantity += quantity;
  
  addInventoryLog(
    inv.id,
    quantity > 0 ? 'in' : 'out',
    Math.abs(quantity),
    reason,
    operator
  );
  
  return inv;
}

function createExchange(data) {
  const exchange = {
    id: 'EX' + Date.now(),
    orderId: data.orderId,
    orderItemId: data.orderItemId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    originalProduct: data.originalProduct,
    originalSize: data.originalSize,
    originalColor: data.originalColor,
    originalPrice: data.originalPrice,
    targetProductId: data.targetProductId,
    targetProductName: data.targetProductName,
    targetSize: data.targetSize,
    targetColor: data.targetColor,
    targetPrice: data.targetPrice,
    priceDifference: data.priceDifference,
    reason: data.reason,
    returnTrackingNumber: null,
    returnCarrier: null,
    qualityResult: null,
    qualityNotes: null,
    differenceHandled: false,
    newOrderTrackingNumber: null,
    newOrderCarrier: null,
    status: EXCHANGE_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  exchanges.push(exchange);
  addTimeline(exchange.id, 'create', data.operator || 'system', '创建换货申请');
  
  return exchange;
}

function updateExchange(exchangeId, updates) {
  const exchange = exchanges.find(e => e.id === exchangeId);
  if (!exchange) return null;
  
  Object.assign(exchange, updates);
  exchange.updatedAt = new Date().toISOString();
  
  return exchange;
}

function getExchange(exchangeId) {
  return exchanges.find(e => e.id === exchangeId);
}

function getExchangesByOrder(orderId) {
  return exchanges.filter(e => e.orderId === orderId);
}

function getAllExchanges() {
  return exchanges;
}

function getOrder(orderId) {
  return orders.find(o => o.id === orderId);
}

function getAllOrders() {
  return orders;
}

function getProduct(productId) {
  return products.find(p => p.id === productId);
}

function getAllProducts() {
  return products;
}

function getAllInventory() {
  return inventory;
}

function getTimelines(exchangeId) {
  return exchangeTimelines.filter(t => t.exchangeId === exchangeId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function getInventoryLogs(inventoryId) {
  return inventoryLogs.filter(l => l.inventoryId === inventoryId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function getAllInventoryLogs() {
  return inventoryLogs;
}

module.exports = {
  EXCHANGE_STATUS,
  addTimeline,
  addInventoryLog,
  checkDuplicateExchange,
  checkInventory,
  getInventory,
  updateInventory,
  createExchange,
  updateExchange,
  getExchange,
  getExchangesByOrder,
  getAllExchanges,
  getOrder,
  getAllOrders,
  getProduct,
  getAllProducts,
  getAllInventory,
  getTimelines,
  getInventoryLogs,
  getAllInventoryLogs
};
