import { Router } from 'express';
import { whitelistController } from '../controllers/whitelist.controller';

const router = Router();

router.post('/', whitelistController.create.bind(whitelistController));
router.get('/', whitelistController.findAll.bind(whitelistController));
router.get('/check', whitelistController.checkWhitelist.bind(whitelistController));
router.post('/import', whitelistController.bulkImport.bind(whitelistController));
router.get('/export', whitelistController.export.bind(whitelistController));
router.post('/refresh-statuses', whitelistController.refreshStatuses.bind(whitelistController));
router.get('/:id', whitelistController.findById.bind(whitelistController));
router.put('/:id', whitelistController.update.bind(whitelistController));
router.post('/:id/approve', whitelistController.approve.bind(whitelistController));
router.post('/:id/reject', whitelistController.reject.bind(whitelistController));
router.post('/:id/revoke', whitelistController.revoke.bind(whitelistController));
router.post('/:id/resubmit', whitelistController.resubmit.bind(whitelistController));
router.get('/:id/histories', whitelistController.getHistories.bind(whitelistController));

export default router;
