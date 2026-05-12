export interface Customer {
  id: string;
  name: string;
  phone: string;
  idCard?: string;
  note?: string;
  createdAt: string;
}

export interface RepairItem {
  id: string;
  name: string;
  description: string;
  estimatedPrice: number;
  actualPrice?: number;
  completed?: boolean;
}

export interface JewelryPhoto {
  id: string;
  orderId: string;
  url: string;
  description: string;
  uploadedAt: string;
}

export interface StatusHistory {
  id: string;
  orderId: string;
  status: RepairStatus;
  operator: string;
  note?: string;
  createdAt: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
  existingOrderNo?: string;
}

export enum RepairStatus {
  REGISTERED = 'registered',
  ESTIMATING = 'estimating',
  QUOTED = 'quoted',
  QUOTE_CONFIRMED = 'quote_confirmed',
  REPAIRING = 'repairing',
  COMPLETED = 'completed',
  PICKED_UP = 'picked_up',
  CANCELLED = 'cancelled'
}

export const statusLabels: Record<RepairStatus, string> = {
  [RepairStatus.REGISTERED]: '已登记',
  [RepairStatus.ESTIMATING]: '估价中',
  [RepairStatus.QUOTED]: '已报价',
  [RepairStatus.QUOTE_CONFIRMED]: '报价已确认',
  [RepairStatus.REPAIRING]: '维修中',
  [RepairStatus.COMPLETED]: '已完成',
  [RepairStatus.PICKED_UP]: '已取件',
  [RepairStatus.CANCELLED]: '已取消'
};

export const statusColors: Record<RepairStatus, string> = {
  [RepairStatus.REGISTERED]: 'bg-gray-100 text-gray-800',
  [RepairStatus.ESTIMATING]: 'bg-blue-100 text-blue-800',
  [RepairStatus.QUOTED]: 'bg-yellow-100 text-yellow-800',
  [RepairStatus.QUOTE_CONFIRMED]: 'bg-green-100 text-green-800',
  [RepairStatus.REPAIRING]: 'bg-purple-100 text-purple-800',
  [RepairStatus.COMPLETED]: 'bg-teal-100 text-teal-800',
  [RepairStatus.PICKED_UP]: 'bg-green-100 text-green-800',
  [RepairStatus.CANCELLED]: 'bg-red-100 text-red-800'
};

export interface RepairOrder {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerIdCard?: string;
  jewelryName: string;
  jewelryDescription: string;
  jewelryMaterial?: string;
  diamondCount?: number;
  weight?: number;
  estimatedPrice?: number;
  finalPrice?: number;
  overdueFee?: number;
  deposit?: number;
  status: RepairStatus;
  quoteConfirmedAt?: string;
  quoteConfirmedBy?: string;
  pickerName?: string;
  pickerPhone?: string;
  pickerIdCard?: string;
  pickedUpAt?: string;
  estimatedPickupDate?: string;
  registeredBy: string;
  registeredAt: string;
  completedAt?: string;
  note?: string;
  photos: JewelryPhoto[];
  statusHistory: StatusHistory[];
  repairItems: RepairItem[];
}

export interface CreateOrderDTO {
  customerName: string;
  customerPhone: string;
  customerIdCard?: string;
  jewelryName: string;
  jewelryDescription: string;
  jewelryMaterial?: string;
  diamondCount?: number;
  weight?: number;
  estimatedPickupDate?: string;
  deposit?: number;
  note?: string;
  repairItems?: RepairItem[];
}

export interface AddRepairItemDTO {
  orderId: string;
  name: string;
  description: string;
  estimatedPrice: number;
}

export interface PickupValidationResult {
  isValid: boolean;
  isCustomerMatch: boolean;
  isIdCardMatch: boolean;
  warnings: string[];
  requiresIdCard: boolean;
}

export interface UpdateOrderDTO {
  jewelryName?: string;
  jewelryDescription?: string;
  jewelryMaterial?: string;
  diamondCount?: number;
  weight?: number;
  estimatedPrice?: number;
  finalPrice?: number;
  estimatedPickupDate?: string;
  note?: string;
}

export interface QuoteConfirmDTO {
  finalPrice: number;
  confirmedBy: string;
}

export interface PickupDTO {
  pickerName: string;
  pickerPhone: string;
  pickerIdCard?: string;
  paidAmount: number;
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  repairingOrders: number;
  completedToday: number;
  pickedUpToday: number;
  totalRevenue: number;
  overdueOrders: number;
  unquotedRepairing: number;
}
