const express = require('express');
const router = express.Router();
const reservationService = require('../services/reservationService');
const {
  createReservationSchema,
  approveReservationSchema,
  releaseReservationSchema,
  queryConflictsSchema
} = require('../validations/reservationValidation');

router.post('/', async (req, res) => {
  try {
    const { error, value } = createReservationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: '参数验证失败', details: error.details });
    }
    
    const result = await reservationService.createReservation(value);
    
    res.status(201).json({
      message: result.conflicts.length > 0 
        ? '预留创建成功，但检测到资源冲突' 
        : '预留创建成功',
      data: result.reservation,
      conflicts: result.conflicts
    });
  } catch (err) {
    res.status(500).json({ error: '创建预留失败', message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      applicant: req.query.applicant
    };
    
    const reservations = await reservationService.getAllReservations(filters);
    
    res.json({
      message: '查询成功',
      data: reservations
    });
  } catch (err) {
    res.status(500).json({ error: '查询预留失败', message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const reservation = await reservationService.getReservationById(req.params.id);
    
    if (!reservation) {
      return res.status(404).json({ error: '预留记录不存在' });
    }
    
    res.json({
      message: '查询成功',
      data: reservation
    });
  } catch (err) {
    res.status(500).json({ error: '查询预留失败', message: err.message });
  }
});

router.get('/:id/conflicts', async (req, res) => {
  try {
    const conflicts = await reservationService.getConflicts(req.params.id);
    
    res.json({
      message: conflicts.length > 0 ? '检测到冲突' : '无冲突',
      conflictCount: conflicts.length,
      data: conflicts
    });
  } catch (err) {
    res.status(500).json({ error: '查询冲突失败', message: err.message });
  }
});

router.post('/check-conflicts', async (req, res) => {
  try {
    const { error, value } = queryConflictsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: '参数验证失败', details: error.details });
    }
    
    const conflicts = await reservationService.checkConflictsByTimeWindow(
      value.start,
      value.end,
      value.machineLabels
    );
    
    res.json({
      message: conflicts.length > 0 ? '检测到冲突' : '无冲突',
      conflictCount: conflicts.length,
      data: conflicts
    });
  } catch (err) {
    res.status(500).json({ error: '检查冲突失败', message: err.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const { error, value } = approveReservationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: '参数验证失败', details: error.details });
    }
    
    const reservation = await reservationService.approveReservation(req.params.id, value);
    
    res.json({
      message: '审批成功',
      data: reservation
    });
  } catch (err) {
    res.status(400).json({ error: '审批失败', message: err.message });
  }
});

router.post('/:id/release', async (req, res) => {
  try {
    const { error, value } = releaseReservationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: '参数验证失败', details: error.details });
    }
    
    const reservation = await reservationService.releaseReservation(req.params.id, value);
    
    res.json({
      message: '释放成功',
      data: reservation
    });
  } catch (err) {
    res.status(400).json({ error: '释放失败', message: err.message });
  }
});

router.get('/:id/proof', async (req, res) => {
  try {
    const proof = await reservationService.generateOccupancyProof(req.params.id);
    
    res.json({
      message: '占用证明生成成功',
      data: proof
    });
  } catch (err) {
    res.status(404).json({ error: '生成证明失败', message: err.message });
  }
});

router.get('/:id/proof/export', async (req, res) => {
  try {
    const proof = await reservationService.generateOccupancyProof(req.params.id);
    
    const format = req.query.format || 'json';
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="proof-${proof.reservationNo}.json"`);
      res.json(proof);
    } else if (format === 'csv') {
      const { Parser } = require('json2csv');
      const fields = [
        'reservationNo', 'applicant', 'applicantDepartment', 'purpose',
        'drillWindow.start', 'drillWindow.end', 'status',
        'approval.approver', 'approval.approvedAt',
        'release.releasedBy', 'release.releasedAt'
      ];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(proof);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="proof-${proof.reservationNo}.csv"`);
      res.send(csv);
    } else {
      res.status(400).json({ error: '不支持的导出格式' });
    }
  } catch (err) {
    res.status(500).json({ error: '导出失败', message: err.message });
  }
});

module.exports = router;
