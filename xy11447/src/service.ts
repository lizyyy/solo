import { v4 as uuidv4 } from 'uuid';
import {
  WorkOrder,
  WorkOrderStatus,
  StatusHistory,
  CreateWorkOrderRequest,
  UpdateStatusRequest,
  QueryParams,
  DirtyRecord,
  DirtyRecordType,
  RetryCategory,
  SourceData,
  AreaManagerDashboard,
  DeadLetterStats,
  DataSource,
} from './types';
import { store } from './store';

class CompensationQueueService {
  private createStatusHistory(
    workOrderId: string,
    status: WorkOrderStatus,
    operator: string,
    reason: string
  ): StatusHistory {
    return {
      id: uuidv4(),
      workOrderId,
      status,
      timestamp: new Date(),
      operator,
      reason,
    };
  }

  createWorkOrder(request: CreateWorkOrderRequest): WorkOrder {
    const id = uuidv4();
    const orderNo = store.generateOrderNo();
    const now = new Date();

    const statusHistory = this.createStatusHistory(
      id,
      'pending',
      request.operator,
      '工单创建'
    );

    const workOrder: WorkOrder = {
      id,
      orderNo,
      source: request.source,
      sourceId: request.sourceId,
      sourceData: request.sourceData,
      rawContent: JSON.stringify(request.sourceData),
      status: 'pending',
      retryCount: 0,
      maxRetries: request.maxRetries ?? 3,
      createdAt: now,
      updatedAt: now,
      statusHistory: [statusHistory],
    };

    this.calculateFaultDuration(workOrder);
    this.detectDirtyRecords(workOrder);
    store.saveWorkOrder(workOrder);

    return workOrder;
  }

  private calculateFaultDuration(workOrder: WorkOrder): void {
    const { alarmTime, recoverTime } = workOrder.sourceData;
    if (alarmTime && recoverTime) {
      const duration = Math.floor(
        (new Date(recoverTime).getTime() - new Date(alarmTime).getTime()) / 60000
      );
      workOrder.faultDurationMinutes = Math.max(0, duration);
    }
  }

  private detectDirtyRecords(workOrder: WorkOrder): void {
    const data = workOrder.sourceData;
    const requiredFields = ['pileId', 'storeId'];
    const missingFields = requiredFields.filter(f => !(f in data));

    if (missingFields.length > 0) {
      this.createDirtyRecord(
        workOrder.id,
        'missing_fields',
        'required_fields',
        missingFields.join(','),
        '',
        '缺少必填字段'
      );
    }

    if (data.alarmTime && data.recoverTime) {
      const alarmDate = new Date(data.alarmTime).toDateString();
      const recoverDate = new Date(data.recoverTime).toDateString();
      if (alarmDate !== recoverDate) {
        this.createDirtyRecord(
          workOrder.id,
          'cross_day',
          'alarm_recover_date',
          alarmDate,
          recoverDate,
          '告警和恢复跨日'
        );
      }
    }

    if (data.amount !== undefined && data.quantity !== undefined) {
      if (data.amount < 0 || data.quantity < 0) {
        this.createDirtyRecord(
          workOrder.id,
          'amount_conflict',
          'negative_value',
          '>=0',
          `amount:${data.amount}, quantity:${data.quantity}`,
          '金额或数量为负数'
        );
      }
    }
  }

  private createDirtyRecord(
    workOrderId: string,
    type: DirtyRecordType,
    fieldName: string,
    expectedValue: string,
    actualValue: string,
    opinion: string
  ): void {
    const workOrder = store.getWorkOrder(workOrderId);
    if (!workOrder) return;

    const record: DirtyRecord = {
      id: uuidv4(),
      workOrderId,
      type,
      fieldName,
      expectedValue,
      actualValue,
      rawContent: workOrder.rawContent,
      processingOpinion: opinion,
      isResolved: false,
      createdAt: new Date(),
    };

    store.saveDirtyRecord(record);
  }

  updateWorkOrderStatus(
    id: string,
    request: UpdateStatusRequest
  ): WorkOrder | null {
    const workOrder = store.getWorkOrder(id);
    if (!workOrder) return null;

    const statusHistory = this.createStatusHistory(
      id,
      request.status,
      request.operator,
      request.reason
    );

    workOrder.status = request.status;
    workOrder.updatedAt = new Date();
    workOrder.statusHistory.push(statusHistory);

    if (request.retryCategory) {
      workOrder.retryCategory = request.retryCategory;
    }

    if (request.compensationAmount !== undefined) {
      workOrder.compensationAmount = request.compensationAmount;
    }

    if (request.status === 'closed') {
      workOrder.closedAt = new Date();
    }

    store.saveWorkOrder(workOrder);
    return workOrder;
  }

  enqueueWorkOrder(id: string, operator: string): WorkOrder | null {
    return this.updateWorkOrderStatus(id, {
      status: 'queued',
      operator,
      reason: '加入重试队列',
    });
  }

  processWorkOrder(id: string, operator: string): WorkOrder | null {
    return this.updateWorkOrderStatus(id, {
      status: 'processing',
      operator,
      reason: '开始处理',
    });
  }

  retryWorkOrder(
    id: string,
    operator: string,
    retryCategory: RetryCategory
  ): WorkOrder | null {
    const workOrder = store.getWorkOrder(id);
    if (!workOrder) return null;

    if (workOrder.retryCount >= workOrder.maxRetries) {
      return this.updateWorkOrderStatus(id, {
        status: 'dead_letter',
        operator,
        reason: '达到最大重试次数，移入死信队列',
        retryCategory,
      });
    }

    workOrder.retryCount++;
    store.saveWorkOrder(workOrder);

    return this.updateWorkOrderStatus(id, {
      status: 'retrying',
      operator,
      reason: `第 ${workOrder.retryCount} 次重试`,
      retryCategory,
    });
  }

  manualTakeover(id: string, operator: string, reason: string): WorkOrder | null {
    return this.updateWorkOrderStatus(id, {
      status: 'manual_takeover',
      operator,
      reason: `人工接管: ${reason}`,
    });
  }

  compensateWorkOrder(
    id: string,
    operator: string,
    amount: number
  ): WorkOrder | null {
    return this.updateWorkOrderStatus(id, {
      status: 'compensated',
      operator,
      reason: '补偿入账',
      compensationAmount: amount,
    });
  }

  closeWorkOrder(id: string, operator: string, reason: string): WorkOrder | null {
    return this.updateWorkOrderStatus(id, {
      status: 'closed',
      operator,
      reason: `工单关闭: ${reason}`,
    });
  }

  resolveDirtyRecord(
    recordId: string,
    operator: string,
    opinion: string
  ): DirtyRecord | null {
    const record = store.getDirtyRecord(recordId);
    if (!record) return null;

    record.isResolved = true;
    record.resolvedAt = new Date();
    record.resolvedBy = operator;
    record.processingOpinion = opinion;

    store.saveDirtyRecord(record);
    return record;
  }

  reprocessAfterDirtyRecordResolved(workOrderId: string): WorkOrder | null {
    const workOrder = store.getWorkOrder(workOrderId);
    if (!workOrder) return null;

    const dirtyRecords = store.getDirtyRecordsByWorkOrderId(workOrderId);
    const allResolved = dirtyRecords.every(r => r.isResolved);

    if (allResolved && dirtyRecords.length > 0) {
      this.calculateFaultDuration(workOrder);
      store.saveWorkOrder(workOrder);
    }

    return workOrder;
  }

  getWorkOrder(id: string): WorkOrder | undefined {
    return store.getWorkOrder(id);
  }

  getWorkOrderByOrderNo(orderNo: string): WorkOrder | undefined {
    return store.getWorkOrderByOrderNo(orderNo);
  }

  queryWorkOrders(params: QueryParams): {
    data: WorkOrder[];
    total: number;
    page: number;
    pageSize: number;
  } {
    let orders = store.getAllWorkOrders();

    if (params.status) {
      orders = orders.filter(o => o.status === params.status);
    }

    if (params.source) {
      orders = orders.filter(o => o.source === params.source);
    }

    if (params.retryCategory) {
      orders = orders.filter(o => o.retryCategory === params.retryCategory);
    }

    if (params.startDate) {
      const start = new Date(params.startDate);
      orders = orders.filter(o => o.createdAt >= start);
    }

    if (params.endDate) {
      const end = new Date(params.endDate);
      orders = orders.filter(o => o.createdAt <= end);
    }

    orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = orders.length;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const data = orders.slice(start, start + pageSize);

    return { data, total, page, pageSize };
  }

  getDirtyRecords(workOrderId?: string): DirtyRecord[] {
    if (workOrderId) {
      return store.getDirtyRecordsByWorkOrderId(workOrderId);
    }
    return store.getAllDirtyRecords();
  }

  getAreaManagerDashboard(): AreaManagerDashboard {
    const orders = store.getAllWorkOrders();
    const retryableCategories: Record<RetryCategory, number> = {
      network_issue: 0,
      system_error: 0,
      data_inconsistency: 0,
      pending_confirmation: 0,
      other: 0,
    };

    const deadLetterByCategory: Record<RetryCategory, number> = {
      network_issue: 0,
      system_error: 0,
      data_inconsistency: 0,
      pending_confirmation: 0,
      other: 0,
    };

    const deadLetterBySource: Record<DataSource, number> = {
      pile_alarm: 0,
      inspection: 0,
      customer_complaint: 0,
      store_handover: 0,
    };

    let recoveryFollowUps = 0;
    let pendingManualTakeover = 0;
    let deadLetterTotal = 0;

    orders.forEach(order => {
      if (order.retryCategory && ['queued', 'retrying', 'processing'].includes(order.status)) {
        retryableCategories[order.retryCategory]++;
      }

      if (order.status === 'dead_letter') {
        deadLetterTotal++;
        if (order.retryCategory) {
          deadLetterByCategory[order.retryCategory]++;
        }
        deadLetterBySource[order.source]++;
      }

      if (order.status === 'retrying' && order.sourceData.recoverTime) {
        recoveryFollowUps++;
      }

      if (order.status === 'manual_takeover') {
        pendingManualTakeover++;
      }
    });

    return {
      retryableByCategory: retryableCategories,
      deadLetterStats: {
        total: deadLetterTotal,
        byCategory: deadLetterByCategory,
        bySource: deadLetterBySource,
      },
      recoveryFollowUps,
      pendingManualTakeover,
    };
  }

  exportWorkOrders(params: { status?: WorkOrderStatus; source?: DataSource }): WorkOrder[] {
    return this.queryWorkOrders({ ...params, pageSize: 10000 }).data;
  }

  getStatusHistory(workOrderId: string): StatusHistory[] {
    const order = store.getWorkOrder(workOrderId);
    return order?.statusHistory ?? [];
  }
}

export const queueService = new CompensationQueueService();
