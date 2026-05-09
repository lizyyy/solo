import { store } from '../storage/inMemoryStore';
import {
  Shift,
  ShiftSnapshot,
  DailyReport,
} from '../models/types';
import { snapshotService } from './snapshotService';
import { productionService } from './productionService';
import { downtimeService } from './downtimeService';

export class HandoverService {
  confirmHandover(
    shiftId: string,
    params: {
      handoverFrom: string;
      handoverTo: string;
    }
  ): Shift {
    const shift = store.getShiftById(shiftId);
    if (!shift) {
      throw new Error(`班次不存在: ${shiftId}`);
    }

    if (shift.status !== 'handover') {
      throw new Error(
        `班次状态不是交接中，无法确认交接: ${shift.status}`
      );
    }

    const pendingProductions = store
      .getProductionsByShift(shiftId)
      .filter((p) => p.status === 'pending');

    const pendingWastes = store
      .getWastesByShift(shiftId)
      .filter((w) => w.status === 'pending');

    if (pendingProductions.length > 0) {
      throw new Error(
        `存在 ${pendingProductions.length} 条待确认的产量记录，请先确认`
      );
    }

    if (pendingWastes.length > 0) {
      throw new Error(
        `存在 ${pendingWastes.length} 条待确认的废品记录，请先确认`
      );
    }

    downtimeService.autoAllocateDowntimeForLine(shift.lineId);

    snapshotService.createSnapshot(shiftId, {
      handoverFrom: params.handoverFrom,
      handoverTo: params.handoverTo,
      isConfirmed: true,
    });

    const updatedShift: Shift = {
      ...shift,
      status: 'confirmed',
      updatedAt: new Date(),
      version: shift.version + 1,
    };

    return store.saveShift(updatedShift);
  }

  reviseShift(
    shiftId: string,
    params: {
      revisedBy: string;
      reason: string;
      changes: {
        teamId?: string;
        teamName?: string;
        startTime?: Date;
        endTime?: Date;
      };
    }
  ): Shift {
    const shift = store.getShiftById(shiftId);
    if (!shift) {
      throw new Error(`班次不存在: ${shiftId}`);
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (params.changes.teamId !== undefined) {
      changes.teamId = { from: shift.teamId, to: params.changes.teamId };
    }
    if (params.changes.teamName !== undefined) {
      changes.teamName = { from: shift.teamName, to: params.changes.teamName };
    }
    if (params.changes.startTime !== undefined) {
      changes.startTime = { from: shift.startTime, to: params.changes.startTime };
    }
    if (params.changes.endTime !== undefined) {
      changes.endTime = { from: shift.endTime, to: params.changes.endTime };
    }

    const updatedShift: Shift = {
      ...shift,
      teamId: params.changes.teamId ?? shift.teamId,
      teamName: params.changes.teamName ?? shift.teamName,
      startTime: params.changes.startTime ?? shift.startTime,
      endTime: params.changes.endTime ?? shift.endTime,
      status: 'revised',
      updatedAt: new Date(),
      version: shift.version + 1,
    };

    store.saveShift(updatedShift);

    store.saveRevision({
      id: store.generateId(),
      targetId: shiftId,
      targetType: 'shift',
      previousVersion: shift.version,
      newVersion: updatedShift.version,
      changes,
      revisedBy: params.revisedBy,
      revisedAt: new Date(),
      reason: params.reason,
    });

    return updatedShift;
  }

  getHandoverSummary(
    shiftId: string
  ): {
    shift: Shift;
    snapshot?: ShiftSnapshot;
    summary: {
      productionTotal: number;
      wasteTotal: number;
      netProduction: number;
      downtimeMinutes: number;
      effectiveTimeMinutes: number;
    };
    pendingItems: {
      productions: number;
      wastes: number;
      unallocatedDowntime: number;
    };
  } {
    const shift = store.getShiftById(shiftId);
    if (!shift) {
      throw new Error(`班次不存在: ${shiftId}`);
    }

    const summary = productionService.calculateShiftSummary(shiftId);
    const shiftDuration = downtimeService.getShiftDurationMinutes(shiftId);
    const downtime = downtimeService.getShiftDowntime(shiftId);

    const pendingProductions = store
      .getProductionsByShift(shiftId)
      .filter((p) => p.status === 'pending').length;

    const pendingWastes = store
      .getWastesByShift(shiftId)
      .filter((w) => w.status === 'pending').length;

    const unallocatedDowntime = store
      .getDowntimesByLine(shift.lineId)
      .filter((d) => d.status === 'pending').length;

    const snapshot = store.getLatestSnapshot(shiftId);

    return {
      shift,
      snapshot,
      summary: {
        productionTotal: summary.productionTotal,
        wasteTotal: summary.wasteTotal,
        netProduction: summary.netProduction,
        downtimeMinutes: downtime.totalMinutes,
        effectiveTimeMinutes: shiftDuration - downtime.totalMinutes,
      },
      pendingItems: {
        productions: pendingProductions,
        wastes: pendingWastes,
        unallocatedDowntime,
      },
    };
  }

  generateDailyReport(date: string, lineId: string): DailyReport {
    const [year, month, day] = date.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const nextDate = new Date(year, month - 1, day + 1);

    const shifts = store.getShiftsByLine(lineId);
    const dayShifts = shifts.filter((s) => {
      const startTime = s.startTime;
      const endTime = s.endTime || new Date();
      return startTime < nextDate && endTime > targetDate;
    });

    const shiftReports = dayShifts.map((shift) => {
      const snapshot = store.getLatestSnapshot(shift.id);
      const shiftDuration = shift.endTime
        ? Math.round(
            (shift.endTime.getTime() - shift.startTime.getTime()) / 60000
          )
        : Math.round((Date.now() - shift.startTime.getTime()) / 60000);

      if (!snapshot) {
        return {
          shiftId: shift.id,
          teamId: shift.teamId,
          teamName: shift.teamName,
          startTime: shift.startTime,
          endTime: shift.endTime || new Date(),
          productionTotal: 0,
          wasteTotal: 0,
          effectiveRate: shiftDuration > 0 ? 100 : 0,
          netProduction: 0,
        };
      }

      const downtimeMinutes = snapshot.downtimeAllocations.reduce(
        (sum, d) => sum + d.durationMinutes,
        0
      );

      return {
        shiftId: shift.id,
        teamId: shift.teamId,
        teamName: shift.teamName,
        startTime: shift.startTime,
        endTime: shift.endTime || new Date(),
        productionTotal: snapshot.productionTotal,
        wasteTotal: snapshot.wasteTotal,
        effectiveRate: shiftDuration > 0
          ? ((shiftDuration - downtimeMinutes) / shiftDuration) * 100
          : 0,
        netProduction: snapshot.productionTotal - snapshot.wasteTotal,
      };
    });

    const dailyTotal = {
      production: shiftReports.reduce((sum, s) => sum + s.productionTotal, 0),
      waste: shiftReports.reduce((sum, s) => sum + s.wasteTotal, 0),
      netProduction: shiftReports.reduce((sum, s) => sum + s.netProduction, 0),
      downtimeMinutes: 0,
    };

    for (const shift of dayShifts) {
      const downtime = downtimeService.getShiftDowntime(shift.id);
      dailyTotal.downtimeMinutes += downtime.totalMinutes;
    }

    return {
      date,
      lineId,
      shifts: shiftReports,
      dailyTotal,
    };
  }

  exportDailyReportAsJSON(date: string, lineId: string): string {
    const report = this.generateDailyReport(date, lineId);
    return JSON.stringify(report, null, 2);
  }

  exportDailyReportAsCSV(date: string, lineId: string): string {
    const report = this.generateDailyReport(date, lineId);

    const headers = [
      '日期',
      '产线',
      '班次ID',
      '班组ID',
      '班组名称',
      '开始时间',
      '结束时间',
      '总产量',
      '废品量',
      '净产量',
      '有效率(%)',
    ];

    const rows = report.shifts.map((shift) => [
      report.date,
      report.lineId,
      shift.shiftId,
      shift.teamId,
      shift.teamName,
      shift.startTime.toISOString(),
      shift.endTime.toISOString(),
      shift.productionTotal.toString(),
      shift.wasteTotal.toString(),
      shift.netProduction.toString(),
      shift.effectiveRate.toFixed(2),
    ]);

    const summaryRow = [
      report.date,
      report.lineId,
      '汇总',
      '',
      '',
      '',
      '',
      report.dailyTotal.production.toString(),
      report.dailyTotal.waste.toString(),
      report.dailyTotal.netProduction.toString(),
      '',
    ];

    const csv = [headers.join(','), ...rows.map((r) => r.join(',')), summaryRow.join(',')];
    return csv.join('\n');
  }
}

export const handoverService = new HandoverService();
