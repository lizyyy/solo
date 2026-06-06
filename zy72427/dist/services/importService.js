"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const cardService_1 = require("./cardService");
class ImportService {
    constructor() {
        this.cardService = new cardService_1.CardService();
    }
    importAttendance(cardId, records, importedBy) {
        const batchId = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const importedRecords = [];
        let duplicateCount = 0;
        const existingRecords = this.getAttendanceByCardId(cardId);
        const existingKeys = new Set(existingRecords.map((r) => `${r.classDate}_${r.className}_${r.studentName}`));
        const recordsToInsert = [];
        for (const record of records) {
            const key = `${record.classDate}_${record.className}_${record.studentName}`;
            if (existingKeys.has(key)) {
                duplicateCount++;
                continue;
            }
            const id = (0, uuid_1.v4)();
            const attendanceRecord = {
                id,
                cardId,
                classDate: record.classDate,
                className: record.className,
                studentName: record.studentName,
                status: record.status,
                sourceNote: record.sourceNote,
                isGroupMessageOnly: record.isGroupMessageOnly || false,
                importedAt: now,
                importBatchId: batchId,
            };
            recordsToInsert.push(attendanceRecord);
            importedRecords.push(attendanceRecord);
        }
        if (recordsToInsert.length > 0) {
            (0, database_1.insertMany)('attendance', recordsToInsert);
        }
        this.cardService.updateCardFields(cardId, {
            attendanceBatchId: batchId,
            status: 'ATTENDANCE_IMPORTED',
        });
        return { batchId, records: importedRecords, duplicateCount };
    }
    supplementTickets(cardId, records, supplementedBy) {
        const batchId = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const importedRecords = [];
        const recordsToInsert = [];
        for (const record of records) {
            const id = (0, uuid_1.v4)();
            const ticketRecord = {
                id,
                cardId,
                classDate: record.classDate,
                className: record.className,
                studentName: record.studentName,
                ticketCount: record.ticketCount,
                ticketType: record.ticketType,
                exportedAt: now,
                exportBatchId: batchId,
                supplementNote: record.supplementNote,
            };
            recordsToInsert.push(ticketRecord);
            importedRecords.push(ticketRecord);
        }
        if (recordsToInsert.length > 0) {
            (0, database_1.insertMany)('tickets', recordsToInsert);
        }
        this.cardService.updateCardFields(cardId, {
            ticketBatchId: batchId,
            status: 'TICKET_SUPPLEMENTED',
        });
        return { batchId, records: importedRecords };
    }
    getAttendanceByCardId(cardId) {
        return (0, database_1.findMany)('attendance', (a) => a.cardId === cardId)
            .sort((a, b) => a.classDate.localeCompare(b.classDate));
    }
    getTicketsByCardId(cardId) {
        return (0, database_1.findMany)('tickets', (t) => t.cardId === cardId)
            .sort((a, b) => a.classDate.localeCompare(b.classDate));
    }
    getAttendanceByBatchId(batchId) {
        return (0, database_1.findMany)('attendance', (a) => a.importBatchId === batchId)
            .sort((a, b) => a.classDate.localeCompare(b.classDate));
    }
    getTicketsByBatchId(batchId) {
        return (0, database_1.findMany)('tickets', (t) => t.exportBatchId === batchId)
            .sort((a, b) => a.classDate.localeCompare(b.classDate));
    }
}
exports.ImportService = ImportService;
