export interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  openTime: string;
  closeTime: string;
}

export interface Room {
  id: string;
  storeId: string;
  name: string;
  capacity: number;
  pricePerHour: number;
  status: 'available' | 'maintenance' | 'disabled';
  equipment: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  vipLevel: 'normal' | 'silver' | 'gold' | 'platinum';
  createdAt: string;
}

export type BookingStatus = 
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_use'
  | 'completed'
  | 'late_released'
  | 'cancelled'
  | 'room_changed';

export interface Booking {
  id: string;
  storeId: string;
  roomId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  originalStartTime?: string;
  originalEndTime?: string;
  originalRoomId?: string;
  status: BookingStatus;
  checkInTime?: string;
  checkOutTime?: string;
  totalPrice: number;
  paidAmount: number;
  lateMinutes?: number;
  isExtended: boolean;
  extendCount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusLog {
  id: string;
  bookingId: string;
  fromStatus?: BookingStatus;
  toStatus: BookingStatus;
  operator: string;
  reason: string;
  createdAt: string;
}

export interface RevenueRecord {
  id: string;
  bookingId: string;
  storeId: string;
  customerId: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'mobile' | 'prepaid';
  createdAt: string;
}

export interface Statistics {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  lateReleasedBookings: number;
  roomChangedBookings: number;
  totalRevenue: number;
  averageRevenue: number;
  topCustomers: { customerId: string; customerName: string; bookingCount: number }[];
  roomUtilization: { roomId: string; roomName: string; utilizationRate: number }[];
}
