"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfCheckService = void 0;
const importService_1 = require("./importService");
const cardService_1 = require("./cardService");
class SelfCheckService {
    constructor() {
        this.importService = new importService_1.ImportService();
        this.cardService = new cardService_1.CardService();
    }
    runAllChecks(cardId) {
        const results = [];
        results.push(this.checkDuplicateImports(cardId));
        results.push(this.checkTempSubstituteWarnings(cardId));
        results.push(this.checkMakeupRecalculation(cardId));
        results.push(this.checkExportConsistency(cardId));
        this.cardService.updateSelfCheckResults(cardId, results);
        return results;
    }
    checkDuplicateImports(cardId) {
        const attendanceRecords = this.importService.getAttendanceByCardId(cardId);
        const keyCount = new Map();
        for (const record of attendanceRecords) {
            const key = `${record.classDate}_${record.className}_${record.studentName}`;
            keyCount.set(key, (keyCount.get(key) || 0) + 1);
        }
        const duplicates = [];
        for (const [key, count] of keyCount.entries()) {
            if (count > 1) {
                duplicates.push(`${key} (${count}条)`);
            }
        }
        if (duplicates.length > 0) {
            return {
                checkType: 'DUPLICATE_IMPORT',
                passed: false,
                message: `发现${duplicates.length}条重复导入记录`,
                details: { duplicates },
                severity: 'ERROR',
            };
        }
        return {
            checkType: 'DUPLICATE_IMPORT',
            passed: true,
            message: '无重复导入记录',
            severity: 'INFO',
        };
    }
    checkTempSubstituteWarnings(cardId) {
        const attendanceRecords = this.importService.getAttendanceByCardId(cardId);
        const groupMessageOnlyRecords = attendanceRecords.filter((r) => r.isGroupMessageOnly);
        if (groupMessageOnlyRecords.length > 0) {
            const details = groupMessageOnlyRecords.map((r) => ({
                classDate: r.classDate,
                className: r.className,
                studentName: r.studentName,
                sourceNote: r.sourceNote,
            }));
            return {
                checkType: 'TEMP_SUBSTITUTE_WARNING',
                passed: false,
                message: `发现${groupMessageOnlyRecords.length}条仅在群里提及的临时替补记录，需票务同事复核`,
                details: { records: details },
                severity: 'WARNING',
            };
        }
        return {
            checkType: 'TEMP_SUBSTITUTE_WARNING',
            passed: true,
            message: '无临时替补预警',
            severity: 'INFO',
        };
    }
    checkMakeupRecalculation(cardId) {
        const attendanceRecords = this.importService.getAttendanceByCardId(cardId);
        const ticketRecords = this.importService.getTicketsByCardId(cardId);
        const makeupRecords = attendanceRecords.filter((r) => r.status === 'MAKEUP');
        const issues = [];
        for (const makeup of makeupRecords) {
            const key = `${makeup.classDate}_${makeup.className}_${makeup.studentName}`;
            const ticket = ticketRecords.find((t) => `${t.classDate}_${t.className}_${t.studentName}` === key);
            if (!ticket) {
                issues.push(`${key}: 补录记录无对应票务，需确认是否需要重算`);
            }
            else if (ticket.supplementNote) {
                issues.push(`${key}: 补录记录有补充说明，建议人工复核计算`);
            }
        }
        if (issues.length > 0) {
            return {
                checkType: 'MAKUP_RECALCULATION',
                passed: false,
                message: `发现${issues.length}条补录记录需要确认重算`,
                details: { issues },
                severity: 'WARNING',
            };
        }
        return {
            checkType: 'MAKUP_RECALCULATION',
            passed: true,
            message: '补录记录均已匹配，无需额外重算',
            severity: 'INFO',
        };
    }
    checkExportConsistency(cardId) {
        const attendanceRecords = this.importService.getAttendanceByCardId(cardId);
        const ticketRecords = this.importService.getTicketsByCardId(cardId);
        if (ticketRecords.length === 0) {
            return {
                checkType: 'EXPORT_CONSISTENCY',
                passed: false,
                message: '暂无票务导出数据，无法校验一致性',
                severity: 'WARNING',
            };
        }
        const attendanceKeys = new Set(attendanceRecords.map((r) => `${r.classDate}_${r.className}_${r.studentName}`));
        const ticketKeys = new Set(ticketRecords.map((r) => `${r.classDate}_${r.className}_${r.studentName}`));
        const inAttendanceOnly = [];
        for (const key of attendanceKeys) {
            if (!ticketKeys.has(key)) {
                inAttendanceOnly.push(key);
            }
        }
        const inTicketOnly = [];
        for (const key of ticketKeys) {
            if (!attendanceKeys.has(key)) {
                inTicketOnly.push(key);
            }
        }
        if (inAttendanceOnly.length > 0 || inTicketOnly.length > 0) {
            return {
                checkType: 'EXPORT_CONSISTENCY',
                passed: false,
                message: `签到与票务数据不一致：签到独有${inAttendanceOnly.length}条，票务独有${inTicketOnly.length}条`,
                details: { inAttendanceOnly, inTicketOnly },
                severity: 'ERROR',
            };
        }
        return {
            checkType: 'EXPORT_CONSISTENCY',
            passed: true,
            message: '签到与票务导出数据一致',
            severity: 'INFO',
        };
    }
}
exports.SelfCheckService = SelfCheckService;
