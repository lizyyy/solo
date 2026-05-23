const express = require('express');
const router = express.Router();
const { DiscrepancyReportDAO, StoreDAO, ProductDAO, PriceVersionDAO } = require('../database/dao');
const { validate } = require('../utils/validation');
const { successResponse, createdResponse, notFoundResponse, pendingReviewResponse, rejectedResponse, compensatedResponse } = require('../utils/response');
const { logException } = require('../middleware/exceptionHandler');

const discrepancyReportDAO = new DiscrepancyReportDAO();
const storeDAO = new StoreDAO();
const productDAO = new ProductDAO();
const priceVersionDAO = new PriceVersionDAO();

router.post('/', validate('discrepancyReport'), async (req, res, next) => {
  try {
    const store = await storeDAO.findByCode(req.body.store_code);
    if (!store) {
      return notFoundResponse(res, '门店不存在');
    }

    const product = await productDAO.findByBarcode(req.body.barcode);
    if (!product) {
      return notFoundResponse(res, '商品不存在');
    }

    req.body.status = 'pending_review';
    const result = await discrepancyReportDAO.create(req.body);
    const discrepancy = await discrepancyReportDAO.findById(result.lastID);
    return pendingReviewResponse(res, discrepancy, '差异报告已提交，待复核');
  } catch (err) {
    await logException(req, err, 'create_discrepancy_failed');
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { status, store_code, discrepancy_type } = req.query;
    let where = '';
    let params = [];

    if (status) {
      where += 'status = ?';
      params.push(status);
    }

    if (store_code) {
      where += where ? ' AND ' : '';
      where += 'store_code = ?';
      params.push(store_code);
    }

    if (discrepancy_type) {
      where += where ? ' AND ' : '';
      where += 'discrepancy_type = ?';
      params.push(discrepancy_type);
    }

    const discrepancies = await discrepancyReportDAO.findAll(where, params);
    return successResponse(res, discrepancies);
  } catch (err) {
    await logException(req, err, 'list_discrepancies_failed');
    next(err);
  }
});

router.get('/pending-review', async (req, res, next) => {
  try {
    const pending = await discrepancyReportDAO.findPendingReview();
    return successResponse(res, pending);
  } catch (err) {
    await logException(req, err, 'get_pending_review_failed');
    next(err);
  }
});

router.get('/:code', async (req, res, next) => {
  try {
    const discrepancy = await discrepancyReportDAO.findByCode(req.params.code);
    if (!discrepancy) {
      return notFoundResponse(res, '差异报告不存在');
    }
    return successResponse(res, discrepancy);
  } catch (err) {
    await logException(req, err, 'get_discrepancy_failed');
    next(err);
  }
});

router.patch('/:code/review', validate('discrepancyReview'), async (req, res, next) => {
  try {
    const discrepancy = await discrepancyReportDAO.findByCode(req.params.code);
    if (!discrepancy) {
      return notFoundResponse(res, '差异报告不存在');
    }

    const updateData = {
      status: req.body.status,
      reviewed_by: req.body.reviewed_by,
      review_time: new Date().toISOString(),
      resolution: req.body.resolution,
      remarks: req.body.remarks,
      updated_at: new Date().toISOString()
    };

    await discrepancyReportDAO.update(discrepancy.id, updateData);
    const updated = await discrepancyReportDAO.findById(discrepancy.id);

    if (req.body.status === 'rejected') {
      return rejectedResponse(res, updated, '差异报告已驳回');
    } else if (req.body.status === 'compensated') {
      return compensatedResponse(res, updated, '差异已补偿处理');
    } else {
      return successResponse(res, updated, '差异复核完成');
    }
  } catch (err) {
    await logException(req, err, 'review_discrepancy_failed');
    next(err);
  }
});

router.patch('/:code/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        status: 'validation_error',
        message: '状态参数必填'
      });
    }

    const discrepancy = await discrepancyReportDAO.findByCode(req.params.code);
    if (!discrepancy) {
      return notFoundResponse(res, '差异报告不存在');
    }

    await discrepancyReportDAO.update(discrepancy.id, {
      status,
      updated_at: new Date().toISOString()
    });

    const updated = await discrepancyReportDAO.findById(discrepancy.id);
    
    let message = '状态更新成功';
    if (status === 'pending_review') message = '待复核';
    else if (status === 'reviewed') message = '已复核';
    else if (status === 'rejected') message = '已驳回';
    else if (status === 'compensated') message = '已补偿';
    
    return successResponse(res, updated, message);
  } catch (err) {
    await logException(req, err, 'update_discrepancy_status_failed');
    next(err);
  }
});

module.exports = router;
