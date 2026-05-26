import type { LevelConfig } from './types';

const avatars = ['👨', '👩', '👴', '👵', '🧑', '👱', '👲', '👳', '🧔', '👨‍💼', '👩‍💼', '🧑‍💻'];

const guestNames = [
  '张先生', '李女士', '王先生', '刘女士', '陈先生',
  '杨女士', '赵先生', '黄女士', '周先生', '吴女士',
  '徐先生', '孙女士', '马先生', '朱女士', '胡先生'
];

export const levels: LevelConfig[] = [
  {
    id: 1,
    name: '新手入门',
    description: '学习基本的客房分配和保洁调度',
    difficulty: 'easy',
    roomCount: 6,
    cleanerCount: 2,
    duration: 60,
    guestArrivalRate: 8,
    presetGuests: [
      {
        name: guestNames[0],
        avatar: avatars[0],
        arrivalTime: 5,
        stayDuration: 15,
      },
      {
        name: guestNames[1],
        avatar: avatars[1],
        arrivalTime: 10,
        stayDuration: 20,
      },
      {
        name: guestNames[2],
        avatar: avatars[2],
        arrivalTime: 15,
        stayDuration: 12,
      },
      {
        name: guestNames[3],
        avatar: avatars[3],
        arrivalTime: 25,
        stayDuration: 18,
      },
      {
        name: guestNames[4],
        avatar: avatars[4],
        arrivalTime: 35,
        stayDuration: 15,
      },
    ],
    presetEvents: [],
    winConditions: {
      minSatisfaction: 70,
      maxComplaints: 2,
      minScore: 50,
    },
  },
  {
    id: 2,
    name: '早到风波',
    description: '处理客人早到的情况，合理安排房间',
    difficulty: 'medium',
    roomCount: 8,
    cleanerCount: 2,
    duration: 90,
    guestArrivalRate: 6,
    presetGuests: [
      {
        name: guestNames[0],
        avatar: avatars[0],
        arrivalTime: 5,
        stayDuration: 20,
      },
      {
        name: guestNames[1],
        avatar: avatars[1],
        arrivalTime: 20,
        stayDuration: 25,
        earlyArrival: 8,
      },
      {
        name: guestNames[2],
        avatar: avatars[2],
        arrivalTime: 25,
        stayDuration: 15,
      },
      {
        name: guestNames[3],
        avatar: avatars[3],
        arrivalTime: 35,
        stayDuration: 20,
        earlyArrival: 10,
      },
      {
        name: guestNames[4],
        avatar: avatars[4],
        arrivalTime: 45,
        stayDuration: 18,
      },
      {
        name: guestNames[5],
        avatar: avatars[5],
        arrivalTime: 55,
        stayDuration: 22,
      },
      {
        name: guestNames[6],
        avatar: avatars[6],
        arrivalTime: 65,
        stayDuration: 15,
        earlyArrival: 5,
      },
    ],
    presetEvents: [
      {
        time: 30,
        type: 'complaint',
        data: { type: 'clean_delay' },
        message: '保洁进度滞后，有客人开始不满',
      },
    ],
    winConditions: {
      minSatisfaction: 65,
      maxComplaints: 3,
      minScore: 80,
    },
  },
  {
    id: 3,
    name: '续住危机',
    description: '应对突发的续住申请，避免房间冲突',
    difficulty: 'medium',
    roomCount: 8,
    cleanerCount: 2,
    duration: 120,
    guestArrivalRate: 5,
    presetGuests: [
      {
        name: guestNames[0],
        avatar: avatars[0],
        arrivalTime: 5,
        stayDuration: 20,
        willExtend: true,
        extendNights: 10,
      },
      {
        name: guestNames[1],
        avatar: avatars[1],
        arrivalTime: 10,
        stayDuration: 25,
      },
      {
        name: guestNames[2],
        avatar: avatars[2],
        arrivalTime: 20,
        stayDuration: 30,
        willExtend: true,
        extendNights: 15,
      },
      {
        name: guestNames[3],
        avatar: avatars[3],
        arrivalTime: 30,
        stayDuration: 15,
      },
      {
        name: guestNames[4],
        avatar: avatars[4],
        arrivalTime: 40,
        stayDuration: 25,
        earlyArrival: 8,
      },
      {
        name: guestNames[5],
        avatar: avatars[5],
        arrivalTime: 50,
        stayDuration: 20,
      },
      {
        name: guestNames[6],
        avatar: avatars[6],
        arrivalTime: 60,
        stayDuration: 18,
        willExtend: true,
        extendNights: 12,
      },
      {
        name: guestNames[7],
        avatar: avatars[7],
        arrivalTime: 75,
        stayDuration: 25,
      },
      {
        name: guestNames[8],
        avatar: avatars[8],
        arrivalTime: 85,
        stayDuration: 20,
        earlyArrival: 10,
      },
    ],
    presetEvents: [
      {
        time: 25,
        type: 'complaint',
        data: { type: 'room_not_ready' },
        message: '有客人抱怨房间准备太慢',
      },
      {
        time: 55,
        type: 'complaint',
        data: { type: 'extend_delayed' },
        message: '续住申请处理太慢，客人不满',
      },
    ],
    winConditions: {
      minSatisfaction: 60,
      maxComplaints: 4,
      minScore: 120,
    },
  },
  {
    id: 4,
    name: '维修风暴',
    description: '房间突发维修问题，考验应急处理能力',
    difficulty: 'hard',
    roomCount: 10,
    cleanerCount: 3,
    duration: 150,
    guestArrivalRate: 4,
    presetGuests: [
      {
        name: guestNames[0],
        avatar: avatars[0],
        arrivalTime: 3,
        stayDuration: 25,
      },
      {
        name: guestNames[1],
        avatar: avatars[1],
        arrivalTime: 8,
        stayDuration: 30,
        willExtend: true,
        extendNights: 15,
      },
      {
        name: guestNames[2],
        avatar: avatars[2],
        arrivalTime: 15,
        stayDuration: 20,
      },
      {
        name: guestNames[3],
        avatar: avatars[3],
        arrivalTime: 25,
        stayDuration: 25,
        earlyArrival: 10,
      },
      {
        name: guestNames[4],
        avatar: avatars[4],
        arrivalTime: 35,
        stayDuration: 18,
      },
      {
        name: guestNames[5],
        avatar: avatars[5],
        arrivalTime: 45,
        stayDuration: 30,
        willExtend: true,
        extendNights: 20,
      },
      {
        name: guestNames[6],
        avatar: avatars[6],
        arrivalTime: 55,
        stayDuration: 22,
        earlyArrival: 8,
      },
      {
        name: guestNames[7],
        avatar: avatars[7],
        arrivalTime: 70,
        stayDuration: 25,
      },
      {
        name: guestNames[8],
        avatar: avatars[8],
        arrivalTime: 85,
        stayDuration: 20,
        willExtend: true,
        extendNights: 10,
      },
      {
        name: guestNames[9],
        avatar: avatars[9],
        arrivalTime: 100,
        stayDuration: 28,
        earlyArrival: 12,
      },
      {
        name: guestNames[10],
        avatar: avatars[10],
        arrivalTime: 115,
        stayDuration: 20,
      },
    ],
    presetEvents: [
      {
        time: 20,
        type: 'complaint',
        data: { type: 'maintenance' },
        message: '102房间水管漏水，需要维修',
      },
      {
        time: 50,
        type: 'complaint',
        data: { type: 'maintenance' },
        message: '203房间空调故障，需要维修',
      },
      {
        time: 80,
        type: 'complaint',
        data: { type: 'room_not_ready' },
        message: '房间清洁太慢，多位客人等待',
      },
      {
        time: 110,
        type: 'complaint',
        data: { type: 'maintenance' },
        message: '105房间门锁故障，需要维修',
      },
    ],
    winConditions: {
      minSatisfaction: 55,
      maxComplaints: 5,
      minScore: 180,
    },
  },
];

export function getLevelById(id: number): LevelConfig | undefined {
  return levels.find(level => level.id === id);
}

export function getRandomGuestName(): string {
  return guestNames[Math.floor(Math.random() * guestNames.length)];
}

export function getRandomAvatar(): string {
  return avatars[Math.floor(Math.random() * avatars.length)];
}
