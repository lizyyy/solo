export interface Nanny {
  id: number;
  name: string;
  phone: string;
  idCard: string;
  level: string;
  dailyRate: number;
  status: 'available' | 'on_service' | 'on_leave';
  createdAt: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface Order {
  id: number;
  orderNo: string;
  customerId: number;
  nannyId: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  totalAmount: number;
  deposit: number;
  status: 'pending' | 'in_service' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface Leave {
  id: number;
  orderId: number;
  nannyId: number;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Replacement {
  id: number;
  leaveId: number;
  orderId: number;
  originalNannyId: number;
  replacementNannyId: number;
  startDate: string;
  endDate: string;
  days: number;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
}

export interface Evaluation {
  id: number;
  orderId: number;
  nannyId: number;
  rating: number;
  comment: string;
  deductionAmount: number;
  deductionReason: string;
  createdAt: string;
}

export interface HistoryLog {
  id: number;
  orderId: number;
  eventType: string;
  eventData: string;
  createdAt: string;
}

export interface OrderDetail {
  order: Order;
  customer: Customer;
  nanny: Nanny;
  leaves: Leave[];
  replacements: Replacement[];
  evaluation: Evaluation | null;
  historyLogs: HistoryLog[];
}

export interface Settlement {
  orderNo: string;
  customerName: string;
  nannyName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  replacementDays: number;
  totalAmount: number;
  deposit: number;
  deductionAmount: number;
  finalAmount: number;
  details: {
    baseDays: number;
    baseAmount: number;
    replacementAmount: number;
  };
}

export interface CalendarData {
  orders: Order[];
  leaves: Leave[];
  replacements: Replacement[];
}
