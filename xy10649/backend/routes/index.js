const express = require('express');
const router = express.Router();

const inventoryRoutes = require('./inventory');
const planRoutes = require('./plans');
const customerRoutes = require('./customers');
const claimRoutes = require('./claims');
const expressRoutes = require('./express');
const returnRoutes = require('./returns');
const exceptionRoutes = require('./exceptions');
const reportRoutes = require('./reports');
const statsRoutes = require('./stats');

router.use('/inventory', inventoryRoutes);
router.use('/plans', planRoutes);
router.use('/customers', customerRoutes);
router.use('/claims', claimRoutes);
router.use('/express', expressRoutes);
router.use('/returns', returnRoutes);
router.use('/exceptions', exceptionRoutes);
router.use('/reports', reportRoutes);
router.use('/stats', statsRoutes);

module.exports = router;
