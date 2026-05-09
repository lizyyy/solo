const express = require('express');
const router = express.Router();
const AccessService = require('../services/access.service');

router.get('/students/:studentId/card', (req, res) => {
  const card = AccessService.getCardByStudent(parseInt(req.params.studentId));
  if (!card) {
    return res.status(404).json({ success: false, message: '未找到门禁卡' });
  }
  
  const parsedCard = {
    ...card,
    authorized_bed_ids: JSON.parse(card.authorized_bed_ids || '[]')
  };
  
  res.json({ success: true, data: parsedCard });
});

router.post('/students/:studentId/card', (req, res) => {
  try {
    const { card_no } = req.body;
    const result = AccessService.createCard(
      parseInt(req.params.studentId),
      card_no
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/sync/:applicationId', (req, res) => {
  try {
    const { operator } = req.body;
    const result = AccessService.syncAccessAfterTransfer(
      parseInt(req.params.applicationId),
      operator || 'system'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/cards/:cardId/manual-sync', (req, res) => {
  try {
    const { remove_beds, add_beds, operator } = req.body;
    const result = AccessService.manualSync(
      parseInt(req.params.cardId),
      remove_beds || [],
      add_beds || [],
      operator || 'admin'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/logs', (req, res) => {
  const { student_id, limit } = req.query;
  const logs = AccessService.getSyncLogs(
    student_id ? parseInt(student_id) : null,
    limit ? parseInt(limit) : 50
  );
  res.json({ success: true, data: logs });
});

module.exports = router;