import dayjs from 'dayjs';
import { OrderStatus, ReviewRecord } from '../types';
import { dataStore } from '../store/dataStore';
import { reconciliationEngine } from './reconciliationEngine';

export class ReviewService {
  updateOrderStatus(
    orderNo: string,
    newStatus: OrderStatus,
    reviewer: string,
    comments: string,
    modifiedFields: string[] = []
  ): ReviewRecord {
    const order = dataStore.getRentalOrderByNo(orderNo);
    if (!order) {
      throw new Error(`订单不存在: ${orderNo}`);
    }

    const previousStatus = order.status;

    if (previousStatus === newStatus) {
      throw new Error(`订单状态已是 ${newStatus}，无需更新`);
    }

    dataStore.updateRentalOrder(order.id, { status: newStatus });

    const reviewRecord: Omit<ReviewRecord, 'id'> = {
      orderNo,
      reviewer,
      reviewDate: dayjs().toISOString(),
      previousStatus,
      newStatus,
      comments,
      modifiedFields,
    };

    const savedRecord = dataStore.addReviewRecord(reviewRecord);
    reconciliationEngine.reconcileOrder(orderNo);

    return savedRecord;
  }

  approveOrder(
    orderNo: string,
    reviewer: string,
    comments: string = '复核通过，同意按当前计算结果结算'
  ): ReviewRecord {
    return this.updateOrderStatus(orderNo, 'approved', reviewer, comments, [
      'status',
    ]);
  }

  rejectOrder(
    orderNo: string,
    reviewer: string,
    comments: string
  ): ReviewRecord {
    if (!comments || comments.trim().length < 5) {
      throw new Error('退回订单必须填写详细原因');
    }
    return this.updateOrderStatus(orderNo, 'rejected', reviewer, comments, [
      'status',
    ]);
  }

  requestMoreInfo(
    orderNo: string,
    reviewer: string,
    comments: string
  ): ReviewRecord {
    if (!comments || comments.trim().length < 5) {
      throw new Error('要求补充材料必须说明需要哪些信息');
    }
    return this.updateOrderStatus(orderNo, 'need_more_info', reviewer, comments, [
      'status',
    ]);
  }

  resetToPending(
    orderNo: string,
    reviewer: string,
    comments: string
  ): ReviewRecord {
    return this.updateOrderStatus(orderNo, 'pending', reviewer, comments, [
      'status',
    ]);
  }

  updateRepairLiability(
    repairId: string,
    liability: 'tenant' | 'owner' | 'natural_wear' | 'pending',
    reviewer: string,
    comments: string
  ): void {
    const repair = dataStore.getRepairRecord(repairId);
    if (!repair) {
      throw new Error(`维修记录不存在: ${repairId}`);
    }

    dataStore.updateRepairRecord(repairId, {
      liability,
      notes: repair.notes
        ? `${repair.notes}\n[${dayjs().format('YYYY-MM-DD')}] ${reviewer}: ${comments}`
        : `[${dayjs().format('YYYY-MM-DD')}] ${reviewer}: ${comments}`,
    });

    if (repair.boundOrderNo) {
      reconciliationEngine.reconcileOrder(repair.boundOrderNo);
    }
  }

  bindRepairToOrder(repairId: string, orderNo: string): void {
    const repair = dataStore.getRepairRecord(repairId);
    const order = dataStore.getRentalOrderByNo(orderNo);

    if (!repair) {
      throw new Error(`维修记录不存在: ${repairId}`);
    }
    if (!order) {
      throw new Error(`订单不存在: ${orderNo}`);
    }
    if (repair.equipmentSerialNo !== order.equipmentSerialNo) {
      throw new Error('维修记录与订单设备序列号不匹配');
    }

    dataStore.updateRepairRecord(repairId, {
      isBoundToOrder: true,
      boundOrderNo: orderNo,
    });

    reconciliationEngine.reconcileOrder(orderNo);
  }

  unbindRepairFromOrder(repairId: string): void {
    const repair = dataStore.getRepairRecord(repairId);
    if (!repair) {
      throw new Error(`维修记录不存在: ${repairId}`);
    }

    const orderNo = repair.boundOrderNo;

    dataStore.updateRepairRecord(repairId, {
      isBoundToOrder: false,
      boundOrderNo: undefined,
    });

    if (orderNo) {
      reconciliationEngine.reconcileOrder(orderNo);
    }
  }

  getOrderReviewHistory(orderNo: string): ReviewRecord[] {
    return dataStore.getReviewRecordsByOrderNo(orderNo);
  }

  getStatusExplanation(status: OrderStatus): string {
    const explanations: Record<OrderStatus, string> = {
      pending: '待复核 - 订单已导入，等待人工审核确认',
      approved: '已通过 - 复核通过，可按计算结果进行结算',
      rejected: '已退回 - 订单存在问题，需重新处理或取消',
      need_more_info: '待补充 - 需要提供更多信息或材料后继续处理',
    };
    return explanations[status] || '未知状态';
  }
}

export const reviewService = new ReviewService();
