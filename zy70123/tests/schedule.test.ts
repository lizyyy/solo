import { DatabaseService, setDbInstance } from '../src/database';
import { scheduleService } from '../src/services/ScheduleService';
import { compensationService } from '../src/services/CompensationService';
import { ConflictType, CompensationType, TaskStatus } from '../src/types';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-cinema-data.json');

let db: DatabaseService;

beforeAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  db = new DatabaseService(TEST_DB_PATH);
  setDbInstance(db);
});

afterAll(() => {
  db.close();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

describe('影厅排片冲突检测 - 主流程', () => {
  test('创建正常排片应无冲突', async () => {
    const hall = db.createHall('影厅1', 100);
    const movie = db.createMovie('电影A', 120);
    const now = Date.now();
    db.createKey(movie.id, now - 86400000, now + 86400000 * 7);

    const result = await scheduleService.createSchedule(
      hall.id,
      movie.id,
      now + 3600000
    );

    expect(result.success).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    expect(result.conflictReports).toHaveLength(0);
    expect(result.schedule.ticketLock).toBe(false);
  });

  test('排片时间重叠应检测到冲突并锁定售票', async () => {
    const hall = db.createHall('影厅2', 100);
    const movie = db.createMovie('电影B', 120);
    const now = Date.now();
    db.createKey(movie.id, now - 86400000, now + 86400000 * 7);

    const schedule1 = await scheduleService.createSchedule(
      hall.id,
      movie.id,
      now + 3600000
    );
    expect(schedule1.success).toBe(true);

    const schedule2 = await scheduleService.createSchedule(
      hall.id,
      movie.id,
      now + 3600000 + 30 * 60 * 1000
    );

    expect(schedule2.success).toBe(false);
    expect(schedule2.conflicts).toHaveLength(1);
    expect(schedule2.conflicts[0].type).toBe(ConflictType.TIME_OVERLAP);
    expect(schedule2.conflicts[0].severity).toBe('high');
    expect(schedule2.schedule.ticketLock).toBe(true);
    expect(schedule2.ticketLocks).toHaveLength(1);
    expect(schedule2.compensationTasks.length).toBeGreaterThan(0);
  });

  test('排片在密钥窗口外应检测到冲突', async () => {
    const hall = db.createHall('影厅3', 100);
    const movie = db.createMovie('电影C', 120);
    const now = Date.now();
    db.createKey(movie.id, now - 86400000 * 14, now - 86400000 * 7);

    const result = await scheduleService.createSchedule(
      hall.id,
      movie.id,
      now + 3600000
    );

    expect(result.success).toBe(false);
    expect(result.conflicts.some(c => c.type === ConflictType.KEY_WINDOW)).toBe(true);
    expect(result.schedule.ticketLock).toBe(true);
  });

  test('清洁时间不足应检测到冲突', async () => {
    const hall = db.createHall('影厅4', 100);
    const movie = db.createMovie('电影D', 120);
    const now = Date.now();
    db.createKey(movie.id, now - 86400000, now + 86400000 * 7);
    db.createCleaningRule(hall.id, 20);

    const schedule1 = await scheduleService.createSchedule(
      hall.id,
      movie.id,
      now + 3600000
    );
    expect(schedule1.success).toBe(true);

    const schedule2Start = schedule1.schedule.endAt + 10 * 60 * 1000;
    const schedule2 = await scheduleService.createSchedule(
      hall.id,
      movie.id,
      schedule2Start
    );

    expect(schedule2.success).toBe(false);
    expect(schedule2.conflicts.some(c => c.type === ConflictType.CLEANING_GAP)).toBe(true);
    expect(schedule2.conflicts.find(c => c.type === ConflictType.CLEANING_GAP)?.severity).toBe('medium');
  });
});

describe('补偿机制 - 边界场景', () => {
  test('补偿任务失败后应可重试', async () => {
    const hall = db.createHall('影厅5', 100);
    const movie = db.createMovie('电影E', 120);
    const now = Date.now();
    db.createKey(movie.id, now - 86400000, now + 86400000 * 7);

    const schedule1 = await scheduleService.createSchedule(
      hall.id,
      movie.id,
      now + 3600000
    );

    const tasks = compensationService.createCompensationTasks(
      schedule1.schedule.id,
      [CompensationType.VOUCHER],
      { userId: 'test-user', voucherAmount: 50 },
      3
    );
    expect(tasks).toHaveLength(1);

    const result1 = await compensationService.executeTask(tasks[0].id);
    expect(result1.success).toBe(true);
    expect(result1.status).toBe(TaskStatus.SUCCESS);

    const tasks2 = compensationService.createCompensationTasks(
      schedule1.schedule.id,
      [CompensationType.VOUCHER],
      { userId: null, voucherAmount: 50 },
      3
    );

    const result2 = await compensationService.executeTask(tasks2[0].id);
    expect(result2.success).toBe(false);
    expect(result2.attempts).toBe(1);

    const result3 = await compensationService.retryTask(tasks2[0].id);
    expect(result3.attempts).toBe(2);
  });

  test('超过最大重试次数的任务应不再执行', async () => {
    const hall = db.createHall('影厅6', 100);
    const movie = db.createMovie('电影F', 120);
    const now = Date.now();
    db.createKey(movie.id, now - 86400000, now + 86400000 * 7);

    const schedule = await scheduleService.createSchedule(
      hall.id,
      movie.id,
      now + 3600000
    );

    const tasks = compensationService.createCompensationTasks(
      schedule.schedule.id,
      [CompensationType.VOUCHER],
      { userId: null, voucherAmount: 50 },
      2
    );

    await compensationService.executeTask(tasks[0].id);
    await compensationService.executeTask(tasks[0].id);

    const taskStatus = compensationService.getTaskStatus(tasks[0].id)!;
    expect(taskStatus.attempts).toBe(2);
    expect(taskStatus.status).toBe(TaskStatus.FAILED);

    const result = await compensationService.executeTask(tasks[0].id);
    expect(result.attempts).toBe(2);
    expect(result.success).toBe(false);
  });

  test('退款补偿任务应正确执行', async () => {
    const hall = db.createHall('影厅7', 100);
    const movie = db.createMovie('电影G', 120);
    const now = Date.now();
    db.createKey(movie.id, now - 86400000, now + 86400000 * 7);

    const schedule = await scheduleService.createSchedule(
      hall.id,
      movie.id,
      now + 3600000
    );

    const tasks = compensationService.createCompensationTasks(
      schedule.schedule.id,
      [CompensationType.REFUND],
      { ticketIds: ['TK001', 'TK002'], amount: 100 },
      1
    );

    const result = await compensationService.executeTask(tasks[0].id);
    expect(result.success).toBe(true);
    expect(result.result?.refundId).toBeDefined();
    expect(result.result?.amount).toBe(100);
  });
});

describe('边界场景 - 极端情况', () => {
  test('影片无密钥应检测到冲突', async () => {
    const hall = db.createHall('影厅8', 100);
    const movie = db.createMovie('电影H', 120);
    const now = Date.now();

    const result = await scheduleService.createSchedule(
      hall.id,
      movie.id,
      now + 3600000
    );

    expect(result.success).toBe(false);
    expect(result.conflicts.some(c => c.type === ConflictType.KEY_WINDOW)).toBe(true);
  });

  test('排片刚好满足清洁时间应无冲突', async () => {
    const hall = db.createHall('影厅9', 100);
    const movie = db.createMovie('电影I', 120);
    const now = Date.now();
    db.createKey(movie.id, now - 86400000, now + 86400000 * 7);
    db.createCleaningRule(hall.id, 20);

    const schedule1 = await scheduleService.createSchedule(
      hall.id,
      movie.id,
      now + 3600000
    );
    expect(schedule1.success).toBe(true);

    const schedule2Start = schedule1.schedule.endAt + 20 * 60 * 1000;
    const schedule2 = await scheduleService.createSchedule(
      hall.id,
      movie.id,
      schedule2Start
    );

    expect(schedule2.success).toBe(true);
    expect(schedule2.conflicts).toHaveLength(0);
  });

  test('解锁售票后应可再次查询状态', async () => {
    const hall = db.createHall('影厅10', 100);
    const movie = db.createMovie('电影J', 120);
    const now = Date.now();
    db.createKey(movie.id, now - 86400000, now + 86400000 * 7);

    const schedule1 = await scheduleService.createSchedule(
      hall.id,
      movie.id,
      now + 3600000
    );

    const schedule2 = await scheduleService.createSchedule(
      hall.id,
      movie.id,
      now + 3600000 + 30 * 60 * 1000
    );

    expect(schedule2.schedule.ticketLock).toBe(true);

    scheduleService.unlockScheduleTickets(schedule2.schedule.id);

    const updatedSchedule = scheduleService.getSchedule(schedule2.schedule.id)!;
    expect(updatedSchedule.ticketLock).toBe(false);
  });
});
