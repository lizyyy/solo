import { Router, Request, Response } from 'express';
import { db } from '../database';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const certificates = db.getAllCertificates();
  res.success(certificates);
});

router.get('/:id', (req: Request, res: Response) => {
  const certificate = db.getCertificateById(req.params.id);
  if (!certificate) {
    return res.notFound('证书不存在');
  }
  res.success(certificate);
});

router.get('/student/:studentId', (req: Request, res: Response) => {
  const certificate = db.getCertificateByStudentId(req.params.studentId);
  res.success(certificate);
});

router.post('/', (req: Request, res: Response) => {
  const { certificateNo, studentId, status, issueDate, operator } = req.body;
  
  if (!certificateNo || !studentId) {
    return res.error('MISSING_FIELDS', '请填写必填字段');
  }

  const student = db.getStudentById(studentId);
  if (!student) {
    return res.error('STUDENT_NOT_FOUND', '学员不存在');
  }

  const existingCert = db.getCertificateByNo(certificateNo);
  if (existingCert) {
    return res.error('DUPLICATE_CERTIFICATE_NO', '证书编号已存在');
  }

  const certificate = db.createCertificate({ 
    certificateNo, studentId, status: status || 'pending', issueDate, createdBy: operator || 'system'
  }, operator || 'system');
  
  res.success(certificate);
});

router.put('/:id', (req: Request, res: Response) => {
  const { operator, ...data } = req.body;
  const certificate = db.updateCertificate(req.params.id, data, operator || 'system');
  
  if (!certificate) {
    return res.notFound('证书不存在');
  }
  res.success(certificate);
});

router.post('/:id/revoke', (req: Request, res: Response) => {
  const { reason, operator } = req.body;
  
  if (!reason) {
    return res.error('MISSING_REASON', '请提供撤销原因');
  }

  const certificate = db.revokeCertificate(req.params.id, reason, operator || 'system');
  
  if (!certificate) {
    return res.notFound('证书不存在');
  }
  res.success(certificate);
});

router.post('/:id/recheck', (req: Request, res: Response) => {
  const { operator } = req.body;
  const certificate = db.recheckCertificate(req.params.id, operator || 'system');
  
  if (!certificate) {
    return res.notFound('证书不存在');
  }
  res.success(certificate);
});

export default router;
