import { getDb, generateId, now, saveDatabase, executeGet, executeAll } from '../database';
import { MealTimer, MealTimerStatus } from '../types';
import { BusinessError } from '../utils/response';
import { getOrderById } from './orderService';
import { logOperation } from './idempotentService';

export const getMealTimer = (orderId: string): MealTimer | null => {
  return executeGet<MealTimer>(
    'SELECT * FROM meal_timers WHERE order_id = ?',
    [orderId]
  );
};

export const startMealTimer = (
  orderId: string,
  expectedMealMinutes: number,
  operatorId: string,
  operatorRole: string
): MealTimer => {
  const db = getDb();
  const order = getOrderById(orderId);
  
  const existing = getMealTimer(orderId);
  if (existing) {
    throw new BusinessError(
      '计时器已启动',
      '该订单的出餐计时器已经启动了',
      'TIMER_ALREADY_STARTED'
    );
  }

  const actualExpected = expectedMealMinutes || order.expected_meal_minutes;
  
  const timer: MealTimer = {
    id: generateId(),
    order_id: orderId,
    start_time: now(),
    end_time: null,
    expected_meal_minutes: actualExpected,
    actual_meal_minutes: null,
    is_overtime: 0,
    overtime_minutes: 0,
    status: 'running',
    created_at: now(),
  };

  db.run(`
    INSERT INTO meal_timers (
      id, order_id, start_time, end_time, expected_meal_minutes,
      actual_meal_minutes, is_overtime, overtime_minutes, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    timer.id,
    timer.order_id,
    timer.start_time,
    timer.end_time,
    timer.expected_meal_minutes,
    timer.actual_meal_minutes,
    timer.is_overtime,
    timer.overtime_minutes,
    timer.status,
    timer.created_at,
  ]);

  logOperation(
    orderId,
    operatorId,
    operatorRole,
    'start_meal_timer',
    `开始计时，预计出餐 ${actualExpected} 分钟`,
    null,
    { timer }
  );

  saveDatabase();
  return timer;
};

export const stopMealTimer = (
  orderId: string,
  operatorId: string,
  operatorRole: string
): { timer: MealTimer; isOvertime: boolean; overtimeMinutes: number } => {
  const db = getDb();
  const timer = getMealTimer(orderId);

  if (!timer) {
    throw new BusinessError(
      '计时器不存在',
      '该订单没有启动出餐计时器',
      'TIMER_NOT_FOUND'
    );
  }

  if (timer.status === 'stopped') {
    throw new BusinessError(
      '计时器已停止',
      '该订单的出餐计时器已经停止了',
      'TIMER_ALREADY_STOPPED'
    );
  }

  const endTime = now();
  const actualMinutes = (endTime - timer.start_time) / (1000 * 60);
  const overtimeMinutes = Math.max(0, actualMinutes - timer.expected_meal_minutes);
  const isOvertime = overtimeMinutes > 0;

  db.run(`
    UPDATE meal_timers 
    SET end_time = ?, actual_meal_minutes = ?, is_overtime = ?, 
        overtime_minutes = ?, status = ?
    WHERE id = ?
  `, [
    endTime,
    actualMinutes,
    isOvertime ? 1 : 0,
    Math.round(overtimeMinutes),
    'stopped',
    timer.id,
  ]);

  const newTimer: MealTimer = {
    ...timer,
    end_time: endTime,
    actual_meal_minutes: actualMinutes,
    is_overtime: isOvertime ? 1 : 0,
    overtime_minutes: Math.round(overtimeMinutes),
    status: 'stopped',
  };

  logOperation(
    orderId,
    operatorId,
    operatorRole,
    'stop_meal_timer',
    isOvertime 
      ? `出餐超时 ${Math.round(overtimeMinutes)} 分钟，实际用时 ${actualMinutes.toFixed(1)} 分钟`
      : `出餐准时，实际用时 ${actualMinutes.toFixed(1)} 分钟`,
    { status: timer.status },
    { status: 'stopped', isOvertime, overtimeMinutes: Math.round(overtimeMinutes) }
  );

  saveDatabase();
  return {
    timer: newTimer,
    isOvertime,
    overtimeMinutes: Math.round(overtimeMinutes),
  };
};

export const checkOvertimeStatus = (orderId: string): { 
  isRunning: boolean; 
  elapsedMinutes: number; 
  expectedMinutes: number; 
  isOvertime: boolean; 
  overtimeMinutes: number 
} => {
  const timer = getMealTimer(orderId);

  if (!timer) {
    throw new BusinessError(
      '计时器不存在',
      '该订单没有启动出餐计时器',
      'TIMER_NOT_FOUND'
    );
  }

  const currentTime = now();
  const startTime = timer.start_time;
  const elapsedMinutes = (currentTime - startTime) / (1000 * 60);
  const overtimeMinutes = Math.max(0, elapsedMinutes - timer.expected_meal_minutes);
  const isOvertime = overtimeMinutes > 0;

  return {
    isRunning: timer.status === 'running',
    elapsedMinutes,
    expectedMinutes: timer.expected_meal_minutes,
    isOvertime,
    overtimeMinutes: Math.round(overtimeMinutes),
  };
};

export const getOvertimeOrders = (): { 
  orderId: string; 
  timer: MealTimer; 
  elapsedMinutes: number;
  overtimeMinutes: number 
}[] => {
  const runningTimers = executeAll<MealTimer>(
    `SELECT * FROM meal_timers WHERE status = 'running'`
  );

  const currentTime = now();
  return runningTimers
    .map(timer => {
      const elapsedMinutes = (currentTime - timer.start_time) / (1000 * 60);
      const overtimeMinutes = Math.max(0, elapsedMinutes - timer.expected_meal_minutes);
      return {
        orderId: timer.order_id,
        timer,
        elapsedMinutes,
        overtimeMinutes: Math.round(overtimeMinutes),
      };
    })
    .filter(item => item.overtimeMinutes > 0)
    .sort((a, b) => b.overtimeMinutes - a.overtimeMinutes);
};
