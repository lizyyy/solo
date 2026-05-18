const { v4: uuidv4 } = require('uuid');

class MemoryStore {
  constructor() {
    this.orders = new Map();
    this.verifications = new Map();
    this.histories = new Map();
    this.initSampleData();
  }

  initSampleData() {
    const now = new Date().toISOString();
    
    const order1 = {
      id: 'ORD-202405001',
      orderNo: 'CAKE-20240518-001',
      customerName: '张三',
      customerPhone: '13800138001',
      cakeName: '草莓奶油生日蛋糕',
      cakeSpec: '8寸，动物奶油，少糖',
      pickupTime: '2024-05-19T10:00:00.000Z',
      actualPickupTime: null,
      price: 298,
      deposit: 100,
      balance: 198,
      status: 'pending',
      proxyPicker: null,
      proxyIdCard: null,
      proxyPhone: null,
      verificationCode: '123456',
      storeLocation: '北京朝阳店',
      remarks: '需要生日蜡烛和刀叉',
      createdAt: now,
      updatedAt: now
    };

    const order2 = {
      id: 'ORD-202405002',
      orderNo: 'CAKE-20240518-002',
      customerName: '李四',
      customerPhone: '13800138002',
      cakeName: '芒果慕斯蛋糕',
      cakeSpec: '6寸，木糖醇',
      pickupTime: '2024-05-18T15:00:00.000Z',
      actualPickupTime: '2024-05-18T14:55:00.000Z',
      price: 198,
      deposit: 100,
      balance: 98,
      status: 'completed',
      proxyPicker: '王五',
      proxyIdCard: '110101199001011234',
      proxyPhone: '13800138003',
      verificationCode: '654321',
      storeLocation: '北京朝阳店',
      remarks: '糖尿病患者食用，务必无糖',
      createdAt: now,
      updatedAt: now
    };

    const order3 = {
      id: 'ORD-202405003',
      orderNo: 'CAKE-20240518-003',
      customerName: '赵六',
      customerPhone: '13800138004',
      cakeName: '巧克力熔岩蛋糕',
      cakeSpec: '10寸，双层夹心',
      pickupTime: '2024-05-20T12:00:00.000Z',
      actualPickupTime: null,
      price: 458,
      deposit: 200,
      balance: 258,
      status: 'manual_review',
      proxyPicker: '孙七',
      proxyIdCard: '110101199002025678',
      proxyPhone: '13800138005',
      verificationCode: '789012',
      storeLocation: '北京海淀店',
      remarks: '公司团建用，需要配套餐具20套',
      createdAt: now,
      updatedAt: now
    };

    this.orders.set(order1.id, order1);
    this.orders.set(order2.id, order2);
    this.orders.set(order3.id, order3);

    const verification1 = {
      id: uuidv4(),
      orderId: 'ORD-202405002',
      orderNo: 'CAKE-20240518-002',
      operator: '店员A',
      operatorId: 'OP001',
      verificationType: 'proxy',
      proxyPicker: '王五',
      proxyIdCard: '110101199001011234',
      proxyPhone: '13800138003',
      verificationCode: '654321',
      status: 'success',
      errorCode: null,
      errorMessage: null,
      balancePaid: 98,
      paymentMethod: 'wechat',
      createdAt: '2024-05-18T14:55:00.000Z'
    };

    this.verifications.set(verification1.id, verification1);

    const history1 = {
      id: uuidv4(),
      orderId: 'ORD-202405002',
      field: 'status',
      oldValue: 'pending',
      newValue: 'completed',
      operator: '店员A',
      operatorId: 'OP001',
      remarks: '订单已完成取货',
      createdAt: '2024-05-18T14:55:00.000Z'
    };

    const history2 = {
      id: uuidv4(),
      orderId: 'ORD-202405003',
      field: 'status',
      oldValue: 'pending',
      newValue: 'manual_review',
      operator: '系统',
      operatorId: 'SYSTEM',
      remarks: '代取人身份证验证不通过，进入人工审核',
      createdAt: now
    };

    this.histories.set(history1.id, history1);
    this.histories.set(history2.id, history2);
  }

  getOrders(filters = {}) {
    let result = Array.from(this.orders.values());
    
    if (filters.status) {
      result = result.filter(o => o.status === filters.status);
    }
    if (filters.storeLocation) {
      result = result.filter(o => o.storeLocation === filters.storeLocation);
    }
    
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getOrderById(id) {
    return this.orders.get(id);
  }

  getOrderByOrderNo(orderNo) {
    return Array.from(this.orders.values()).find(o => o.orderNo === orderNo);
  }

  updateOrder(id, updates, operator) {
    const order = this.orders.get(id);
    if (!order) return null;

    const now = new Date().toISOString();
    const oldOrder = { ...order };

    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'orderNo' && key !== 'createdAt') {
        if (order[key] !== updates[key]) {
          this.addHistory(id, key, order[key], updates[key], operator, updates.remarks || `更新${key}`);
          order[key] = updates[key];
        }
      }
    });

    order.updatedAt = now;
    return order;
  }

  getVerifications(filters = {}) {
    let result = Array.from(this.verifications.values());
    
    if (filters.orderId) {
      result = result.filter(v => v.orderId === filters.orderId);
    }
    if (filters.status) {
      result = result.filter(v => v.status === filters.status);
    }
    
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  createVerification(data) {
    const verification = {
      id: uuidv4(),
      ...data,
      createdAt: new Date().toISOString()
    };
    this.verifications.set(verification.id, verification);
    return verification;
  }

  getHistories(orderId) {
    return Array.from(this.histories.values())
      .filter(h => h.orderId === orderId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  addHistory(orderId, field, oldValue, newValue, operator, remarks) {
    const history = {
      id: uuidv4(),
      orderId,
      field,
      oldValue,
      newValue,
      operator: operator || '系统',
      operatorId: operator || 'SYSTEM',
      remarks,
      createdAt: new Date().toISOString()
    };
    this.histories.set(history.id, history);
    return history;
  }
}

module.exports = new MemoryStore();
