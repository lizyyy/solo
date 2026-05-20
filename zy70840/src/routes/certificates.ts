import { Router, Request, Response } from 'express';
import CertificateService from '../services/CertificateService';
import dayjs from 'dayjs';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { applicationId, certificateNo, type, version, issueDate, expiryDate, attachmentUrl } = req.body;
    
    if (!applicationId || !certificateNo || !type || !version || !issueDate || !expiryDate) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }

    const certificate = await CertificateService.addCertificate(
      applicationId,
      certificateNo,
      type,
      version,
      dayjs(issueDate).toDate(),
      dayjs(expiryDate).toDate(),
      attachmentUrl
    );

    res.json(certificate);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/application/:applicationId', async (req: Request, res: Response) => {
  try {
    const certificates = await CertificateService.getCertificatesByApplication(parseInt(req.params.applicationId));
    res.json(certificates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/application/:applicationId/check', async (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    const result = await CertificateService.checkCertificates(
      parseInt(req.params.applicationId),
      operator || 'system'
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/version/:version', async (req: Request, res: Response) => {
  try {
    const certificates = await CertificateService.getCertificatesByVersion(req.params.version);
    res.json(certificates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
