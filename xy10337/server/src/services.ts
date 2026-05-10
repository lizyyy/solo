import { prepare, exec } from './database';
import { datesOverlap, calculateDays, generateOrderNo } from './utils';
import { Nanny, Customer, Order, Leave, Replacement, Evaluation, OrderDetail, Settlement, HistoryLog } from './types';

function addHistoryLog(orderId: number, eventType: string, eventData: Record<string, unknown>) {
  const stmt = prepare(`
    INSERT INTO history_logs (order_id, event_type, event_data)
    VALUES (?, ?, ?)
  `);
  stmt.run(orderId, eventType, JSON.stringify(eventData));
}

function checkNannyAvailability(nannyId: number, startDate: string, endDate: string, excludeOrderId?: number): boolean {
  let orders: Order[];
  if (excludeOrderId) {
    const stmt = prepare(`
      SELECT * FROM orders 
      WHERE nanny_id = ? AND status != 'cancelled' AND id != ?
    `);
    orders = stmt.all(nannyId, excludeOrderId) as Order[];
  } else {
    const stmt = prepare(`
      SELECT * FROM orders 
      WHERE nanny_id = ? AND status != 'cancelled'
    `);
    orders = stmt.all(nannyId) as Order[];
  }

  for (const order of orders) {
    if (datesOverlap(startDate, endDate, order.startDate, order.endDate)) {
      return false;
    }
  }
  return true;
}

function getAvailableNannies(startDate: string, endDate: string): Nanny[] {
  const allNannies = prepare('SELECT * FROM nannies').all() as Nanny[];
  return allNannies.filter(nanny => checkNannyAvailability(nanny.id, startDate, endDate));
}

function getAllNannies(): Nanny[] {
  return prepare('SELECT * FROM nannies').all() as Nanny[];
}

function getNannyById(id: number): Nanny | undefined {
  return prepare('SELECT * FROM nannies WHERE id = ?').get(id) as Nanny | undefined;
}

function createNanny(data: Partial<Nanny>): Nanny {
  const stmt = prepare(`
    INSERT INTO nannies (name, phone, id_card, level, daily_rate, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.name,
    data.phone,
    data.idCard,
    data.level,
    data.dailyRate || 500,
    'available'
  );
  return getNannyById(result.lastInsertRowid as number)!;
}

function getAllCustomers(): Customer[] {
  return prepare('SELECT * FROM customers').all() as Customer[];
}

function getCustomerById(id: number): Customer | undefined {
  return prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer | undefined;
}

function createCustomer(data: Partial<Customer>): Customer {
  const stmt = prepare(`
    INSERT INTO customers (name, phone, address)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(data.name, data.phone, data.address);
  return getCustomerById(result.lastInsertRowid as number)!;
}

function getAllOrders(): Order[] {
  return prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as Order[];
}

function getOrderById(id: number): Order | undefined {
  return prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;
}

function getOrderByNo(orderNo: string): Order | undefined {
  return prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo) as Order | undefined;
}

function getOrderDetail(orderId: number): OrderDetail | null {
  const order = getOrderById(orderId);
  if (!order) return null;

  const customer = getCustomerById(order.customerId);
  const nanny = getNannyById(order.nannyId);
  const leaves = prepare('SELECT * FROM leaves WHERE order_id = ? ORDER BY created_at DESC').all(orderId) as Leave[];
  const replacements = prepare('SELECT * FROM replacements WHERE order_id = ? ORDER BY created_at DESC').all(orderId) as Replacement[];
  const evaluation = prepare('SELECT * FROM evaluations WHERE order_id = ?').get(orderId) as Evaluation | undefined;
  const historyLogs = prepare('SELECT * FROM history_logs WHERE order_id = ? ORDER BY created_at DESC').all(orderId);

  return {
    order,
    customer: customer!,
    nanny: nanny!,
    leaves,
    replacements,
    evaluation: evaluation || null,
    historyLogs: historyLogs as HistoryLog[]
  };
}

function createOrder(data: {
  customerId: number;
  nannyId: number;
  startDate: string;
  endDate: string;
  deposit: number;
}): Order {
  const nanny = getNannyById(data.nannyId);
  if (!nanny) {
    throw new Error('月嫂不存在');
  }

  if (!checkNannyAvailability(data.nannyId, data.startDate, data.endDate)) {
    throw new Error('该月嫂在指定日期已有安排');
  }

  const totalDays = calculateDays(data.startDate, data.endDate);
  const totalAmount = totalDays * nanny.dailyRate;
  const orderNo = generateOrderNo();

  const stmt = prepare(`
    INSERT INTO orders (order_no, customer_id, nanny_id, start_date, end_date, total_days, total_amount, deposit, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);

  const result = stmt.run(
    orderNo,
    data.customerId,
    data.nannyId,
    data.startDate,
    data.endDate,
    totalDays,
    totalAmount,
    data.deposit
  );

  const order = getOrderById(result.lastInsertRowid as number)!;
  addHistoryLog(order.id, 'order_created', { orderNo, status: 'pending' });

  return order;
}

function updateOrderStatus(orderId: number, status: Order['status']): Order {
  const order = getOrderById(orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
  addHistoryLog(orderId, 'status_changed', { from: order.status, to: status });

  return getOrderById(orderId)!;
}

function createLeave(data: {
  orderId: number;
  nannyId: number;
  startDate: string;
  endDate: string;
  reason: string;
}): Leave {
  const order = getOrderById(data.orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (!datesOverlap(data.startDate, data.endDate, order.startDate, order.endDate)) {
    throw new Error('请假日期必须在服务期内');
  }

  const days = calculateDays(data.startDate, data.endDate);

  const stmt = prepare(`
    INSERT INTO leaves (order_id, nanny_id, start_date, end_date, days, reason, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `);

  const result = stmt.run(
    data.orderId,
    data.nannyId,
    data.startDate,
    data.endDate,
    days,
    data.reason
  );

  const leave = prepare('SELECT * FROM leaves WHERE id = ?').get(result.lastInsertRowid as number) as Leave;
  addHistoryLog(data.orderId, 'leave_created', { leaveId: leave.id, startDate: data.startDate, endDate: data.endDate, days });

  return leave;
}

function approveLeave(leaveId: number): Leave {
  const leave = prepare('SELECT * FROM leaves WHERE id = ?').get(leaveId) as Leave | undefined;
  if (!leave) {
    throw new Error('请假记录不存在');
  }

  prepare('UPDATE leaves SET status = ? WHERE id = ?').run('approved', leaveId);
  addHistoryLog(leave.orderId, 'leave_approved', { leaveId });

  return prepare('SELECT * FROM leaves WHERE id = ?').get(leaveId) as Leave;
}

function createReplacement(data: {
  leaveId: number;
  orderId: number;
  originalNannyId: number;
  replacementNannyId: number;
  startDate: string;
  endDate: string;
}): Replacement {
  if (!checkNannyAvailability(data.replacementNannyId, data.startDate, data.endDate, data.orderId)) {
    throw new Error('替班月嫂在指定日期已有安排');
  }

  const days = calculateDays(data.startDate, data.endDate);

  const stmt = prepare(`
    INSERT INTO replacements (leave_id, order_id, original_nanny_id, replacement_nanny_id, start_date, end_date, days, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `);

  const result = stmt.run(
    data.leaveId,
    data.orderId,
    data.originalNannyId,
    data.replacementNannyId,
    data.startDate,
    data.endDate,
    days
  );

  const replacement = prepare('SELECT * FROM replacements WHERE id = ?').get(result.lastInsertRowid as number) as Replacement;
  addHistoryLog(data.orderId, 'replacement_created', {
    replacementId: replacement.id,
    originalNannyId: data.originalNannyId,
    replacementNannyId: data.replacementNannyId,
    startDate: data.startDate,
    endDate: data.endDate,
    days
  });

  return replacement;
}

function createEvaluation(data: {
  orderId: number;
  nannyId: number;
  rating: number;
  comment: string;
  deductionAmount: number;
  deductionReason: string;
}): Evaluation {
  const order = getOrderById(data.orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  const existing = prepare('SELECT * FROM evaluations WHERE order_id = ?').get(data.orderId);
  if (existing) {
    throw new Error('该订单已有评价');
  }

  const stmt = prepare(`
    INSERT INTO evaluations (order_id, nanny_id, rating, comment, deduction_amount, deduction_reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.orderId,
    data.nannyId,
    data.rating,
    data.comment,
    data.deductionAmount,
    data.deductionReason
  );

  const evaluation = prepare('SELECT * FROM evaluations WHERE id = ?').get(result.lastInsertRowid as number) as Evaluation;
  
  addHistoryLog(data.orderId, 'evaluation_created', {
    rating: data.rating,
    deductionAmount: data.deductionAmount,
    deductionReason: data.deductionReason
  });

  return evaluation;
}

function calculateSettlement(orderId: number): Settlement {
  const detail = getOrderDetail(orderId);
  if (!detail) {
    throw new Error('订单不存在');
  }

  const { order, customer, nanny, replacements, evaluation } = detail;

  const totalReplacementDays = replacements.reduce((sum, r) => sum + r.days, 0);
  const baseDays = order.totalDays - totalReplacementDays;
  
  let replacementAmount = 0;
  for (const r of replacements) {
    const replacementNanny = getNannyById(r.replacementNannyId);
    if (replacementNanny) {
      replacementAmount += r.days * replacementNanny.dailyRate;
    }
  }

  const baseAmount = baseDays * nanny.dailyRate;
  const totalAmount = baseAmount + replacementAmount;
  const deductionAmount = evaluation?.deductionAmount || 0;
  const finalAmount = totalAmount - order.deposit - deductionAmount;

  return {
    orderNo: order.orderNo,
    customerName: customer.name,
    nannyName: nanny.name,
    startDate: order.startDate,
    endDate: order.endDate,
    totalDays: order.totalDays,
    replacementDays: totalReplacementDays,
    totalAmount,
    deposit: order.deposit,
    deductionAmount,
    finalAmount,
    details: {
      baseDays,
      baseAmount,
      replacementAmount
    }
  };
}

function getCalendarData(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const orders = prepare(`
    SELECT * FROM orders 
    WHERE status != 'cancelled' 
    AND start_date < ? 
    AND end_date >= ?
  `).all(endDate, startDate) as Order[];

  const leaves = prepare(`
    SELECT * FROM leaves 
    WHERE status = 'approved'
    AND start_date < ? 
    AND end_date >= ?
  `).all(endDate, startDate) as Leave[];

  const replacements = prepare(`
    SELECT * FROM replacements 
    WHERE status != 'pending'
    AND start_date < ? 
    AND end_date >= ?
  `).all(endDate, startDate) as Replacement[];

  return { orders, leaves, replacements };
}

export {
  getAllNannies,
  getNannyById,
  createNanny,
  getAvailableNannies,
  getAllCustomers,
  getCustomerById,
  createCustomer,
  getAllOrders,
  getOrderById,
  getOrderByNo,
  getOrderDetail,
  createOrder,
  updateOrderStatus,
  createLeave,
  approveLeave,
  createReplacement,
  createEvaluation,
  calculateSettlement,
  getCalendarData,
  checkNannyAvailability
};
