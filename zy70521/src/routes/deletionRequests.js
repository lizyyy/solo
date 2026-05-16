const express = require('express');
const Joi = require('joi');
const DeletionRequest = require('../models/deletionRequest');
const RevocationRequest = require('../models/revocationRequest');
const PurgeTask = require('../models/purgeTask');
const ProofSummary = require('../models/proofSummary');
const { DELETION_STATUS } = require('../constants/status');

const router = express.Router();

const createSchema = Joi.object({
  user_subject: Joi.string().required(),
  deletion_scope: Joi.string().required(),
  scope_details: Joi.object(),
  grace_period_hours: Joi.number().integer().min(1).default(72),
  created_by: Joi.string().required(),
  reason: Joi.string()
});

const manualCorrectSchema = Joi.object({
  user_subject: Joi.string(),
  deletion_scope: Joi.string(),
  scope_details: Joi.object(),
  grace_period_hours: Joi.number().integer().min(1),
  grace_deadline: Joi.string().isoDate(),
  reason: Joi.string(),
  corrected_by: Joi.string().required(),
  correction_reason: Joi.string().required()
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '参数验证失败',
          details: error.details.map(d => d.message)
        }
      });
    }

    const result = await DeletionRequest.create(value);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { status, user_subject } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (user_subject) filters.user_subject = user_subject;
    
    const requests = await DeletionRequest.findAll(filters);
    res.json(requests);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const request = await DeletionRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: '删除请求不存在'
        }
      });
    }
    res.json(request);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const history = await DeletionRequest.getStatusHistory(req.params.id);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/start-grace', async (req, res, next) => {
  try {
    const { changed_by, reason } = req.body;
    if (!changed_by || !reason) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '缺少必填参数',
          details: 'changed_by 和 reason 都是必填的'
        }
      });
    }

    const result = await DeletionRequest.updateStatus(
      req.params.id,
      DELETION_STATUS.IN_GRACE_PERIOD,
      changed_by,
      reason
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/revoke', async (req, res, next) => {
  try {
    const { requested_by, reason } = req.body;
    if (!requested_by || !reason) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '缺少必填参数',
          details: 'requested_by 和 reason 都是必填的'
        }
      });
    }

    const result = await RevocationRequest.create(req.params.id, {
      requested_by,
      reason
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/revocations/:id/review', async (req, res, next) => {
  try {
    const { decision, reviewed_by, review_notes } = req.body;
    if (!decision || !reviewed_by) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '缺少必填参数',
          details: 'decision 和 reviewed_by 都是必填的'
        }
      });
    }

    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '无效的决策值',
          details: 'decision 必须是 APPROVE 或 REJECT'
        }
      });
    }

    const result = await RevocationRequest.review(req.params.id, decision, reviewed_by, review_notes);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/purge', async (req, res, next) => {
  try {
    const { purge_scope } = req.body;
    if (!purge_scope) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '缺少必填参数',
          details: 'purge_scope 是必填的'
        }
      });
    }

    const result = await PurgeTask.create(req.params.id, purge_scope);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/purge/:id/start', async (req, res, next) => {
  try {
    const result = await PurgeTask.start(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/purge/:id/complete', async (req, res, next) => {
  try {
    const { records_purged, bytes_purged, execution_log } = req.body;
    if (records_purged === undefined || bytes_purged === undefined) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '缺少必填参数',
          details: 'records_purged 和 bytes_purged 都是必填的'
        }
      });
    }

    const result = await PurgeTask.complete(
      req.params.id,
      records_purged,
      bytes_purged,
      execution_log || {}
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/purge/:id/fail', async (req, res, next) => {
  try {
    const { error_details } = req.body;
    if (!error_details) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '缺少必填参数',
          details: 'error_details 是必填的'
        }
      });
    }

    const result = await PurgeTask.fail(req.params.id, error_details);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/manual-correct', async (req, res, next) => {
  try {
    const { error, value } = manualCorrectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '参数验证失败',
          details: error.details.map(d => d.message)
        }
      });
    }

    const { corrected_by, correction_reason, ...updates } = value;
    const result = await DeletionRequest.manualCorrect(
      req.params.id,
      updates,
      corrected_by,
      correction_reason
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/export', async (req, res, next) => {
  try {
    const audit = await ProofSummary.exportFullAudit(req.params.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${req.params.id}.json"`);
    res.json(audit);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/proofs', async (req, res, next) => {
  try {
    const proofs = await ProofSummary.findByDeletionRequestId(req.params.id);
    res.json(proofs);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/revocations', async (req, res, next) => {
  try {
    const revocations = await RevocationRequest.findByDeletionRequestId(req.params.id);
    res.json(revocations);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/purge-tasks', async (req, res, next) => {
  try {
    const tasks = await PurgeTask.findByDeletionRequestId(req.params.id);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
