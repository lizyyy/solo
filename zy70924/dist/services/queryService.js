"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyExportCount = exports.getBatchAttendanceReport = exports.exportToCSV = exports.getStudentDetail = exports.queryRecords = void 0;
const database_1 = require("../database");
const json2csv_1 = require("json2csv");
const queryRecords = async (filters) => {
    let sql = `
    SELECT 
      s.employee_id,
      s.name as student_name,
      s.department,
      b.course_name,
      b.course_code,
      b.batch_number,
      c.certificate_number,
      c.status as certificate_status,
      c.final_score,
      c.attendance_rate,
      c.homework_avg_score,
      c.issue_date,
      c.revoke_reason
    FROM students s
    JOIN batches b ON s.batch_id = b.id
    LEFT JOIN certificates c ON s.id = c.student_id AND s.batch_id = c.batch_id
    WHERE 1=1
  `;
    const params = [];
    if (filters.batch_id) {
        sql += ` AND b.id = ?`;
        params.push(filters.batch_id);
    }
    if (filters.employee_id) {
        sql += ` AND s.employee_id = ?`;
        params.push(filters.employee_id);
    }
    if (filters.certificate_number) {
        sql += ` AND c.certificate_number = ?`;
        params.push(filters.certificate_number);
    }
    if (filters.course_code) {
        sql += ` AND b.course_code = ?`;
        params.push(filters.course_code);
    }
    if (filters.status) {
        sql += ` AND c.status = ?`;
        params.push(filters.status);
    }
    sql += ` ORDER BY b.created_at DESC, s.employee_id`;
    return new Promise((resolve, reject) => {
        database_1.db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    });
};
exports.queryRecords = queryRecords;
const getStudentDetail = async (batchId, employeeId) => {
    const student = await new Promise((resolve, reject) => {
        database_1.db.get(`SELECT * FROM students WHERE batch_id = ? AND employee_id = ?`, [batchId, employeeId], (err, row) => err ? reject(err) : resolve(row));
    });
    if (!student)
        return null;
    const attendance = await new Promise((resolve, reject) => {
        database_1.db.all(`SELECT * FROM attendance_records WHERE batch_id = ? AND student_id = ? ORDER BY session_date`, [batchId, student.id], (err, rows) => err ? reject(err) : resolve(rows));
    });
    const homework = await new Promise((resolve, reject) => {
        database_1.db.all(`SELECT * FROM homework_records WHERE batch_id = ? AND student_id = ? ORDER BY created_at`, [batchId, student.id], (err, rows) => err ? reject(err) : resolve(rows));
    });
    const certificate = await new Promise((resolve, reject) => {
        database_1.db.get(`SELECT * FROM certificates WHERE batch_id = ? AND student_id = ?`, [batchId, student.id], (err, row) => err ? reject(err) : resolve(row));
    });
    const reviews = await new Promise((resolve, reject) => {
        database_1.db.all(`SELECT * FROM record_reviews WHERE batch_id = ? AND student_id = ? ORDER BY processed_at DESC`, [batchId, student.id], (err, rows) => err ? reject(err) : resolve(rows));
    });
    return {
        student,
        attendance_records: attendance,
        homework_records: homework,
        certificate,
        review_history: reviews
    };
};
exports.getStudentDetail = getStudentDetail;
const exportToCSV = async (filters) => {
    const records = await (0, exports.queryRecords)(filters);
    const formatted = records.map(r => ({
        学员工号: r.employee_id || '',
        学员姓名: r.student_name || '',
        部门: r.department || '',
        课程名称: r.course_name || '',
        课程代码: r.course_code || '',
        批次号: r.batch_number || '',
        出勤率: r.attendance_rate !== null ? `${r.attendance_rate}%` : '',
        作业平均分: r.homework_avg_score !== null ? r.homework_avg_score : '',
        最终成绩: r.final_score !== null ? r.final_score : '',
        证书编号: r.certificate_number || '',
        证书状态: r.certificate_status || '',
        颁发日期: r.issue_date || '',
        撤销原因: r.revoke_reason || ''
    }));
    const parser = new json2csv_1.Parser();
    return parser.parse(formatted);
};
exports.exportToCSV = exportToCSV;
const getBatchAttendanceReport = (batchId) => {
    return new Promise((resolve, reject) => {
        database_1.db.all(`
      SELECT 
        s.employee_id,
        s.name as student_name,
        ar.session_date,
        ar.status,
        ar.late_minutes,
        ar.is_makeup,
        ar.makeup_reason
      FROM students s
      JOIN attendance_records ar ON s.id = ar.student_id
      WHERE s.batch_id = ?
      ORDER BY s.employee_id, ar.session_date
    `, [batchId], (err, rows) => err ? reject(err) : resolve(rows));
    });
};
exports.getBatchAttendanceReport = getBatchAttendanceReport;
const verifyExportCount = async (filters) => {
    const records = await (0, exports.queryRecords)(filters);
    const csvContent = await (0, exports.exportToCSV)(filters);
    const csvLines = csvContent.split('\n').filter(line => line.trim()).length - 1;
    return {
        queryCount: records.length,
        exportCount: csvLines,
        matches: records.length === csvLines
    };
};
exports.verifyExportCount = verifyExportCount;
