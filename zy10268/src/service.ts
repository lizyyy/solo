import { Database } from 'sqlite';
import { getDatabase } from './database';
import { OrderStatus, ConstructionNode, Department, ApiResponse, DedicatedLineOrder, Device, ConstructionProgress, OperationHistory } from './types';
import crypto from 'crypto';

function generateId(): string {
  return crypto.randomUUID();
}

async function checkDuplicateRequest(db: Database, requestId: string): Promise<boolean> {
  const existing = await db.get(
    'SELECT id FROM operation_history WHERE request_id = ?',
    [requestId]
  );
  return !!existing;
}

async function recordHistory(
  db: Database,
  orderId: string,
  operationType: string,
  operator: string,
  department: Department,
  beforeState: string,
  afterState: string,
  requestId: string,
  reason: string | null = null
) {
  await db.run(
    `INSERT INTO operation_history 
     (id, order_id, operation_type, operator, department, before_state, after_state, reason, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      orderId,
      operationType,
      operator,
      department,
      beforeState,
      afterState,
      reason,
      requestId,
      new Date().toISOString()
    ]
  );
}

export async function createOrder(
  orderNo: string,
  customerName: string,
  bandwidth: number,
  operator: string,
  requestId: string
): Promise<ApiResponse> {
  const db = await getDatabase();

  if (await checkDuplicateRequest(db, requestId)) {
    return {
      success: false,
      code: 'DUPLICATE_REQUEST',
      message: '重复请求，该 requestId 已处理过'
    };
  }

  const existingOrder = await db.get(
    'SELECT id FROM dedicated_line_orders WHERE order_no = ?',
    [orderNo]
  );

  if (existingOrder) {
    return {
      success: false,
      code: 'ORDER_EXISTS',
      message: '订单号已存在'
    };
  }

  const orderId = generateId();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO dedicated_line_orders 
     (id, order_no, customer_name, bandwidth, status, device_id, is_billing, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?)`,
    [orderId, orderNo, customerName, bandwidth, OrderStatus.CREATED, now, now]
  );

  const nodes = [
    { node: ConstructionNode.CONTRACT_SIGNED, department: Department.SALES },
    { node: ConstructionNode.RESOURCE_ALLOCATION, department: Department.ENGINEERING },
    { node: ConstructionNode.DEVICE_INSTALLATION, department: Department.ENGINEERING },
    { node: ConstructionNode.LINE_TESTING, department: Department.OPERATION },
    { node: ConstructionNode.CUSTOMER_ACCEPTANCE, department: Department.SALES }
  ];

  for (const n of nodes) {
    await db.run(
      `INSERT INTO construction_progress 
       (id, order_id, node, department, status, start_time, end_time, remark)
       VALUES (?, ?, ?, ?, 'PENDING', NULL, NULL, NULL)`,
      [generateId(), orderId, n.node, n.department]
    );
  }

  await recordHistory(
    db, orderId, 'CREATE_ORDER', operator, Department.SALES,
    '{}', JSON.stringify({ status: OrderStatus.CREATED }), requestId
  );

  return {
    success: true,
    code: 'SUCCESS',
    message: '订单创建成功',
    data: { orderId, orderNo, status: OrderStatus.CREATED }
  };
}

export async function bindDevice(
  orderId: string,
  deviceId: string,
  operator: string,
  requestId: string
): Promise<ApiResponse> {
  const db = await getDatabase();

  if (await checkDuplicateRequest(db, requestId)) {
    return {
      success: false,
      code: 'DUPLICATE_REQUEST',
      message: '重复请求，该 requestId 已处理过'
    };
  }

  const order = await db.get<DedicatedLineOrder>(
    'SELECT * FROM dedicated_line_orders WHERE id = ?',
    [orderId]
  );

  if (!order) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: '订单不存在'
    };
  }

  if (order.status === OrderStatus.CONSTRUCTION_FAILED) {
    return {
      success: false,
      code: 'CONSTRUCTION_FAILED',
      message: '施工已失败，无法绑定设备'
    };
  }

  if (order.device_id) {
    return {
      success: false,
      code: 'DEVICE_ALREADY_BOUND',
      message: '订单已绑定设备，不能重复绑定'
    };
  }

  const device = await db.get<Device>(
    'SELECT * FROM devices WHERE id = ?',
    [deviceId]
  );

  if (!device) {
    return {
      success: false,
      code: 'DEVICE_NOT_FOUND',
      message: '设备不存在'
    };
  }

  if (device.is_bound) {
    return {
      success: false,
      code: 'DEVICE_ALREADY_USED',
      message: '设备已被其他订单绑定，不能重复绑定',
      errorDetails: `设备 ${device.device_no} 已被订单 ${device.bound_order_id} 绑定`
    };
  }

  const beforeState = JSON.stringify({ status: order.status, deviceId: order.device_id });

  await db.run(
    'UPDATE dedicated_line_orders SET device_id = ?, status = ?, updated_at = ? WHERE id = ?',
    [deviceId, OrderStatus.DEVICE_BOUND, new Date().toISOString(), orderId]
  );

  await db.run(
    'UPDATE devices SET is_bound = 1, bound_order_id = ? WHERE id = ?',
    [orderId, deviceId]
  );

  await db.run(
    `UPDATE construction_progress 
     SET status = 'COMPLETED', end_time = ? 
     WHERE order_id = ? AND node = ?`,
    [new Date().toISOString(), orderId, ConstructionNode.RESOURCE_ALLOCATION]
  );

  await db.run(
    `UPDATE construction_progress 
     SET status = 'IN_PROGRESS', start_time = ? 
     WHERE order_id = ? AND node = ?`,
    [new Date().toISOString(), orderId, ConstructionNode.DEVICE_INSTALLATION]
  );

  await recordHistory(
    db, orderId, 'BIND_DEVICE', operator, Department.ENGINEERING,
    beforeState, JSON.stringify({ status: OrderStatus.DEVICE_BOUND, deviceId }), requestId
  );

  return {
    success: true,
    code: 'SUCCESS',
    message: '设备绑定成功',
    data: { orderId, deviceId, status: OrderStatus.DEVICE_BOUND }
  };
}

export async function updateConstructionNode(
  orderId: string,
  node: ConstructionNode,
  nodeStatus: 'COMPLETED' | 'FAILED',
  operator: string,
  requestId: string,
  remark?: string
): Promise<ApiResponse> {
  const db = await getDatabase();

  if (await checkDuplicateRequest(db, requestId)) {
    return {
      success: false,
      code: 'DUPLICATE_REQUEST',
      message: '重复请求，该 requestId 已处理过'
    };
  }

  const order = await db.get<DedicatedLineOrder>(
    'SELECT * FROM dedicated_line_orders WHERE id = ?',
    [orderId]
  );

  if (!order) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: '订单不存在'
    };
  }

  const progress = await db.get<ConstructionProgress>(
    'SELECT * FROM construction_progress WHERE order_id = ? AND node = ?',
    [orderId, node]
  );

  if (!progress) {
    return {
      success: false,
      code: 'NODE_NOT_FOUND',
      message: '施工节点不存在'
    };
  }

  if (progress.status === 'COMPLETED') {
    return {
      success: false,
      code: 'NODE_ALREADY_COMPLETED',
      message: '该节点已完成，不能重复操作'
    };
  }

  const beforeState = JSON.stringify({ status: order.status, nodeStatus: progress.status });

  if (nodeStatus === 'FAILED') {
    await db.run(
      'UPDATE dedicated_line_orders SET status = ?, updated_at = ? WHERE id = ?',
      [OrderStatus.CONSTRUCTION_FAILED, new Date().toISOString(), orderId]
    );

    await db.run(
      `UPDATE construction_progress 
       SET status = 'FAILED', end_time = ?, remark = ? 
       WHERE order_id = ? AND node = ?`,
      [new Date().toISOString(), remark || '施工失败', orderId, node]
    );

    await recordHistory(
      db, orderId, 'CONSTRUCTION_FAILED', operator, progress.department as Department,
      beforeState, JSON.stringify({ status: OrderStatus.CONSTRUCTION_FAILED }), requestId, remark
    );

    return {
      success: true,
      code: 'SUCCESS',
      message: '施工失败已记录',
      data: { orderId, status: OrderStatus.CONSTRUCTION_FAILED, failedNode: node }
    };
  }

  await db.run(
    `UPDATE construction_progress 
     SET status = 'COMPLETED', end_time = ?, remark = ? 
     WHERE order_id = ? AND node = ?`,
    [new Date().toISOString(), remark || '节点完成', orderId, node]
  );

  const nodes = Object.values(ConstructionNode);
  const currentIndex = nodes.indexOf(node);
  
  if (currentIndex < nodes.length - 1) {
    const nextNode = nodes[currentIndex + 1];
    await db.run(
      `UPDATE construction_progress 
       SET status = 'IN_PROGRESS', start_time = ? 
       WHERE order_id = ? AND node = ?`,
      [new Date().toISOString(), orderId, nextNode]
    );
  }

  let newStatus = order.status;
  if (node === ConstructionNode.CUSTOMER_ACCEPTANCE) {
    newStatus = OrderStatus.ACCEPTED;
    await db.run(
      'UPDATE dedicated_line_orders SET status = ?, updated_at = ? WHERE id = ?',
      [newStatus, new Date().toISOString(), orderId]
    );
  } else if (node === ConstructionNode.CONTRACT_SIGNED) {
    newStatus = OrderStatus.CONSTRUCTION_IN_PROGRESS;
    await db.run(
      'UPDATE dedicated_line_orders SET status = ?, updated_at = ? WHERE id = ?',
      [newStatus, new Date().toISOString(), orderId]
    );
  }

  await recordHistory(
    db, orderId, 'CONSTRUCTION_NODE_COMPLETE', operator, progress.department as Department,
    beforeState, JSON.stringify({ status: newStatus, completedNode: node }), requestId, remark
  );

  return {
    success: true,
    code: 'SUCCESS',
    message: '施工节点更新成功',
    data: { orderId, completedNode: node, status: newStatus }
  };
}

export async function confirmActivation(
  orderId: string,
  operator: string,
  requestId: string
): Promise<ApiResponse> {
  const db = await getDatabase();

  if (await checkDuplicateRequest(db, requestId)) {
    return {
      success: false,
      code: 'DUPLICATE_REQUEST',
      message: '重复请求，该 requestId 已处理过'
    };
  }

  const order = await db.get<DedicatedLineOrder>(
    'SELECT * FROM dedicated_line_orders WHERE id = ?',
    [orderId]
  );

  if (!order) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: '订单不存在'
    };
  }

  const orderStatus = order.status as OrderStatus;

  if (orderStatus === OrderStatus.CONSTRUCTION_FAILED) {
    return {
      success: false,
      code: 'CONSTRUCTION_FAILED',
      message: '施工失败的订单不能开通'
    };
  }

  if (orderStatus !== OrderStatus.ACCEPTED) {
    return {
      success: false,
      code: 'INVALID_STATUS',
      message: '只有已验收的订单才能开通激活',
      errorDetails: `当前状态: ${orderStatus}，需要状态: ${OrderStatus.ACCEPTED}`
    };
  }

  const beforeState = JSON.stringify({ status: orderStatus, isBilling: order.is_billing });

  await db.run(
    'UPDATE dedicated_line_orders SET status = ?, is_billing = 1, updated_at = ? WHERE id = ?',
    [OrderStatus.ACTIVE, new Date().toISOString(), orderId]
  );

  await recordHistory(
    db, orderId, 'ACTIVATE_LINE', operator, Department.OPERATION,
    beforeState, JSON.stringify({ status: OrderStatus.ACTIVE, isBilling: true }), requestId
  );

  return {
    success: true,
    code: 'SUCCESS',
    message: '专线开通成功，已开始计费',
    data: { orderId, status: OrderStatus.ACTIVE, isBilling: true }
  };
}

export async function changeBandwidth(
  orderId: string,
  newBandwidth: number,
  operator: string,
  requestId: string
): Promise<ApiResponse> {
  const db = await getDatabase();

  if (await checkDuplicateRequest(db, requestId)) {
    return {
      success: false,
      code: 'DUPLICATE_REQUEST',
      message: '重复请求，该 requestId 已处理过'
    };
  }

  const order = await db.get<DedicatedLineOrder>(
    'SELECT * FROM dedicated_line_orders WHERE id = ?',
    [orderId]
  );

  if (!order) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: '订单不存在'
    };
  }

  if (order.status === OrderStatus.SUSPENDED) {
    return {
      success: false,
      code: 'SUSPENDED_CANNOT_CHANGE',
      message: '暂停期间不能变更带宽，请先恢复服务'
    };
  }

  if (order.status === OrderStatus.CONSTRUCTION_FAILED) {
    return {
      success: false,
      code: 'CONSTRUCTION_FAILED',
      message: '施工失败的订单不能变更带宽'
    };
  }

  if (order.bandwidth === newBandwidth) {
    return {
      success: false,
      code: 'SAME_BANDWIDTH',
      message: '新带宽与当前带宽相同，无需变更'
    };
  }

  const beforeState = JSON.stringify({ bandwidth: order.bandwidth });

  await db.run(
    'UPDATE dedicated_line_orders SET bandwidth = ?, updated_at = ? WHERE id = ?',
    [newBandwidth, new Date().toISOString(), orderId]
  );

  await recordHistory(
    db, orderId, 'CHANGE_BANDWIDTH', operator, Department.OPERATION,
    beforeState, JSON.stringify({ bandwidth: newBandwidth }), requestId
  );

  return {
    success: true,
    code: 'SUCCESS',
    message: '带宽变更成功',
    data: { orderId, oldBandwidth: order.bandwidth, newBandwidth }
  };
}

export async function suspendBilling(
  orderId: string,
  operator: string,
  requestId: string,
  reason?: string
): Promise<ApiResponse> {
  const db = await getDatabase();

  if (await checkDuplicateRequest(db, requestId)) {
    return {
      success: false,
      code: 'DUPLICATE_REQUEST',
      message: '重复请求，该 requestId 已处理过'
    };
  }

  const orderRow = await db.get(
    'SELECT * FROM dedicated_line_orders WHERE id = ?',
    [orderId]
  );

  if (!orderRow) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: '订单不存在'
    };
  }

  const order = orderRow as DedicatedLineOrder;
  const isCurrentlyBilling = !!order.is_billing;
  if (!isCurrentlyBilling) {
    return {
      success: false,
      code: 'NOT_BILLING',
      message: '订单当前未在计费，无需暂停'
    };
  }

  if (order.status !== OrderStatus.ACTIVE) {
    return {
      success: false,
      code: 'INVALID_STATUS',
      message: '只有活跃状态的订单才能暂停计费',
      errorDetails: `当前状态: ${order.status}`
    };
  }

  const beforeState = JSON.stringify({ status: order.status, isBilling: isCurrentlyBilling });

  await db.run(
    'UPDATE dedicated_line_orders SET status = ?, is_billing = 0, updated_at = ? WHERE id = ?',
    [OrderStatus.SUSPENDED, new Date().toISOString(), orderId]
  );

  await recordHistory(
    db, orderId, 'SUSPEND_BILLING', operator, Department.FINANCE,
    beforeState, JSON.stringify({ status: OrderStatus.SUSPENDED, isBilling: false }), requestId, reason
  );

  return {
    success: true,
    code: 'SUCCESS',
    message: '计费已暂停',
    data: { orderId, status: OrderStatus.SUSPENDED, isBilling: false }
  };
}

export async function resumeBilling(
  orderId: string,
  operator: string,
  requestId: string
): Promise<ApiResponse> {
  const db = await getDatabase();

  if (await checkDuplicateRequest(db, requestId)) {
    return {
      success: false,
      code: 'DUPLICATE_REQUEST',
      message: '重复请求，该 requestId 已处理过'
    };
  }

  const order = await db.get<DedicatedLineOrder>(
    'SELECT * FROM dedicated_line_orders WHERE id = ?',
    [orderId]
  );

  if (!order) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: '订单不存在'
    };
  }

  if (order.status !== OrderStatus.SUSPENDED) {
    return {
      success: false,
      code: 'INVALID_STATUS',
      message: '只有暂停状态的订单才能恢复计费',
      errorDetails: `当前状态: ${order.status}`
    };
  }

  const beforeState = JSON.stringify({ status: order.status, isBilling: order.is_billing });

  await db.run(
    'UPDATE dedicated_line_orders SET status = ?, is_billing = 1, updated_at = ? WHERE id = ?',
    [OrderStatus.ACTIVE, new Date().toISOString(), orderId]
  );

  await recordHistory(
    db, orderId, 'RESUME_BILLING', operator, Department.FINANCE,
    beforeState, JSON.stringify({ status: OrderStatus.ACTIVE, isBilling: true }), requestId
  );

  return {
    success: true,
    code: 'SUCCESS',
    message: '计费已恢复',
    data: { orderId, status: OrderStatus.ACTIVE, isBilling: true }
  };
}

export async function getOrderDetail(orderId: string): Promise<ApiResponse> {
  const db = await getDatabase();

  const order = await db.get<DedicatedLineOrder>(
    'SELECT * FROM dedicated_line_orders WHERE id = ?',
    [orderId]
  );

  if (!order) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: '订单不存在'
    };
  }

  const progress = await db.all<ConstructionProgress[]>(
    'SELECT * FROM construction_progress WHERE order_id = ? ORDER BY node',
    [orderId]
  );

  const pendingNode = progress.find(p => p.status === 'IN_PROGRESS' || p.status === 'PENDING');
  const blockedDepartment = pendingNode ? pendingNode.department : null;

  const history = await db.all<OperationHistory[]>(
    'SELECT * FROM operation_history WHERE order_id = ? ORDER BY created_at DESC LIMIT 20',
    [orderId]
  );

  let deviceInfo = null;
  if (order.device_id) {
    deviceInfo = await db.get<Device>(
      'SELECT * FROM devices WHERE id = ?',
      [order.device_id]
    );
  }

  return {
    success: true,
    code: 'SUCCESS',
    message: '查询成功',
    data: {
      order: {
        ...order,
        isBilling: !!order.is_billing
      },
      device: deviceInfo,
      constructionProgress: progress,
      currentBlockedDepartment: blockedDepartment,
      operationHistory: history
    }
  };
}

export async function getAvailableDevices(): Promise<ApiResponse> {
  const db = await getDatabase();

  const devices = await db.all<Device[]>(
    'SELECT * FROM devices WHERE is_bound = 0'
  );

  return {
    success: true,
    code: 'SUCCESS',
    message: '查询成功',
    data: devices
  };
}
