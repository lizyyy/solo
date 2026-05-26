import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { logAction, addReviewRecord } from './auditService';

export const generateCertificates = async (
  batchId: string,
  operator: string
): Promise<{ generated: number; skipped: number }> => {
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
    
    const certId = uuidv4();
    const certNumber = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO certificates 
         (id, certificate_number, student_id, batch_id, issue_date, status, 
          final_score, attendance_rate, homework_avg_score, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [certId, certNumber, student.id, batchId, qualified ? now : null,
         qualified ? 'issued' : 'pending', stats.finalScore, stats.attendanceRate, 
         stats.homeworkAvg, now],
        (err) => err ? reject(err) : resolve()
      );
    });
    
    generated++;
  }
  
  await logAction({
    batch_id: batchId,
    action: 'generate_certificates',
    details: `生成证书 ${generated} 份, 跳过 ${skipped} 份`,
    operator
  });
  
  return { generated, skipped };
};

export const revokeCertificate = async (
  certificateId: string,
  reason: string,
  revokedBy: string
): Promise<void> => {
  const cert = await getCertificateById(certificateId);
  if (!cert) throw new Error('证书不存在');
  
  const now = new Date().toISOString();
  
  await new Promise<void>((resolve, reject) => {
    db.run(
      `UPDATE certificates 
       SET status = 'revoked', revoke_reason = ?, revoked_by = ?, revoked_at = ?
       WHERE id = ?`,
      [reason, revokedBy, now, certificateId],
      (err) => err ? reject(err) : resolve()
    );
  });
  
  await addReviewRecord({
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
  
  await logAction({
    batch_id: cert.batch_id,
    student_id: cert.student_id,
    certificate_id: certificateId,
    action: 'revoke_certificate',
    details: reason,
    operator: revokedBy
  });
};

export const getCertificateByNumber = (certNumber: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT c.*, s.employee_id, s.name as student_name, s.department,
              b.course_name, b.course_code, b.batch_number
       FROM certificates c
       JOIN students s ON c.student_id = s.id
       JOIN batches b ON c.batch_id = b.id
       WHERE c.certificate_number = ?`,
      [certNumber],
      (err, row) => err ? reject(err) : resolve(row || null)
    );
  });
};

const getBatchRules = (batchId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM course_rules WHERE batch_id = ?`, [batchId], (err, row) => {
      err ? reject(err) : resolve(row);
    });
  });
};

const getBatchStudents = (batchId: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM students WHERE batch_id = ?`, [batchId], (err, rows) => {
      err ? reject(err) : resolve(rows);
    });
  });
};

const getCertificateByStudent = (batchId: string, studentId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM certificates WHERE batch_id = ? AND student_id = ?`,
      [batchId, studentId],
      (err, row) => err ? reject(err) : resolve(row)
    );
  });
};

const getCertificateById = (certId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM certificates WHERE id = ?`, [certId], (err, row) => {
      err ? reject(err) : resolve(row);
    });
  });
};

const calculateStudentStats = (
  batchId: string,
  studentId: string,
  rules: any
): Promise<{
  attendanceRate: number;
  homeworkAvg: number;
  finalScore: number;
}> => {
  return new Promise(async (resolve, reject) => {
    const attendance = await new Promise<any[]>((res, rej) => {
      db.all(
        `SELECT * FROM attendance_records WHERE batch_id = ? AND student_id = ?`,
        [batchId, studentId],
        (err, rows) => err ? rej(err) : res(rows)
      );
    });
    
    const homework = await new Promise<any[]>((res, rej) => {
      db.all(
        `SELECT * FROM homework_records WHERE batch_id = ? AND student_id = ?`,
        [batchId, studentId],
        (err, rows) => err ? rej(err) : res(rows)
      );
    });
    
    const validAttendance = attendance.filter(a => 
      ['normal', 'late', 'makeup_approved'].includes(a.status)
    ).length;
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

const checkQualification = (stats: any, rules: any): boolean => {
  if (stats.attendanceRate < (rules.min_attendance_rate || 0.8) * 100) {
    return false;
  }
  if (stats.homeworkAvg < (rules.min_homework_score || 60)) {
    return false;
  }
  return true;
};
