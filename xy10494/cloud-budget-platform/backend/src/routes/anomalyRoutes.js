const express = require('express');
const anomalyController = require('../controllers/anomalyController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', anomalyController.getAnomalies);
router.get('/stats', anomalyController.getAnomalyStats);
router.get('/:id', anomalyController.getAnomalyById);

router.use(roleMiddleware('admin', 'finance'));

router.put('/:id', anomalyController.updateAnomalyStatus);

module.exports = router;
