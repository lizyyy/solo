import { Router } from 'express';
import * as controller from '../controllers/whitelistController';

const router = Router();

router.get('/', controller.listRecords);
router.get('/export', controller.exportRecords);
router.get('/check-audit/:account', controller.checkAuditBypass);
router.get('/:id', controller.getRecord);
router.get('/:id/history', controller.getHistory);

router.post('/', controller.createRecord);
router.post('/import', controller.importRecords);
router.post('/:id/submit-expire', controller.submitExpire);
router.post('/:id/approve-expire', controller.approveExpire);
router.post('/:id/withdraw', controller.withdraw);
router.post('/:id/request-restore', controller.requestRestore);
router.post('/:id/approve-restore', controller.approveRestore);
router.post('/:id/remark', controller.addRemark);

export default router;
