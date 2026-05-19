import { storage } from '../storage/StorageManager';
import { ScheduleCreateInput, ScheduleUpdateInput, Schedule } from '../models/Schedule';
import { ResultWithReason, Role } from '../models/types';
import { AuditService } from './AuditService';
import { getCurrentTime, generateIdempotentKey } from '../utils/dateUtils';

export class ScheduleService {
  static createSchedule(input: ScheduleCreateInput): ResultWithReason<Schedule> {
    if (input.idempotentKey) {
      const existingResultId = storage.schedules.getIdempotentResult(input.idempotentKey);
      if (existingResultId) {
        const existingSchedule = storage.schedules.getById(existingResultId);
        if (existingSchedule) {
          AuditService.logScheduleCreate(
            existingSchedule.id,
            input.operator,
            input.role as Role,
            'allowed',
            `幂等命中：已存在相同排班，请求键: ${input.idempotentKey}`,
            undefined,
            input.idempotentKey
          );
          return {
            success: true,
            result: existingSchedule,
            reason: `幂等命中：已存在相同排班，请求键: ${input.idempotentKey}`,
            operationResult: 'allowed',
            idempotentKey: input.idempotentKey
          };
        }
      }
    }

    const shift = storage.shifts.getById(input.shiftId);
    if (!shift) {
      AuditService.logScheduleCreate(
        '',
        input.operator,
        input.role as Role,
        'blocked',
        `班次不存在：ID ${input.shiftId}`,
        undefined,
        input.idempotentKey
      );
      return {
        success: false,
        reason: `班次不存在：ID ${input.shiftId}`,
        operationResult: 'blocked'
      };
    }

    const forklift = storage.forklifts.getById(input.forkliftId);
    if (!forklift) {
      AuditService.logScheduleCreate(
        '',
        input.operator,
        input.role as Role,
        'blocked',
        `叉车不存在：ID ${input.forkliftId}`,
        undefined,
        input.idempotentKey
      );
      return {
        success: false,
        reason: `叉车不存在：ID ${input.forkliftId}`,
        operationResult: 'blocked'
      };
    }

    const existingSchedule = storage.schedules.findOne(
      s => s.shiftId === input.shiftId && 
           s.forkliftId === input.forkliftId && 
           s.status !== 'cancelled'
    );

    if (existingSchedule) {
      AuditService.logScheduleCreate(
        '',
        input.operator,
        input.role as Role,
        'blocked',
        `排班冲突：叉车 ${forklift.code} 在本班次已有排班`,
        {
          existingScheduleId: existingSchedule.id,
          taskDescription: existingSchedule.taskDescription
        },
        input.idempotentKey
      );
      return {
        success: false,
        reason: `排班冲突：叉车 ${forklift.code} 在本班次已有排班`,
        operationResult: 'blocked'
      };
    }

    const now = getCurrentTime();
    const schedule = storage.schedules.create({
      shiftId: input.shiftId,
      date: input.date,
      shiftType: input.shiftType,
      forkliftId: input.forkliftId,
      forkliftCode: input.forkliftCode,
      operatorName: input.operatorName,
      taskDescription: input.taskDescription,
      status: 'scheduled',
      priority: input.priority || 0,
      createdAt: now,
      updatedAt: now,
      createdBy: input.operator,
      updatedBy: input.operator
    });

    if (input.idempotentKey) {
      storage.schedules.setIdempotentResult(input.idempotentKey, schedule.id);
    }

    AuditService.logScheduleCreate(
      schedule.id,
      input.operator,
      input.role as Role,
      'allowed',
      `排班创建成功：叉车 ${forklift.code} 分配给 ${input.operatorName}`,
      {
        shiftType: input.shiftType,
        taskDescription: input.taskDescription,
        priority: input.priority || 0
      },
      input.idempotentKey
    );

    return {
      success: true,
      result: schedule,
      reason: `排班创建成功：叉车 ${forklift.code} 分配给 ${input.operatorName}，任务：${input.taskDescription}`,
      operationResult: 'allowed'
    };
  }

  static updateSchedule(input: ScheduleUpdateInput): ResultWithReason<Schedule> {
    const schedule = storage.schedules.getById(input.id);
    if (!schedule) {
      AuditService.logScheduleUpdate(
        input.id,
        input.operator,
        input.role as Role,
        'blocked',
        `排班记录不存在：ID ${input.id}`
      );
      return {
        success: false,
        reason: `排班记录不存在：ID ${input.id}`,
        operationResult: 'blocked'
      };
    }

    const now = getCurrentTime();
    const updates: Partial<Schedule> = {
      updatedAt: now,
      updatedBy: input.operator
    };

    if (input.status !== undefined) {
      updates.status = input.status;
    }
    if (input.taskDescription !== undefined) {
      updates.taskDescription = input.taskDescription;
    }

    const updatedSchedule = storage.schedules.update(input.id, updates);

    AuditService.logScheduleUpdate(
      input.id,
      input.operator,
      input.role as Role,
      'allowed',
      `排班更新成功：${input.status ? '状态更新为 ' + input.status : ''} ${input.taskDescription ? '任务更新为 ' + input.taskDescription : ''}`,
      {
        previousStatus: schedule.status,
        newStatus: input.status,
        previousTask: schedule.taskDescription,
        newTask: input.taskDescription
      }
    );

    return {
      success: true,
      result: updatedSchedule!,
      reason: `排班更新成功`,
      operationResult: 'allowed'
    };
  }

  static deleteSchedule(
    scheduleId: string,
    operator: string,
    role: string
  ): ResultWithReason<boolean> {
    const schedule = storage.schedules.getById(scheduleId);
    if (!schedule) {
      AuditService.logScheduleDelete(
        scheduleId,
        operator,
        role as Role,
        'blocked',
        `排班记录不存在：ID ${scheduleId}`
      );
      return {
        success: false,
        reason: `排班记录不存在：ID ${scheduleId}`,
        operationResult: 'blocked'
      };
    }

    storage.schedules.update(scheduleId, {
      status: 'cancelled',
      updatedAt: getCurrentTime(),
      updatedBy: operator
    });

    AuditService.logScheduleDelete(
      scheduleId,
      operator,
      role as Role,
      'allowed',
      `排班已取消：叉车 ${schedule.forkliftCode}，原操作员：${schedule.operatorName}`,
      {
        forkliftCode: schedule.forkliftCode,
        operatorName: schedule.operatorName,
        taskDescription: schedule.taskDescription
      }
    );

    return {
      success: true,
      result: true,
      reason: `排班已取消`,
      operationResult: 'allowed'
    };
  }

  static getScheduleById(scheduleId: string): Schedule | undefined {
    return storage.schedules.getById(scheduleId);
  }

  static getSchedulesByShift(shiftId: string): Schedule[] {
    return storage.schedules.find(s => s.shiftId === shiftId);
  }

  static getSchedulesByDate(date: string): Schedule[] {
    return storage.schedules.find(s => s.date === date);
  }

  static getSchedulesByForklift(forkliftId: string): Schedule[] {
    return storage.schedules.find(s => s.forkliftId === forkliftId);
  }

  static getActiveSchedules(): Schedule[] {
    return storage.schedules.find(s => s.status === 'scheduled' || s.status === 'in_progress');
  }

  static getAllSchedules(): Schedule[] {
    return storage.schedules.getAll();
  }

  static getScheduleHistory(scheduleId: string): {
    record: Schedule | undefined;
    audit: ReturnType<typeof AuditService.getHistory>;
  } {
    const record = storage.schedules.getById(scheduleId);
    const audit = AuditService.getHistory('Schedule', scheduleId);
    return { record, audit };
  }
}
