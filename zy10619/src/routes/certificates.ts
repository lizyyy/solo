import { Router, Request, Response } from 'express';
import {
  createCertificate,
  getCertificate,
  listCertificates,
  updateCertificate,
  getCertificateHistory,
  importCertificates,
  exportCertificates,
} from '../services/certificateService';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  const cert = createCertificate(req.body);
  res.status(201).json(cert);
});

router.get('/', (req: Request, res: Response) => {
  const certificates = listCertificates();
  res.json(certificates);
});

router.get('/:id', (req: Request, res: Response) => {
  const cert = getCertificate(String(req.params.id));
  if (!cert) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: '证书不存在', suggestion: 'fix_data' as const } });
    return;
  }
  res.json(cert);
});

router.patch('/:id', (req: Request, res: Response) => {
  const cert = updateCertificate(String(req.params.id), req.body);
  res.json(cert);
});

router.get('/:id/history', (req: Request, res: Response) => {
  const history = getCertificateHistory(String(req.params.id));
  res.json(history);
});

router.post('/import', (req: Request, res: Response) => {
  const { data, operator } = req.body;
  const result = importCertificates(data, operator);
  res.json(result);
});

router.get('/export/csv', (req: Request, res: Response) => {
  const csv = exportCertificates();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="certificates.csv"');
  res.send('\uFEFF' + csv);
});

export default router;
