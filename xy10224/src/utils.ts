import type {
  Lane,
  TimeSlot,
  Booking,
  Conflict,
  OperationHistory,
  TeamBooking,
  IndividualBooking,
  PrivateBooking,
} from './types';
import { BookingType, BookingStatus } from './types';

// 生成唯一 ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

// 获取当前日期字符串
export const getCurrentDate = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// 格式化时间
export const formatTime = (date: Date): string => {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// 比较两个时间段是否有重叠
export const checkTimeOverlap = (
  slot1: { startTime: string; endTime: string },
  slot2: { startTime: string; endTime: string }
): boolean => {
  const start1 = parseInt(slot1.startTime.replace(':', ''));
  const end1 = parseInt(slot1.endTime.replace(':', ''));
  const start2 = parseInt(slot2.startTime.replace(':', ''));
  const end2 = parseInt(slot2.endTime.replace(':', ''));

  return !(end1 <= start2 || end2 <= start1);
};

// 获取预约类型的显示名称
export const getBookingTypeName = (type: BookingType): string => {
  const names: Record<BookingType, string> = {
    [BookingType.TEAM]: '训练队',
    [BookingType.INDIVIDUAL]: '散客',
    [BookingType.PRIVATE]: '私教课',
  };
  return names[type];
};

// 获取预约状态的显示名称
export const getBookingStatusName = (status: BookingStatus): string => {
  const names: Record<BookingStatus, string> = {
    [BookingStatus.CONFIRMED]: '已确认',
    [BookingStatus.PENDING]: '待复核',
    [BookingStatus.CONFLICT]: '有冲突',
    [BookingStatus.CANCELLED]: '已取消',
  };
  return names[status];
};

// 获取预约类型对应的颜色
export const getBookingTypeColor = (type: BookingType): string => {
  const colors: Record<BookingType, string> = {
    [BookingType.TEAM]: 'bg-blue-500',
    [BookingType.INDIVIDUAL]: 'bg-green-500',
    [BookingType.PRIVATE]: 'bg-purple-500',
  };
  return colors[type];
};

// 获取预约状态对应的颜色
export const getBookingStatusColor = (status: BookingStatus): string => {
  const colors: Record<BookingStatus, string> = {
    [BookingStatus.CONFIRMED]: 'bg-green-100 text-green-800',
    [BookingStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
    [BookingStatus.CONFLICT]: 'bg-red-100 text-red-800',
    [BookingStatus.CANCELLED]: 'bg-gray-100 text-gray-800',
  };
  return colors[status];
};

// 示例泳道数据
export const sampleLanes: Lane[] = [
  { id: 'lane1', number: 1, length: 50, name: '50米慢道', isActive: true },
  { id: 'lane2', number: 2, length: 50, name: '50米快道', isActive: true },
  { id: 'lane3', number: 3, length: 50, name: '50米训练道', isActive: true },
  { id: 'lane4', number: 4, length: 25, name: '25米练习道', isActive: true },
  { id: 'lane5', number: 5, length: 25, name: '25米初学道', isActive: true },
];

// 示例时段数据
export const sampleTimeSlots: TimeSlot[] = [
  { id: 'slot1', startTime: '08:00', endTime: '09:00', date: getCurrentDate() },
  { id: 'slot2', startTime: '09:00', endTime: '10:00', date: getCurrentDate() },
  { id: 'slot3', startTime: '10:00', endTime: '11:00', date: getCurrentDate() },
  { id: 'slot4', startTime: '14:00', endTime: '15:00', date: getCurrentDate() },
  { id: 'slot5', startTime: '15:00', endTime: '16:00', date: getCurrentDate() },
  { id: 'slot6', startTime: '16:00', endTime: '17:00', date: getCurrentDate() },
  { id: 'slot7', startTime: '17:00', endTime: '18:00', date: getCurrentDate() },
  { id: 'slot8', startTime: '18:00', endTime: '19:00', date: getCurrentDate() },
];

// 顺利样例预约数据
export const sampleSmoothBookings: Booking[] = [
  {
    id: 'booking1',
    laneId: 'lane1',
    timeSlotId: 'slot1',
    type: BookingType.TEAM,
    status: BookingStatus.CONFIRMED,
    teamName: '市体校一队',
    coachName: '李教练',
    teamSize: 12,
    createdAt: formatTime(new Date()),
    updatedAt: formatTime(new Date()),
  } as TeamBooking,
  {
    id: 'booking2',
    laneId: 'lane2',
    timeSlotId: 'slot1',
    type: BookingType.INDIVIDUAL,
    status: BookingStatus.CONFIRMED,
    customerName: '张三',
    phone: '13800138001',
    swimmerLevel: 'advanced',
    createdAt: formatTime(new Date()),
    updatedAt: formatTime(new Date()),
  } as IndividualBooking,
  {
    id: 'booking3',
    laneId: 'lane3',
    timeSlotId: 'slot1',
    type: BookingType.PRIVATE,
    status: BookingStatus.CONFIRMED,
    customerName: '李四',
    coachName: '王教练',
    phone: '13800138002',
    sessionGoal: '自由泳技术提升',
    createdAt: formatTime(new Date()),
    updatedAt: formatTime(new Date()),
  } as PrivateBooking,
  {
    id: 'booking4',
    laneId: 'lane1',
    timeSlotId: 'slot2',
    type: BookingType.TEAM,
    status: BookingStatus.CONFIRMED,
    teamName: '市体校二队',
    coachName: '赵教练',
    teamSize: 10,
    createdAt: formatTime(new Date()),
    updatedAt: formatTime(new Date()),
  } as TeamBooking,
  {
    id: 'booking5',
    laneId: 'lane4',
    timeSlotId: 'slot2',
    type: BookingType.INDIVIDUAL,
    status: BookingStatus.CONFIRMED,
    customerName: '王五',
    phone: '13800138003',
    swimmerLevel: 'beginner',
    createdAt: formatTime(new Date()),
    updatedAt: formatTime(new Date()),
  } as IndividualBooking,
];

// 冲突样例预约数据
export const sampleConflictBookings: Booking[] = [
  {
    id: 'booking6',
    laneId: 'lane1',
    timeSlotId: 'slot1',
    type: BookingType.TEAM,
    status: BookingStatus.CONFLICT,
    teamName: '区业余队',
    coachName: '刘教练',
    teamSize: 8,
    createdAt: formatTime(new Date()),
    updatedAt: formatTime(new Date()),
  } as TeamBooking,
  {
    id: 'booking7',
    laneId: 'lane2',
    timeSlotId: 'slot2',
    type: BookingType.PRIVATE,
    status: BookingStatus.PENDING,
    customerName: '赵六',
    coachName: '孙教练',
    phone: '13800138004',
    sessionGoal: '蛙泳入门',
    createdAt: formatTime(new Date()),
    updatedAt: formatTime(new Date()),
  } as PrivateBooking,
];

// 创建操作历史记录
export const createHistoryRecord = (
  action: 'create' | 'update' | 'delete' | 'move',
  entityType: 'booking' | 'lane' | 'timeslot',
  entityId: string,
  description: string,
  oldValue?: string,
  newValue?: string
): OperationHistory => ({
  id: generateId(),
  timestamp: formatTime(new Date()),
  action,
  entityType,
  entityId,
  description,
  oldValue,
  newValue,
});

// 检测预约冲突
export const detectConflicts = (
  bookings: Booking[],
  _lanes: Lane[],
  timeSlots: TimeSlot[]
): Conflict[] => {
  const conflicts: Conflict[] = [];

  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      const b1 = bookings[i];
      const b2 = bookings[j];

      if (b1.laneId === b2.laneId && b1.timeSlotId === b2.timeSlotId) {
        const timeSlot1 = timeSlots.find(s => s.id === b1.timeSlotId);
        const timeSlot2 = timeSlots.find(s => s.id === b2.timeSlotId);
        
        if (timeSlot1 && timeSlot2 && checkTimeOverlap(timeSlot1, timeSlot2)) {
          const conflict: Conflict = {
            id: generateId(),
            bookingId1: b1.id,
            bookingId2: b2.id,
            laneId: b1.laneId,
            timeSlotId: b1.timeSlotId,
            type: 'time_overlap',
            message: `时间冲突：两个预约占用同一泳道的同一时段`,
          };
          conflicts.push(conflict);
        }
      }
    }
  }

  return conflicts;
};

// 导出日程为 CSV
export const exportScheduleToCSV = (
  bookings: Booking[],
  lanes: Lane[],
  timeSlots: TimeSlot[]
): string => {
  const headers = ['预约ID', '泳道', '时段', '类型', '状态', '客户/队伍', '教练', '电话', '备注'];
  const rows: string[] = [headers.join(',')];

  bookings.forEach((booking) => {
    const lane = lanes.find((l) => l.id === booking.laneId);
    const timeSlot = timeSlots.find((t) => t.id === booking.timeSlotId);

    let customerInfo = '';
    let coach = '';
    let phone = '';
    let notes = '';

    if (booking.type === BookingType.TEAM) {
      const teamBooking = booking as TeamBooking;
      customerInfo = teamBooking.teamName;
      coach = teamBooking.coachName;
      phone = '';
      notes = `队员数: ${teamBooking.teamSize}${teamBooking.description ? `, ${teamBooking.description}` : ''}`;
    } else if (booking.type === BookingType.INDIVIDUAL) {
      const individualBooking = booking as IndividualBooking;
      customerInfo = individualBooking.customerName;
      coach = '';
      phone = individualBooking.phone;
      const levelNames: Record<string, string> = {
        beginner: '初级',
        intermediate: '中级',
        advanced: '高级',
      };
      notes = `水平: ${levelNames[individualBooking.swimmerLevel]}`;
    } else if (booking.type === BookingType.PRIVATE) {
      const privateBooking = booking as PrivateBooking;
      customerInfo = privateBooking.customerName;
      coach = privateBooking.coachName;
      phone = privateBooking.phone;
      notes = privateBooking.sessionGoal || '';
    }

    const row = [
      booking.id,
      lane ? `${lane.name} (${lane.length}米)` : '未知',
      timeSlot ? `${timeSlot.startTime}-${timeSlot.endTime}` : '未知',
      getBookingTypeName(booking.type),
      getBookingStatusName(booking.status),
      customerInfo,
      coach,
      phone,
      notes,
    ];

    rows.push(row.map((cell) => `"${cell}"`).join(','));
  });

  return rows.join('\n');
};

// 下载文件
export const downloadFile = (content: string, filename: string, type: string = 'text/csv') => {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
