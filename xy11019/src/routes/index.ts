import { Router } from 'express';
import { authorizationController } from '../controllers/authorizationController';
import { childController } from '../controllers/childController';
import { guardianController } from '../controllers/guardianController';
import { exportController } from '../controllers/exportController';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '儿童托管班接送授权API运行正常',
    timestamp: new Date().toISOString()
  });
});

router.get('/authorizations', authorizationController.getAll);
router.get('/authorizations/:id', authorizationController.getById);
router.post('/authorizations', authorizationController.create);
router.put('/authorizations/:id/status', authorizationController.updateStatus);
router.get('/authorizations/:id/consistency', authorizationController.checkConsistency);
router.get('/authorizations/validate/pickup', authorizationController.validatePickup);
router.delete('/authorizations/:id', authorizationController.delete);

router.get('/children', childController.getAll);
router.get('/children/:id', childController.getById);
router.post('/children', childController.create);

router.get('/guardians', guardianController.getAll);
router.get('/guardians/:id', guardianController.getById);
router.post('/guardians', guardianController.create);

router.post('/export/json', exportController.exportJson);
router.post('/export/csv', exportController.exportCsv);
router.get('/export/files', exportController.listFiles);
router.get('/export/download/:filename', exportController.downloadFile);

export default router;
