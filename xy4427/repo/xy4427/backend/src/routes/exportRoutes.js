const express = require('express');
const router = express.Router();
const {
  exportReleaseMarkdownHandler,
  downloadReleaseMarkdownHandler,
  exportAuditPackageHandler,
  downloadAuditPackageHandler,
} = require('../controllers/exportController');

router.post('/release-markdown', exportReleaseMarkdownHandler);
router.get('/release-markdown/download', downloadReleaseMarkdownHandler);
router.post('/audit-package', exportAuditPackageHandler);
router.get('/audit-package/download', downloadAuditPackageHandler);

module.exports = router;
