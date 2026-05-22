"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileParserService = exports.FileParserService = void 0;
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
const DataStore_1 = require("../store/DataStore");
class FileParserService {
    async parseMentorCSV(buffer) {
        const mentors = [];
        return new Promise((resolve, reject) => {
            const readable = stream_1.Readable.from(buffer.toString('utf-8'));
            readable
                .pipe((0, csv_parser_1.default)({
                headers: ['id', 'name', 'department', 'major', 'direction', 'quota', 'usedQuota'],
                skipLines: 1
            }))
                .on('data', (row) => {
                mentors.push({
                    id: row.id?.trim() || DataStore_1.dataStore.generateId(),
                    name: row.name?.trim() || '',
                    department: row.department?.trim() || '',
                    major: row.major?.trim() || '',
                    direction: row.direction?.trim() || '',
                    quota: parseInt(row.quota) || 0,
                    usedQuota: parseInt(row.usedQuota) || 0
                });
            })
                .on('end', () => resolve(mentors))
                .on('error', reject);
        });
    }
    parseApplicationsJSON(jsonString) {
        const data = JSON.parse(jsonString);
        const applications = Array.isArray(data) ? data : [data];
        return applications.map((app) => ({
            id: app.id?.trim() || DataStore_1.dataStore.generateId(),
            batchId: app.batchId?.trim() || '',
            studentId: app.studentId?.trim() || '',
            studentName: app.studentName?.trim() || '',
            studentMajor: app.studentMajor?.trim() || '',
            mentorId: app.mentorId?.trim() || '',
            mentorName: app.mentorName?.trim() || '',
            priority: parseInt(app.priority) || 1,
            isTransfer: Boolean(app.isTransfer),
            status: app.status || 'pending',
            createdAt: app.createdAt ? new Date(app.createdAt) : new Date()
        }));
    }
    parseTransfersJSON(jsonString) {
        const data = JSON.parse(jsonString);
        const transfers = Array.isArray(data) ? data : [data];
        return transfers.map((t) => ({
            id: t.id?.trim() || DataStore_1.dataStore.generateId(),
            batchId: t.batchId?.trim() || '',
            studentId: t.studentId?.trim() || '',
            studentName: t.studentName?.trim() || '',
            fromMajor: t.fromMajor?.trim() || '',
            toMajor: t.toMajor?.trim() || '',
            reason: t.reason?.trim() || '',
            status: t.status || 'pending',
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date()
        }));
    }
    formatMentorCSV() {
        const mentors = DataStore_1.dataStore.getAllMentors();
        const headers = ['ID', '姓名', '院系', '专业', '研究方向', '总名额', '已用名额'];
        const rows = mentors.map(m => [
            m.id,
            m.name,
            m.department,
            m.major,
            m.direction,
            m.quota,
            m.usedQuota
        ]);
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
}
exports.FileParserService = FileParserService;
exports.fileParserService = new FileParserService();
