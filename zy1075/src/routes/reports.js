const express = require('express');
const router = express.Router();
const ResponseHandler = require('../utils/responseHandler');
const ReportService = require('../services/ReportService');
const ReturnService = require('../services/ReturnService');
const TimelineService = require('../services/TimelineService');

router.get('/weekly-summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const summary = await ReportService.getWeeklySummary(startDate, endDate);
    
    return ResponseHandler.success(res, summary, '本周对账摘要获取成功');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/weekly-summary/export', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const exportResult = await ReportService.exportWeeklySummary(startDate, endDate);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=weekly-summary-${Date.now()}.json`);
    
    return res.json(exportResult);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/disputes', async (req, res) => {
  try {
    const { status } = req.query;
    
    const disputes = await ReturnService.getAllDisputes(status);
    
    return ResponseHandler.success(res, disputes);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/disputes/:id', async (req, res) => {
  try {
    const { Dispute, ReturnRecord, Loan, Item, User } = require('../models');
    
    const dispute = await Dispute.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'phone', 'email'] },
        {
          model: ReturnRecord,
          as: 'returnRecord',
          include: [
            {
              model: Loan,
              as: 'loan',
              include: [{ model: Item, as: 'item' }],
            },
          ],
        },
        { model: User, as: 'resolver', attributes: ['id', 'name'] },
      ],
    });
    
    if (!dispute) {
      return ResponseHandler.notFound(res, '争议记录不存在');
    }
    
    return ResponseHandler.success(res, dispute);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.put('/disputes/:id/resolve', async (req, res) => {
  try {
    const { resolution, resolved_amount, resolved_by, status = 'resolved' } = req.body;
    
    if (!resolution) {
      return ResponseHandler.validationError(
        res,
        { resolution: '解决方案不能为空' }
      );
    }
    
    const result = await ReturnService.resolveDispute(
      req.params.id,
      resolution,
      resolved_amount || 0,
      resolved_by,
      status
    );
    
    return ResponseHandler.success(res, result, '争议已解决');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/user-timeline/:userId', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const timeline = await TimelineService.getUserTimeline(
      req.params.userId,
      startDate,
      endDate
    );
    
    return ResponseHandler.success(res, timeline);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/item-timeline/:itemId', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const timeline = await TimelineService.getItemTimeline(
      req.params.itemId,
      startDate,
      endDate
    );
    
    return ResponseHandler.success(res, timeline);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

module.exports = router;
