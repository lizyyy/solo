const express = require('express');
const router = express.Router();
const ReviewService = require('../services/reviewService');
const { validate, schemas } = require('../middleware/validator');
const { AppError } = require('../middleware/errorHandler');

router.post('/:discrepancyId/approve', validate(schemas.reviewAction), async (req, res, next) => {
  try {
    const { discrepancyId } = req.params;
    const { operator, remark } = req.body;

    const result = await ReviewService.approveDiscrepancy(discrepancyId, operator, remark);

    res.status(200).json({
      success: true,
      message: '差异已放行',
      data: result
    });
  } catch (error) {
    if (error.message === '差异记录不存在') {
      return next(new AppError(error.message, 404));
    }
    next(error);
  }
});

router.post('/:discrepancyId/reject', validate(schemas.reviewAction), async (req, res, next) => {
  try {
    const { discrepancyId } = req.params;
    const { operator, remark } = req.body;

    const result = await ReviewService.rejectDiscrepancy(discrepancyId, operator, remark);

    res.status(200).json({
      success: true,
      message: '差异已退回',
      data: result
    });
  } catch (error) {
    if (error.message === '差异记录不存在') {
      return next(new AppError(error.message, 404));
    }
    next(error);
  }
});

router.post('/:discrepancyId/request-info', validate(schemas.reviewAction), async (req, res, next) => {
  try {
    const { discrepancyId } = req.params;
    const { operator, remark } = req.body;

    const result = await ReviewService.requestMoreInfo(discrepancyId, operator, remark);

    res.status(200).json({
      success: true,
      message: '已要求补充材料',
      data: result
    });
  } catch (error) {
    if (error.message === '差异记录不存在') {
      return next(new AppError(error.message, 404));
    }
    next(error);
  }
});

router.get('/:discrepancyId/history', validate(schemas.discrepancyId), async (req, res, next) => {
  try {
    const { discrepancyId } = req.params;

    const history = await ReviewService.getReviewHistory(discrepancyId);

    res.status(200).json({
      success: true,
      message: '获取复核历史成功',
      data: history
    });
  } catch (error) {
    if (error.message === '差异记录不存在') {
      return next(new AppError(error.message, 404));
    }
    next(error);
  }
});

module.exports = router;
