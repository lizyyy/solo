const { v4: uuidv4 } = require('uuid');

const store = {
  customers: [],
  doctors: [],
  services: [],
  customerPackages: [],
  appointments: [],
  transactions: [],
  giftedTransactions: []
};

const now = () => new Date().toISOString();

const initStore = () => {
  store.services = [
    { id: 'svc_skin_001', name: '深层清洁护理', category: '皮肤管理', unit_price: 380, duration_minutes: 60, description: '深层清洁毛孔，去除老化角质' },
    { id: 'svc_skin_002', name: '水光针护理', category: '皮肤管理', unit_price: 1280, duration_minutes: 45, description: '玻尿酸补水，提亮肤色' },
    { id: 'svc_skin_003', name: '黄金微针', category: '皮肤管理', unit_price: 2580, duration_minutes: 90, description: '刺激胶原蛋白再生' },
    { id: 'svc_hair_001', name: '唇部脱毛', category: '脱毛', unit_price: 298, duration_minutes: 30, description: '激光脱毛，唇部' },
    { id: 'svc_hair_002', name: '腋下脱毛', category: '脱毛', unit_price: 398, duration_minutes: 30, description: '激光脱毛，腋下' },
    { id: 'svc_hair_003', name: '全身脱毛', category: '脱毛', unit_price: 1980, duration_minutes: 120, description: '激光脱毛，全身' },
    { id: 'svc_laser_001', name: '光子嫩肤', category: '光电项目', unit_price: 880, duration_minutes: 45, description: '改善肤色不均' },
    { id: 'svc_laser_002', name: '点阵激光', category: '光电项目', unit_price: 1880, duration_minutes: 60, description: '改善痘坑痘印' },
    { id: 'svc_laser_003', name: '皮秒祛斑', category: '光电项目', unit_price: 3280, duration_minutes: 50, description: '去除各类色斑' },
  ];
  
  store.doctors = [
    { id: 'doc_001', name: '张医生', specialization: '皮肤科', status: 'active' },
    { id: 'doc_002', name: '李医生', specialization: '光电科', status: 'active' },
    { id: 'doc_003', name: '王医生', specialization: '综合美容', status: 'active' },
  ];
  
  store.customers = [
    { id: 'cust_001', name: '王美丽', phone: '13800138001', created_at: now(), updated_at: now() },
    { id: 'cust_002', name: '李小花', phone: '13800138002', created_at: now(), updated_at: now() },
    { id: 'cust_003', name: '张婷婷', phone: '13800138003', created_at: now(), updated_at: now() },
  ];
};

initStore();

const TRANSACTION_TYPES = {
  PURCHASE: 'purchase',
  GIFT: 'gift',
  CONSUME: 'consume',
  REFUND: 'refund',
  APPOINTMENT: 'appointment'
};

const getCustomerPackage = (customerId, serviceId) => {
  return store.customerPackages
    .filter(p => p.customer_id === customerId && p.service_id === serviceId && p.status === 'active')
    .sort((a, b) => new Date(b.purchased_at) - new Date(a.purchased_at))[0];
};

const createCustomerPackage = (customerId, serviceId, packageName, count, amount) => {
  const id = uuidv4();
  store.customerPackages.push({
    id,
    customer_id: customerId,
    service_id: serviceId,
    package_name: packageName,
    purchased_count: count,
    gifted_count: 0,
    used_count: 0,
    gifted_used_count: 0,
    refunded_count: 0,
    total_amount: amount,
    status: 'active',
    purchased_at: now()
  });
  return id;
};

const createTransaction = (data) => {
  const id = uuidv4();
  store.transactions.push({
    id,
    customer_id: data.customerId,
    customer_package_id: data.customerPackageId || null,
    appointment_id: data.appointmentId || null,
    doctor_id: data.doctorId || null,
    service_id: data.serviceId,
    transaction_type: data.transactionType,
    count: data.count || 0,
    gifted_count: data.giftedCount || 0,
    amount: data.amount || 0,
    status: data.status || 'completed',
    reason: data.reason || null,
    related_transaction_id: data.relatedTransactionId || null,
    created_at: now()
  });
  return id;
};

const getAvailableCount = (customerPackageId) => {
  const pkg = store.customerPackages.find(p => p.id === customerPackageId);
  if (!pkg) return { purchased: 0, gifted: 0, total: 0 };
  
  const remainingPurchased = pkg.purchased_count - pkg.used_count - pkg.refunded_count;
  const remainingGifted = pkg.gifted_count - pkg.gifted_used_count;
  
  return {
    purchased: Math.max(0, remainingPurchased),
    gifted: Math.max(0, remainingGifted),
    total: Math.max(0, remainingPurchased + remainingGifted),
    package: pkg
  };
};

const purchasePackage = (customerId, serviceId, packageName, count, unitPrice) => {
  const existingPackage = getCustomerPackage(customerId, serviceId);
  const totalAmount = count * unitPrice;
  
  let customerPackageId;
  if (existingPackage) {
    existingPackage.purchased_count += count;
    existingPackage.total_amount += totalAmount;
    customerPackageId = existingPackage.id;
  } else {
    customerPackageId = createCustomerPackage(customerId, serviceId, packageName, count, totalAmount);
  }
  
  createTransaction({
    customerId,
    customerPackageId,
    serviceId,
    transactionType: TRANSACTION_TYPES.PURCHASE,
    count,
    amount: totalAmount
  });
  
  const available = getAvailableCount(customerPackageId);
  return {
    success: true,
    customerPackageId,
    remainingPurchased: available.purchased,
    remainingGifted: available.gifted,
    totalRemaining: available.total,
    totalAmount
  };
};

const giftSessions = (customerId, serviceId, count, reason) => {
  const existingPackage = getCustomerPackage(customerId, serviceId);
  if (!existingPackage) {
    throw new Error('客户未购买此项目的疗程包，无法赠送');
  }
  
  existingPackage.gifted_count += count;
  
  store.giftedTransactions.push({
    id: uuidv4(),
    customer_id: customerId,
    customer_package_id: existingPackage.id,
    gifted_count: count,
    reason: reason || '赠送次数',
    created_at: now()
  });
  
  createTransaction({
    customerId,
    customerPackageId: existingPackage.id,
    serviceId,
    transactionType: TRANSACTION_TYPES.GIFT,
    giftedCount: count,
    reason: reason || '赠送次数'
  });
  
  const available = getAvailableCount(existingPackage.id);
  return {
    success: true,
    customerPackageId: existingPackage.id,
    giftedAdded: count,
    remainingPurchased: available.purchased,
    remainingGifted: available.gifted,
    totalRemaining: available.total
  };
};

const createAppointment = (customerId, serviceId, doctorId, scheduledAt, notes) => {
  const pkg = getCustomerPackage(customerId, serviceId);
  if (!pkg) {
    throw new Error('客户未购买此项目的疗程包');
  }
  
  const available = getAvailableCount(pkg.id);
  if (available.total < 1) {
    throw new Error('剩余次数不足，无法预约');
  }
  
  const appointmentId = uuidv4();
  store.appointments.push({
    id: appointmentId,
    customer_id: customerId,
    customer_package_id: pkg.id,
    doctor_id: doctorId,
    service_id: serviceId,
    scheduled_at: scheduledAt,
    status: 'scheduled',
    confirmed_by_doctor: 0,
    consumed_count: 0,
    created_at: now()
  });
  
  return {
    success: true,
    appointmentId,
    status: 'scheduled',
    message: '预约成功，需医生确认后方可扣次'
  };
};

const checkDuplicateConsumption = (customerId, serviceId, appointmentId, scheduledDate) => {
  const scheduledDateStr = scheduledDate ? new Date(scheduledDate).toISOString().split('T')[0] : null;
  
  const existing = store.transactions.find(t => {
    const sameDay = scheduledDateStr ? new Date(t.created_at).toISOString().split('T')[0] === scheduledDateStr : false;
    return t.transaction_type === 'consume' &&
      t.status === 'completed' &&
      t.customer_id === customerId &&
      t.service_id === serviceId &&
      ((t.appointment_id === appointmentId && t.appointment_id) || sameDay);
  });
  
  return existing !== undefined;
};

const confirmConsumption = (appointmentId, doctorId) => {
  const appointment = store.appointments.find(a => a.id === appointmentId);
  if (!appointment) {
    throw new Error('预约不存在');
  }
  
  if (appointment.confirmed_by_doctor === 1 && appointment.consumed_count > 0) {
    throw new Error('该预约已完成扣次，不能重复操作');
  }
  
  if (!appointment.confirmed_by_doctor) {
    appointment.confirmed_by_doctor = 1;
    appointment.status = 'confirmed';
  }
  
  const available = getAvailableCount(appointment.customer_package_id);
  if (available.total < 1) {
    throw new Error('剩余次数不足，无法完成扣次');
  }
  
  const isDuplicate = checkDuplicateConsumption(
    appointment.customer_id,
    appointment.service_id,
    appointmentId,
    appointment.scheduled_at
  );
  
  if (isDuplicate) {
    throw new Error('疑似重复扣次：该服务今日已完成消耗或该预约已扣过次');
  }
  
  let giftedUsed = 0;
  let purchasedUsed = 0;
  
  if (available.gifted > 0) {
    giftedUsed = 1;
  } else {
    purchasedUsed = 1;
  }
  
  const pkg = available.package;
  pkg.used_count += purchasedUsed;
  pkg.gifted_used_count += giftedUsed;
  
  appointment.consumed_count += 1;
  appointment.status = 'completed';
  
  const transactionId = createTransaction({
    customerId: appointment.customer_id,
    customerPackageId: appointment.customer_package_id,
    appointmentId: appointment.id,
    doctorId: doctorId || appointment.doctor_id,
    serviceId: appointment.service_id,
    transactionType: TRANSACTION_TYPES.CONSUME,
    count: purchasedUsed,
    giftedCount: giftedUsed,
    reason: giftedUsed > 0 ? '扣减赠送次数' : '扣减购买次数'
  });
  
  const newAvailable = getAvailableCount(appointment.customer_package_id);
  return {
    success: true,
    transactionId,
    usedGifted: giftedUsed > 0,
    remainingPurchased: newAvailable.purchased,
    remainingGifted: newAvailable.gifted,
    totalRemaining: newAvailable.total,
    message: giftedUsed > 0 
      ? '已优先扣减赠送次数1次' 
      : '已扣减购买次数1次'
  };
};

const processRefund = (customerId, serviceId, refundCount, reason) => {
  const pkg = getCustomerPackage(customerId, serviceId);
  if (!pkg) {
    throw new Error('客户未购买此项目的疗程包');
  }
  
  const availablePurchased = pkg.purchased_count - pkg.used_count - pkg.refunded_count;
  if (refundCount > availablePurchased) {
    throw new Error(`可退款次数不足，当前可退款购买次数: ${availablePurchased}`);
  }
  
  pkg.refunded_count += refundCount;
  
  const unitPrice = pkg.total_amount / pkg.purchased_count;
  const refundAmount = refundCount * unitPrice;
  
  createTransaction({
    customerId,
    customerPackageId: pkg.id,
    serviceId,
    transactionType: TRANSACTION_TYPES.REFUND,
    count: refundCount,
    amount: -refundAmount,
    reason: reason || '客户退款'
  });
  
  const newAvailable = getAvailableCount(pkg.id);
  return {
    success: true,
    refundedCount: refundCount,
    refundAmount,
    remainingPurchased: newAvailable.purchased,
    remainingGifted: newAvailable.gifted,
    totalRemaining: newAvailable.total,
    usedCount: pkg.used_count,
    giftedUsedCount: pkg.gifted_used_count
  };
};

const getCustomerRemaining = (customerId) => {
  return store.customerPackages
    .filter(p => p.customer_id === customerId && p.status === 'active')
    .map(pkg => {
      const svc = store.services.find(s => s.id === pkg.service_id);
      const remainingPurchased = pkg.purchased_count - pkg.used_count - pkg.refunded_count;
      const remainingGifted = pkg.gifted_count - pkg.gifted_used_count;
      return {
        packageId: pkg.id,
        packageName: pkg.package_name,
        serviceId: pkg.service_id,
        serviceName: svc ? svc.name : '',
        category: svc ? svc.category : '',
        unitPrice: svc ? svc.unit_price : 0,
        totalPurchased: pkg.purchased_count,
        totalGifted: pkg.gifted_count,
        usedPurchased: pkg.used_count,
        usedGifted: pkg.gifted_used_count,
        refunded: pkg.refunded_count,
        remainingPurchased: Math.max(0, remainingPurchased),
        remainingGifted: Math.max(0, remainingGifted),
        totalRemaining: Math.max(0, remainingPurchased + remainingGifted),
        totalSpent: pkg.total_amount
      };
    });
};

const toTimestamp = (dateStr) => {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

const getDoctorPerformance = (doctorId, startDate, endDate) => {
  const startTime = toTimestamp(startDate);
  const endTime = toTimestamp(endDate);
  
  const transactions = store.transactions
    .filter(t => 
      t.doctor_id === doctorId && 
      t.status === 'completed' &&
      toTimestamp(t.created_at) >= startTime &&
      toTimestamp(t.created_at) <= endTime
    )
    .map(t => {
      const c = store.customers.find(x => x.id === t.customer_id);
      const s = store.services.find(x => x.id === t.service_id);
      return {
        ...t,
        customer_name: c ? c.name : '',
        service_name: s ? s.name : '',
        category: s ? s.category : ''
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const consumeCount = transactions
    .filter(t => t.transaction_type === 'consume')
    .reduce((sum, t) => sum + t.count + t.gifted_count, 0);
  
  const services = {};
  transactions
    .filter(t => t.transaction_type === 'consume')
    .forEach(t => {
      const key = t.service_id;
      if (!services[key]) {
        services[key] = {
          serviceId: t.service_id,
          serviceName: t.service_name,
          category: t.category,
          count: 0
        };
      }
      services[key].count += t.count + t.gifted_count;
    });
  
  return {
    doctorId,
    period: { startDate, endDate },
    totalExecutions: consumeCount,
    serviceBreakdown: Object.values(services),
    transactions
  };
};

const getRefundImpact = (customerId, startDate, endDate) => {
  const startTime = toTimestamp(startDate);
  const endTime = toTimestamp(endDate);
  
  const refunds = store.transactions
    .filter(t => {
      const tTime = toTimestamp(t.created_at);
      let match = t.transaction_type === 'refund' && 
        t.status === 'completed' &&
        tTime >= startTime &&
        tTime <= endTime;
      if (customerId) match = match && t.customer_id === customerId;
      return match;
    })
    .map(t => {
      const s = store.services.find(x => x.id === t.service_id);
      return {
        ...t,
        service_name: s ? s.name : '',
        category: s ? s.category : ''
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const totalRefundCount = refunds.reduce((sum, r) => sum + r.count, 0);
  const totalRefundAmount = refunds.reduce((sum, r) => sum + Math.abs(r.amount), 0);
  
  const byCategory = {};
  refunds.forEach(r => {
    const key = r.category;
    if (!byCategory[key]) {
      byCategory[key] = { category: key, count: 0, amount: 0 };
    }
    byCategory[key].count += r.count;
    byCategory[key].amount += Math.abs(r.amount);
  });
  
  return {
    period: { startDate, endDate },
    totalRefundCount,
    totalRefundAmount,
    byCategory: Object.values(byCategory),
    refunds
  };
};

const getAbnormalTransactions = (startDate, endDate) => {
  const startTime = toTimestamp(startDate);
  const endTime = toTimestamp(endDate);
  
  return store.transactions
    .filter(t => {
      const tTime = toTimestamp(t.created_at);
      return tTime >= startTime && tTime <= endTime &&
        ((t.transaction_type === 'consume' && t.gifted_count > 0 && t.count === 0) || t.transaction_type === 'refund');
    })
    .map(t => {
      const c = store.customers.find(x => x.id === t.customer_id);
      const s = store.services.find(x => x.id === t.service_id);
      return {
        ...t,
        customer_name: c ? c.name : '',
        service_name: s ? s.name : '',
        category: s ? s.category : '',
        anomaly_type: t.transaction_type === 'refund' 
          ? '退款交易' 
          : (t.gifted_count > 0 && t.count === 0 ? '全部使用赠送次数' : '常规交易')
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

const getTransactionHistory = (customerId, transactionType, startDate, endDate, limit = 100) => {
  const startTime = toTimestamp(startDate);
  const endTime = toTimestamp(endDate);
  
  return store.transactions
    .filter(t => {
      const tTime = toTimestamp(t.created_at);
      let match = tTime >= startTime && tTime <= endTime;
      if (customerId) match = match && t.customer_id === customerId;
      if (transactionType) match = match && t.transaction_type === transactionType;
      return match;
    })
    .map(t => {
      const c = store.customers.find(x => x.id === t.customer_id);
      const s = store.services.find(x => x.id === t.service_id);
      const d = store.doctors.find(x => x.id === t.doctor_id);
      return {
        ...t,
        customer_name: c ? c.name : '',
        customer_phone: c ? c.phone : '',
        service_name: s ? s.name : '',
        service_category: s ? s.category : '',
        doctor_name: d ? d.name : ''
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
};

const listServices = (category) => {
  if (category) {
    return store.services.filter(s => s.category === category);
  }
  return store.services;
};

const listDoctors = () => {
  return store.doctors.filter(d => d.status === 'active');
};

const listCustomers = () => {
  return store.customers;
};

const resetStore = () => {
  store.customerPackages = [];
  store.appointments = [];
  store.transactions = [];
  store.giftedTransactions = [];
  return { success: true, message: '数据已重置' };
};

module.exports = {
  TRANSACTION_TYPES,
  purchasePackage,
  giftSessions,
  createAppointment,
  confirmConsumption,
  processRefund,
  getCustomerRemaining,
  getDoctorPerformance,
  getRefundImpact,
  getAbnormalTransactions,
  getTransactionHistory,
  listServices,
  listDoctors,
  listCustomers,
  resetStore
};
