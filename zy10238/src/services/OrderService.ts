import { v4 as uuidv4 } from 'uuid';
import { OrderInfo, OrderStatus, FaultTicket, TicketStatus } from '../models';
import ticketService from './TicketService';
import { OperationType } from '../models/OperationHistory';

interface CreateOrderRequest {
  orderCode: string;
  stationId: string;
  pileId: string;
  userId: string;
  startTime?: Date;
  endTime?: Date;
  chargedKwh?: number;
  totalAmount?: number;
  status: OrderStatus;
  failureReason?: string;
}

interface RefundRequest {
  orderCode: string;
  refundAmount: number;
  operatorId?: string;
  operatorName?: string;
  reason?: string;
}

class OrderService {
  async createOrUpdateOrder(request: CreateOrderRequest): Promise<OrderInfo> {
    let order = await OrderInfo.findOne({ where: { orderCode: request.orderCode } });

    if (order) {
      await order.update({
        ...request,
        updatedAt: new Date(),
      });
    } else {
      order = await OrderInfo.create({
        id: uuidv4(),
        ...request,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (request.status === OrderStatus.FAILED && request.failureReason) {
      const ticket = await FaultTicket.findOne({ where: { orderId: request.orderCode } });
      if (ticket) {
        await ticketService.recordHistory({
          ticketId: ticket.id,
          operationType: OperationType.STATUS_CHANGED,
          description: `订单失败: ${request.failureReason}`,
          details: { orderCode: request.orderCode },
        });
      }
    }

    return order;
  }

  async requestRefund(request: RefundRequest): Promise<{ order: OrderInfo; ticket?: FaultTicket }> {
    const order = await OrderInfo.findOne({ where: { orderCode: request.orderCode } });
    if (!order) {
      throw new Error(`订单不存在: ${request.orderCode}`);
    }

    if (order.status === OrderStatus.REFUNDED) {
      throw new Error('该订单已退款');
    }

    await order.update({
      status: OrderStatus.REFUND_PENDING,
      refundRequestedAt: new Date(),
      refundAmount: request.refundAmount,
      updatedAt: new Date(),
    });

    const ticket = await FaultTicket.findOne({ where: { orderId: request.orderCode } });
    if (ticket) {
      await ticketService.recordHistory({
        ticketId: ticket.id,
        operationType: OperationType.REFUND_REQUESTED,
        operatorId: request.operatorId,
        operatorName: request.operatorName,
        description: `申请退款: ${request.refundAmount}元，原因: ${request.reason || '未填写'}`,
        details: { orderCode: request.orderCode, refundAmount: request.refundAmount },
      });
    }

    return { order, ticket: ticket || undefined };
  }

  async approveRefund(orderCode: string, operatorId?: string, operatorName?: string): Promise<{ order: OrderInfo; ticket?: FaultTicket; needsMaintenance: boolean }> {
    const order = await OrderInfo.findOne({ where: { orderCode } });
    if (!order) {
      throw new Error(`订单不存在: ${orderCode}`);
    }

    if (order.status === OrderStatus.REFUNDED) {
      throw new Error('该订单已退款');
    }

    await order.update({
      status: OrderStatus.REFUNDED,
      refundCompletedAt: new Date(),
      updatedAt: new Date(),
    });

    const ticket = await FaultTicket.findOne({ where: { orderId: orderCode } });
    let needsMaintenance = false;
    
    if (ticket) {
      const hasFailedOperations = ticket.remoteRestartAttempts >= ticket.maxRemoteRestarts;
      const isHardwareRelated = ticket.failureReason === 'hardware_failure';
      needsMaintenance = hasFailedOperations || isHardwareRelated;
      
      if (!needsMaintenance) {
        await ticketService.updateStatus({
          ticketId: ticket.id,
          newStatus: TicketStatus.REFUNDED,
          operatorId,
          operatorName,
          description: `退款已完成: ${order.refundAmount}元，客户问题已通过退款解决`,
          details: { orderCode },
        });
      } else {
        await ticketService.recordHistory({
          ticketId: ticket.id,
          operationType: OperationType.REFUND_APPROVED,
          operatorId,
          operatorName,
          description: `退款已完成: ${order.refundAmount}元，但设备故障仍需维修处理`,
          details: { orderCode, needsMaintenance: true },
        });
      }
    }

    return { order, ticket: ticket || undefined, needsMaintenance };
  }

  async rejectRefund(orderCode: string, reason: string, operatorId?: string, operatorName?: string): Promise<{ order: OrderInfo; ticket?: FaultTicket }> {
    const order = await OrderInfo.findOne({ where: { orderCode } });
    if (!order) {
      throw new Error(`订单不存在: ${orderCode}`);
    }

    await order.update({
      status: OrderStatus.REFUND_REJECTED,
      updatedAt: new Date(),
    });

    const ticket = await FaultTicket.findOne({ where: { orderId: orderCode } });
    if (ticket) {
      await ticketService.recordHistory({
        ticketId: ticket.id,
        operationType: OperationType.REFUND_REJECTED,
        operatorId,
        operatorName,
        description: `退款申请被拒绝: ${reason}`,
        details: { orderCode, rejectReason: reason },
      });
    }

    return { order, ticket: ticket || undefined };
  }

  async getOrder(orderCode: string): Promise<OrderInfo | null> {
    return OrderInfo.findOne({ where: { orderCode } });
  }
}

export default new OrderService();
