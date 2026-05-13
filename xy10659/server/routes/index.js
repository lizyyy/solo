const express = require('express');
const router = express.Router();

const vehicleRoutes = require('./vehicles');
const orderRoutes = require('./orders');
const itemRoutes = require('./items');
const ruleRoutes = require('./rules');
const verificationRoutes = require('./verifications');
const reminderRoutes = require('./reminders');
const exceptionRoutes = require('./exceptions');
const reportRoutes = require('./reports');
const statsRoutes = require('./stats');

router.use('/vehicles', vehicleRoutes);
router.use('/orders', orderRoutes);
router.use('/items', itemRoutes);
router.use('/rules', ruleRoutes);
router.use('/verifications', verificationRoutes);
router.use('/reminders', reminderRoutes);
router.use('/exceptions', exceptionRoutes);
router.use('/reports', reportRoutes);
router.use('/stats', statsRoutes);

module.exports = router;
