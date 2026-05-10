const storage = require('../storage/file');
const { v4: uuidv4 } = require('uuid');

function getOrders() {
  return storage.readJSON(storage.getOrdersPath(), []);
}

function saveOrders(orders) {
  storage.writeJSON(storage.getOrdersPath(), orders);
}

function getOrderById(orderId) {
  const orders = getOrders();
  return orders.find(o => o.orderId === orderId);
}

function getBouquetSpecs() {
  return storage.readJSON(storage.getBouquetSpecsPath(), []);
}

function saveBouquetSpecs(specs) {
  storage.writeJSON(storage.getBouquetSpecsPath(), specs);
}

function getCards() {
  return storage.readJSON(storage.getCardsPath(), []);
}

function saveCards(cards) {
  storage.writeJSON(storage.getCardsPath(), cards);
}

function addHistory(action, details) {
  const history = storage.readJSON(storage.getHistoryPath(), []);
  history.push({
    id: uuidv4(),
    action,
    details,
    timestamp: new Date().toISOString()
  });
  storage.writeJSON(storage.getHistoryPath(), history);
}

function importOrder(orderData) {
  const orders = getOrders();
  const existingOrder = orders.find(o => o.orderId === orderData.orderId);
  
  if (existingOrder) {
    return {
      success: false,
      duplicate: true,
      message: `订单 ${orderData.orderId} 已存在，不会重复导入`,
      existingOrder
    };
  }
  
  const newOrder = {
    ...orderData,
    id: uuidv4(),
    importedAt: new Date().toISOString(),
    status: 'imported',
    validationIssues: [],
    replacements: [],
    confirmed: false
  };
  
  orders.push(newOrder);
  saveOrders(orders);
  addHistory('import', { orderId: orderData.orderId });
  
  return {
    success: true,
    duplicate: false,
    message: `订单 ${orderData.orderId} 导入成功`,
    order: newOrder
  };
}

function updateOrder(orderId, updates) {
  const orders = getOrders();
  const index = orders.findIndex(o => o.orderId === orderId);
  
  if (index === -1) {
    return { success: false, message: `订单 ${orderId} 不存在` };
  }
  
  orders[index] = {
    ...orders[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  saveOrders(orders);
  
  return { success: true, order: orders[index] };
}

module.exports = {
  getOrders,
  getOrderById,
  importOrder,
  updateOrder,
  getBouquetSpecs,
  saveBouquetSpecs,
  getCards,
  saveCards,
  addHistory
};
