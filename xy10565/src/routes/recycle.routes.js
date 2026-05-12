const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const RecycleService = require('../services/RecycleService');

router.post('/check-overdue', asyncHandler(async (req, res) => {
  const overdueList = RecycleService.checkOverdue();
  
  res.json({
    success: true,
    data: {
      processed: overdueList.length,
      items: overdueList
    }
  });
}));

router.get('/overdue', asyncHandler(async (req, res) => {
  const overdueList = RecycleService.getAllOverdue();
  
  res.json({
    success: true,
    data: overdueList
  });
}));

module.exports = router;
