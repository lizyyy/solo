import { Router, Request, Response } from 'express';
import * as certificateService from '../services/certificateService';
import * as auditService from '../services/auditService';

const router = Router();

router.get('/:certNumber', async (req: Request, res: Response) => {
  try {
    const cert = await certificateService.getCertificateByNumber(req.params.certNumber);
    if (!cert) return res.status(404).json({ error: '证书不存在' });
    res.json(cert);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:certId/revoke', async (req: Request, res: Response) => {
  try {
    const { reason, operator } = req.body;
    await certificateService.revokeCertificate(req.params.certId, reason, operator);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:certId/audit-logs', async (req: Request, res: Response) => {
  try {
    const logs = await auditService.getAuditLogs({ certificate_id: req.params.certId });
    res.json(logs);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
