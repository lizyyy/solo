import { storage } from '../storage/StorageManager';
import { LockRecord } from '../models/LockRecord';
import { Schedule } from '../models/Schedule';
import { AuditLog } from '../models/AuditLog';
import { ResultWithReason, Role, ShiftType } from '../models/types';
import { AuditService } from './AuditService';
import { formatDate } from '../utils/dateUtils';

export interface DailyReport {
  date: string;
  summary: {
    totalLocks: number;
    activeLocks: number;
    releasedLocks: number;
    exceptionLocks: number;
    totalSchedules: number;
    completedSchedules: number;
    cancelledSchedules: number;
    pendingSchedules: number;
    totalAuditLogs: number;
    allowedOperations: number;
    blockedOperations: number;
  };
  locksByShift: Record<ShiftType, LockRecord[]>;
  locksByForklift: Record<string, LockRecord[]>;
  schedulesByShift: Record<ShiftType, Schedule[]>;
  lowBatteryLocks: LockRecord[];
  blockedOperations: AuditLog[];
  operatorActivity: Record<string, {
    locks: number;
    releases: number;
    exceptions: number;
    schedules: number;
  }>;
}

export class ReportService {
  static generateDailyReport(
    date: string,
    operator: string,
    role: string
  ): ResultWithReason<DailyReport> {
    const formattedDate = formatDate(date);

    const allLocks = storage.lockRecords.find(lock => lock.date === formattedDate);
    const allSchedules = storage.schedules.find(s => s.date === formattedDate);
    const allLogs = storage.auditLogs.find(log => formatDate(log.createdAt) === formattedDate);

    const summary = {
      totalLocks: allLocks.length,
      activeLocks: allLocks.filter(l => l.status === 'active').length,
      releasedLocks: allLocks.filter(l => l.status === 'released').length,
      exceptionLocks: allLocks.filter(l => l.status === 'exception').length,
      totalSchedules: allSchedules.length,
      completedSchedules: allSchedules.filter(s => s.status === 'completed').length,
      cancelledSchedules: allSchedules.filter(s => s.status === 'cancelled').length,
      pendingSchedules: allSchedules.filter(s => s.status === 'scheduled' || s.status === 'in_progress').length,
      totalAuditLogs: allLogs.length,
      allowedOperations: allLogs.filter(l => l.operationResult === 'allowed').length,
      blockedOperations: allLogs.filter(l => l.operationResult === 'blocked').length
    };

    const locksByShift = allLocks.reduce((acc, lock) => {
      const shiftType = lock.shiftType as ShiftType;
      if (!acc[shiftType]) {
        acc[shiftType] = [];
      }
      acc[shiftType].push(lock);
      return acc;
    }, {} as Record<ShiftType, LockRecord[]>);

    const locksByForklift = allLocks.reduce((acc, lock) => {
      if (!acc[lock.forkliftCode]) {
        acc[lock.forkliftCode] = [];
      }
      acc[lock.forkliftCode].push(lock);
      return acc;
    }, {} as Record<string, LockRecord[]>);

    const schedulesByShift = allSchedules.reduce((acc, schedule) => {
      const shiftType = schedule.shiftType as ShiftType;
      if (!acc[shiftType]) {
        acc[shiftType] = [];
      }
      acc[shiftType].push(schedule);
      return acc;
    }, {} as Record<ShiftType, Schedule[]>);

    const lowBatteryLocks = allLocks.filter(l => l.batteryLevelAtLock <= 30);
    const blockedOperations = allLogs.filter(l => l.operationResult === 'blocked');

    const operatorActivity: Record<string, {
      locks: number;
      releases: number;
      exceptions: number;
      schedules: number;
    }> = {};

    allLogs.forEach(log => {
      if (!operatorActivity[log.operator]) {
        operatorActivity[log.operator] = { locks: 0, releases: 0, exceptions: 0, schedules: 0 };
      }
      switch (log.action) {
        case 'lock_acquire':
          operatorActivity[log.operator].locks++;
          break;
        case 'lock_release':
          operatorActivity[log.operator].releases++;
          break;
        case 'lock_exception':
          operatorActivity[log.operator].exceptions++;
          break;
        case 'schedule_create':
        case 'schedule_update':
        case 'schedule_delete':
          operatorActivity[log.operator].schedules++;
          break;
      }
    });

    const report: DailyReport = {
      date: formattedDate,
      summary,
      locksByShift,
      locksByForklift,
      schedulesByShift,
      lowBatteryLocks,
      blockedOperations,
      operatorActivity
    };

    AuditService.logDailyReport(
      operator,
      role as Role,
      'allowed',
      `日报生成成功：${formattedDate}`,
      { summary }
    );

    return {
      success: true,
      result: report,
      reason: `日报生成成功：${formattedDate}`,
      operationResult: 'allowed'
    };
  }

  static printReport(report: DailyReport): string {
    const lines: string[] = [];
    lines.push('='.repeat(60));
    lines.push(`叉车排班与充电桩管理系统日报 - ${report.date}`);
    lines.push('='.repeat(60));
    lines.push('');

    lines.push('【概览统计】');
    lines.push('-'.repeat(40));
    lines.push(`锁定总数: ${report.summary.totalLocks}`);
    lines.push(`  活跃锁定: ${report.summary.activeLocks}`);
    lines.push(`  已释放: ${report.summary.releasedLocks}`);
    lines.push(`  异常释放: ${report.summary.exceptionLocks}`);
    lines.push(`排班总数: ${report.summary.totalSchedules}`);
    lines.push(`  已完成: ${report.summary.completedSchedules}`);
    lines.push(`  进行中/待执行: ${report.summary.pendingSchedules}`);
    lines.push(`  已取消: ${report.summary.cancelledSchedules}`);
    lines.push(`操作审计: 共 ${report.summary.totalAuditLogs} 条`);
    lines.push(`  通过: ${report.summary.allowedOperations}`);
    lines.push(`  拦截: ${report.summary.blockedOperations}`);
    lines.push('');

    lines.push('【低电量充电记录】');
    lines.push('-'.repeat(40));
    if (report.lowBatteryLocks.length === 0) {
      lines.push('  无低电量充电记录');
    } else {
      report.lowBatteryLocks.forEach(lock => {
        lines.push(`  叉车 ${lock.forkliftCode} | 桩 ${lock.chargingPileCode} | 电量 ${lock.batteryLevelAtLock}% | ${lock.shiftType}`);
      });
    }
    lines.push('');

    lines.push('【被拦截操作记录】');
    lines.push('-'.repeat(40));
    if (report.blockedOperations.length === 0) {
      lines.push('  无被拦截操作');
    } else {
      report.blockedOperations.slice(0, 10).forEach(log => {
        lines.push(`  ${log.createdAt.slice(11, 19)} | ${log.operator} | ${log.action} | ${log.reason}`);
      });
      if (report.blockedOperations.length > 10) {
        lines.push(`  ...还有 ${report.blockedOperations.length - 10} 条记录`);
      }
    }
    lines.push('');

    lines.push('【操作员活动统计】');
    lines.push('-'.repeat(40));
    Object.entries(report.operatorActivity).forEach(([op, activity]) => {
      const total = activity.locks + activity.releases + activity.exceptions + activity.schedules;
      if (total > 0) {
        lines.push(`  ${op}: 锁定${activity.locks}次 | 释放${activity.releases}次 | 异常${activity.exceptions}次 | 排班${activity.schedules}次`);
      }
    });
    lines.push('');

    lines.push('【按班次统计锁定】');
    lines.push('-'.repeat(40));
    (['白班', '中班', '夜班'] as ShiftType[]).forEach(shift => {
      const locks = report.locksByShift[shift] || [];
      lines.push(`  ${shift}: ${locks.length} 次锁定`);
    });
    lines.push('');

    lines.push('='.repeat(60));
    lines.push('报告生成完毕');
    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  static getForkliftUtilization(forkliftId: string, startDate: string, endDate: string) {
    const locks = storage.lockRecords.find(lock => 
      lock.forkliftId === forkliftId &&
      lock.date >= formatDate(startDate) &&
      lock.date <= formatDate(endDate)
    );

    const totalMinutes = locks.reduce((sum, lock) => {
      if (lock.actualReleaseTime) {
        const duration = (new Date(lock.actualReleaseTime).getTime() - new Date(lock.lockTime).getTime()) / 60000;
        return sum + duration;
      }
      return sum;
    }, 0);

    return {
      forkliftId,
      totalLocks: locks.length,
      totalChargingMinutes: Math.round(totalMinutes),
      averageChargeMinutes: locks.length > 0 ? Math.round(totalMinutes / locks.length) : 0,
      dateRange: { start: formatDate(startDate), end: formatDate(endDate) }
    };
  }

  static getChargingPileUtilization(pileId: string, startDate: string, endDate: string) {
    const locks = storage.lockRecords.find(lock => 
      lock.chargingPileId === pileId &&
      lock.date >= formatDate(startDate) &&
      lock.date <= formatDate(endDate)
    );

    const totalMinutes = locks.reduce((sum, lock) => {
      if (lock.actualReleaseTime) {
        const duration = (new Date(lock.actualReleaseTime).getTime() - new Date(lock.lockTime).getTime()) / 60000;
        return sum + duration;
      }
      return sum;
    }, 0);

    return {
      chargingPileId: pileId,
      totalLocks: locks.length,
      totalOccupiedMinutes: Math.round(totalMinutes),
      averageOccupancyMinutes: locks.length > 0 ? Math.round(totalMinutes / locks.length) : 0,
      dateRange: { start: formatDate(startDate), end: formatDate(endDate) }
    };
  }
}
