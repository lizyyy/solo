const express = require('express');
const router = express.Router();
const store = require('../store/memoryStore');
const rotationService = require('../services/RotationService');
const exportService = require('../services/ExportService');

router.post('/', (req, res) => {
  try {
    const { serviceName, currentOwner, candidateOwner, reason, alertReferences, operator } = req.body;
    
    if (!serviceName || !currentOwner || !candidateOwner || !reason) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['serviceName', 'currentOwner', 'candidateOwner', 'reason']
      });
    }

    const rotation = rotationService.createRotation(
      serviceName,
      currentOwner,
      candidateOwner,
      reason,
      alertReferences || [],
      operator || 'system'
    );

    res.status(201).json(rotation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      serviceId: req.query.serviceId,
      serviceName: req.query.serviceName,
      currentOwner: req.query.currentOwner,
      candidateOwner: req.query.candidateOwner
    };
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) delete filters[key];
    });
    const rotations = store.listRotations(filters);
    res.json(rotations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const rotation = store.getRotation(req.params.id);
    if (!rotation) {
      return res.status(404).json({ error: '轮转记录不存在' });
    }
    res.json(rotation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const history = store.getHistory(req.params.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/start-confirm', (req, res) => {
  try {
    const { operator } = req.body;
    const rotation = rotationService.startConfirm(req.params.id, operator || 'system');
    res.json(rotation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/confirm', (req, res) => {
  try {
    const { confirmedBy, receiptNote } = req.body;
    if (!confirmedBy) {
      return res.status(400).json({ error: '缺少确认人信息' });
    }
    const rotation = rotationService.confirmReceipt(req.params.id, confirmedBy, receiptNote);
    res.json(rotation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/complete', (req, res) => {
  try {
    const { completedBy, handoverDetails, documentLinks, remarks } = req.body;
    if (!completedBy) {
      return res.status(400).json({ error: '缺少完成人信息' });
    }
    const rotation = rotationService.completeRotation(req.params.id, completedBy, {
      handoverDetails,
      documentLinks,
      remarks
    });
    res.json(rotation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/reject', (req, res) => {
  try {
    const { rejectedBy, reason } = req.body;
    if (!rejectedBy || !reason) {
      return res.status(400).json({ error: '缺少拒绝人或拒绝原因' });
    }
    const rotation = rotationService.rejectRotation(req.params.id, rejectedBy, reason);
    res.json(rotation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/restart-confirm', (req, res) => {
  try {
    const { operator } = req.body;
    const rotation = rotationService.restartConfirm(req.params.id, operator || 'system');
    res.json(rotation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/exception', (req, res) => {
  try {
    const { exceptionType, description, rawInput, handlingBasis, operator } = req.body;
    if (!exceptionType || !description) {
      return res.status(400).json({ error: '缺少异常类型或描述' });
    }
    const exception = rotationService.markException(
      req.params.id,
      exceptionType,
      description,
      rawInput,
      handlingBasis,
      operator || 'system'
    );
    res.status(201).json(exception);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/exceptions/:exceptionId/resolve', (req, res) => {
  try {
    const { resolvedBy, resolution, handlingBasis } = req.body;
    if (!resolvedBy || !resolution) {
      return res.status(400).json({ error: '缺少处理人或处理方案' });
    }
    const exception = rotationService.resolveException(
      req.params.exceptionId,
      resolvedBy,
      resolution,
      handlingBasis
    );
    res.json(exception);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/exceptions/list', (req, res) => {
  try {
    const filters = {
      rotationId: req.query.rotationId,
      resolved: req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined
    };
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) delete filters[key];
    });
    const exceptions = store.listExceptions(filters);
    res.json(exceptions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/manual-correct', (req, res) => {
  try {
    const { updates, operator, reason } = req.body;
    if (!updates || !operator || !reason) {
      return res.status(400).json({ error: '缺少更新内容、操作人或修正原因' });
    }
    const rotation = rotationService.manualCorrect(req.params.id, updates, operator, reason);
    res.json(rotation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reminders/overdue', (req, res) => {
  try {
    const reminders = rotationService.getOverdueReminders();
    res.json(reminders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/maintenance/check-expired', (req, res) => {
  try {
    const results = rotationService.checkAndMarkExpiredRotations();
    res.json({ processed: results.length, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/csv', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      serviceName: req.query.serviceName
    };
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) delete filters[key];
    });
    const csv = exportService.exportRotationsToCSV(filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rotations.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/:id/report', (req, res) => {
  try {
    const report = exportService.exportRotationReport(req.params.id);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/export/services/report', (req, res) => {
  try {
    const report = exportService.exportAllServicesReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/:id/audit', (req, res) => {
  try {
    const csv = exportService.exportHistoryAudit(req.params.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-trail.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/services/list', (req, res) => {
  try {
    const services = store.listServices();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
