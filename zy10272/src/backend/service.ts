import { v4 as uuidv4 } from 'uuid';
import {
  Order,
  OrderStatus,
  CreateOrderRequest,
  UpdateOrderRequest,
  PRICE_CONFIG,
  PaperType,
  PrintSide
} from '../types';
import {
  getNextOrderNumber,
  getOrders,
  getOrderById,
  addOrder,
  updateOrder,
  getActiveOrders,
  getQueueOrders
} from './storage';

function calculatePrice(
  paperType: PaperType,
  printSide: PrintSide,
  pageCount: number,
  copies: number
): { pricePerPage: number; totalPages: number; totalAmount: number } {
  const pricePerPage = PRICE_CONFIG[paperType][printSide];
  const totalPages = pageCount * copies;
  const totalAmount = totalPages * pricePerPage;
  return { pricePerPage, totalPages, totalAmount };
}

function calculateBalance(totalAmount: number, prepaidAmount: number): number {
  return Math.round((prepaidAmount - totalAmount) * 100) / 100;
}

function determineStatus(totalAmount: number, prepaidAmount: number): OrderStatus {
  const balance = calculateBalance(totalAmount, prepaidAmount);
  if (balance >= 0) {
    return OrderStatus.PAID;
  } else {
    return OrderStatus.NEEDS_TOPUP;
  }
}

export function createOrder(request: CreateOrderRequest): Order {
  if (!request.customerName?.trim()) {
    throw new Error('客户姓名不能为空');
  }
  if (request.pageCount < 1) {
    throw new Error('页数必须大于0');
  }
  if (request.copies < 1) {
    throw new Error('份数必须大于0');
  }
  if (request.prepaidAmount < 0) {
    throw new Error('预付金额不能为负数');
  }

  const { pricePerPage, totalPages, totalAmount } = calculatePrice(
    request.paperType,
    request.printSide,
    request.pageCount,
    request.copies
  );

  const balance = calculateBalance(totalAmount, request.prepaidAmount);
  const status = determineStatus(totalAmount, request.prepaidAmount);

  const now = new Date();
  const order: Order = {
    id: uuidv4(),
    orderNumber: getNextOrderNumber(),
    customerName: request.customerName.trim(),
    paperType: request.paperType,
    printSide: request.printSide,
    pageCount: request.pageCount,
    copies: request.copies,
    totalPages,
    pricePerPage,
    totalAmount,
    prepaidAmount: request.prepaidAmount,
    balance,
    status,
    createdAt: now,
    updatedAt: now
  };

  addOrder(order);
  return order;
}

export function updateOrderInfo(id: string, request: UpdateOrderRequest): Order {
  const order = getOrderById(id);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.REFUNDED) {
    throw new Error('已完成或已退款的订单不能修改');
  }

  const paperType = request.paperType || order.paperType;
  const printSide = request.printSide || order.printSide;
  const pageCount = request.pageCount !== undefined ? request.pageCount : order.pageCount;
  const copies = request.copies !== undefined ? request.copies : order.copies;
  const prepaidAmount = request.prepaidAmount !== undefined ? request.prepaidAmount : order.prepaidAmount;

  if (pageCount < 1) {
    throw new Error('页数必须大于0');
  }
  if (copies < 1) {
    throw new Error('份数必须大于0');
  }
  if (prepaidAmount < 0) {
    throw new Error('预付金额不能为负数');
  }

  const { pricePerPage, totalPages, totalAmount } = calculatePrice(
    paperType,
    printSide,
    pageCount,
    copies
  );

  const balance = calculateBalance(totalAmount, prepaidAmount);
  
  let status: OrderStatus = order.status;
  if (status !== OrderStatus.CALLED) {
    status = determineStatus(totalAmount, prepaidAmount);
  }

  const updatedOrder: Order = {
    ...order,
    paperType,
    printSide,
    pageCount,
    copies,
    totalPages,
    pricePerPage,
    totalAmount,
    prepaidAmount,
    balance,
    status,
    updatedAt: new Date()
  };

  updateOrder(updatedOrder);
  return updatedOrder;
}

export function callOrder(id: string): Order {
  const order = getOrderById(id);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.REFUNDED) {
    throw new Error('订单已完成或已退款，不能叫号');
  }

  if (order.status === OrderStatus.CALLED) {
    throw new Error('该订单已叫号');
  }

  const updatedOrder: Order = {
    ...order,
    status: OrderStatus.CALLED,
    calledAt: new Date(),
    updatedAt: new Date()
  };

  updateOrder(updatedOrder);
  return updatedOrder;
}

export function callNextOrder(): Order | null {
  const queue = getQueueOrders();
  if (queue.length === 0) {
    return null;
  }

  const nextOrder = queue[0];
  return callOrder(nextOrder.id);
}

export function topupOrder(id: string, amount: number): Order {
  const order = getOrderById(id);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.REFUNDED) {
    throw new Error('订单已完成或已退款');
  }

  if (amount <= 0) {
    throw new Error('补差金额必须大于0');
  }

  const newPrepaidAmount = Math.round((order.prepaidAmount + amount) * 100) / 100;
  const newBalance = calculateBalance(order.totalAmount, newPrepaidAmount);

  let status = order.status;
  if (newBalance >= 0 && status === OrderStatus.NEEDS_TOPUP) {
    status = OrderStatus.PAID;
  }

  const updatedOrder: Order = {
    ...order,
    prepaidAmount: newPrepaidAmount,
    balance: newBalance,
    status,
    updatedAt: new Date()
  };

  updateOrder(updatedOrder);
  return updatedOrder;
}

export function refundOrder(id: string): Order {
  const order = getOrderById(id);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.status === OrderStatus.REFUNDED) {
    throw new Error('该订单已退款');
  }

  if (order.status === OrderStatus.COMPLETED) {
    throw new Error('已完成订单不能退款');
  }

  const updatedOrder: Order = {
    ...order,
    status: OrderStatus.REFUNDED,
    updatedAt: new Date()
  };

  updateOrder(updatedOrder);
  return updatedOrder;
}

export function completeOrder(id: string): Order {
  const order = getOrderById(id);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.status === OrderStatus.COMPLETED) {
    throw new Error('该订单已完成');
  }

  if (order.status === OrderStatus.REFUNDED) {
    throw new Error('已退款订单不能完成');
  }

  if (order.balance < 0) {
    throw new Error('请先完成补差后再确认完成');
  }

  const updatedOrder: Order = {
    ...order,
    status: OrderStatus.COMPLETED,
    completedAt: new Date(),
    updatedAt: new Date()
  };

  updateOrder(updatedOrder);
  return updatedOrder;
}

export function getAllOrders(): Order[] {
  return getOrders();
}

export function getOrder(id: string): Order | undefined {
  return getOrderById(id);
}

export function getActiveOrdersList(): Order[] {
  return getActiveOrders();
}

export function getQueueOrdersList(): Order[] {
  return getQueueOrders();
}
