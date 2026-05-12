const express = require('express');
const router = express.Router();

const equipmentRoutes = require('./equipmentRoutes');
const orderRoutes = require('./orderRoutes');
const reportRoutes = require('./reportRoutes');
const demoRoutes = require('./demoRoutes');

router.use(equipmentRoutes);
router.use(orderRoutes);
router.use(reportRoutes);
router.use('/demo', demoRoutes);

module.exports = router;