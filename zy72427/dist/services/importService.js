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
        const details = [];
        const existingRecords = this.getAttendanceByCardId(cardId);
        const existingKeyToRecord = new Map();
        for (const r of existingRecords) {
            const key = `${r.classDate}_${r.className}_${r.studentName}`;
            existingKeyToRecord.set(key, r);
        }
        const currentBatchKeys = new Set();
        const recordsToInsert = [];
        for (const record of records) {
            const key = `${record.classDate}_${record.className}_${record.studentName}`;
            if (currentBatchKeys.has(key)) {
                details.push({
                    record: {
                        id: '',
                        cardId,
                        ...record,
                        isGroupMessageOnly: record.isGroupMessageOnly || false,
                        importedAt: now,
                        importBatchId: batchId,
                    },
                    importStatus: 'DUPLICATE_CURRENT_BATCH',
                    duplicateOf: key,
                });
                continue;
            }
            if (existingKeyToRecord.has(key)) {
                const existing = existingKeyToRecord.get(key);
                details.push({
                    record: {
                        id: '',
                        cardId,
                        ...record,
                        isGroupMessageOnly: record.isGroupMessageOnly || false,
                        importedAt: now,
                        importBatchId: batchId,
                    },
                    importStatus: 'DUPLICATE_HISTORICAL',
                    duplicateOf: `历史记录(${existing.importBatchId.substring(0, 8)}...)`,
                });
                currentBatchKeys.add(key);
                continue;
            }
            currentBatchKeys.add(key);
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
            details.push({
                record: attendanceRecord,
                importStatus: 'NEW',
            });
        }
        if (recordsToInsert.length > 0) {
            (0, database_1.insertMany)('attendance', recordsToInsert);
        }
        this.cardService.updateCardFields(cardId, {
            attendanceBatchId: batchId,
            status: 'ATTENDANCE_IMPORTED',
        });
        const summary = {
            newCount: details.filter(d => d.importStatus === 'NEW').length,
            duplicateCurrentBatchCount: details.filter(d => d.importStatus === 'DUPLICATE_CURRENT_BATCH').length,
            duplicateHistoricalCount: details.filter(d => d.importStatus === 'DUPLICATE_HISTORICAL').length,
        };
        return { batchId, records: importedRecords, details, summary };
    }
    supplementTickets(cardId, records, supplementedBy) {
        const batchId = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const importedRecords = [];
        const details = [];
        const existingRecords = this.getTicketsByCardId(cardId);
        const existingKeyToRecord = new Map();
        for (const r of existingRecords) {
            const key = `${r.classDate}_${r.className}_${r.studentName}`;
            existingKeyToRecord.set(key, r);
        }
        const currentBatchKeys = new Set();
        const recordsToInsert = [];
        for (const record of records) {
            const key = `${record.classDate}_${record.className}_${record.studentName}`;
            if (currentBatchKeys.has(key)) {
                details.push({
                    record: {
                        id: '',
                        cardId,
                        ...record,
                        exportedAt: now,
                        exportBatchId: batchId,
                    },
                    importStatus: 'DUPLICATE_CURRENT_BATCH',
                    duplicateOf: key,
                });
                continue;
            }
            const isManualSupplement = !!record.supplementNote;
            if (existingKeyToRecord.has(key)) {
                const existing = existingKeyToRecord.get(key);
                if (isManualSupplement) {
                    details.push({
                        record: {
                            id: '',
                            cardId,
                            ...record,
                            exportedAt: now,
                            exportBatchId: batchId,
                        },
                        importStatus: 'DUPLICATE_HISTORICAL',
                        duplicateOf: `历史记录(${existing.exportBatchId.substring(0, 8)}...)`,
                        supplementNote: record.supplementNote,
                    });
                }
                else {
                    details.push({
                        record: {
                            id: '',
                            cardId,
                            ...record,
                            exportedAt: now,
                            exportBatchId: batchId,
                        },
                        importStatus: 'DUPLICATE_HISTORICAL',
                        duplicateOf: `历史记录(${existing.exportBatchId.substring(0, 8)}...)`,
                    });
                }
                currentBatchKeys.add(key);
                continue;
            }
            currentBatchKeys.add(key);
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
            const status = isManualSupplement ? 'MANUAL_SUPPLEMENT' : 'NEW';
            details.push({
                record: ticketRecord,
                importStatus: status,
                supplementNote: record.supplementNote,
            });
        }
        if (recordsToInsert.length > 0) {
            (0, database_1.insertMany)('tickets', recordsToInsert);
        }
        this.cardService.updateCardFields(cardId, {
            ticketBatchId: batchId,
            status: 'TICKET_SUPPLEMENTED',
        });
        const summary = {
            newCount: details.filter(d => d.importStatus === 'NEW').length,
            duplicateCurrentBatchCount: details.filter(d => d.importStatus === 'DUPLICATE_CURRENT_BATCH').length,
            duplicateHistoricalCount: details.filter(d => d.importStatus === 'DUPLICATE_HISTORICAL').length,
            manualSupplementCount: details.filter(d => d.importStatus === 'MANUAL_SUPPLEMENT').length,
        };
        return { batchId, records: importedRecords, details, summary };
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
