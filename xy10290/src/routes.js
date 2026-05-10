const express = require('express');
const router = express.Router();

const { idempotentMiddleware } = require('./idempotency');
const campgroundService = require('./campground-service');
const settlementService = require('./settlement-service');
const issueTracker = require('./issue-tracker');
const { getRules } = require('./rules');
const ruleValidator = require('./rule-validator');
const { RuleViolation, ValidationError } = require('./rules');

function handleError(res, error) {
  console.error('API错误:', error);
  
  if (error instanceof RuleViolation) {
    return res.status(422).json({
      success: false,
      error: 'RULE_VIOLATION',
      rule_id: error.ruleId,
      rule_name: error.ruleName,
      message: error.details,
      source_type: error.sourceType,
      source_ref: error.sourceRef
    });
  }
  
  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      field: error.field,
      message: error.message,
      details: error.details
    });
  }
  
  return res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: error.message
  });
}

router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

router.get('/rules', (req, res) => {
  res.json({
    success: true,
    data: getRules()
  });
});

router.get('/rules/validate', (req, res) => {
  try {
    const report = ruleValidator.runAllValidations();
    res.json({
      success: true,
      data: report
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/campsites', idempotentMiddleware('POST /campsites'), (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELD',
        field: 'name',
        message: '必须提供营地名称'
      });
    }
    
    const campsite = campgroundService.createCampsite(name);
    res.status(201).json({ success: true, data: campsite });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/campsites/:campsiteId/spots', idempotentMiddleware('POST /campsites/:id/spots'), (req, res) => {
  try {
    const { spot_number } = req.body;
    const { campsiteId } = req.params;
    
    if (!spot_number) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELD',
        field: 'spot_number',
        message: '必须提供车位编号'
      });
    }
    
    const spot = campgroundService.createParkingSpot(campsiteId, spot_number);
    res.status(201).json({ success: true, data: spot });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/campsites/:campsiteId/pillars', idempotentMiddleware('POST /campsites/:id/pillars'), (req, res) => {
  try {
    const { pillar_code, water_fee_per_unit, electric_fee_per_unit } = req.body;
    const { campsiteId } = req.params;
    
    if (!pillar_code) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELD',
        field: 'pillar_code',
        message: '必须提供水电桩编号'
      });
    }
    
    const pillar = campgroundService.createUtilityPillar(
      campsiteId, 
      pillar_code,
      water_fee_per_unit,
      electric_fee_per_unit
    );
    res.status(201).json({ success: true, data: pillar });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/pillars/:pillarId/connect/:spotId', idempotentMiddleware('POST /pillars/:id/connect'), (req, res) => {
  try {
    const { pillarId, spotId } = req.params;
    const result = campgroundService.connectPillarToSpot(pillarId, spotId);
    res.json({ success: true, data: result });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/stays/check-in', idempotentMiddleware('POST /stays/check-in'), (req, res) => {
  try {
    const { campsite_id, spot_id, vehicle_plate, deposit_amount, check_in_time } = req.body;
    
    if (!campsite_id || !spot_id || !vehicle_plate || deposit_amount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        required: ['campsite_id', 'spot_id', 'vehicle_plate', 'deposit_amount'],
        message: '缺少必填字段'
      });
    }
    
    const stay = campgroundService.checkIn(
      campsite_id,
      spot_id,
      vehicle_plate,
      deposit_amount,
      check_in_time
    );
    
    res.status(201).json({ success: true, data: stay });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/meter-readings', idempotentMiddleware('POST /meter-readings'), (req, res) => {
  try {
    const { 
      pillar_id, 
      reading_time, 
      water_reading, 
      electric_reading,
      source_type,
      source_ref,
      is_correction
    } = req.body;
    
    if (!pillar_id || water_reading === undefined || electric_reading === undefined) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        required: ['pillar_id', 'water_reading', 'electric_reading'],
        message: '缺少必填字段'
      });
    }
    
    const reading = campgroundService.recordMeterReading(
      pillar_id,
      reading_time,
      water_reading,
      electric_reading,
      source_type,
      source_ref,
      is_correction || false
    );
    
    res.status(201).json({ success: true, data: reading });
  } catch (e) {
    issueTracker.createIssueFromError(
      e, 
      'METER_READING', 
      req.body.pillar_id, 
      req.body
    );
    handleError(res, e);
  }
});

router.post('/allocations', idempotentMiddleware('POST /allocations'), (req, res) => {
  try {
    const { pillar_id, from_reading_id, to_reading_id, allocation_type } = req.body;
    
    if (!pillar_id || !to_reading_id) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        required: ['pillar_id', 'to_reading_id'],
        message: '缺少必填字段'
      });
    }
    
    const allocation = campgroundService.allocateUtilityUsage(
      pillar_id,
      from_reading_id,
      to_reading_id,
      allocation_type
    );
    
    res.status(201).json({ success: true, data: allocation });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/stays/:stayId/check-out', idempotentMiddleware('POST /stays/:id/check-out'), (req, res) => {
  try {
    const { stayId } = req.params;
    const { check_out_time } = req.body;
    
    const result = settlementService.checkOut(stayId, check_out_time);
    res.json({ success: true, data: result });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/settlements', idempotentMiddleware('POST /settlements'), (req, res) => {
  try {
    const { stay_id } = req.body;
    
    if (!stay_id) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELD',
        field: 'stay_id',
        message: '必须提供入住记录ID'
      });
    }
    
    const settlement = settlementService.createSettlement(stay_id);
    res.status(201).json({ success: true, data: settlement });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/settlements/:settlementId/confirm', idempotentMiddleware('POST /settlements/:id/confirm'), (req, res) => {
  try {
    const { settlementId } = req.params;
    const { payment_reference } = req.body;
    
    const result = settlementService.confirmSettlement(settlementId, payment_reference);
    res.json({ success: true, data: result });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/stays/:stayId', (req, res) => {
  try {
    const { stayId } = req.params;
    const details = settlementService.getFullStayDetails(stayId);
    
    if (!details) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `入住记录 ${stayId} 不存在`
      });
    }
    
    res.json({ success: true, data: details });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/stays/:stayId/summary', (req, res) => {
  try {
    const { stayId } = req.params;
    const summary = campgroundService.getStaySummary(stayId);
    
    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `入住记录 ${stayId} 不存在`
      });
    }
    
    res.json({ success: true, data: summary });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/issues', (req, res) => {
  try {
    const { status, severity, issue_type, limit } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (severity) filters.severity = severity;
    if (issue_type) filters.issue_type = issue_type;
    if (limit) filters.limit = parseInt(limit);
    
    const issues = issueTracker.getIssues(filters);
    const count = issueTracker.getIssueCount(filters);
    
    res.json({ 
      success: true, 
      data: { 
        items: issues, 
        total: count,
        stats: {
          open: issueTracker.getIssueCount({ status: 'OPEN' }),
          critical: issueTracker.getIssueCount({ status: 'OPEN', severity: 'CRITICAL' }),
          high: issueTracker.getIssueCount({ status: 'OPEN', severity: 'HIGH' })
        }
      } 
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/issues/:issueId/resolve', (req, res) => {
  try {
    const { issueId } = req.params;
    const { resolution_note } = req.body;
    
    if (!resolution_note) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELD',
        field: 'resolution_note',
        message: '必须提供解决说明'
      });
    }
    
    const resolved = issueTracker.resolveIssue(issueId, resolution_note);
    
    if (!resolved) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `问题记录 ${issueId} 不存在`
      });
    }
    
    res.json({ success: true, data: { id: issueId, status: 'RESOLVED' } });
  } catch (e) {
    handleError(res, e);
  }
});

module.exports = router;
