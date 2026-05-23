const express = require('express');
const router = express.Router();
const TreatmentPackageService = require('../services/TreatmentPackageService');
const ReportExceptionService = require('../services/ReportExceptionService');

router.post('/', async (req, res) => {
  try {
    const pkg = await TreatmentPackageService.createPackage(req.body);
    res.json({
      success: true,
      status: 'completed',
      data: pkg
    });
  } catch (error) {
    await ReportExceptionService.logException('create_package', req.body, error.message, 'failed', req.body.operator);
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const packages = await TreatmentPackageService.getAllPackages(req.query);
    res.json({
      success: true,
      status: 'completed',
      data: packages
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pkg = await TreatmentPackageService.getPackageById(req.params.id);
    if (!pkg) {
      return res.status(404).json({
        success: false,
        status: 'not_found',
        error: '套餐不存在'
      });
    }
    res.json({
      success: true,
      status: 'completed',
      data: pkg
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.post('/:id/split', async (req, res) => {
  try {
    const result = await TreatmentPackageService.splitPackage(
      req.params.id, 
      req.body.split_count, 
      req.body.split_gift_count || 0,
      req.body.operator
    );
    res.json({
      success: true,
      status: 'completed',
      data: result
    });
  } catch (error) {
    await ReportExceptionService.logException('split_package', { ...req.params, ...req.body }, error.message, 'failed', req.body.operator);
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.post('/:id/gift', async (req, res) => {
  try {
    const pkg = await TreatmentPackageService.addGift(
      req.params.id, 
      req.body.gift_count, 
      req.body.reason, 
      req.body.operator
    );
    res.json({
      success: true,
      status: 'completed',
      data: pkg
    });
  } catch (error) {
    await ReportExceptionService.logException('add_gift', { ...req.params, ...req.body }, error.message, 'failed', req.body.operator);
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.post('/:id/verify', async (req, res) => {
  try {
    const verification = await TreatmentPackageService.verify(
      req.params.id, 
      req.body.store_id, 
      req.body.count, 
      req.body.use_gift_count || 0,
      req.body.operator,
      req.body.remark
    );
    res.json({
      success: true,
      status: 'completed',
      data: verification
    });
  } catch (error) {
    await ReportExceptionService.logException('verify_package', { ...req.params, ...req.body }, error.message, 'failed', req.body.operator);
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/:id/gifts', async (req, res) => {
  try {
    const gifts = await TreatmentPackageService.getGiftRecords(req.params.id);
    res.json({
      success: true,
      status: 'completed',
      data: gifts
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/:id/verifications', async (req, res) => {
  try {
    const verifications = await TreatmentPackageService.getVerificationRecords(req.params.id);
    res.json({
      success: true,
      status: 'completed',
      data: verifications
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.post('/:id/correct', async (req, res) => {
  try {
    const correction = await TreatmentPackageService.manualCorrect(
      req.params.id,
      req.body.before_data,
      req.body.after_data,
      req.body.reason,
      req.body.operator
    );
    res.json({
      success: true,
      status: 'completed',
      data: correction
    });
  } catch (error) {
    await ReportExceptionService.logException('manual_correct', { ...req.params, ...req.body }, error.message, 'failed', req.body.operator);
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

module.exports = router;
