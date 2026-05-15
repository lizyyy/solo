import { BusReservation } from './types';
import * as crypto from 'crypto';

const EMPLOYEE_DATA = [
  { employeeId: 'E001', employeeName: '张三', department: '技术部' },
  { employeeId: 'E002', employeeName: '李四', department: '产品部' },
  { employeeId: 'E003', employeeName: '王五', department: '市场部' },
  { employeeId: 'E004', employeeName: '赵六', department: '人力资源部' },
  { employeeId: 'E005', employeeName: '钱七', department: '财务部' },
  { employeeId: 'E006', employeeName: '孙八', department: '技术部' },
  { employeeId: 'E007', employeeName: '周九', department: '运营部' },
  { employeeId: 'E008', employeeName: '吴十', department: '技术部' },
  { employeeId: 'E009', employeeName: '郑十一', department: '产品部' },
  { employeeId: 'E010', employeeName: '王十二', department: '市场部' },
];

const BUS_ROUTES = [
  'A线-科技园直达',
  'B线-市中心环线',
  'C线-工业区专线',
  'D线-住宅区快线',
];

const BUS_STOPS = [
  '南门站',
  '北门站',
  '地铁站接驳点',
  '商业中心站',
  '科技园东门',
];

const TIME_SLOTS = ['07:30', '08:00', '08:30', '09:00', '17:30', '18:00', '18:30', '19:00'];

const DATES = ['2024-05-15', '2024-05-16', '2024-05-17', '2024-05-18', '2024-05-19'];

export function generateId(): string {
  return 'RES-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateReservation(overrides: Partial<BusReservation> = {}): BusReservation {
  const employee = pickRandom(EMPLOYEE_DATA);
  const now = new Date().toISOString();
  
  return {
    id: overrides.id !== undefined ? overrides.id : generateId(),
    employeeId: overrides.employeeId !== undefined ? overrides.employeeId : employee.employeeId,
    employeeName: overrides.employeeName !== undefined ? overrides.employeeName : employee.employeeName,
    department: overrides.department !== undefined ? overrides.department : employee.department,
    busRoute: overrides.busRoute !== undefined ? overrides.busRoute : pickRandom(BUS_ROUTES),
    busStop: overrides.busStop !== undefined ? overrides.busStop : pickRandom(BUS_STOPS),
    date: overrides.date !== undefined ? overrides.date : pickRandom(DATES),
    timeSlot: overrides.timeSlot !== undefined ? overrides.timeSlot : pickRandom(TIME_SLOTS),
    status: overrides.status !== undefined ? overrides.status : 'confirmed',
    createdAt: overrides.createdAt !== undefined ? overrides.createdAt : now,
    updatedAt: overrides.updatedAt !== undefined ? overrides.updatedAt : now,
    source: overrides.source !== undefined ? overrides.source : 'web-portal',
    version: overrides.version !== undefined ? overrides.version : 1,
  };
}

export function generateBatchReservations(count: number): BusReservation[] {
  const reservations: BusReservation[] = [];
  for (let i = 0; i < count; i++) {
    reservations.push(generateReservation());
  }
  return reservations;
}

export function generateConcurrentConflictScenario(): {
  original: BusReservation;
  writerA: BusReservation;
  writerB: BusReservation;
  finalOverwritten: BusReservation;
} {
  const baseTime = new Date();
  const original = generateReservation({
    id: 'RES-CONFLICT-001',
    employeeId: 'E001',
    employeeName: '张三',
    busRoute: 'A线-科技园直达',
    busStop: '南门站',
    date: '2024-05-20',
    timeSlot: '08:00',
    status: 'pending',
    createdAt: baseTime.toISOString(),
    updatedAt: baseTime.toISOString(),
    source: 'initial-booking',
    version: 1,
  });

  const timeA = new Date(baseTime.getTime() + 100);
  const writerA = {
    ...original,
    busStop: '北门站',
    status: 'confirmed' as const,
    updatedAt: timeA.toISOString(),
    source: 'mobile-app-writer-A',
    version: 2,
  };

  const timeB = new Date(baseTime.getTime() + 150);
  const writerB = {
    ...original,
    timeSlot: '08:30',
    busRoute: 'B线-市中心环线',
    status: 'confirmed' as const,
    updatedAt: timeB.toISOString(),
    source: 'web-portal-writer-B',
    version: 2,
  };

  const timeFinal = new Date(baseTime.getTime() + 200);
  const finalOverwritten = {
    ...writerB,
    updatedAt: timeFinal.toISOString(),
    source: 'final-state-after-overwrite',
    version: 2,
  };

  return { original, writerA, writerB, finalOverwritten };
}

export function generateTrainingEnvironmentData(): {
  normalReservations: BusReservation[];
  conflictScenario: ReturnType<typeof generateConcurrentConflictScenario>;
  allReservations: BusReservation[];
} {
  const normalReservations = generateBatchReservations(15);
  const conflictScenario = generateConcurrentConflictScenario();
  
  const allReservations = [
    ...normalReservations,
    conflictScenario.original,
    conflictScenario.writerA,
    conflictScenario.writerB,
    conflictScenario.finalOverwritten,
  ];

  return { normalReservations, conflictScenario, allReservations };
}

export function getEmployeeData() {
  return EMPLOYEE_DATA;
}

export function getBusRoutes() {
  return BUS_ROUTES;
}

export function getBusStops() {
  return BUS_STOPS;
}

export function getTimeSlots() {
  return TIME_SLOTS;
}

export function getDates() {
  return DATES;
}
