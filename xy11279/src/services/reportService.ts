import * as fs from 'fs';
import * as path from 'path';
import { DailyReport, ExceptionSummary, ExceptionType, ShiftType, TaskStatus } from '../types';
import { getTasks, getVehicles, getChargers, getExceptions, getShifts } from '../db';
import { maskSensitiveData } from '../utils/security';

export async function generateDailyReport(date: string): Promise<DailyReport> {
  const allTasks = await getTasks();
  const allVehicles = await getVehicles();
  const allChargers = await getChargers();
  const allExceptions = await getExceptions();
  const allShifts = await getShifts();
  
  const dayTasks = allTasks.filter(t => {
    const shift = allShifts.find(s => s.id === t.shiftId);
    return shift?.date === date && shift.type === ShiftType.DAY;
  });
  
  const nightTasks = allTasks.filter(t => {
    const shift = allShifts.find(s => s.id === t.shiftId);
    return shift?.date === date && shift.type === ShiftType.NIGHT;
  });
  
  const totalTasks = dayTasks.length + nightTasks.length;
  const completedTasks = [...dayTasks, ...nightTasks].filter(t => t.status === TaskStatus.COMPLETED).length;
  const exceptionTasks = [...dayTasks, ...nightTasks].filter(t => t.status === TaskStatus.EXCEPTION).length;
  
  const usedVehicleIds = new Set<string>();
  [...dayTasks, ...nightTasks].forEach(t => {
    if (t.assignedVehicleId) usedVehicleIds.add(t.assignedVehicleId);
  });
  
  const dayShift = allShifts.find(s => s.date === date && s.type === ShiftType.DAY);
  const nightShift = allShifts.find(s => s.date === date && s.type === ShiftType.NIGHT);
  
  const dayShiftVehicleIds = new Set<string>();
  dayShift?.vehicleAssignments.forEach(a => dayShiftVehicleIds.add(a.vehicleId));
  
  const nightShiftVehicleIds = new Set<string>();
  nightShift?.vehicleAssignments.forEach(a => nightShiftVehicleIds.add(a.vehicleId));
  
  const exceptionSummaries: ExceptionSummary[] = [];
  const dateExceptions = allExceptions.filter(e => {
    const shift = allShifts.find(s => s.id === e.shiftId);
    return shift?.date === date;
  });
  
  const exceptionCounts: Record<string, number> = {};
  dateExceptions.forEach(e => {
    exceptionCounts[e.type] = (exceptionCounts[e.type] || 0) + 1;
  });
  
  Object.entries(exceptionCounts).forEach(([type, count]) => {
    exceptionSummaries.push({
      type: type as ExceptionType,
      count,
      description: getExceptionDescription(type as ExceptionType)
    });
  });
  
  const vehicleBatteryLevels = allVehicles
    .filter(v => usedVehicleIds.has(v.id))
    .map(v => v.batteryLevel);
  
  const averageBatteryUsage = vehicleBatteryLevels.length > 0
    ? Math.round(vehicleBatteryLevels.reduce((a, b) => a + b, 0) / vehicleBatteryLevels.length)
    : 0;
  
  return {
    date,
    totalTasks,
    completedTasks,
    exceptionTasks,
    vehiclesUsed: usedVehicleIds.size,
    chargersUsed: dayShiftVehicleIds.size + nightShiftVehicleIds.size,
    averageBatteryUsage,
    exceptions: exceptionSummaries,
    shiftSummary: {
      day: {
        totalTasks: dayTasks.length,
        completedTasks: dayTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
        operators: dayShift?.operatorIds.length || 0,
        vehicles: dayShiftVehicleIds.size
      },
      night: {
        totalTasks: nightTasks.length,
        completedTasks: nightTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
        operators: nightShift?.operatorIds.length || 0,
        vehicles: nightShiftVehicleIds.size
      }
    }
  };
}

function getExceptionDescription(type: ExceptionType): string {
  const descriptions: Record<ExceptionType, string> = {
    [ExceptionType.LOW_BATTERY]: '车辆电量不足，需要充电',
    [ExceptionType.CHARGER_CONFLICT]: '充电桩资源冲突',
    [ExceptionType.VEHICLE_BREAKDOWN]: '车辆故障',
    [ExceptionType.TASK_DELAY]: '任务延迟',
    [ExceptionType.OPERATOR_ABSENT]: '操作员缺勤'
  };
  return descriptions[type] || '未知异常';
}

export async function exportReportToJSON(report: DailyReport, outputDir: string): Promise<string> {
  const maskedReport = maskSensitiveData(report);
  const fileName = `report-${report.date}.json`;
  const filePath = path.join(outputDir, fileName);
  
  fs.writeFileSync(filePath, JSON.stringify(maskedReport, null, 2), 'utf-8');
  return filePath;
}

export async function exportReportToCSV(report: DailyReport, outputDir: string): Promise<string> {
  const fileName = `report-${report.date}.csv`;
  const filePath = path.join(outputDir, fileName);
  
  const lines: string[] = [];
  
  lines.push('日报汇总');
  lines.push(`日期,${report.date}`);
  lines.push(`总任务数,${report.totalTasks}`);
  lines.push(`已完成任务数,${report.completedTasks}`);
  lines.push(`异常任务数,${report.exceptionTasks}`);
  lines.push(`使用车辆数,${report.vehiclesUsed}`);
  lines.push(`使用充电桩数,${report.chargersUsed}`);
  lines.push(`平均剩余电量,${report.averageBatteryUsage}%`);
  lines.push('');
  
  lines.push('异常统计');
  lines.push('异常类型,数量,描述');
  report.exceptions.forEach(e => {
    lines.push(`${e.type},${e.count},${e.description}`);
  });
  lines.push('');
  
  lines.push('白班统计');
  lines.push(`总任务数,${report.shiftSummary.day.totalTasks}`);
  lines.push(`已完成任务数,${report.shiftSummary.day.completedTasks}`);
  lines.push(`操作员数,${report.shiftSummary.day.operators}`);
  lines.push(`车辆数,${report.shiftSummary.day.vehicles}`);
  lines.push('');
  
  lines.push('夜班统计');
  lines.push(`总任务数,${report.shiftSummary.night.totalTasks}`);
  lines.push(`已完成任务数,${report.shiftSummary.night.completedTasks}`);
  lines.push(`操作员数,${report.shiftSummary.night.operators}`);
  lines.push(`车辆数,${report.shiftSummary.night.vehicles}`);
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  return filePath;
}
