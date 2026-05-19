"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDailyReport = generateDailyReport;
exports.exportReportToJSON = exportReportToJSON;
exports.exportReportToCSV = exportReportToCSV;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("../types");
const db_1 = require("../db");
const security_1 = require("../utils/security");
async function generateDailyReport(date) {
    const allTasks = await (0, db_1.getTasks)();
    const allVehicles = await (0, db_1.getVehicles)();
    const allChargers = await (0, db_1.getChargers)();
    const allExceptions = await (0, db_1.getExceptions)();
    const allShifts = await (0, db_1.getShifts)();
    const dayTasks = allTasks.filter(t => {
        const shift = allShifts.find(s => s.id === t.shiftId);
        return shift?.date === date && shift.type === types_1.ShiftType.DAY;
    });
    const nightTasks = allTasks.filter(t => {
        const shift = allShifts.find(s => s.id === t.shiftId);
        return shift?.date === date && shift.type === types_1.ShiftType.NIGHT;
    });
    const totalTasks = dayTasks.length + nightTasks.length;
    const completedTasks = [...dayTasks, ...nightTasks].filter(t => t.status === types_1.TaskStatus.COMPLETED).length;
    const exceptionTasks = [...dayTasks, ...nightTasks].filter(t => t.status === types_1.TaskStatus.EXCEPTION).length;
    const usedVehicleIds = new Set();
    [...dayTasks, ...nightTasks].forEach(t => {
        if (t.assignedVehicleId)
            usedVehicleIds.add(t.assignedVehicleId);
    });
    const dayShift = allShifts.find(s => s.date === date && s.type === types_1.ShiftType.DAY);
    const nightShift = allShifts.find(s => s.date === date && s.type === types_1.ShiftType.NIGHT);
    const dayShiftVehicleIds = new Set();
    dayShift?.vehicleAssignments.forEach(a => dayShiftVehicleIds.add(a.vehicleId));
    const nightShiftVehicleIds = new Set();
    nightShift?.vehicleAssignments.forEach(a => nightShiftVehicleIds.add(a.vehicleId));
    const exceptionSummaries = [];
    const dateExceptions = allExceptions.filter(e => {
        const shift = allShifts.find(s => s.id === e.shiftId);
        return shift?.date === date;
    });
    const exceptionCounts = {};
    dateExceptions.forEach(e => {
        exceptionCounts[e.type] = (exceptionCounts[e.type] || 0) + 1;
    });
    Object.entries(exceptionCounts).forEach(([type, count]) => {
        exceptionSummaries.push({
            type: type,
            count,
            description: getExceptionDescription(type)
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
                completedTasks: dayTasks.filter(t => t.status === types_1.TaskStatus.COMPLETED).length,
                operators: dayShift?.operatorIds.length || 0,
                vehicles: dayShiftVehicleIds.size
            },
            night: {
                totalTasks: nightTasks.length,
                completedTasks: nightTasks.filter(t => t.status === types_1.TaskStatus.COMPLETED).length,
                operators: nightShift?.operatorIds.length || 0,
                vehicles: nightShiftVehicleIds.size
            }
        }
    };
}
function getExceptionDescription(type) {
    const descriptions = {
        [types_1.ExceptionType.LOW_BATTERY]: '车辆电量不足，需要充电',
        [types_1.ExceptionType.CHARGER_CONFLICT]: '充电桩资源冲突',
        [types_1.ExceptionType.VEHICLE_BREAKDOWN]: '车辆故障',
        [types_1.ExceptionType.TASK_DELAY]: '任务延迟',
        [types_1.ExceptionType.OPERATOR_ABSENT]: '操作员缺勤'
    };
    return descriptions[type] || '未知异常';
}
async function exportReportToJSON(report, outputDir) {
    const maskedReport = (0, security_1.maskSensitiveData)(report);
    const fileName = `report-${report.date}.json`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(maskedReport, null, 2), 'utf-8');
    return filePath;
}
async function exportReportToCSV(report, outputDir) {
    const fileName = `report-${report.date}.csv`;
    const filePath = path.join(outputDir, fileName);
    const lines = [];
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
