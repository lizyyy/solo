import { Router } from 'express';
import { revocationController } from './controllers/revocation.controller';

const router = Router();

router.post('/revoke', revocationController.revokeCertificate.bind(revocationController));
router.post('/review', revocationController.reviewRevocation.bind(revocationController));
router.post('/reject', revocationController.rejectRevocation.bind(revocationController));
router.post('/restore', revocationController.restoreCertificate.bind(revocationController));

router.get('/revocations', revocationController.getRevocationList.bind(revocationController));
router.get('/revocations/:id', revocationController.getRevocationDetail.bind(revocationController));

router.get('/certificates', revocationController.getCertificateList.bind(revocationController));
router.get('/certificates/:id', revocationController.getCertificateDetail.bind(revocationController));
router.get('/certificates/:certificateId/history', revocationController.getCertificateHistory.bind(revocationController));

router.get('/verify/:certificateNo', revocationController.verifyCertificateExternal.bind(revocationController));

router.post('/import', revocationController.importRevocations.bind(revocationController));
router.get('/export/revocations', revocationController.exportRevocations.bind(revocationController));
router.get('/export/certificates', revocationController.exportCertificates.bind(revocationController));

router.get('/import-records', revocationController.getImportRecords.bind(revocationController));

export default router;
