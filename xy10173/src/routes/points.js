const express = require('express');
const router = express.Router();
const pointService = require('../services/PointService');
const { BalanceService } = require('../services/BalanceService');
const { ValidationError } = require('../errors/ApiError');
const pointLedgerRepo = require('../repositories/PointLedgerRepository');
const freezeBucketRepo = require('../repositories/FreezeBucketRepository');
const freezeRuleRepo = require('../repositories/FreezeRuleRepository');
const idempotencyRepo = require('../repositories/IdempotencyRepository');

const balanceService = new BalanceService();

function parseOperator(req) {
  return {
    name: req.header('X-Operator-Name') || 'unknown',
    id: req.header('X-Operator-Id') || 'unknown',
    type: req.header('X-Operator-Type') || 'api'
  };
}

function parseRequestId(req, prefix) {
  const id = req.header('X-Request-Id') || req.body.requestId || `${prefix}-${Date.now()}`;
  return id;
}

function requireFields(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null) {
      throw new ValidationError(`${field} 必填`, { field });
    }
  }
}

router.get('/:memberId/balance', (req, res) => {
  const balance = balanceService.getCurrentBalance(req.params.memberId);
  const consistency = balanceService.verifyConsistency(req.params.memberId);
  res.json({
    success: true,
    data: {
      balance,
      consistency: {
        isConsistent: consistency.isConsistent
      }
    }
  });
});

router.get('/:memberId/ledgers', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  const ledgers = pointLedgerRepo.findByMemberId(req.params.memberId, limit);
  res.json({ success: true, data: ledgers });
});

router.get('/:memberId/buckets', (req, res) => {
  const buckets = freezeBucketRepo.findByMemberId(req.params.memberId);
  res.json({ success: true, data: buckets });
});

router.post('/:memberId/recharge', (req, res) => {
  requireFields(req.body, ['amount']);
  const result = pointService.recharge(
    req.params.memberId,
    parseInt(req.body.amount),
    parseRequestId(req, 'recharge'),
    parseOperator(req),
    req.body.reason
  );
  res.json({ success: true, data: result });
});

router.post('/:memberId/freeze', (req, res) => {
  requireFields(req.body, ['amount', 'freezeRuleCode']);
  const result = pointService.freeze(
    req.params.memberId,
    parseInt(req.body.amount),
    req.body.freezeRuleCode,
    parseRequestId(req, 'freeze'),
    parseOperator(req),
    req.body.reason
  );
  res.json({ success: true, data: result });
});

router.post('/:memberId/consume', (req, res) => {
  requireFields(req.body, ['amount']);
  const result = pointService.consume(
    req.params.memberId,
    parseInt(req.body.amount),
    parseRequestId(req, 'consume'),
    parseOperator(req),
    req.body.refId,
    req.body.reason,
    req.body.allowFreeze === true
  );
  res.json({ success: true, data: result });
});

router.post('/:memberId/refund', (req, res) => {
  requireFields(req.body, ['amount']);
  const result = pointService.refund(
    req.params.memberId,
    parseInt(req.body.amount),
    parseRequestId(req, 'refund'),
    parseOperator(req),
    req.body.refId,
    req.body.reason
  );
  res.json({ success: true, data: result });
});

router.post('/:memberId/unfreeze', (req, res) => {
  requireFields(req.body, ['bucketId', 'amount']);
  const result = pointService.unfreeze(
    req.params.memberId,
    req.body.bucketId,
    parseInt(req.body.amount),
    parseRequestId(req, 'unfreeze'),
    parseOperator(req),
    req.body.reason
  );
  res.json({ success: true, data: result });
});

router.post('/:memberId/auto-unfreeze', (req, res) => {
  const result = pointService.autoUnfreezeExpired(
    req.params.memberId,
    parseOperator(req)
  );
  res.json({ success: true, data: result });
});

router.get('/:memberId/snapshot/:date', (req, res) => {
  const { memberId, date } = req.params;
  const snapshot = balanceService.createSnapshot(memberId, date);
  const consistency = balanceService.verifyConsistency(memberId);
  res.json({ success: true, data: { snapshot, consistency } });
});

router.get('/rules', (req, res) => {
  const rules = freezeRuleRepo.findAll();
  res.json({ success: true, data: rules });
});

router.post('/rules', (req, res) => {
  requireFields(req.body, ['code', 'name', 'releaseType']);
  const rule = freezeRuleRepo.create({
    code: req.body.code,
    name: req.body.name,
    releaseType: req.body.releaseType,
    releaseDays: req.body.releaseDays,
    autoRelease: req.body.autoRelease !== false,
    priority: req.body.priority || 0,
    description: req.body.description
  });
  res.status(201).json({ success: true, data: rule });
});

router.get('/idempotency/:requestId/:action', (req, res) => {
  const record = idempotencyRepo.findByRequestIdAndAction(req.params.requestId, req.params.action);
  res.json({ success: true, data: record });
});

module.exports = router;
