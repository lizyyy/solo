const express = require('express');
const router = express.Router();
const {
  createDonation,
  getDonationById,
  getAllDonations,
  updateDonationStatus,
  withdrawDonation,
  getDonationWithDetails,
  DONATION_STATUSES
} = require('../services/donationService');

router.post('/', (req, res) => {
  try {
    const { donorId, donationDate, quantityMl, notes } = req.body;

    if (donorId === undefined || donationDate === undefined || quantityMl === undefined) {
      return res.status(400).json({
        error: '缺少必要字段',
        required: ['donorId', 'donationDate', 'quantityMl'],
        code: 'MISSING_FIELDS'
      });
    }

    if (quantityMl <= 0) {
      return res.status(400).json({
        error: '捐赠量必须大于0',
        code: 'INVALID_QUANTITY'
      });
    }

    const donation = createDonation(donorId, donationDate, quantityMl, notes);
    res.status(201).json({
      success: true,
      data: donation,
      message: '捐赠登记成功'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'CREATE_FAILED'
    });
  }
});

router.get('/', (req, res) => {
  try {
    const filters = {
      donorId: req.query.donorId,
      status: req.query.status
    };
    const donations = getAllDonations(filters);
    res.json({
      success: true,
      data: donations,
      count: donations.length
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.get('/statuses', (req, res) => {
  res.json({
    success: true,
    data: DONATION_STATUSES
  });
});

router.get('/:id', (req, res) => {
  try {
    const donation = getDonationById(req.params.id);
    if (!donation) {
      return res.status(404).json({
        error: '捐赠记录不存在',
        code: 'NOT_FOUND'
      });
    }
    res.json({
      success: true,
      data: donation
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.get('/:id/details', (req, res) => {
  try {
    const details = getDonationWithDetails(req.params.id);
    if (!details) {
      return res.status(404).json({
        error: '捐赠记录不存在',
        code: 'NOT_FOUND'
      });
    }
    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.patch('/:id/status', (req, res) => {
  try {
    const { status, reason } = req.body;

    if (!status) {
      return res.status(400).json({
        error: '缺少 status 字段',
        code: 'MISSING_FIELDS'
      });
    }

    const result = updateDonationStatus(req.params.id, status, reason);

    if (result === null) {
      return res.status(404).json({
        error: '捐赠记录不存在',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: result,
      message: result._message || '状态更新成功'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'STATUS_UPDATE_FAILED'
    });
  }
});

router.post('/:id/withdraw', (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        error: '撤回必须提供原因',
        code: 'MISSING_REASON'
      });
    }

    const result = withdrawDonation(req.params.id, reason);

    if (result === null) {
      return res.status(404).json({
        error: '捐赠记录不存在',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: result,
      message: '捐赠已撤回'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'WITHDRAW_FAILED'
    });
  }
});

module.exports = router;
