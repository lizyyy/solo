const express = require('express');
const router = express.Router();
const CatchupService = require('../services/CatchupService');
const { asyncHandler } = require('../middleware/error');
const { catchupSchema, validate } = require('../middleware/validator');

router.post('/:equipmentId/catchup', validate(catchupSchema), asyncHandler(async (req, res) => {
  const result = await CatchupService.performCatchup(req.params.equipmentId, req.body);
  res.json({
    success: true,
    message: '补做确认完成',
    completedPlansCount: result.completedPlans.length,
    data: result
  });
}));

module.exports = router;
