import { createHash } from 'crypto';
import {
  SaleOrder,
  SyncBatch,
  SaleStatus,
  BatchStatus,
  ExceptionType,
  OfflineSyncRequest,
  MemberInfo,
  RefundRecord
} from './types';
import { store } from './store';

function calculateContentHash(order: Omit<SaleOrder, 'contentHash'>): string {
  const content = JSON.stringify({
    items: order.items,
    totalAmount: order.totalAmount,
    payAmount: order.payAmount,
    payments: order.payments,
    member: order.member,
    refund: order.refund
  });
  return createHash('md5').update(content).digest('hex');
}

async function checkInventory(items: SaleOrder['items']): Promise<{ sufficient: boolean; details: Record<string, { requested: number; available: number }> }> {
  const details: Record<string, { requested: number; available: number }> = {};
  let sufficient = true;

  for (const item of items) {
    const inventory = await store.getInventory(item.sku);
    const available = inventory?.quantity || 0;
    details[item.sku] = { requested: item.quantity, available };
    if (available < item.quantity) {
      sufficient = false;
    }
  }

  return { sufficient, details };
}

async function deductInventory(items: SaleOrder['items']): Promise<void> {
  for (const item of items) {
    await store.updateInventory(item.sku, -item.quantity);
  }
}

async function restoreInventory(items: SaleOrder['items']): Promise<void> {
  for (const item of items) {
    await store.updateInventory(item.sku, item.quantity);
  }
}

async function processMemberPoints(member: MemberInfo, orderNo: string): Promise<{ success: boolean; isDuplicate: boolean }> {
  const existingLogs = await store.getMemberPointsLogs(member.memberId, orderNo);
  if (existingLogs.length > 0) {
    return { success: false, isDuplicate: true };
  }

  if (member.pointsEarned > 0) {
    await store.addMemberPointsLog({
      memberId: member.memberId,
      orderNo,
      points: member.pointsEarned,
      type: 'earn'
    });
  }

  if (member.pointsUsed > 0) {
    await store.addMemberPointsLog({
      memberId: member.memberId,
      orderNo,
      points: member.pointsUsed,
      type: 'spend'
    });
  }

  return { success: true, isDuplicate: false };
}

async function checkRefundTiming(refund: RefundRecord, saleTime: string): Promise<{ valid: boolean; refundBeforeSale: boolean }> {
  const refundDate = new Date(refund.refundTime);
  const saleDate = new Date(saleTime);
  const refundBeforeSale = refundDate < saleDate;
  return { valid: !refundBeforeSale, refundBeforeSale };
}

export async function processOfflineSync(request: OfflineSyncRequest): Promise<{
  batch: SyncBatch;
  results: Array<{ orderNo: string; success: boolean; code: string; message: string }>;
}> {
  const now = new Date().toISOString();
  
  const batch: SyncBatch = {
    batchId: request.batchId,
    terminalNo: request.terminalNo,
    startTime: request.startTime,
    endTime: request.endTime,
    totalCount: request.orders.length,
    successCount: 0,
    failedCount: 0,
    status: BatchStatus.SYNCING,
    createdAt: now
  };
  
  await store.saveSyncBatch(batch);

  const results: Array<{ orderNo: string; success: boolean; code: string; message: string }> = [];

  for (const orderData of request.orders) {
    const result = await processSingleOrder(orderData, request.batchId);
    results.push(result);
    
    if (result.success) {
      batch.successCount++;
    } else {
      batch.failedCount++;
    }
  }

  if (batch.successCount === batch.totalCount) {
    batch.status = BatchStatus.COMPLETED;
  } else if (batch.failedCount === batch.totalCount) {
    batch.status = BatchStatus.HAS_ERRORS;
  } else {
    batch.status = BatchStatus.PARTIAL;
  }
  batch.completedAt = new Date().toISOString();
  
  await store.saveSyncBatch(batch);

  return { batch, results };
}

async function processSingleOrder(
  orderData: OfflineSyncRequest['orders'][0],
  batchId: string
): Promise<{ orderNo: string; success: boolean; code: string; message: string }> {
  const orderNo = orderData.orderNo;
  const now = new Date().toISOString();

  const tempOrder: Omit<SaleOrder, 'contentHash'> = {
    ...orderData,
    batchId,
    syncTime: now,
    status: SaleStatus.PENDING,
    createdAt: now,
    updatedAt: now,
    retryCount: 0
  };
  const contentHash = calculateContentHash(tempOrder);

  const existingOrder = await store.getSaleOrder(orderNo);

  if (existingOrder) {
    if (existingOrder.contentHash === contentHash) {
      if (existingOrder.status === SaleStatus.SUCCESS) {
        return { orderNo, success: true, code: 'DUPLICATE_SUCCESS', message: '订单已存在且处理成功，幂等返回' };
      } else if (existingOrder.status === SaleStatus.PROCESSING) {
        return { orderNo, success: false, code: 'PROCESSING', message: '订单正在处理中，请稍后重试' };
      } else {
        existingOrder.retryCount++;
        existingOrder.updatedAt = now;
        existingOrder.status = SaleStatus.PENDING;
        await store.saveSaleOrder(existingOrder);
      }
    } else {
      await store.addExceptionOrder({
        orderNo,
        batchId,
        type: ExceptionType.DUPLICATE_DIFF_CONTENT,
        message: '流水号重复但内容不同',
        detail: {
          existingHash: existingOrder.contentHash,
          newHash: contentHash,
          existingContent: { items: existingOrder.items, total: existingOrder.totalAmount },
          newContent: { items: orderData.items, total: orderData.totalAmount }
        }
      });
      return { orderNo, success: false, code: 'CONTENT_MISMATCH', message: '流水号重复但内容不同，已记录异常' };
    }
  }

  const saleOrder: SaleOrder = {
    ...tempOrder,
    contentHash,
    status: SaleStatus.PROCESSING
  };

  if (!existingOrder) {
    await store.saveSaleOrder(saleOrder);
  }

  const inventoryCheck = await checkInventory(orderData.items);
  if (!inventoryCheck.sufficient) {
    saleOrder.status = SaleStatus.FAILED;
    saleOrder.errorMessage = '库存不足';
    saleOrder.updatedAt = now;
    await store.saveSaleOrder(saleOrder);
    
    await store.addExceptionOrder({
      orderNo,
      batchId,
      type: ExceptionType.INVENTORY_SHORTAGE,
      message: '库存不足',
      detail: inventoryCheck.details
    });
    
    return { orderNo, success: false, code: 'INVENTORY_SHORTAGE', message: '库存不足' };
  }

  if (orderData.refund) {
    const refundCheck = await checkRefundTiming(orderData.refund, orderData.saleTime);
    if (!refundCheck.valid) {
      saleOrder.status = SaleStatus.FAILED;
      saleOrder.errorMessage = '退款时间早于销售时间';
      saleOrder.updatedAt = now;
      await store.saveSaleOrder(saleOrder);
      
      await store.addExceptionOrder({
        orderNo,
        batchId,
        type: ExceptionType.REFUND_BEFORE_SALE,
        message: '退款时间早于销售时间',
        detail: { refundTime: orderData.refund.refundTime, saleTime: orderData.saleTime }
      });
      
      return { orderNo, success: false, code: 'REFUND_BEFORE_SALE', message: '退款时间早于销售时间' };
    }
  }

  if (orderData.member) {
    const pointsResult = await processMemberPoints(orderData.member, orderNo);
    if (pointsResult.isDuplicate) {
      await store.addExceptionOrder({
        orderNo,
        batchId,
        type: ExceptionType.POINTS_DUPLICATE,
        message: '会员积分重复发放',
        detail: { memberId: orderData.member.memberId }
      });
    }
  }

  try {
    await deductInventory(orderData.items);
    saleOrder.status = SaleStatus.SUCCESS;
    saleOrder.updatedAt = now;
    await store.saveSaleOrder(saleOrder);
    
    return { orderNo, success: true, code: 'SUCCESS', message: '处理成功' };
  } catch (error: any) {
    saleOrder.status = SaleStatus.FAILED;
    saleOrder.errorMessage = error.message;
    saleOrder.updatedAt = now;
    await store.saveSaleOrder(saleOrder);
    
    return { orderNo, success: false, code: 'PROCESS_ERROR', message: error.message };
  }
}

export async function cancelOrder(orderNo: string, reason: string): Promise<{ success: boolean; message: string }> {
  const order = await store.getSaleOrder(orderNo);
  if (!order) {
    return { success: false, message: '订单不存在' };
  }

  if (order.status === SaleStatus.CANCELLED || order.status === SaleStatus.REVERSED) {
    return { success: true, message: '订单已撤销' };
  }

  if (order.status === SaleStatus.SUCCESS) {
    await restoreInventory(order.items);
  }

  order.status = SaleStatus.CANCELLED;
  order.updatedAt = new Date().toISOString();
  order.errorMessage = reason;
  await store.saveSaleOrder(order);

  return { success: true, message: '订单撤销成功' };
}

export async function getBatchList(): Promise<SyncBatch[]> {
  return store.getAllSyncBatches();
}

export async function getBatchDetail(batchId: string): Promise<{ batch: SyncBatch | undefined; orders: SaleOrder[] }> {
  const batch = await store.getSyncBatch(batchId);
  const orders = await store.getSaleOrdersByBatch(batchId);
  return { batch, orders };
}

export async function getInventoryList(): Promise<any[]> {
  return store.getAllInventory();
}

export async function getExceptionList(batchId?: string): Promise<any[]> {
  if (batchId) {
    return store.getExceptionOrders(undefined, batchId);
  }
  return store.getAllExceptionOrders();
}

export async function getOrderDetail(orderNo: string): Promise<SaleOrder | undefined> {
  return store.getSaleOrder(orderNo);
}
