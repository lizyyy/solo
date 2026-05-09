const express = require('express');

const applicationsRouter = require('./applications');
const extensionsRouter = require('./extensions');
const withdrawalsRouter = require('./withdrawals');
const finesRouter = require('./fines');
const roadSectionsRouter = require('./roadSections');
const reportsRouter = require('./reports');

const router = express.Router();

router.use('/applications', applicationsRouter);
router.use('/applications/:applicationId/extensions', extensionsRouter);
router.use('/applications/:applicationId/withdrawals', withdrawalsRouter);
router.use('/applications/:applicationId/fines', finesRouter);
router.use('/road-sections', roadSectionsRouter);
router.use('/reports', reportsRouter);

module.exports = router;
