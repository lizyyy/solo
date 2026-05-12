const express = require('express');
const router = express.Router();
const claimService = require('../services/claimService');
const materialService = require('../services/materialService');
const reminderService = require('../services/reminderService');
const { success, error } = require('../utils/response');

router.post('/', async (req, res, next) => {
  try {
    const claim = await claimService.createClaim(req.body);
    res.json(success(claim, '案件创建成功'));
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const claims = await claimService.getAllClaims(req.query);
    res.json(success(claims));
  } catch (err) {
    next(err);
  }
});

router.get('/overdue', async (req, res, next) => {
  try {
    const claims = await claimService.getOverdueClaims();
    res.json(success(claims));
  } catch (err) {
    next(err);
  }
});

router.get('/:claimId', async (req, res, next) => {
  try {
    const claim = await claimService.getClaimById(req.params.claimId);
    if (!claim) {
      return res.status(404).json(error('案件不存在', 404));
    }
    res.json(success(claim));
  } catch (err) {
    next(err);
  }
});

router.patch('/:claimId/status', async (req, res, next) => {
  try {
    const { status, operator, remark } = req.body;
    const claim = await claimService.updateClaimStatus(req.params.claimId, status, operator, remark);
    res.json(success(claim, '案件状态更新成功'));
  } catch (err) {
    next(err);
  }
});

router.get('/:claimId/audit-logs', async (req, res, next) => {
  try {
    const logs = await claimService.getAuditLogs(req.params.claimId);
    res.json(success(logs));
  } catch (err) {
    next(err);
  }
});

router.get('/:claimId/materials', async (req, res, next) => {
  try {
    const materials = await materialService.getLatestMaterials(req.params.claimId);
    res.json(success(materials));
  } catch (err) {
    next(err);
  }
});

router.get('/:claimId/materials/all', async (req, res, next) => {
  try {
    const materials = await materialService.getMaterialsByClaimId(req.params.claimId);
    res.json(success(materials));
  } catch (err) {
    next(err);
  }
});

router.get('/:claimId/materials/missing', async (req, res, next) => {
  try {
    const materials = await materialService.getMissingMaterials(req.params.claimId);
    res.json(success(materials));
  } catch (err) {
    next(err);
  }
});

router.get('/:claimId/materials/:materialCode/history', async (req, res, next) => {
  try {
    const history = await materialService.getMaterialHistory(req.params.claimId, req.params.materialCode);
    res.json(success(history));
  } catch (err) {
    next(err);
  }
});

router.post('/:claimId/materials', async (req, res, next) => {
  try {
    const { operator } = req.body;
    const material = await materialService.addMaterial(req.params.claimId, req.body, operator || 'system');
    res.json(success(material, '材料添加成功'));
  } catch (err) {
    next(err);
  }
});

router.get('/:claimId/reminders', async (req, res, next) => {
  try {
    const reminders = await reminderService.getReminders(req.params.claimId);
    res.json(success(reminders));
  } catch (err) {
    next(err);
  }
});

router.post('/:claimId/reminders/missing', async (req, res, next) => {
  try {
    const { operator } = req.body;
    const reminders = await reminderService.createMissingMaterialReminder(req.params.claimId, operator || 'system');
    res.json(success(reminders, '催办提醒创建成功'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
