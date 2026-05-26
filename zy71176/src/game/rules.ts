import type { Room, Guest, Cleaner } from './types';

export interface RuleCheckResult {
  valid: boolean;
  violation?: string;
  scoreChange: number;
  satisfactionChange: number;
  complaint: boolean;
}

export function canAssignRoom(room: Room): RuleCheckResult {
  if (room.status === 'dirty') {
    return {
      valid: false,
      violation: '脏房不能直接分配给客人',
      scoreChange: -15,
      satisfactionChange: -20,
      complaint: true,
    };
  }

  if (room.status === 'maintenance') {
    return {
      valid: false,
      violation: '维修中的房间不能分配',
      scoreChange: -20,
      satisfactionChange: -25,
      complaint: true,
    };
  }

  if (room.status === 'occupied') {
    return {
      valid: false,
      violation: '该房间已有客人入住',
      scoreChange: -10,
      satisfactionChange: -15,
      complaint: true,
    };
  }

  return {
    valid: true,
    scoreChange: 10,
    satisfactionChange: 5,
    complaint: false,
  };
}

export function canDispatchCleaner(cleaner: Cleaner, room: Room): RuleCheckResult {
  if (cleaner.status !== 'idle') {
    return {
      valid: false,
      violation: '该保洁人员正在工作中',
      scoreChange: 0,
      satisfactionChange: 0,
      complaint: false,
    };
  }

  if (room.status !== 'dirty') {
    return {
      valid: false,
      violation: '该房间不需要清洁',
      scoreChange: 0,
      satisfactionChange: 0,
      complaint: false,
    };
  }

  return {
    valid: true,
    scoreChange: 0,
    satisfactionChange: 0,
    complaint: false,
  };
}

export function checkExtendRequest(
  _guest: Guest,
  room: Room | undefined,
  nextGuest: Guest | undefined
): RuleCheckResult {
  if (!room) {
    return {
      valid: false,
      violation: '找不到该客人的房间信息',
      scoreChange: 0,
      satisfactionChange: 0,
      complaint: false,
    };
  }

  if (nextGuest) {
    return {
      valid: false,
      violation: '该房间已有下一位客人预订',
      scoreChange: -5,
      satisfactionChange: -10,
      complaint: false,
    };
  }

  return {
    valid: true,
    scoreChange: 5,
    satisfactionChange: 10,
    complaint: false,
  };
}

export function checkGameOver(
  score: number,
  complaints: number,
  satisfaction: number,
  maxComplaints: number,
  minSatisfaction: number
): { gameOver: boolean; reason?: string } {
  if (complaints >= maxComplaints) {
    return {
      gameOver: true,
      reason: `客诉次数达到上限 (${complaints}/${maxComplaints})，酒店运营失败`,
    };
  }

  if (satisfaction < minSatisfaction) {
    return {
      gameOver: true,
      reason: `客人满意度低于最低要求 (${satisfaction}%/${minSatisfaction}%)，酒店评级下降`,
    };
  }

  if (score < -100) {
    return {
      gameOver: true,
      reason: '分数过低，酒店濒临破产',
    };
  }

  return { gameOver: false };
}

export function calculateCleaningTime(_room: Room): number {
  const baseTime = 8;
  return baseTime;
}

export function calculateMaintenanceTime(): number {
  return 15;
}

export function calculateGuestSatisfactionChange(
  waitTime: number,
  roomReady: boolean,
  hasSpecialRequest: boolean,
  specialRequestFulfilled: boolean
): number {
  let change = 0;

  if (waitTime > 10) {
    change -= 15;
  } else if (waitTime > 5) {
    change -= 8;
  }

  if (!roomReady) {
    change -= 20;
  }

  if (hasSpecialRequest) {
    if (specialRequestFulfilled) {
      change += 10;
    } else {
      change -= 10;
    }
  }

  return change;
}

export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) + 8;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function getRoomStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    empty: '空房',
    dirty: '脏房',
    occupied: '已入住',
    maintenance: '维修中',
    extend: '续住申请',
  };
  return statusMap[status] || status;
}

export function getGuestStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    waiting: '等待入住',
    'checked-in': '已入住',
    'checked-out': '已退房',
    complained: '已投诉',
    left: '已离开',
  };
  return statusMap[status] || status;
}
