import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../database';
import {
  InspectionOrder,
  InspectionItem,
  InspectionHistory,
  CreateOrderRequest,
  UpdateOrderRequest,
  SubmitOrderRequest,
  WithdrawOrderRequest,
  ManualProcessRequest,
  AddRemarkRequest,
  InspectionStatus,
  OperationType,
  DailyReport
} from '../types';
import { calculateItemLoss, calculateOrderSummary } from './calculationService';

function generateOrderNo(date: string): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INS-${date.replace(/-/g, '')}-${timestamp}${random}`;
}

function formatDate(date: Date): string {
  return date.toISOString();
}

async function addHistory(
  orderId: string,
  operationType: OperationType,
  operatorId: string | undefined,
  operatorName: string | undefined,
  beforeStatus: InspectionStatus | undefined,
  afterStatus: InspectionStatus | undefined,
  changeContent: string,
  remark: string | undefined
): Promise<void> {
  const historyId = uuidv4();
  await runAsync(
    `INSERT INTO inspection_history (
      id, order_id, operation_type, operator_id, operator_name,
      before_status, after_status, change_content, remark, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      historyId,
      orderId,
      operationType,
      operatorId,
      operatorName,
      beforeStatus,
      afterStatus,
      changeContent,
      remark,
      formatDate(new Date())
    ]
  );
}

function rowToOrder(row: any): InspectionOrder {
  return {
    id: row.id,
    orderNo: row.order_no,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    deliveryDate: row.delivery_date,
    vehicleNo: row.vehicle_no,
    driverName: row.driver_name,
    driverPhone: row.driver_phone,
    totalQuantity: row.total_quantity,
    totalWeight: row.total_weight,
    totalLossWeight: row.total_loss_weight,
    totalLossRate: row.total_loss_rate,
    status: row.status,
    inspectorId: row.inspector_id,
    inspectorName: row.inspector_name,
    remark: row.remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    manualProcessedAt: row.manual_processed_at
  };
}

function rowToItem(row: any): InspectionItem {
  return {
    id: row.id,
    orderId: row.order_id,
    seafoodType: row.seafood_type,
    seafoodName: row.seafood_name,
    seafoodSpec: row.seafood_spec,
    isLive: row.is_live,
    expectedQuantity: row.expected_quantity,
    expectedWeight: row.expected_weight,
    actualQuantity: row.actual_quantity,
    actualWeight: row.actual_weight,
    lossWeight: row.loss_weight,
    lossRate: row.loss_rate,
    temperature: row.temperature,
    salinity: row.salinity,
    phValue: row.ph_value,
    qualityLevel: row.quality_level,
    abnormalDescription: row.abnormal_description,
    imageUrls: row.image_urls,
    remark: row.remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToHistory(row: any): InspectionHistory {
  return {
    id: row.id,
    orderId: row.order_id,
    operationType: row.operation_type,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    beforeStatus: row.before_status,
    afterStatus: row.after_status,
    changeContent: row.change_content,
    remark: row.remark,
    createdAt: row.created_at
  };
}

export async function createOrder(request: CreateOrderRequest): Promise<InspectionOrder> {
  const orderId = uuidv4();
  const orderNo = generateOrderNo(request.deliveryDate);
  const now = formatDate(new Date());

  const itemsWithLoss = request.items.map(item => ({
    ...item,
    ...calculateItemLoss(item)
  }));

  const summary = calculateOrderSummary(itemsWithLoss);

  await runAsync(
    `INSERT INTO inspection_orders (
      id, order_no, supplier_id, supplier_name, delivery_date, vehicle_no,
      driver_name, driver_phone, total_quantity, total_weight, total_loss_weight,
      total_loss_rate, status, remark, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      orderNo,
      request.supplierId,
      request.supplierName,
      request.deliveryDate,
      request.vehicleNo,
      request.driverName,
      request.driverPhone,
      summary.totalQuantity,
      summary.totalWeight,
      summary.totalLossWeight,
      summary.totalLossRate,
      'draft',
      '',
      now,
      now
    ]
  );

  for (const item of itemsWithLoss) {
    const itemId = uuidv4();
    await runAsync(
      `INSERT INTO inspection_items (
        id, order_id, seafood_type, seafood_name, seafood_spec, is_live,
        expected_quantity, expected_weight, actual_quantity, actual_weight,
        loss_weight, loss_rate, temperature, salinity, ph_value, quality_level,
        abnormal_description, image_urls, remark, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        orderId,
        item.seafoodType,
        item.seafoodName,
        item.seafoodSpec,
        item.isLive,
        item.expectedQuantity,
        item.expectedWeight,
        item.actualQuantity,
        item.actualWeight,
        item.lossWeight,
        item.lossRate,
        item.temperature,
        item.salinity,
        item.phValue,
        item.qualityLevel,
        item.abnormalDescription,
        item.imageUrls,
        item.remark,
        now,
        now
      ]
    );
  }

  await addHistory(
    orderId,
    'create',
    request.operatorId,
    request.operatorName,
    undefined,
    'draft',
    `创建验收单，共${request.items.length}条明细`,
    undefined
  );

  const order = await getOrderById(orderId);
  if (!order) throw new Error('创建验收单失败');
  return order;
}

export async function getOrderById(orderId: string): Promise<InspectionOrder | undefined> {
  const row = await getAsync('SELECT * FROM inspection_orders WHERE id = ?', [orderId]);
  return row ? rowToOrder(row) : undefined;
}

export async function getOrderWithItems(orderId: string): Promise<{ order: InspectionOrder; items: InspectionItem[] } | undefined> {
  const order = await getOrderById(orderId);
  if (!order) return undefined;

  const itemRows = await allAsync('SELECT * FROM inspection_items WHERE order_id = ?', [orderId]);
  const items = itemRows.map(rowToItem);

  return { order, items };
}

export async function getOrderList(page: number = 1, pageSize: number = 20, status?: InspectionStatus, startDate?: string, endDate?: string): Promise<{ orders: InspectionOrder[]; total: number }> {
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (status) {
    whereClause += ' AND status = ?';
    params.push(status);
  }
  if (startDate) {
    whereClause += ' AND delivery_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    whereClause += ' AND delivery_date <= ?';
    params.push(endDate);
  }

  const countRow = await getAsync(`SELECT COUNT(*) as count FROM inspection_orders ${whereClause}`, params);
  const total = countRow?.count || 0;

  const offset = (page - 1) * pageSize;
  const rows = await allAsync(
    `SELECT * FROM inspection_orders ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const orders = rows.map(rowToOrder);
  return { orders, total };
}

export async function getOrderHistory(orderId: string): Promise<InspectionHistory[]> {
  const rows = await allAsync('SELECT * FROM inspection_history WHERE order_id = ? ORDER BY created_at DESC', [orderId]);
  return rows.map(rowToHistory);
}

export async function updateOrder(orderId: string, request: UpdateOrderRequest): Promise<InspectionOrder> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('验收单不存在');
  if (order.status !== 'draft' && order.status !== 'withdrawn') throw new Error('只有草稿或已撤回状态的验收单才能修改');

  const now = formatDate(new Date());
  const changes: string[] = [];

  if (request.supplierId && request.supplierId !== order.supplierId) {
    changes.push(`供应商ID: ${order.supplierId} -> ${request.supplierId}`);
  }
  if (request.supplierName && request.supplierName !== order.supplierName) {
    changes.push(`供应商名称: ${order.supplierName} -> ${request.supplierName}`);
  }
  if (request.deliveryDate && request.deliveryDate !== order.deliveryDate) {
    changes.push(`送货日期: ${order.deliveryDate} -> ${request.deliveryDate}`);
  }
  if (request.vehicleNo !== undefined) {
    changes.push(`车牌号: ${order.vehicleNo || ''} -> ${request.vehicleNo || ''}`);
  }
  if (request.driverName !== undefined) {
    changes.push(`司机姓名: ${order.driverName || ''} -> ${request.driverName || ''}`);
  }
  if (request.driverPhone !== undefined) {
    changes.push(`司机电话: ${order.driverPhone || ''} -> ${request.driverPhone || ''}`);
  }
  if (request.remark !== undefined) {
    changes.push(`备注更新`);
  }

  let orderSummary = {
    totalQuantity: order.totalQuantity,
    totalWeight: order.totalWeight,
    totalLossWeight: order.totalLossWeight,
    totalLossRate: order.totalLossRate
  };
  if (request.items && request.items.length > 0) {
    const itemsWithLoss = request.items.map(item => ({
      ...item,
      ...calculateItemLoss(item)
    }));
    orderSummary = calculateOrderSummary(itemsWithLoss);
    changes.push(`更新明细，共${request.items.length}条`);

    await runAsync('DELETE FROM inspection_items WHERE order_id = ?', [orderId]);
    for (const item of itemsWithLoss) {
      const itemId = uuidv4();
      await runAsync(
        `INSERT INTO inspection_items (
          id, order_id, seafood_type, seafood_name, seafood_spec, is_live,
          expected_quantity, expected_weight, actual_quantity, actual_weight,
          loss_weight, loss_rate, temperature, salinity, ph_value, quality_level,
          abnormal_description, image_urls, remark, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          orderId,
          item.seafoodType,
          item.seafoodName,
          item.seafoodSpec,
          item.isLive,
          item.expectedQuantity,
          item.expectedWeight,
          item.actualQuantity,
          item.actualWeight,
          item.lossWeight,
          item.lossRate,
          item.temperature,
          item.salinity,
          item.phValue,
          item.qualityLevel,
          item.abnormalDescription,
          item.imageUrls,
          item.remark,
          now,
          now
        ]
      );
    }
  }

  await runAsync(
    `UPDATE inspection_orders SET
      supplier_id = COALESCE(?, supplier_id),
      supplier_name = COALESCE(?, supplier_name),
      delivery_date = COALESCE(?, delivery_date),
      vehicle_no = ?,
      driver_name = ?,
      driver_phone = ?,
      total_quantity = ?,
      total_weight = ?,
      total_loss_weight = ?,
      total_loss_rate = ?,
      remark = COALESCE(?, remark),
      updated_at = ?
    WHERE id = ?`,
    [
      request.supplierId,
      request.supplierName,
      request.deliveryDate,
      request.vehicleNo,
      request.driverName,
      request.driverPhone,
      orderSummary.totalQuantity,
      orderSummary.totalWeight,
      orderSummary.totalLossWeight,
      orderSummary.totalLossRate,
      request.remark,
      now,
      orderId
    ]
  );

  await addHistory(
    orderId,
    'update',
    request.operatorId,
    request.operatorName,
    order.status,
    order.status,
    changes.join('; '),
    undefined
  );

  const updatedOrder = await getOrderById(orderId);
  if (!updatedOrder) throw new Error('更新验收单失败');
  return updatedOrder;
}

export async function submitOrder(orderId: string, request: SubmitOrderRequest): Promise<InspectionOrder> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('验收单不存在');
  if (order.status !== 'draft' && order.status !== 'withdrawn') throw new Error('只有草稿或已撤回状态的验收单才能提交');

  const now = formatDate(new Date());
  const newStatus: InspectionStatus = 'submitted';

  await runAsync(
    `UPDATE inspection_orders SET status = ?, submitted_at = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, now, orderId]
  );

  await addHistory(
    orderId,
    'submit',
    request.operatorId,
    request.operatorName,
    order.status,
    newStatus,
    '提交验收单',
    request.remark
  );

  const updatedOrder = await getOrderById(orderId);
  if (!updatedOrder) throw new Error('提交验收单失败');
  return updatedOrder;
}

export async function withdrawOrder(orderId: string, request: WithdrawOrderRequest): Promise<InspectionOrder> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('验收单不存在');
  if (order.status !== 'submitted' && order.status !== 'manual_processing') throw new Error('只有已提交或人工处理中的验收单才能撤回');

  const now = formatDate(new Date());
  const newStatus: InspectionStatus = 'withdrawn';

  await runAsync(
    `UPDATE inspection_orders SET status = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, orderId]
  );

  await addHistory(
    orderId,
    'withdraw',
    request.operatorId,
    request.operatorName,
    order.status,
    newStatus,
    '撤回验收单',
    request.remark
  );

  const updatedOrder = await getOrderById(orderId);
  if (!updatedOrder) throw new Error('撤回验收单失败');
  return updatedOrder;
}

export async function startManualProcess(orderId: string, request: ManualProcessRequest): Promise<InspectionOrder> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('验收单不存在');
  if (order.status !== 'submitted') throw new Error('只有已提交的验收单才能进入人工处理');

  const now = formatDate(new Date());
  const newStatus: InspectionStatus = 'manual_processing';

  await runAsync(
    `UPDATE inspection_orders SET status = ?, manual_processed_at = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, now, orderId]
  );

  await addHistory(
    orderId,
    'manual_process',
    request.operatorId,
    request.operatorName,
    order.status,
    newStatus,
    '进入人工处理',
    request.remark
  );

  const updatedOrder = await getOrderById(orderId);
  if (!updatedOrder) throw new Error('启动人工处理失败');
  return updatedOrder;
}

export async function addRemark(orderId: string, request: AddRemarkRequest): Promise<InspectionOrder> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('验收单不存在');

  const now = formatDate(new Date());

  await addHistory(
    orderId,
    'add_remark',
    request.operatorId,
    request.operatorName,
    order.status,
    order.status,
    `添加备注: ${request.remark}`,
    request.remark
  );

  const updatedOrder = await getOrderById(orderId);
  if (!updatedOrder) throw new Error('添加备注失败');
  return updatedOrder;
}

export async function approveOrder(orderId: string, operatorId?: string, operatorName?: string, remark?: string): Promise<InspectionOrder> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('验收单不存在');
  if (order.status !== 'manual_processing') throw new Error('只有人工处理中的验收单才能审批通过');

  const now = formatDate(new Date());
  const newStatus: InspectionStatus = 'approved';

  await runAsync(
    `UPDATE inspection_orders SET status = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, orderId]
  );

  await addHistory(
    orderId,
    'approve',
    operatorId,
    operatorName,
    order.status,
    newStatus,
    '审批通过',
    remark
  );

  const updatedOrder = await getOrderById(orderId);
  if (!updatedOrder) throw new Error('审批通过失败');
  return updatedOrder;
}

export async function rejectOrder(orderId: string, operatorId?: string, operatorName?: string, remark?: string): Promise<InspectionOrder> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('验收单不存在');
  if (order.status !== 'manual_processing') throw new Error('只有人工处理中的验收单才能审批拒绝');

  const now = formatDate(new Date());
  const newStatus: InspectionStatus = 'rejected';

  await runAsync(
    `UPDATE inspection_orders SET status = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, orderId]
  );

  await addHistory(
    orderId,
    'reject',
    operatorId,
    operatorName,
    order.status,
    newStatus,
    '审批拒绝',
    remark
  );

  const updatedOrder = await getOrderById(orderId);
  if (!updatedOrder) throw new Error('审批拒绝失败');
  return updatedOrder;
}

export async function getDailyReport(date: string): Promise<DailyReport> {
  const orders = await allAsync(
    `SELECT * FROM inspection_orders WHERE delivery_date = ?`,
    [date]
  );

  const itemRows = await allAsync(
    `SELECT i.* FROM inspection_items i
     JOIN inspection_orders o ON i.order_id = o.id
     WHERE o.delivery_date = ?`,
    [date]
  );

  const items = itemRows.map(rowToItem);
  const summary = calculateOrderSummary(items);

  const submittedOrders = orders.filter((o: any) => o.status !== 'draft').length;
  const approvedOrders = orders.filter((o: any) => o.status === 'approved').length;
  const rejectedOrders = orders.filter((o: any) => o.status === 'rejected').length;

  return {
    date,
    totalOrders: orders.length,
    submittedOrders,
    approvedOrders,
    rejectedOrders,
    totalWeight: summary.totalWeight,
    totalLossWeight: summary.totalLossWeight,
    averageLossRate: summary.totalLossRate,
    liveSeafoodLossRate: summary.liveLossRate,
    icedSeafoodLossRate: summary.icedLossRate
  };
}

export async function exportReportData(date: string): Promise<{ report: DailyReport; orders: InspectionOrder[]; items: InspectionItem[] }> {
  const report = await getDailyReport(date);
  const { orders } = await getOrderList(1, 1000, undefined, date, date);
  
  const allItems: InspectionItem[] = [];
  for (const order of orders) {
    const itemRows = await allAsync('SELECT * FROM inspection_items WHERE order_id = ?', [order.id]);
    allItems.push(...itemRows.map(rowToItem));
  }

  return { report, orders, items: allItems };
}
