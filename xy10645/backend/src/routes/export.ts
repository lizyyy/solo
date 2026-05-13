import { Router, Request, Response } from 'express';
import * as ExcelJS from 'exceljs';
import { db } from '../database';

const router = Router();

router.get('/certificates', async (req: Request, res: Response) => {
  const { responsiblePerson, startDate, endDate, status } = req.query;
  
  let certificates = db.getAllCertificates();
  const students = db.getAllStudents();
  const histories = db.getStatusHistory('certificate');

  if (status) {
    certificates = certificates.filter(c => c.status === status);
  }

  if (startDate || endDate) {
    certificates = certificates.filter(c => {
      const issueDate = c.issueDate ? new Date(c.issueDate);
      if (startDate && issueDate < new Date(startDate as string)) return false;
      if (endDate && issueDate > new Date(endDate as string)) return false;
      return true;
    });
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('证书发放名单');

  worksheet.columns = [
    { header: '证书编号', key: 'certificateNo', width: 20 },
    { header: '学员姓名', key: 'studentName', width: 15 },
    { header: '身份证号', key: 'idCard', width: 20 },
    { header: '课程', key: 'course', width: 20 },
    { header: '状态', key: 'status', width: 12 },
    { header: '发放日期', key: 'issueDate', width: 15 },
    { header: '撤销原因', key: 'revokeReason', width: 25 },
    { header: '撤销人', key: 'revokedBy', width: 15 },
    { header: '创建人', key: 'createdBy', width: 15 },
    { header: '创建时间', key: 'createdAt', width: 20 }
  ];

  certificates.forEach(cert => {
    const student = students.find(s => s.id === cert.studentId);
    const certHistories = histories.filter(h => h.entityId === cert.id);
    
    worksheet.addRow({
      certificateNo: cert.certificateNo,
      studentName: student?.name || '',
      idCard: student?.idCard || '',
      course: student?.course || '',
      status: cert.status === 'issued' ? '已发放' : 
              cert.status === 'revoked' ? '已撤销' :
              cert.status === 'rechecked' ? '已复核' : '待处理',
      issueDate: cert.issueDate || '',
      revokeReason: cert.revokeReason || '',
      revokedBy: cert.revokedBy || '',
      createdBy: cert.createdBy,
      createdAt: cert.createdAt
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=certificates.xlsx');

  await workbook.xlsx.write(res);
  res.end();
});

router.get('/history', async (req: Request, res: Response) => {
  const { responsiblePerson, startDate, endDate } = req.query;
  
  let histories = db.getStatusHistory();

  if (responsiblePerson) {
    histories = histories.filter(h => h.changedBy === responsiblePerson);
  }

  if (startDate || endDate) {
    histories = histories.filter(h => {
      const changedAt = new Date(h.changedAt);
      if (startDate && changedAt < new Date(startDate as string)) return false;
      if (endDate && changedAt > new Date(endDate as string)) return false;
      return true;
    });
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('变更历史');

  worksheet.columns = [
    { header: '实体类型', key: 'entityType', width: 15 },
    { header: '字段名', key: 'fieldName', width: 15 },
    { header: '旧值', key: 'oldValue', width: 30 },
    { header: '新值', key: 'newValue', width: 30 },
    { header: '操作人', key: 'changedBy', width: 15 },
    { header: '操作时间', key: 'changedAt', width: 20 },
    { header: '备注', key: 'remark', width: 30 }
  ];

  histories.forEach(h => {
    worksheet.addRow({
      entityType: h.entityType === 'student' ? '学员' :
                 h.entityType === 'attendance' ? '出勤' :
                 h.entityType === 'examScore' ? '考试成绩' :
                 h.entityType === 'retake' ? '补考记录' : '证书',
      fieldName: h.fieldName,
      oldValue: String(h.oldValue || ''),
      newValue: String(h.newValue || ''),
      changedBy: h.changedBy,
      changedAt: h.changedAt,
      remark: h.remark || ''
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=history.xlsx');

  await workbook.xlsx.write(res);
  res.end();
});

export default router;
