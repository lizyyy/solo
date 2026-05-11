const express = require('express');
const router = express.Router();
const {
  getVersionById,
  createVersion,
  updateVersion,
  confirmVersion,
  voidVersion,
  compareVersions,
  getPendingAttachments,
  getConfirmedProposals
} = require('../controllers/proposalController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/versions/compare', compareVersions);
router.get('/pending-attachments', getPendingAttachments);
router.get('/confirmed-proposals', getConfirmedProposals);
router.get('/versions/:id', getVersionById);
router.post('/versions', createVersion);
router.put('/versions/:id', updateVersion);
router.post('/versions/:id/confirm', confirmVersion);
router.post('/versions/:id/void', voidVersion);

module.exports = router;