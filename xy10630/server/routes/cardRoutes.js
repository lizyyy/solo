const express = require('express');
const router = express.Router();
const { 
  getCards, 
  getCardById, 
  createCard, 
  freezeCard, 
  unfreezeCard, 
  reportLost 
} = require('../controllers/cardController');
const { checkCardStatus } = require('../middleware/businessRules');
const { auditLog } = require('../middleware/audit');

router.get('/', getCards);
router.get('/:id', getCardById);
router.post('/', auditLog('create', 'card'), createCard);
router.post('/freeze', auditLog('freeze', 'card'), freezeCard);
router.post('/unfreeze', auditLog('unfreeze', 'card'), unfreezeCard);
router.post('/lost', auditLog('report_lost', 'card'), reportLost);

module.exports = router;
