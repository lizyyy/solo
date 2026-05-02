const express = require('express');
const router = express.Router();
const models = require('./models');
const stateMachine = require('./stateMachine');
const { validate, schemas, businessRules } = require('./validation');
const importExport = require('./importExport');

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'sterilization-tracking-api'
  });
});

router.get('/packages', (req, res) => {
  const filters = {};
  if (req.query.status) {
    filters.status = req.query.status;
  }
  if (req.query.package_number) {
    filters.package_number = req.query.package_number;
  }

  const packages = models.packages.getAll(filters);
  res.json({
    success: true,
    data: packages.map(pkg => ({
      ...pkg,
      status_label: stateMachine.getStatusLabel(pkg.current_status)
    }))
  });
});

router.get('/packages/:id', (req, res) => {
  const pkg = models.packages.getById(req.params.id);
  if (!pkg) {
    return res.status(404).json({
      success: false,
      error: '器械包不存在',
      code: 'PACKAGE_NOT_FOUND'
    });
  }

  res.json({
    success: true,
    data: {
      ...pkg,
      status_label: stateMachine.getStatusLabel(pkg.current_status)
    }
  });
});

router.post('/packages', (req, res) => {
  const validation = validate(schemas.package, req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      errors: validation.errors
    });
  }

  const existing = models.packages.getByNumber(req.body.package_number);
  if (existing) {
    return res.status(409).json({
      success: false,
      error: '包编号已存在',
      code: 'DUPLICATE_PACKAGE_NUMBER'
    });
  }

  try {
    const pkg = models.packages.create(validation.value);
    
    models.audit.log(
      'CREATE',
      'INSTRUMENT_PACKAGE',
      pkg.id,
      { data: validation.value },
      req.headers['x-user-id']
    );

    res.status(201).json({
      success: true,
      data: {
        ...pkg,
        status_label: stateMachine.getStatusLabel(pkg.current_status)
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      code: 'CREATE_FAILED'
    });
  }
});

router.post('/packages/:id/transition', async (req, res) => {
  const { to_status, context = {} } = req.body;
  
  if (!to_status) {
    return res.status(400).json({
      success: false,
      error: '缺少目标状态',
      code: 'MISSING_TARGET_STATUS'
    });
  }

  const pkg = models.packages.getById(req.params.id);
  if (!pkg) {
    return res.status(404).json({
      success: false,
      error: '器械包不存在',
      code: 'PACKAGE_NOT_FOUND'
    });
  }

  const transitionValidation = stateMachine.validateTransition(pkg, to_status, context);
  if (!transitionValidation.valid) {
    return res.status(400).json({
      success: false,
      errors: transitionValidation.errors
    });
  }

  if (to_status === stateMachine.STATUS.RELEASED) {
    const canRelease = await businessRules.canReleasePackage(pkg.id, context.cycle_id);
    if (!canRelease.valid) {
      return res.status(400).json({
        success: false,
        errors: canRelease.errors,
        code: 'RELEASE_DENIED'
      });
    }
  }

  try {
    const updatedPkg = models.packages.updateStatus(pkg.id, to_status, {
      expiration_date: context.expiration_date
    });

    models.audit.log(
      'STATUS_TRANSITION',
      'INSTRUMENT_PACKAGE',
      pkg.id,
      {
        from: pkg.current_status,
        to: to_status,
        description: stateMachine.getTransitionDescription(pkg.current_status, to_status),
        context
      },
      req.headers['x-user-id']
    );

    res.json({
      success: true,
      data: {
        ...updatedPkg,
        status_label: stateMachine.getStatusLabel(updatedPkg.current_status)
      },
      transition: stateMachine.getTransitionDescription(pkg.current_status, to_status)
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      code: 'TRANSITION_FAILED'
    });
  }
});

router.get('/cycles', (req, res) => {
  const filters = {};
  if (req.query.status) {
    filters.status = req.query.status;
  }
  if (req.query.cycle_number) {
    filters.cycle_number = req.query.cycle_number;
  }

  const cycles = models.cycles.getAll(filters);
  res.json({
    success: true,
    data: cycles
  });
});

router.get('/cycles/:id', (req, res) => {
  const cycle = models.cycles.getById(req.params.id);
  if (!cycle) {
    return res.status(404).json({
      success: false,
      error: '锅次不存在',
      code: 'CYCLE_NOT_FOUND'
    });
  }

  const curves = models.curves.getByCycle(cycle.id);
  const analysis = models.curves.analyzeQuality(cycle.id, cycle.target_temperature);

  res.json({
    success: true,
    data: {
      ...cycle,
      curves,
      quality_analysis: analysis
    }
  });
});

router.post('/cycles', (req, res) => {
  const validation = validate(schemas.cycle, req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      errors: validation.errors
    });
  }

  const existing = models.cycles.getByNumber(req.body.cycle_number);
  if (existing) {
    return res.status(409).json({
      success: false,
      error: '锅次编号已存在',
      code: 'DUPLICATE_CYCLE_NUMBER'
    });
  }

  try {
    const cycle = models.cycles.create(validation.value);
    
    models.audit.log(
      'CREATE',
      'STERILIZATION_CYCLE',
      cycle.id,
      { data: validation.value },
      req.headers['x-user-id']
    );

    res.status(201).json({
      success: true,
      data: cycle
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      code: 'CREATE_FAILED'
    });
  }
});

router.post('/cycles/:id/curves', (req, res) => {
  const { points } = req.body;
  
  if (!points || !Array.isArray(points)) {
    return res.status(400).json({
      success: false,
      error: '参数曲线点必须是数组',
      code: 'INVALID_CURVE_POINTS'
    });
  }

  const cycle = models.cycles.getById(req.params.id);
  if (!cycle) {
    return res.status(404).json({
      success: false,
      error: '锅次不存在',
      code: 'CYCLE_NOT_FOUND'
    });
  }

  const createdPoints = [];
  const errors = [];

  for (let i = 0; i < points.length; i++) {
    const validation = validate(schemas.curvePoint, points[i]);
    if (!validation.valid) {
      errors.push({
        index: i,
        errors: validation.errors
      });
      continue;
    }
    
    const point = models.curves.create(cycle.id, validation.value);
    createdPoints.push(point);
  }

  models.audit.log(
    'CURVE_DATA_ADDED',
    'STERILIZATION_CYCLE',
    cycle.id,
    {
      points_added: createdPoints.length,
      points_failed: errors.length
    },
    req.headers['x-user-id']
  );

  res.json({
    success: true,
    data: {
      points_added: createdPoints.length,
      points_failed: errors.length,
      errors
    }
  });
});

router.post('/quality-checks', (req, res) => {
  const validation = validate(schemas.qualityCheck, req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      errors: validation.errors
    });
  }

  try {
    const check = models.qualityChecks.create(validation.value);
    
    models.audit.log(
      'QC_CREATE',
      'QUALITY_CHECK',
      check.id,
      { data: validation.value },
      req.headers['x-user-id']
    );

    res.status(201).json({
      success: true,
      data: check
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      code: 'CREATE_FAILED'
    });
  }
});

router.post('/usage', async (req, res) => {
  const validation = validate(schemas.usage, req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      errors: validation.errors
    });
  }

  const canUse = await businessRules.canUsePackage(validation.value.package_id);
  if (!canUse.valid) {
    return res.status(400).json({
      success: false,
      errors: canUse.errors,
      code: 'USAGE_DENIED'
    });
  }

  const pkg = models.packages.getById(validation.value.package_id);

  try {
    const usage = models.usage.create(validation.value);
    const updatedPkg = models.packages.updateStatus(
      pkg.id,
      stateMachine.STATUS.USED,
      {}
    );

    models.audit.log(
      'USAGE_RECORD',
      'INSTRUMENT_PACKAGE',
      pkg.id,
      {
        usage_id: usage.id,
        department: usage.department,
        user_name: usage.user_name
      },
      req.headers['x-user-id']
    );

    res.status(201).json({
      success: true,
      data: {
        usage,
        package: {
          ...updatedPkg,
          status_label: stateMachine.getStatusLabel(updatedPkg.current_status)
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      code: 'USAGE_FAILED'
    });
  }
});

router.post('/recall', async (req, res) => {
  const validation = validate(schemas.recall, req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      errors: validation.errors
    });
  }

  const reasonCheck = await businessRules.checkRecallReason(validation.value);
  if (!reasonCheck.valid) {
    return res.status(400).json({
      success: false,
      error: reasonCheck.error,
      code: reasonCheck.code
    });
  }

  const pkg = models.packages.getById(validation.value.package_id);
  if (!pkg) {
    return res.status(404).json({
      success: false,
      error: '器械包不存在',
      code: 'PACKAGE_NOT_FOUND'
    });
  }

  const transitionValidation = stateMachine.validateTransition(
    pkg,
    stateMachine.STATUS.RECALLED,
    { reason: validation.value.reason }
  );
  if (!transitionValidation.valid) {
    return res.status(400).json({
      success: false,
      errors: transitionValidation.errors
    });
  }

  try {
    const updatedPkg = models.packages.updateStatus(
      pkg.id,
      stateMachine.STATUS.RECALLED,
      {}
    );

    models.audit.log(
      'RECALL',
      'INSTRUMENT_PACKAGE',
      pkg.id,
      {
        reason: validation.value.reason,
        from_status: pkg.current_status
      },
      req.headers['x-user-id']
    );

    res.json({
      success: true,
      data: {
        ...updatedPkg,
        status_label: stateMachine.getStatusLabel(updatedPkg.current_status)
      },
      recall_reason: validation.value.reason
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      code: 'RECALL_FAILED'
    });
  }
});

router.get('/audit', (req, res) => {
  const filters = {};
  if (req.query.entity_type) {
    filters.entity_type = req.query.entity_type;
  }
  if (req.query.action) {
    filters.action = req.query.action;
  }
  if (req.query.entity_id) {
    filters.entity_id = req.query.entity_id;
  }

  const logs = models.audit.getAll(filters);
  res.json({
    success: true,
    data: logs
  });
});

router.post('/import/packages', async (req, res) => {
  try {
    let csvContent;
    
    if (req.is('text/csv') || req.is('text/plain')) {
      csvContent = req.body;
    } else if (req.body.csv_content) {
      csvContent = req.body.csv_content;
    } else {
      return res.status(400).json({
        success: false,
        error: '缺少CSV内容',
        code: 'MISSING_CSV_CONTENT'
      });
    }

    const result = await importExport.importCsvPackages(
      csvContent,
      req.headers['x-user-id']
    );

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      code: 'IMPORT_FAILED'
    });
  }
});

router.post('/import/cycles', async (req, res) => {
  try {
    let csvContent;
    
    if (req.is('text/csv') || req.is('text/plain')) {
      csvContent = req.body;
    } else if (req.body.csv_content) {
      csvContent = req.body.csv_content;
    } else {
      return res.status(400).json({
        success: false,
        error: '缺少CSV内容',
        code: 'MISSING_CSV_CONTENT'
      });
    }

    const result = await importExport.importCsvCycles(
      csvContent,
      req.headers['x-user-id']
    );

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      code: 'IMPORT_FAILED'
    });
  }
});

router.get('/export/report/:packageId', (req, res) => {
  const report = importExport.exportMarkdownReport(req.params.packageId);
  
  if (!report) {
    return res.status(404).json({
      success: false,
      error: '器械包不存在',
      code: 'PACKAGE_NOT_FOUND'
    });
  }

  res.set('Content-Type', 'text/markdown; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="trace-report-${req.params.packageId}.md"`);
  res.send(report);
});

router.get('/export/audit', (req, res) => {
  const filters = {};
  if (req.query.entity_type) {
    filters.entity_type = req.query.entity_type;
  }
  if (req.query.action) {
    filters.action = req.query.action;
  }

  const auditPackage = importExport.exportAuditPackage(filters);
  
  res.json({
    success: true,
    data: auditPackage
  });
});

router.get('/statuses', (req, res) => {
  res.json({
    success: true,
    data: {
      statuses: Object.entries(stateMachine.STATUS).map(([key, value]) => ({
        key,
        value,
        label: stateMachine.STATUS_LABELS[value]
      })),
      transitions: stateMachine.ALLOWED_TRANSITIONS
    }
  });
});

module.exports = router;
