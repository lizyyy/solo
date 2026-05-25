import { Level, SIGNAL_ASPECTS, TRAIN_STATUSES } from '../types/game';

export const levels: Level[] = [
  {
    id: 1,
    name: '新手入门',
    description: '单线铁路，2列列车，学习基础信号调度。无检修窗口，熟悉信号切换操作。',
    difficulty: 'easy',
    stations: [
      { id: 'A', name: 'A站', position: { x: 50, y: 200 } },
      { id: 'B', name: 'B站', position: { x: 400, y: 200 } },
      { id: 'C', name: 'C站', position: { x: 750, y: 200 } }
    ],
    sections: [
      {
        id: 'S1',
        name: 'A-B区间',
        from: 'A',
        to: 'B',
        fromPos: { x: 50, y: 200 },
        toPos: { x: 400, y: 200 },
        length: 350,
        maintenance: [],
        bidirectional: true
      },
      {
        id: 'S2',
        name: 'B-C区间',
        from: 'B',
        to: 'C',
        fromPos: { x: 400, y: 200 },
        toPos: { x: 750, y: 200 },
        length: 350,
        maintenance: [],
        bidirectional: true
      }
    ],
    signals: [
      {
        id: 'SIG1',
        sectionId: 'S1',
        aspect: SIGNAL_ASPECTS.RED,
        position: { x: 70, y: 170 },
        direction: 'forward'
      },
      {
        id: 'SIG2',
        sectionId: 'S1',
        aspect: SIGNAL_ASPECTS.RED,
        position: { x: 380, y: 230 },
        direction: 'backward'
      },
      {
        id: 'SIG3',
        sectionId: 'S2',
        aspect: SIGNAL_ASPECTS.RED,
        position: { x: 420, y: 170 },
        direction: 'forward'
      },
      {
        id: 'SIG4',
        sectionId: 'S2',
        aspect: SIGNAL_ASPECTS.RED,
        position: { x: 730, y: 230 },
        direction: 'backward'
      }
    ],
    trains: [
      {
        id: 'T1',
        name: 'K101',
        route: ['S1', 'S2'],
        currentSectionIndex: -1,
        progress: 0,
        speed: 0,
        maxSpeed: 60,
        delay: 0,
        scheduledDeparture: 0,
        scheduledArrival: 400,
        status: TRAIN_STATUSES.WAITING,
        color: '#3b82f6',
        direction: 'forward'
      },
      {
        id: 'T2',
        name: 'K102',
        route: ['S2', 'S1'],
        currentSectionIndex: -1,
        progress: 1,
        speed: 0,
        maxSpeed: 60,
        delay: 0,
        scheduledDeparture: 100,
        scheduledArrival: 500,
        status: TRAIN_STATUSES.WAITING,
        color: '#ef4444',
        direction: 'backward'
      }
    ],
    targetScore: 150,
    timeLimit: 800
  },
  {
    id: 2,
    name: '复线挑战',
    description: '复线区间，4列列车，处理会让与越行。引入检修窗口，部分时段区间不可用。',
    difficulty: 'medium',
    stations: [
      { id: 'A', name: 'A站', position: { x: 50, y: 150 } },
      { id: 'B', name: 'B站', position: { x: 400, y: 150 } },
      { id: 'C', name: 'C站', position: { x: 750, y: 150 } },
      { id: 'D', name: 'D站', position: { x: 50, y: 300 } },
      { id: 'E', name: 'E站', position: { x: 750, y: 300 } }
    ],
    sections: [
      {
        id: 'S1',
        name: 'A-B上行',
        from: 'A',
        to: 'B',
        fromPos: { x: 50, y: 150 },
        toPos: { x: 400, y: 150 },
        length: 350,
        maintenance: [{ start: 200, end: 350 }],
        bidirectional: false
      },
      {
        id: 'S2',
        name: 'B-C上行',
        from: 'B',
        to: 'C',
        fromPos: { x: 400, y: 150 },
        toPos: { x: 750, y: 150 },
        length: 350,
        maintenance: [],
        bidirectional: false
      },
      {
        id: 'S3',
        name: 'D-E下行',
        from: 'D',
        to: 'E',
        fromPos: { x: 50, y: 300 },
        toPos: { x: 750, y: 300 },
        length: 700,
        maintenance: [{ start: 100, end: 200 }],
        bidirectional: true
      },
      {
        id: 'S4',
        name: '联络线',
        from: 'B',
        to: 'E',
        fromPos: { x: 400, y: 150 },
        toPos: { x: 750, y: 300 },
        length: 380,
        maintenance: [],
        bidirectional: true
      }
    ],
    signals: [
      { id: 'SIG1', sectionId: 'S1', aspect: SIGNAL_ASPECTS.RED, position: { x: 70, y: 120 }, direction: 'forward' },
      { id: 'SIG2', sectionId: 'S2', aspect: SIGNAL_ASPECTS.RED, position: { x: 420, y: 120 }, direction: 'forward' },
      { id: 'SIG3', sectionId: 'S3', aspect: SIGNAL_ASPECTS.RED, position: { x: 70, y: 270 }, direction: 'forward' },
      { id: 'SIG4', sectionId: 'S3', aspect: SIGNAL_ASPECTS.RED, position: { x: 730, y: 330 }, direction: 'backward' },
      { id: 'SIG5', sectionId: 'S4', aspect: SIGNAL_ASPECTS.RED, position: { x: 420, y: 170 }, direction: 'forward' },
      { id: 'SIG6', sectionId: 'S4', aspect: SIGNAL_ASPECTS.RED, position: { x: 730, y: 280 }, direction: 'backward' }
    ],
    trains: [
      {
        id: 'T1',
        name: 'G101',
        route: ['S1', 'S2'],
        currentSectionIndex: -1,
        progress: 0,
        speed: 0,
        maxSpeed: 80,
        delay: 0,
        scheduledDeparture: 0,
        scheduledArrival: 300,
        status: TRAIN_STATUSES.WAITING,
        color: '#3b82f6',
        direction: 'forward'
      },
      {
        id: 'T2',
        name: 'G102',
        route: ['S2', 'S1'],
        currentSectionIndex: -1,
        progress: 1,
        speed: 0,
        maxSpeed: 80,
        delay: 0,
        scheduledDeparture: 80,
        scheduledArrival: 380,
        status: TRAIN_STATUSES.WAITING,
        color: '#ef4444',
        direction: 'backward'
      },
      {
        id: 'T3',
        name: 'K201',
        route: ['S3'],
        currentSectionIndex: -1,
        progress: 0,
        speed: 0,
        maxSpeed: 50,
        delay: 0,
        scheduledDeparture: 50,
        scheduledArrival: 350,
        status: TRAIN_STATUSES.WAITING,
        color: '#10b981',
        direction: 'forward'
      },
      {
        id: 'T4',
        name: 'K202',
        route: ['S4'],
        currentSectionIndex: -1,
        progress: 1,
        speed: 0,
        maxSpeed: 55,
        delay: 0,
        scheduledDeparture: 150,
        scheduledArrival: 450,
        status: TRAIN_STATUSES.WAITING,
        color: '#f59e0b',
        direction: 'backward'
      }
    ],
    targetScore: 300,
    timeLimit: 1000
  },
  {
    id: 3,
    name: '枢纽调度',
    description: '多站多线，6列列车，交路复杂。密集晚点事件，连锁反应处理，多检修窗口。综合调度能力测试。',
    difficulty: 'hard',
    stations: [
      { id: 'A', name: 'A站', position: { x: 50, y: 100 } },
      { id: 'B', name: 'B站', position: { x: 300, y: 100 } },
      { id: 'C', name: 'C站', position: { x: 550, y: 100 } },
      { id: 'D', name: 'D站', position: { x: 800, y: 100 } },
      { id: 'E', name: 'E站', position: { x: 50, y: 250 } },
      { id: 'F', name: 'F站', position: { x: 800, y: 250 } },
      { id: 'G', name: 'G站', position: { x: 425, y: 350 } }
    ],
    sections: [
      {
        id: 'S1',
        name: 'A-B',
        from: 'A',
        to: 'B',
        fromPos: { x: 50, y: 100 },
        toPos: { x: 300, y: 100 },
        length: 250,
        maintenance: [{ start: 150, end: 250 }, { start: 500, end: 600 }],
        bidirectional: true
      },
      {
        id: 'S2',
        name: 'B-C',
        from: 'B',
        to: 'C',
        fromPos: { x: 300, y: 100 },
        toPos: { x: 550, y: 100 },
        length: 250,
        maintenance: [{ start: 300, end: 400 }],
        bidirectional: true
      },
      {
        id: 'S3',
        name: 'C-D',
        from: 'C',
        to: 'D',
        fromPos: { x: 550, y: 100 },
        toPos: { x: 800, y: 100 },
        length: 250,
        maintenance: [],
        bidirectional: true
      },
      {
        id: 'S4',
        name: 'E-F',
        from: 'E',
        to: 'F',
        fromPos: { x: 50, y: 250 },
        toPos: { x: 800, y: 250 },
        length: 750,
        maintenance: [{ start: 100, end: 200 }],
        bidirectional: true
      },
      {
        id: 'S5',
        name: 'B-G',
        from: 'B',
        to: 'G',
        fromPos: { x: 300, y: 100 },
        toPos: { x: 425, y: 350 },
        length: 270,
        maintenance: [],
        bidirectional: true
      },
      {
        id: 'S6',
        name: 'G-C',
        from: 'G',
        to: 'C',
        fromPos: { x: 425, y: 350 },
        toPos: { x: 550, y: 100 },
        length: 270,
        maintenance: [{ start: 400, end: 500 }],
        bidirectional: true
      }
    ],
    signals: [
      { id: 'SIG1', sectionId: 'S1', aspect: SIGNAL_ASPECTS.RED, position: { x: 70, y: 70 }, direction: 'forward' },
      { id: 'SIG2', sectionId: 'S1', aspect: SIGNAL_ASPECTS.RED, position: { x: 280, y: 130 }, direction: 'backward' },
      { id: 'SIG3', sectionId: 'S2', aspect: SIGNAL_ASPECTS.RED, position: { x: 320, y: 70 }, direction: 'forward' },
      { id: 'SIG4', sectionId: 'S2', aspect: SIGNAL_ASPECTS.RED, position: { x: 530, y: 130 }, direction: 'backward' },
      { id: 'SIG5', sectionId: 'S3', aspect: SIGNAL_ASPECTS.RED, position: { x: 570, y: 70 }, direction: 'forward' },
      { id: 'SIG6', sectionId: 'S3', aspect: SIGNAL_ASPECTS.RED, position: { x: 780, y: 130 }, direction: 'backward' },
      { id: 'SIG7', sectionId: 'S4', aspect: SIGNAL_ASPECTS.RED, position: { x: 70, y: 220 }, direction: 'forward' },
      { id: 'SIG8', sectionId: 'S4', aspect: SIGNAL_ASPECTS.RED, position: { x: 780, y: 280 }, direction: 'backward' },
      { id: 'SIG9', sectionId: 'S5', aspect: SIGNAL_ASPECTS.RED, position: { x: 310, y: 130 }, direction: 'forward' },
      { id: 'SIG10', sectionId: 'S5', aspect: SIGNAL_ASPECTS.RED, position: { x: 415, y: 330 }, direction: 'backward' },
      { id: 'SIG11', sectionId: 'S6', aspect: SIGNAL_ASPECTS.RED, position: { x: 435, y: 330 }, direction: 'forward' },
      { id: 'SIG12', sectionId: 'S6', aspect: SIGNAL_ASPECTS.RED, position: { x: 540, y: 130 }, direction: 'backward' }
    ],
    trains: [
      {
        id: 'T1',
        name: 'G001',
        route: ['S1', 'S2', 'S3'],
        currentSectionIndex: -1,
        progress: 0,
        speed: 0,
        maxSpeed: 90,
        delay: 0,
        scheduledDeparture: 0,
        scheduledArrival: 280,
        status: TRAIN_STATUSES.WAITING,
        color: '#3b82f6',
        direction: 'forward'
      },
      {
        id: 'T2',
        name: 'G002',
        route: ['S3', 'S2', 'S1'],
        currentSectionIndex: -1,
        progress: 1,
        speed: 0,
        maxSpeed: 90,
        delay: 0,
        scheduledDeparture: 60,
        scheduledArrival: 340,
        status: TRAIN_STATUSES.WAITING,
        color: '#ef4444',
        direction: 'backward'
      },
      {
        id: 'T3',
        name: 'K003',
        route: ['S4'],
        currentSectionIndex: -1,
        progress: 0,
        speed: 0,
        maxSpeed: 55,
        delay: 0,
        scheduledDeparture: 30,
        scheduledArrival: 380,
        status: TRAIN_STATUSES.WAITING,
        color: '#10b981',
        direction: 'forward'
      },
      {
        id: 'T4',
        name: 'K004',
        route: ['S1', 'S5', 'S6', 'S3'],
        currentSectionIndex: -1,
        progress: 0,
        speed: 0,
        maxSpeed: 65,
        delay: 0,
        scheduledDeparture: 100,
        scheduledArrival: 450,
        status: TRAIN_STATUSES.WAITING,
        color: '#f59e0b',
        direction: 'forward'
      },
      {
        id: 'T5',
        name: 'K005',
        route: ['S4'],
        currentSectionIndex: -1,
        progress: 1,
        speed: 0,
        maxSpeed: 55,
        delay: 0,
        scheduledDeparture: 150,
        scheduledArrival: 500,
        status: TRAIN_STATUSES.WAITING,
        color: '#8b5cf6',
        direction: 'backward'
      },
      {
        id: 'T6',
        name: 'G006',
        route: ['S3', 'S6', 'S5', 'S1'],
        currentSectionIndex: -1,
        progress: 1,
        speed: 0,
        maxSpeed: 80,
        delay: 0,
        scheduledDeparture: 200,
        scheduledArrival: 550,
        status: TRAIN_STATUSES.WAITING,
        color: '#ec4899',
        direction: 'backward'
      }
    ],
    targetScore: 500,
    timeLimit: 1200
  }
];
