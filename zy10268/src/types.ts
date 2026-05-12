export enum OrderStatus {
  CREATED = 'CREATED',
  CONSTRUCTION_IN_PROGRESS = 'CONSTRUCTION_IN_PROGRESS',
  CONSTRUCTION_FAILED = 'CONSTRUCTION_FAILED',
  DEVICE_BOUND = 'DEVICE_BOUND',
  ACCEPTED = 'ACCEPTED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED'
}

export enum ConstructionNode {
  CONTRACT_SIGNED = 'CONTRACT_SIGNED',
  RESOURCE_ALLOCATION = 'RESOURCE_ALLOCATION',
  DEVICE_INSTALLATION = 'DEVICE_INSTALLATION',
  LINE_TESTING = 'LINE_TESTING',
  CUSTOMER_ACCEPTANCE = 'CUSTOMER_ACCEPTANCE'
}

export enum Department {
  SALES = 'SALES',
  ENGINEERING = 'ENGINEERING',
  OPERATION = 'OPERATION',
  FINANCE = 'FINANCE'
}

export interface DedicatedLineOrder {
  id: string;
  order_no: string;
  customer_name: string;
  bandwidth: number;
  status: OrderStatus;
  device_id: string | null;
  is_billing: number;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  device_no: string;
  device_type: string;
  is_bound: number;
  bound_order_id: string | null;
  created_at: string;
}

export interface ConstructionProgress {
  id: string;
  orderId: string;
  node: ConstructionNode;
  department: Department;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  startTime: string | null;
  endTime: string | null;
  remark: string | null;
}

export interface OperationHistory {
  id: string;
  orderId: string;
  operationType: string;
  operator: string;
  department: Department;
  beforeState: string;
  afterState: string;
  reason: string | null;
  requestId: string;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  code: string;
  message: string;
  data?: T;
  errorDetails?: string;
}
