// 泳道类型
export interface Lane {
  id: string;
  number: number;
  length: number; // 长度：25 米或 50 米
  name: string;
  isActive: boolean;
}

// 时段类型
export interface TimeSlot {
  id: string;
  startTime: string; // HH:mm 格式
  endTime: string; // HH:mm 格式
  date: string; // YYYY-MM-DD 格式
}

// 预约类型
export const BookingType = {
  TEAM: 'team',
  INDIVIDUAL: 'individual',
  PRIVATE: 'private',
} as const;

export type BookingType = typeof BookingType[keyof typeof BookingType];

// 预约状态
export const BookingStatus = {
  CONFIRMED: 'confirmed',
  PENDING: 'pending',
  CONFLICT: 'conflict',
  CANCELLED: 'cancelled',
} as const;

export type BookingStatus = typeof BookingStatus[keyof typeof BookingStatus];

// 预约基础接口
export interface BaseBooking {
  id: string;
  laneId: string;
  timeSlotId: string;
  type: BookingType;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

// 训练队预约
export interface TeamBooking extends BaseBooking {
  type: 'team';
  teamName: string;
  coachName: string;
  teamSize: number;
  description?: string;
}

// 散客预约
export interface IndividualBooking extends BaseBooking {
  type: 'individual';
  customerName: string;
  phone: string;
  swimmerLevel: 'beginner' | 'intermediate' | 'advanced';
}

// 私教预约
export interface PrivateBooking extends BaseBooking {
  type: 'private';
  customerName: string;
  coachName: string;
  phone: string;
  sessionGoal?: string;
}

// 联合预约类型
export type Booking = TeamBooking | IndividualBooking | PrivateBooking;

// 冲突类型
export interface Conflict {
  id: string;
  bookingId1: string;
  bookingId2: string;
  laneId: string;
  timeSlotId: string;
  type: 'time_overlap' | 'lane_length_mismatch' | 'capacity_exceeded';
  message: string;
}

// 操作历史
export interface OperationHistory {
  id: string;
  timestamp: string;
  action: 'create' | 'update' | 'delete' | 'move';
  entityType: 'booking' | 'lane' | 'timeslot';
  entityId: string;
  description: string;
  oldValue?: string;
  newValue?: string;
}

// 应用状态
export interface AppState {
  lanes: Lane[];
  timeSlots: TimeSlot[];
  bookings: Booking[];
  conflicts: Conflict[];
  history: OperationHistory[];
  selectedDate: string;
}
