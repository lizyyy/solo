import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { Order, OrderStatus, OrderChangeHistory, OrderUrgency, CakeFlavor, CakeSize } from '../types';

export class OrderService {
  private generateOrderNo(): string {
    const date = new Date();
    const prefix = `BK${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const todayOrders = store.getOrders().filter(o => o.orderNo.startsWith(prefix)).length;
    return `${prefix}${String(todayOrders + 1).padStart(4, '0')}`;
  }

  private recordChange(
    orderId: string,
    fieldName: string,
    oldValue: string,
    newValue: string,
    operator: string,
    operationType: OrderChangeHistory['operationType'],
    remark: string = ''
  ): void {
    const history: OrderChangeHistory = {
      id: uuidv4(),
      orderId,
      fieldName,
      oldValue,
      newValue,
      operator,
      operationTime: new Date().toISOString(),
      remark,
      operationType
    };
    store.addChangeHistory(history);
  }

  createOrder(orderData: Partial<Order>, operator: string): Order {
    const now = new Date().toISOString();
    const order: Order = {
      id: uuidv4(),
      orderNo: this.generateOrderNo(),
      customerName: orderData.customerName || '',
      customerPhone: orderData.customerPhone || '',
      deliveryAddress: orderData.deliveryAddress || '',
      deliveryTime: orderData.deliveryTime || '',
      cakeName: orderData.cakeName || '',
      cakeFlavor: orderData.cakeFlavor || CakeFlavor.VANILLA,
      cakeSize: orderData.cakeSize || CakeSize.SIZE_6,
      cakeWeight: orderData.cakeWeight || 0.5,
      layers: orderData.layers || 1,
      specialRequirements: orderData.specialRequirements || '',
      urgency: orderData.urgency || OrderUrgency.NORMAL,
      bakingDuration: orderData.bakingDuration || 45,
      coolingDuration: orderData.coolingDuration || 30,
      status: OrderStatus.DRAFT,
      scheduledOvenId: null,
      scheduledDate: null,
      scheduledTimeSlot: null,
      assignedPastryChef: null,
      createdAt: now,
      updatedAt: now,
      currentHandler: null
    };

    store.addOrder(order);
    this.recordChange(order.id, '订单创建', '', order.orderNo, operator, 'create', '创建订单');

    return order;
  }

  updateOrder(orderId: string, updates: Partial<Order>, operator: string): Order | null {
    const order = store.getOrderById(orderId);
    if (!order) return null;

    const updatedOrder: Order = {
      ...order,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    for (const [key, value] of Object.entries(updates)) {
      const oldValue = String(order[key as keyof Order] || '');
      const newValue = String(value || '');
      if (oldValue !== newValue) {
        this.recordChange(orderId, key, oldValue, newValue, operator, 'update');
      }
    }

    store.updateOrder(orderId, updatedOrder);
    return updatedOrder;
  }

  updateStatus(orderId: string, newStatus: OrderStatus, operator: string, remark: string = ''): Order | null {
    const order = store.getOrderById(orderId);
    if (!order) return null;

    const oldStatus = order.status;
    const updatedOrder: Order = {
      ...order,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    store.updateOrder(orderId, updatedOrder);
    this.recordChange(orderId, 'status', oldStatus, newStatus, operator, 'status_change', remark);

    return updatedOrder;
  }

  addRemark(orderId: string, remark: string, operator: string): boolean {
    const order = store.getOrderById(orderId);
    if (!order) return false;

    this.recordChange(orderId, 'remark', '', remark, operator, 'remark', remark);
    return true;
  }

  setManualProcessing(orderId: string, handler: string, remark: string): Order | null {
    const order = this.updateStatus(orderId, OrderStatus.MANUAL_PROCESSING, handler, remark);
    if (order) {
      return this.updateOrder(orderId, { currentHandler: handler }, handler);
    }
    return null;
  }

  getOrderDetail(orderId: string): Order | null {
    return store.getOrderById(orderId) || null;
  }

  getOrderHistory(orderId: string): OrderChangeHistory[] {
    return store.getChangeHistoriesByOrderId(orderId);
  }

  listOrders(filters?: { status?: OrderStatus; urgency?: OrderUrgency; dateFrom?: string; dateTo?: string }): Order[] {
    let orders = store.getOrders();

    if (filters?.status) {
      orders = orders.filter(o => o.status === filters.status);
    }
    if (filters?.urgency) {
      orders = orders.filter(o => o.urgency === filters.urgency);
    }
    if (filters?.dateFrom) {
      orders = orders.filter(o => o.createdAt >= (filters.dateFrom ?? ''));
    }
    if (filters?.dateTo) {
      orders = orders.filter(o => o.createdAt <= (filters.dateTo ?? ''));
    }

    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const orderService = new OrderService();