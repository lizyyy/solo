export enum CakeFlavor {
  CHOCOLATE = '巧克力',
  STRAWBERRY = '草莓',
  MATCHA = '抹茶',
  VANILLA = '香草',
  MANGO = '芒果',
  DURIAN = '榴莲',
  TIRAMISU = '提拉米苏',
  BLACK_FOREST = '黑森林'
}

export enum CakeSize {
  SIZE_6 = '6寸',
  SIZE_8 = '8寸',
  SIZE_10 = '10寸',
  SIZE_12 = '12寸',
  SIZE_14 = '14寸'
}

export enum OrderStatus {
  DRAFT = '草稿',
  PENDING_SCHEDULE = '待排产',
  SCHEDULED = '已排产',
  IN_PRODUCTION = '生产中',
  COMPLETED = '已完成',
  CANCELLED = '已取消',
  RECALLED = '已撤回',
  MANUAL_PROCESSING = '人工处理中'
}

export enum OrderUrgency {
  NORMAL = '普通',
  URGENT = '急单',
  SUPER_URGENT = '特级急单'
}

export interface Oven {
  id: string;
  ovenNumber: string;
  name: string;
  capacity: number;
  maxTemperature: number;
  status: 'active' | 'maintenance' | 'inactive';
}

export interface CapacityRecord {
  id: string;
  ovenId: string;
  date: string;
  timeSlot: string;
  usedCapacity: number;
  totalCapacity: number;
  orderIds: string[];
}

export interface OrderChangeHistory {
  id: string;
  orderId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  operator: string;
  operationTime: string;
  remark: string;
  operationType: 'create' | 'update' | 'status_change' | 'schedule' | 'recall' | 'resubmit' | 'remark';
}

export interface Order {
  id: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryTime: string;
  cakeName: string;
  cakeFlavor: CakeFlavor;
  cakeSize: CakeSize;
  cakeWeight: number;
  layers: number;
  specialRequirements: string;
  urgency: OrderUrgency;
  bakingDuration: number;
  coolingDuration: number;
  status: OrderStatus;
  scheduledOvenId: string | null;
  scheduledDate: string | null;
  scheduledTimeSlot: string | null;
  assignedPastryChef: string | null;
  createdAt: string;
  updatedAt: string;
  currentHandler: string | null;
}

export interface ScheduleResult {
  success: boolean;
  message: string;
  conflictOrders?: string[];
  scheduledOrder?: Order;
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
}