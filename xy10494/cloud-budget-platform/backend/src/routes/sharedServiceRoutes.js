const express = require('express');
const sharedServiceController = require('../controllers/sharedServiceController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', sharedServiceController.getSharedServices);
router.get('/:id', sharedServiceController.getSharedServiceById);
router.get('/:sharedServiceId/ratios/:effectiveMonth?', sharedServiceController.getAllocationRatios);

router.use(roleMiddleware('admin', 'finance'));

router.post('/', sharedServiceController.createSharedService);
router.put('/:id', sharedServiceController.updateSharedService);
router.delete('/:id', sharedServiceController.deleteSharedService);
router.post('/:sharedServiceId/ratios', sharedServiceController.createOrUpdateAllocationRatios);

module.exports = router;
