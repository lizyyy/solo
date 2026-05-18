import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { Order, OrderStatus, OrderUrgency, ScheduleResult, CapacityRecord, OrderChangeHistory } from '../types';

const TIME_SLOTS = [
  '08:00-10:00',
  '10:00-12:00',
  '14:00-16:00',
  '16:00-18:00',
  '18:00-20:00'
];

export class SchedulingService {
  calculateRequiredCapacity(order: Order): number {
    const sizeCapacityMap: Record<string, number> = {
      '6寸': 1,
      '8寸': 1.5,
      '10寸': 2,
      '12寸': 3,
      '14寸': 4
    };
    return sizeCapacityMap[order.cakeSize] || 1;
  }

  checkTimeSlotConflict(
    ovenId: string,
    date: string,
    timeSlot: string,
    excludeOrderId?: string
  ): { conflict: boolean; orders: Order[] } {
    const scheduledOrders = store.getOrdersBySchedule(ovenId, date, timeSlot)
      .filter(o => !excludeOrderId || o.id !== excludeOrderId);

    return {
      conflict: scheduledOrders.length > 0,
      orders: scheduledOrders
    };
  }

  checkCapacityConsistency(
    ovenId: string,
    date: string,
    timeSlot: string,
    requiredCapacity: number
  ): { consistent: boolean; usedCapacity: number; totalCapacity: number } {
    const oven = store.getOvenById(ovenId);
    if (!oven) {
      return { consistent: false, usedCapacity: 0, totalCapacity: 0 };
    }

    const capacityRecord = store.getCapacityRecord(ovenId, date, timeSlot);
    const usedCapacity = capacityRecord?.usedCapacity || 0;
    const available = oven.capacity - usedCapacity;

    return {
      consistent: available >= requiredCapacity,
      usedCapacity,
      totalCapacity: oven.capacity
    };
  }

  findAvailableSlot(order: Order): { ovenId: string; date: string; timeSlot: string } | null {
    const requiredCapacity = this.calculateRequiredCapacity(order);
    const ovens = store.getOvens().filter(o => o.status === 'active');
    
    const today = new Date();
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().split('T')[0];

      for (const oven of ovens) {
        for (const timeSlot of TIME_SLOTS) {
          const conflict = this.checkTimeSlotConflict(oven.id, dateStr, timeSlot);
          const capacity = this.checkCapacityConsistency(oven.id, dateStr, timeSlot, requiredCapacity);
          
          if (!conflict.conflict && capacity.consistent) {
            return { ovenId: oven.id, date: dateStr, timeSlot };
          }
        }
      }
    }
    return null;
  }

  scheduleUrgentOrder(orderId: string): ScheduleResult {
    const order = store.getOrderById(orderId);
    if (!order) {
      return { success: false, message: '订单不存在' };
    }

    if (order.urgency === OrderUrgency.NORMAL) {
      return { success: false, message: '非急单不能使用急单排产功能' };
    }

    const requiredCapacity = this.calculateRequiredCapacity(order);
    const availableSlot = this.findAvailableSlot(order);

    if (!availableSlot) {
      return this.tryDisplaceNormalOrder(order, requiredCapacity);
    }

    return this.executeScheduling(order, availableSlot.ovenId, availableSlot.date, availableSlot.timeSlot);
  }

  private tryDisplaceNormalOrder(urgentOrder: Order, requiredCapacity: number): ScheduleResult {
    const ovens = store.getOvens().filter(o => o.status === 'active');
    const today = new Date();

    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().split('T')[0];

      for (const oven of ovens) {
        for (const timeSlot of TIME_SLOTS) {
          const scheduledOrders = store.getOrdersBySchedule(oven.id, dateStr, timeSlot);
          const normalOrders = scheduledOrders.filter(o => o.urgency === OrderUrgency.NORMAL);

          if (normalOrders.length > 0) {
            const orderToDisplace = normalOrders[0];
            const newSlot = this.findAvailableSlot(orderToDisplace);

            if (newSlot) {
              this.recallOrder(orderToDisplace.id, '系统：被急单挤占，重新排产');
              
              const result = this.executeScheduling(urgentOrder, oven.id, dateStr, timeSlot);
              if (result.success) {
                return {
                  ...result,
                  message: `急单排产成功，已将普通单 ${orderToDisplace.orderNo} 移至新时段`,
                  conflictOrders: [orderToDisplace.id]
                };
              }
            } else {
              return {
                success: false,
                message: `找到可挤占时段，但普通单 ${orderToDisplace.orderNo} 无法重新安排`,
                conflictOrders: [orderToDisplace.id]
              };
            }
          }
        }
      }
    }

    return { success: false, message: '无可用时段，也无可挤占的普通单' };
  }

  private executeScheduling(
    order: Order,
    ovenId: string,
    date: string,
    timeSlot: string
  ): ScheduleResult {
    const requiredCapacity = this.calculateRequiredCapacity(order);
    const capacityCheck = this.checkCapacityConsistency(ovenId, date, timeSlot, requiredCapacity);

    if (!capacityCheck.consistent) {
      return {
        success: false,
        message: `产能不足，已用${capacityCheck.usedCapacity}，需要${requiredCapacity}，总容量${capacityCheck.totalCapacity}`
      };
    }

    const updatedOrder: Order = {
      ...order,
      scheduledOvenId: ovenId,
      scheduledDate: date,
      scheduledTimeSlot: timeSlot,
      status: OrderStatus.SCHEDULED,
      updatedAt: new Date().toISOString()
    };

    store.updateOrder(order.id, updatedOrder);
    this.updateCapacityRecord(ovenId, date, timeSlot, requiredCapacity, order.id);

    return {
      success: true,
      message: '排产成功',
      scheduledOrder: updatedOrder
    };
  }

  private updateCapacityRecord(
    ovenId: string,
    date: string,
    timeSlot: string,
    capacityChange: number,
    orderId: string
  ): void {
    let record = store.getCapacityRecord(ovenId, date, timeSlot);
    
    if (!record) {
      const oven = store.getOvenById(ovenId);
      record = {
        id: uuidv4(),
        ovenId,
        date,
        timeSlot,
        usedCapacity: 0,
        totalCapacity: oven?.capacity || 0,
        orderIds: []
      };
      store.addCapacityRecord(record);
    }

    record.usedCapacity += capacityChange;
    if (!record.orderIds.includes(orderId)) {
      record.orderIds.push(orderId);
    }
    store.updateCapacityRecord(record.id, record);
  }

  recallOrder(orderId: string, remark: string, operator: string = 'system'): boolean {
    const order = store.getOrderById(orderId);
    if (!order || !order.scheduledOvenId || !order.scheduledDate || !order.scheduledTimeSlot) {
      return false;
    }

    const requiredCapacity = this.calculateRequiredCapacity(order);
    
    let record = store.getCapacityRecord(order.scheduledOvenId, order.scheduledDate, order.scheduledTimeSlot);
    if (record) {
      record.usedCapacity = Math.max(0, record.usedCapacity - requiredCapacity);
      record.orderIds = record.orderIds.filter(id => id !== orderId);
      store.updateCapacityRecord(record.id, record);
    }

    const updatedOrder: Order = {
      ...order,
      status: OrderStatus.RECALLED,
      scheduledOvenId: null,
      scheduledDate: null,
      scheduledTimeSlot: null,
      updatedAt: new Date().toISOString()
    };
    store.updateOrder(orderId, updatedOrder);

    const history: OrderChangeHistory = {
      id: uuidv4(),
      orderId,
      fieldName: 'status',
      oldValue: OrderStatus.SCHEDULED,
      newValue: OrderStatus.RECALLED,
      operator,
      operationTime: new Date().toISOString(),
      remark,
      operationType: 'recall'
    };
    store.addChangeHistory(history);

    return true;
  }

  resubmitOrder(orderId: string): ScheduleResult {
    const order = store.getOrderById(orderId);
    if (!order) {
      return { success: false, message: '订单不存在' };
    }

    if (order.status !== OrderStatus.RECALLED && order.status !== OrderStatus.MANUAL_PROCESSING) {
      return { success: false, message: '只有已撤回或人工处理中的订单才能重新提交' };
    }

    const updatedOrder: Order = {
      ...order,
      status: OrderStatus.PENDING_SCHEDULE,
      updatedAt: new Date().toISOString()
    };
    store.updateOrder(orderId, updatedOrder);

    if (order.urgency !== OrderUrgency.NORMAL) {
      return this.scheduleUrgentOrder(orderId);
    }

    const slot = this.findAvailableSlot(order);
    if (slot) {
      return this.executeScheduling(updatedOrder, slot.ovenId, slot.date, slot.timeSlot);
    }

    return { success: true, message: '重新提交成功，待排产', scheduledOrder: store.getOrderById(orderId) };
  }

  verifyCapacityConsistency(ovenId: string, date: string): { valid: boolean; details: string[] } {
    const details: string[] = [];
    let valid = true;

    const oven = store.getOvenById(ovenId);
    if (!oven) {
      return { valid: false, details: ['烤箱不存在'] };
    }

    for (const timeSlot of TIME_SLOTS) {
      const scheduledOrders = store.getOrdersBySchedule(ovenId, date, timeSlot);
      const totalRequired = scheduledOrders.reduce((sum, o) => sum + this.calculateRequiredCapacity(o), 0);
      const capacityRecord = store.getCapacityRecord(ovenId, date, timeSlot);

      if (totalRequired !== (capacityRecord?.usedCapacity || 0)) {
        valid = false;
        details.push(`${date} ${timeSlot} 产能不一致：订单实际需要${totalRequired}，记录表显示${capacityRecord?.usedCapacity || 0}`);
      }

      if (totalRequired > oven.capacity) {
        valid = false;
        details.push(`${date} ${timeSlot} 产能超载：总需要${totalRequired}，烤箱容量${oven.capacity}`);
      }
    }

    return { valid, details };
  }
}

export const schedulingService = new SchedulingService();