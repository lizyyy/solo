"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importHomeworkJSON = exports.importAttendanceCSV = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const auditService_1 = require("./auditService");
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
const importAttendanceCSV = async (batchId, csvContent, operator) => {
    const results = [];
    const errors = [];
    return new Promise((resolve, reject) => {
        const stream = stream_1.Readable.from(csvContent);
        stream
            .pipe((0, csv_parser_1.default)())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
            try {
                let imported = 0;
                const now = new Date().toISOString();
                for (const row of results) {
                    if (!row['学员工号'] || !row['签到日期']) {
                        errors.push(`跳过无效行: ${JSON.stringify(row)}`);
                        continue;
                    }
                    const studentId = await getOrCreateStudent(batchId, row['学员工号'], row['学员姓名'], row['部门']);
                    const recordId = (0, uuid_1.v4)();
                    const { status, lateMinutes } = calculateAttendanceStatus(row['签到时间'], '09:00', 30);
                    await new Promise((res, rej) => {
                        database_1.db.run(`INSERT OR REPLACE INTO attendance_records 
                 (id, student_id, batch_id, session_date, check_in_time, check_out_time, status, late_minutes, is_makeup, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`, [recordId, studentId, batchId, row['签到日期'],
                            row['签到时间'] || null, row['签退时间'] || null,
                            status, lateMinutes, now], (err) => err ? rej(err) : res());
                    });
                    imported++;
                }
                await updateBatchStudentCount(batchId);
                await (0, auditService_1.logAction)({
                    batch_id: batchId,
                    action: 'import_attendance',
                    details: `导入签到记录 ${imported} 条`,
                    operator
                });
                resolve({ imported, errors });
            }
            catch (err) {
                reject(err);
            }
        })
            .on('error', reject);
    });
};
exports.importAttendanceCSV = importAttendanceCSV;
const importHomeworkJSON = async (batchId, homeworkList, operator) => {
    const now = new Date().toISOString();
    let imported = 0;
    for (const hw of homeworkList) {
        const studentId = await getStudentByEmployeeId(batchId, hw.学员工号);
        if (!studentId)
            continue;
        const recordId = (0, uuid_1.v4)();
        const status = hw.分数 !== undefined ? 'graded' : (hw.提交时间 ? 'submitted' : 'pending');
        await new Promise((resolve, reject) => {
            database_1.db.run(`INSERT OR REPLACE INTO homework_records 
         (id, student_id, batch_id, homework_name, score, submitted_at, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [recordId, studentId, batchId, hw.作业名称,
                hw.分数 || null, hw.提交时间 || null, status, now], (err) => err ? reject(err) : resolve());
        });
        imported++;
    }
    await (0, auditService_1.logAction)({
        batch_id: batchId,
        action: 'import_homework',
        details: `导入作业记录 ${imported} 条`,
        operator
    });
    return { imported };
};
exports.importHomeworkJSON = importHomeworkJSON;
const getOrCreateStudent = (batchId, employeeId, name, department) => {
    return new Promise((resolve, reject) => {
        database_1.db.get(`SELECT id FROM students WHERE batch_id = ? AND employee_id = ?`, [batchId, employeeId], (err, row) => {
            if (err)
                return reject(err);
            if (row)
                return resolve(row.id);
            const id = (0, uuid_1.v4)();
            const now = new Date().toISOString();
            database_1.db.run(`INSERT INTO students (id, batch_id, employee_id, name, department, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`, [id, batchId, employeeId, name, department || null, now], (insertErr) => insertErr ? reject(insertErr) : resolve(id));
        });
    });
};
const getStudentByEmployeeId = (batchId, employeeId) => {
    return new Promise((resolve, reject) => {
        database_1.db.get(`SELECT id FROM students WHERE batch_id = ? AND employee_id = ?`, [batchId, employeeId], (err, row) => err ? reject(err) : resolve(row?.id || null));
    });
};
const updateBatchStudentCount = (batchId) => {
    return new Promise((resolve, reject) => {
        database_1.db.run(`UPDATE batches SET total_students = (
        SELECT COUNT(DISTINCT student_id) FROM attendance_records WHERE batch_id = ?
      ) WHERE id = ?`, [batchId, batchId], (err) => err ? reject(err) : resolve());
    });
};
const calculateAttendanceStatus = (checkInTime, expectedTime = '09:00', thresholdMinutes = 30) => {
    if (!checkInTime) {
        return { status: 'absent', lateMinutes: 0 };
    }
    const checkIn = parseTime(checkInTime);
    const expected = parseTime(expectedTime);
    if (checkIn <= expected) {
        return { status: 'normal', lateMinutes: 0 };
    }
    const lateMinutes = Math.floor((checkIn - expected) / 60000);
    if (lateMinutes > thresholdMinutes) {
        return { status: 'absent', lateMinutes };
    }
    return { status: 'late', lateMinutes };
};
const parseTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date.getTime();
};
