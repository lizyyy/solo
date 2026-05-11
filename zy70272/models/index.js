const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced'
};

const EQUIPMENT_STATUS = {
  AVAILABLE: 'available',
  IN_USE: 'in_use',
  MAINTENANCE: 'maintenance',
  EXPIRED: 'expired'
};

const WIND_DIRECTIONS = {
  NORTH: 'N',
  SOUTH: 'S',
  EAST: 'E',
  WEST: 'W',
  NORTH_EAST: 'NE',
  NORTH_WEST: 'NW',
  SOUTH_EAST: 'SE',
  SOUTH_WEST: 'SW'
};

const FLIGHT_STATUS = {
  DRAFT: 'draft',
  WEATHER_CHECK: 'weather_check',
  SCHEDULE_CHECK: 'schedule_check',
  EQUIPMENT_CHECK: 'equipment_check',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  NEEDS_REVIEW: 'needs_review'
};

let weatherData = [
  {
    id: 'w1',
    date: dayjs().format('YYYY-MM-DD'),
    timeSlot: 'morning',
    windDirection: 'E',
    windSpeed: 15,
    temperature: 22,
    visibility: 10,
    humidity: 60,
    isFlyable: true,
    minLevel: LEVELS.INTERMEDIATE
  },
  {
    id: 'w2',
    date: dayjs().format('YYYY-MM-DD'),
    timeSlot: 'afternoon',
    windDirection: 'SE',
    windSpeed: 25,
    temperature: 26,
    visibility: 8,
    humidity: 70,
    isFlyable: false,
    reason: '风速过高',
    minLevel: LEVELS.ADVANCED
  },
  {
    id: 'w3',
    date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    timeSlot: 'morning',
    windDirection: 'NE',
    windSpeed: 10,
    temperature: 20,
    visibility: 12,
    humidity: 55,
    isFlyable: true,
    minLevel: LEVELS.BEGINNER
  }
];

let coaches = [
  {
    id: 'c1',
    name: '张明',
    level: LEVELS.ADVANCED,
    phone: '13800138001',
    schedules: [
      { date: dayjs().format('YYYY-MM-DD'), timeSlot: 'morning', isAvailable: true },
      { date: dayjs().format('YYYY-MM-DD'), timeSlot: 'afternoon', isAvailable: false, reason: '休息' },
      { date: dayjs().add(1, 'day').format('YYYY-MM-DD'), timeSlot: 'morning', isAvailable: true }
    ]
  },
  {
    id: 'c2',
    name: '李华',
    level: LEVELS.INTERMEDIATE,
    phone: '13800138002',
    schedules: [
      { date: dayjs().format('YYYY-MM-DD'), timeSlot: 'morning', isAvailable: true },
      { date: dayjs().format('YYYY-MM-DD'), timeSlot: 'afternoon', isAvailable: true },
      { date: dayjs().add(1, 'day').format('YYYY-MM-DD'), timeSlot: 'morning', isAvailable: false, reason: '培训' }
    ]
  },
  {
    id: 'c3',
    name: '王强',
    level: LEVELS.BEGINNER,
    phone: '13800138003',
    schedules: [
      { date: dayjs().format('YYYY-MM-DD'), timeSlot: 'morning', isAvailable: false, reason: '设备维护' },
      { date: dayjs().format('YYYY-MM-DD'), timeSlot: 'afternoon', isAvailable: true },
      { date: dayjs().add(1, 'day').format('YYYY-MM-DD'), timeSlot: 'morning', isAvailable: true }
    ]
  }
];

let students = [
  {
    id: 's1',
    name: '赵小白',
    level: LEVELS.BEGINNER,
    age: 25,
    phone: '13900139001',
    totalFlights: 5,
    lastFlightDate: dayjs().subtract(7, 'day').format('YYYY-MM-DD')
  },
  {
    id: 's2',
    name: '钱中间',
    level: LEVELS.INTERMEDIATE,
    age: 30,
    phone: '13900139002',
    totalFlights: 30,
    lastFlightDate: dayjs().subtract(2, 'day').format('YYYY-MM-DD')
  },
  {
    id: 's3',
    name: '孙高手',
    level: LEVELS.ADVANCED,
    age: 35,
    phone: '13900139003',
    totalFlights: 100,
    lastFlightDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  }
];

let equipment = [
  {
    id: 'e1',
    name: '滑翔伞 Alpha-1',
    type: 'canopy',
    status: EQUIPMENT_STATUS.AVAILABLE,
    lastCheckDate: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
    nextCheckDate: dayjs().add(23, 'day').format('YYYY-MM-DD'),
    maxWindSpeed: 20,
    suitableLevels: [LEVELS.BEGINNER, LEVELS.INTERMEDIATE, LEVELS.ADVANCED]
  },
  {
    id: 'e2',
    name: '滑翔伞 Beta-2',
    type: 'canopy',
    status: EQUIPMENT_STATUS.AVAILABLE,
    lastCheckDate: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
    nextCheckDate: dayjs().add(27, 'day').format('YYYY-MM-DD'),
    maxWindSpeed: 25,
    suitableLevels: [LEVELS.INTERMEDIATE, LEVELS.ADVANCED]
  },
  {
    id: 'e3',
    name: '伞具 Gamma-3',
    type: 'canopy',
    status: EQUIPMENT_STATUS.MAINTENANCE,
    lastCheckDate: dayjs().subtract(60, 'day').format('YYYY-MM-DD'),
    nextCheckDate: dayjs().add(0, 'day').format('YYYY-MM-DD'),
    maxWindSpeed: 18,
    suitableLevels: [LEVELS.BEGINNER, LEVELS.INTERMEDIATE]
  },
  {
    id: 'e4',
    name: '备份伞 S-1',
    type: 'reserve',
    status: EQUIPMENT_STATUS.AVAILABLE,
    lastCheckDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    nextCheckDate: dayjs().add(335, 'day').format('YYYY-MM-DD'),
    maxWindSpeed: 30,
    suitableLevels: [LEVELS.BEGINNER, LEVELS.INTERMEDIATE, LEVELS.ADVANCED]
  },
  {
    id: 'e5',
    name: '头盔 H-1',
    type: 'helmet',
    status: EQUIPMENT_STATUS.AVAILABLE,
    lastCheckDate: dayjs().subtract(14, 'day').format('YYYY-MM-DD'),
    nextCheckDate: dayjs().add(351, 'day').format('YYYY-MM-DD'),
    maxWindSpeed: 50,
    suitableLevels: [LEVELS.BEGINNER, LEVELS.INTERMEDIATE, LEVELS.ADVANCED]
  }
];

let flightRequests = [];

let approvalLogs = [];

let safetyReports = [];

const createId = () => uuidv4();

module.exports = {
  LEVELS,
  EQUIPMENT_STATUS,
  WIND_DIRECTIONS,
  FLIGHT_STATUS,
  weatherData,
  coaches,
  students,
  equipment,
  flightRequests,
  approvalLogs,
  safetyReports,
  createId
};
