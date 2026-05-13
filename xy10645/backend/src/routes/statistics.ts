import { Router, Request, Response } from 'express';
import { db } from '../database';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const students = db.getAllStudents();
  const attendances = db.getAllAttendances();
  const examScores = db.getAllExamScores();
  const retakeRecords = db.getAllRetakeRecords();
  const certificates = db.getAllCertificates();

  const passCount = examScores.filter(e => e.isPassed).length;
  const issuedCount = certificates.filter(c => c.status === 'issued').length;
  const revokedCount = certificates.filter(c => c.status === 'revoked').length;
  const recheckedCount = certificates.filter(c => c.status === 'rechecked').length;
  const pendingCount = certificates.filter(c => c.status === 'pending').length;

  const presentCount = attendances.filter(a => a.status === 'present').length;
  const absentCount = attendances.filter(a => a.status === 'absent').length;
  const lateCount = attendances.filter(a => a.status === 'late').length;

  res.success({
    students: students.length,
    attendances: {
      total: attendances.length,
      present: presentCount,
      absent: absentCount,
      late: lateCount
    },
    examScores: {
      total: examScores.length,
      passed: passCount,
      failed: examScores.length - passCount,
      passRate: examScores.length > 0 ? (passCount / examScores.length * 100).toFixed(2) : 0
    },
    retakeRecords: retakeRecords.length,
    certificates: {
      total: certificates.length,
      issued: issuedCount,
      revoked: revokedCount,
      rechecked: recheckedCount,
      pending: pendingCount
    }
  });
});

export default router;
