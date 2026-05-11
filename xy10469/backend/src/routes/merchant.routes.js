const express = require('express');
const router = express.Router();
const merchantController = require('../controllers/merchant.controller');

router.get('/', merchantController.getAllMerchants);
router.post('/', merchantController.createMerchant);
router.get('/:id', merchantController.getMerchantById);
router.put('/:id', merchantController.updateMerchant);
router.delete('/:id', merchantController.deleteMerchant);

module.exports = router;