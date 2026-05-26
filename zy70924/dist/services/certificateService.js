"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCertificateByNumber = exports.revokeCertificate = exports.generateCertificates = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const auditService_1 = require("./auditService");
const generateCertificates = async (batchId, operator) => {
    const rules = await getBatchRules(batchId);
    const students = await getBatchStudents(batchId);
    let generated = 0;
    let skipped = 0;
    const now = new Date().toISOString();
    for (const student of students) {
        const existing = await getCertificateByStudent(batchId, student.id);
        if (existing) {
            skipped++;
            continue;
        }
        const stats = await calculateStudentStats(batchId, student.id, rules);
        const qualified = checkQualification(stats, rules);
        const certId = (0, uuid_1.v4)();
        const certNumber = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        await new Promise((resolve, reject) => {
            database_1.db.run(`INSERT INTO certificates 
         (id, certificate_number, student_id, batch_id, issue_date, status, 
          final_score, attendance_rate, homework_avg_score, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [certId, certNumber, student.id, batchId, qualified ? now : null,
                qualified ? 'issued' : 'pending', stats.finalScore, stats.attendanceRate,
                stats.homeworkAvg, now], (err) => err ? reject(err) : resolve());
        });
        generated++;
    }
    await (0, auditService_1.logAction)({
        batch_id: batchId,
        action: 'generate_certificates',
        details: `生成证书 ${generated} 份, 跳过 ${skipped} 份`,
        operator
    });
    return { generated, skipped };
};
exports.generateCertificates = generateCertificates;
const revokeCertificate = async (certificateId, reason, revokedBy) => {
    const cert = await getCertificateById(certificateId);
    if (!cert)
        throw new Error('证书不存在');
    const now = new Date().toISOString();
    await new Promise((resolve, reject) => {
        database_1.db.run(`UPDATE certificates 
       SET status = 'revoked', revoke_reason = ?, revoked_by = ?, revoked_at = ?
       WHERE id = ?`, [reason, revokedBy, now, certificateId], (err) => err ? reject(err) : resolve());
    });
    await (0, auditService_1.addReviewRecord)({
        record_type: 'certificate',
        record_id: certificateId,
        batch_id: cert.batch_id,
        student_id: cert.student_id,
        action: 'revoke',
        reason,
        processed_by: revokedBy,
        previous_status: cert.status,
        new_status: 'revoked'
    });
    await (0, auditService_1.logAction)({
        batch_id: cert.batch_id,
        student_id: cert.student_id,
        certificate_id: certificateId,
        action: 'revoke_certificate',
        details: reason,
        operator: revokedBy
    });
};
exports.revokeCertificate = revokeCertificate;
const getCertificateByNumber = (certNumber) => {
    return new Promise((resolve, reject) => {
        database_1.db.get(`SELECT c.*, s.employee_id, s.name as student_name, s.department,
              b.course_name, b.course_code, b.batch_number
       FROM certificates c
       JOIN students s ON c.student_id = s.id
       JOIN batches b ON c.batch_id = b.id
       WHERE c.certificate_number = ?`, [certNumber], (err, row) => err ? reject(err) : resolve(row || null));
    });
};
exports.getCertificateByNumber = getCertificateByNumber;
const getBatchRules = (batchId) => {
    return new Promise((resolve, reject) => {
        database_1.db.get(`SELECT * FROM course_rules WHERE batch_id = ?`, [batchId], (err, row) => {
            err ? reject(err) : resolve(row);
        });
    });
};
const getBatchStudents = (batchId) => {
    return new Promise((resolve, reject) => {
        database_1.db.all(`SELECT * FROM students WHERE batch_id = ?`, [batchId], (err, rows) => {
            err ? reject(err) : resolve(rows);
        });
    });
};
const getCertificateByStudent = (batchId, studentId) => {
    return new Promise((resolve, reject) => {
        database_1.db.get(`SELECT * FROM certificates WHERE batch_id = ? AND student_id = ?`, [batchId, studentId], (err, row) => err ? reject(err) : resolve(row));
    });
};
const getCertificateById = (certId) => {
    return new Promise((resolve, reject) => {
        database_1.db.get(`SELECT * FROM certificates WHERE id = ?`, [certId], (err, row) => {
            err ? reject(err) : resolve(row);
        });
    });
};
const calculateStudentStats = (batchId, studentId, rules) => {
    return new Promise(async (resolve, reject) => {
        const attendance = await new Promise((res, rej) => {
            database_1.db.all(`SELECT * FROM attendance_records WHERE batch_id = ? AND student_id = ?`, [batchId, studentId], (err, rows) => err ? rej(err) : res(rows));
        });
        const homework = await new Promise((res, rej) => {
            database_1.db.all(`SELECT * FROM homework_records WHERE batch_id = ? AND student_id = ?`, [batchId, studentId], (err, rows) => err ? rej(err) : res(rows));
        });
        const validAttendance = attendance.filter(a => ['normal', 'late', 'makeup_approved'].includes(a.status)).length;
        const attendanceRate = attendance.length > 0 ? validAttendance / attendance.length : 0;
        const gradedHomework = homework.filter(h => h.score !== null);
        const homeworkAvg = gradedHomework.length > 0
            ? gradedHomework.reduce((sum, h) => sum + h.score, 0) / gradedHomework.length
            : 0;
        const latePenalty = attendance
            .filter(a => a.status === 'late')
            .reduce((sum, a) => sum + (rules.late_penalty_score || 0), 0);
        const finalScore = Math.max(0, (attendanceRate * 40 + homeworkAvg * 0.6) - latePenalty);
        resolve({
            attendanceRate: Math.round(attendanceRate * 10000) / 100,
            homeworkAvg: Math.round(homeworkAvg * 100) / 100,
            finalScore: Math.round(finalScore * 100) / 100
        });
    });
};
const checkQualification = (stats, rules) => {
    if (stats.attendanceRate < (rules.min_attendance_rate || 0.8) * 100) {
        return false;
    }
    if (stats.homeworkAvg < (rules.min_homework_score || 60)) {
        return false;
    }
    return true;
};
