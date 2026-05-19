const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(process.cwd(), '.reconcile');
const ORDERS_FILE = path.join(DB_DIR, 'orders.json');
const ACTIONS_FILE = path.join(DB_DIR, 'actions.json');

let ordersCache = null;
let actionsCache = null;

const initData = () => {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(ACTIONS_FILE)) {
    fs.writeFileSync(ACTIONS_FILE, JSON.stringify([], null, 2));
  }
};

const now = () => new Date().toISOString();

const getOrders = () => {
  if (!ordersCache) {
    initData();
    ordersCache = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  }
  return ordersCache;
};

const saveOrders = (orders) => {
  ordersCache = orders;
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
};

const getActions = () => {
  if (!actionsCache) {
    initData();
    actionsCache = JSON.parse(fs.readFileSync(ACTIONS_FILE, 'utf8'));
  }
  return actionsCache;
};

const saveActions = (actions) => {
  actionsCache = actions;
  fs.writeFileSync(ACTIONS_FILE, JSON.stringify(actions, null, 2));
};

const dbOperations = {
  addOrder: async (order) => {
    const orders = getOrders();
    const newId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1;
    const newOrder = {
      id: newId,
      order_no: order.orderNo,
      customer_name: order.customerName,
      phone: order.phone || '',
      product_name: order.productName,
      original_amount: order.originalAmount,
      handler: order.handler || '',
      status: order.status || 'pending',
      exception_type: order.exceptionType || '',
      created_at: order.createdAt || now(),
      updated_at: now()
    };
    orders.push(newOrder);
    saveOrders(orders);
    return { lastID: newId, changes: 1 };
  },

  getOrderByNo: async (orderNo) => {
    const orders = getOrders();
    return orders.find(o => o.order_no === orderNo);
  },

  updateOrderStatus: async (orderNo, status, exceptionType = null) => {
    const orders = getOrders();
    const index = orders.findIndex(o => o.order_no === orderNo);
    if (index !== -1) {
      orders[index].status = status;
      if (exceptionType !== null) {
        orders[index].exception_type = exceptionType;
      }
      orders[index].updated_at = now();
      saveOrders(orders);
      return { changes: 1 };
    }
    return { changes: 0 };
  },

  addAction: async (action) => {
    const actions = getActions();
    const newId = actions.length > 0 ? Math.max(...actions.map(a => a.id)) + 1 : 1;
    const newAction = {
      id: newId,
      order_id: action.orderId,
      action_type: action.actionType,
      amount: action.amount || 0,
      coupon_code: action.couponCode || '',
      exchange_product: action.exchangeProduct || '',
      exchange_amount: action.exchangeAmount || 0,
      notes: action.notes || '',
      created_at: now()
    };
    actions.push(newAction);
    saveActions(actions);
    return { lastID: newId, changes: 1 };
  },

  getOrders: async (filters = {}) => {
    let orders = getOrders();

    if (filters.handler) {
      orders = orders.filter(o => o.handler === filters.handler);
    }
    if (filters.status) {
      orders = orders.filter(o => o.status === filters.status);
    }
    if (filters.exceptionType) {
      orders = orders.filter(o => o.exception_type === filters.exceptionType);
    }
    if (filters.startDate) {
      orders = orders.filter(o => o.created_at >= filters.startDate);
    }
    if (filters.endDate) {
      orders = orders.filter(o => o.created_at <= filters.endDate);
    }

    orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return orders;
  },

  getOrderActions: async (orderId) => {
    const actions = getActions();
    return actions
      .filter(a => a.order_id === orderId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getStatistics: async () => {
    const orders = getOrders();
    const statusMap = {};
    
    orders.forEach(order => {
      if (!statusMap[order.status]) {
        statusMap[order.status] = { count: 0, total_amount: 0 };
      }
      statusMap[order.status].count++;
      statusMap[order.status].total_amount += order.original_amount;
    });

    return Object.entries(statusMap).map(([status, data]) => ({
      status,
      count: data.count,
      total_amount: data.total_amount
    }));
  },

  getAllOrdersWithActions: async () => {
    const orders = getOrders();
    const actions = getActions();
    
    const result = orders.map(order => ({
      ...order,
      actions: actions.filter(a => a.order_id === order.id)
    }));
    
    result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return result;
  },

  clearAll: async () => {
    saveOrders([]);
    saveActions([]);
  }
};

module.exports = { ...dbOperations };
