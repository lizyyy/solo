const express = require('express');
const router = express.Router();
const reminderService = require('../services/reminderService');
const { success } = require('../utils/response');

router.get('/', async (req, res, next) => {
  try {
    const reminders = await reminderService.getAllReminders(req.query);
    res.json(success(reminders));
  } catch (err) {
    next(err);
  }
});

router.post('/check-overdue', async (req, res, next) => {
  try {
    const { operator } = req.body;
    const reminders = await reminderService.checkAndCreateOverdueReminders(operator || 'system');
    res.json(success(reminders, '超期提醒检查完成'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
