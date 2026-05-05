const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');

router.get('/metadata', leadController.getMetadata);
router.get('/', leadController.getAllLeads);
router.get('/:id', leadController.getLeadById);
router.get('/:id/export', leadController.exportMarkdownReport);
router.post('/', leadController.createLead);
router.put('/:id', leadController.updateLead);
router.delete('/:id', leadController.deleteLead);

module.exports = router;
