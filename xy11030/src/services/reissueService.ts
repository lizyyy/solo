import { v4 as uuidv4 } from 'uuid';
import { runQuery, runSingleQuery, runExecute } from '../database';
import {
  ReissueOrder,
  ReissueItem,
  ReissueHistory,
  ReissueStatus,
  CreateReissueOrderRequest,
  UpdateReissueStatusRequest
} from '../types';

const generateOrderNo = (): string => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `REISSUE-${dateStr}-${random}`;
};

const mapRowToOrder = (row: any): ReissueOrder => ({
  id: row.id,
  orderNo: row.order_no,
  groupBuyCode: row.group_buy_code,
  groupBuyName: row.group_buy_name,
  leaderId: row.leader_id,
  leaderName: row.leader_name,
  leaderPhone: row.leader_phone,
  warehouseCode: row.warehouse_code,
  warehouseName: row.warehouse_name,
  originalOrderNo: row.original_order_no,
  originalOrderDate: new Date(row.original_order_date),
  status: row.status as ReissueStatus,
  totalAmount: row.total_amount,
  totalItems: row.total_items,
  remark: row.remark,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
  updatedBy: row.updated_by,
  updatedAt: new Date(row.updated_at)
});

const mapRowToItem = (row: any): ReissueItem => ({
  id: row.id,
  reissueOrderId: row.reissue_order_id,
  productCode: row.product_code,
  productName: row.product_name,
  skuCode: row.sku_code,
  skuName: row.sku_name,
  issueType: row.issue_type,
  originalQuantity: row.original_quantity,
  issueQuantity: row.issue_quantity,
  reissueQuantity: row.reissue_quantity,
  unitPrice: row.unit_price,
  subtotal: row.subtotal,
  remark: row.remark,
  createdAt: new Date(row.created_at)
});

const mapRowToHistory = (row: any): ReissueHistory => ({
  id: row.id,
  reissueOrderId: row.reissue_order_id,
  action: row.action,
  previousStatus: row.previous_status as ReissueStatus | null,
  newStatus: row.new_status as ReissueStatus | null,
  operatorId: row.operator_id,
  operatorName: row.operator_name,
  remark: row.remark,
  changeDetails: row.change_details,
  createdAt: new Date(row.created_at)
});

export const createReissueOrder = async (
  request: CreateReissueOrderRequest
): Promise<ReissueOrder> => {
  const orderId = uuidv4();
  const orderNo = generateOrderNo();
  const now = new Date().toISOString();

  let totalAmount = 0;
  let totalItems = 0;

  for (const item of request.items) {
    const subtotal = item.reissueQuantity * item.unitPrice;
    totalAmount += subtotal;
    totalItems += item.reissueQuantity;
  }

  await runExecute(
    `
    INSERT INTO reissue_orders (
      id, order_no, group_buy_code, group_buy_name, leader_id, leader_name,
      leader_phone, warehouse_code, warehouse_name, original_order_no,
      original_order_date, status, total_amount, total_items, remark,
      created_by, created_at, updated_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      orderId,
      orderNo,
      request.groupBuyCode,
      request.groupBuyName,
      request.leaderId,
      request.leaderName,
      request.leaderPhone,
      request.warehouseCode,
      request.warehouseName,
      request.originalOrderNo,
      request.originalOrderDate,
      ReissueStatus.NORMAL,
      totalAmount,
      totalItems,
      request.remark,
      request.createdBy,
      now,
      request.createdBy,
      now
    ]
  );

  for (const item of request.items) {
    const itemId = uuidv4();
    const subtotal = item.reissueQuantity * item.unitPrice;

    await runExecute(
      `
      INSERT INTO reissue_items (
        id, reissue_order_id, product_code, product_name, sku_code, sku_name,
        issue_type, original_quantity, issue_quantity, reissue_quantity,
        unit_price, subtotal, remark, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        itemId,
        orderId,
        item.productCode,
        item.productName,
        item.skuCode,
        item.skuName,
        item.issueType,
        item.originalQuantity,
        item.issueQuantity,
        item.reissueQuantity,
        item.unitPrice,
        subtotal,
        item.remark,
        now
      ]
    );
  }

  await createHistoryRecord(
    orderId,
    '创建补发单',
    null,
    ReissueStatus.NORMAL,
    request.createdBy,
    '系统自动创建',
    '创建补发单，初始状态为正常'
  );

  const order = await getReissueOrderById(orderId);
  if (!order) {
    throw new Error('创建补发单失败');
  }

  return order;
};

export const createHistoryRecord = async (
  reissueOrderId: string,
  action: string,
  previousStatus: ReissueStatus | null,
  newStatus: ReissueStatus | null,
  operatorId: string,
  operatorName: string,
  changeDetails: string,
  remark?: string
): Promise<void> => {
  const historyId = uuidv4();
  const now = new Date().toISOString();

  await runExecute(
    `
    INSERT INTO reissue_history (
      id, reissue_order_id, action, previous_status, new_status,
      operator_id, operator_name, remark, change_details, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      historyId,
      reissueOrderId,
      action,
      previousStatus,
      newStatus,
      operatorId,
      operatorName,
      remark || '',
      changeDetails,
      now
    ]
  );
};

export const getReissueOrders = async (
  page: number = 1,
  pageSize: number = 20,
  status?: ReissueStatus,
  leaderId?: string
): Promise<{ orders: ReissueOrder[]; total: number }> => {
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (status) {
    whereClause += ' AND status = ?';
    params.push(status);
  }

  if (leaderId) {
    whereClause += ' AND leader_id = ?';
    params.push(leaderId);
  }

  const countResult = await runSingleQuery<{ count: number }>(
    `SELECT COUNT(*) as count FROM reissue_orders ${whereClause}`,
    params
  );
  const total = countResult?.count || 0;

  const offset = (page - 1) * pageSize;
  const rows = await runQuery(
    `SELECT * FROM reissue_orders ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    orders: rows.map(mapRowToOrder),
    total
  };
};

export const getReissueOrderById = async (
  id: string
): Promise<ReissueOrder | undefined> => {
  const row = await runSingleQuery(
    'SELECT * FROM reissue_orders WHERE id = ?',
    [id]
  );
  return row ? mapRowToOrder(row) : undefined;
};

export const getReissueItemsByOrderId = async (
  orderId: string
): Promise<ReissueItem[]> => {
  const rows = await runQuery(
    'SELECT * FROM reissue_items WHERE reissue_order_id = ?',
    [orderId]
  );
  return rows.map(mapRowToItem);
};

export const getReissueHistoryByOrderId = async (
  orderId: string
): Promise<ReissueHistory[]> => {
  const rows = await runQuery(
    'SELECT * FROM reissue_history WHERE reissue_order_id = ? ORDER BY created_at DESC',
    [orderId]
  );
  return rows.map(mapRowToHistory);
};

export const updateReissueStatus = async (
  orderId: string,
  request: UpdateReissueStatusRequest
): Promise<ReissueOrder> => {
  const order = await getReissueOrderById(orderId);
  if (!order) {
    throw new Error('补发单不存在');
  }

  const now = new Date().toISOString();
  const previousStatus = order.status;

  await runExecute(
    `
    UPDATE reissue_orders
    SET status = ?, updated_by = ?, updated_at = ?, remark = COALESCE(?, remark)
    WHERE id = ?
    `,
    [
      request.status,
      request.operatorId,
      now,
      request.remark || null,
      orderId
    ]
  );

  let action = '';
  let changeDetails = '';

  switch (request.status) {
    case ReissueStatus.PROCESSING:
      action = '开始处理';
      changeDetails = `状态从 ${previousStatus} 变更为 处理中`;
      break;
    case ReissueStatus.REVIEWING:
      action = '提交复核';
      changeDetails = `状态从 ${previousStatus} 变更为 复核中`;
      break;
    case ReissueStatus.REJECTED:
      action = '驳回';
      changeDetails = `状态从 ${previousStatus} 变更为 已驳回`;
      break;
    case ReissueStatus.SUPPLEMENTED:
      action = '补录信息';
      changeDetails = `状态从 ${previousStatus} 变更为 已补录`;
      break;
    case ReissueStatus.COMPLETED:
      action = '完成';
      changeDetails = `状态从 ${previousStatus} 变更为 已完成`;
      break;
    case ReissueStatus.CANCELLED:
      action = '取消';
      changeDetails = `状态从 ${previousStatus} 变更为 已取消`;
      break;
    default:
      action = '状态更新';
      changeDetails = `状态从 ${previousStatus} 变更为 ${request.status}`;
  }

  await createHistoryRecord(
    orderId,
    action,
    previousStatus,
    request.status,
    request.operatorId,
    request.operatorName,
    changeDetails,
    request.remark
  );

  const updatedOrder = await getReissueOrderById(orderId);
  if (!updatedOrder) {
    throw new Error('更新状态失败');
  }

  return updatedOrder;
};

export const resubmitReissueOrder = async (
  orderId: string,
  request: UpdateReissueStatusRequest
): Promise<ReissueOrder> => {
  const order = await getReissueOrderById(orderId);
  if (!order) {
    throw new Error('补发单不存在');
  }

  if (order.status !== ReissueStatus.REJECTED) {
    throw new Error('只有驳回状态的补发单可以重新提交');
  }

  return updateReissueStatus(orderId, {
    ...request,
    status: ReissueStatus.PROCESSING
  });
};

export const getReissueStatistics = async (
  startDate?: string,
  endDate?: string
): Promise<{
  totalOrders: number;
  totalAmount: number;
  statusCounts: Record<ReissueStatus, number>;
  issueTypeCounts: Record<string, number>;
}> => {
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (startDate) {
    whereClause += ' AND created_at >= ?';
    params.push(startDate);
  }

  if (endDate) {
    whereClause += ' AND created_at <= ?';
    params.push(endDate);
  }

  const totalResult = await runSingleQuery<{ count: number; amount: number }>(
    `
    SELECT COUNT(*) as count, SUM(total_amount) as amount
    FROM reissue_orders
    ${whereClause}
    `,
    params
  );

  const statusRows = await runQuery<{ status: string; count: number }>(
    `
    SELECT status, COUNT(*) as count
    FROM reissue_orders
    ${whereClause}
    GROUP BY status
    `,
    params
  );

  const issueTypeRows = await runQuery<{ issue_type: string; count: number }>(
    `
    SELECT ri.issue_type, COUNT(*) as count
    FROM reissue_items ri
    JOIN reissue_orders ro ON ri.reissue_order_id = ro.id
    ${whereClause}
    GROUP BY ri.issue_type
    `,
    params
  );

  const statusCounts: Record<ReissueStatus, number> = {
    [ReissueStatus.DRAFT]: 0,
    [ReissueStatus.NORMAL]: 0,
    [ReissueStatus.REJECTED]: 0,
    [ReissueStatus.SUPPLEMENTED]: 0,
    [ReissueStatus.PROCESSING]: 0,
    [ReissueStatus.REVIEWING]: 0,
    [ReissueStatus.COMPLETED]: 0,
    [ReissueStatus.CANCELLED]: 0
  };

  for (const row of statusRows) {
    statusCounts[row.status as ReissueStatus] = row.count;
  }

  const issueTypeCounts: Record<string, number> = {};
  for (const row of issueTypeRows) {
    issueTypeCounts[row.issue_type] = row.count;
  }

  return {
    totalOrders: totalResult?.count || 0,
    totalAmount: totalResult?.amount || 0,
    statusCounts,
    issueTypeCounts
  };
};
