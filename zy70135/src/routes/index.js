const express = require('express');
const authRoutes = require('./auth-routes');
const blacklistRoutes = require('./blacklist-routes');
const exemptionRoutes = require('./exemption-routes');
const versionRoutes = require('./version-routes');
const reportRoutes = require('./report-routes');
const exportRoutes = require('./export-routes');
const ResponseUtils = require('../utils/response');

const router = express.Router();

router.get('/health', (req, res) => {
  ResponseUtils.success(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

router.use('/auth', authRoutes);
router.use('/blacklists', blacklistRoutes);
router.use('/exemptions', exemptionRoutes);
router.use('/versions', versionRoutes);
router.use('/reports', reportRoutes);
router.use('/exports', exportRoutes);

module.exports = router;
