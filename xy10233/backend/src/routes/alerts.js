const express = require('express');
const router = express.Router();

const AlertModel = require('../models/alert');
const OperationLogModel = require('../models/operationLog');

router.get('/', (req, res) => {
  const { tank_id, status } = req.query;
  
  let alerts;
  
  if (status === 'active') {
    alerts = AlertModel.getActive();
  } else if (tank_id) {
    alerts = AlertModel.getByTankId(tank_id);
  } else {
    alerts = AlertModel.getAll();
  }
  
  res.json({ success: true, data: alerts });
});

router.get('/:id', (req, res) => {
  const alert = AlertModel.getById(req.params.id);
  if (!alert) {
    return res.status(404).json({ success: false, error: '报警不存在' });
  }
  res.json({ success: true, data: alert });
});

router.post('/:id/acknowledge', (req, res) => {
  const alert = AlertModel.getById(req.params.id);
  if (!alert) {
    return res.status(404).json({ success: false, error: '报警不存在' });
  }
  
  if (alert.status !== 'active') {
    return res.status(400).json({
      success: false,
      error: '该报警已确认或已解决'
    });
  }
  
  const updatedAlert = AlertModel.acknowledge(req.params.id, res.locals.operator);
  
  OperationLogModel.create({
    operation_type: OperationLogModel.OPERATION_TYPE.ALERT_ACKNOWLEDGE,
    target_type: 'alert',
    target_id: req.params.id,
    operator: res.locals.operator,
    details: `确认报警: ${alert.message}`
  });
  
  res.json({ success: true, data: updatedAlert });
});

router.post('/:id/resolve', (req, res) => {
  const { resolution_notes } = req.body;
  
  const alert = AlertModel.getById(req.params.id);
  if (!alert) {
    return res.status(404).json({ success: false, error: '报警不存在' });
  }
  
  if (alert.status === 'resolved') {
    return res.status(400).json({
      success: false,
      error: '该报警已解决'
    });
  }
  
  const updatedAlert = AlertModel.resolve(req.params.id, res.locals.operator, resolution_notes);
  
  OperationLogModel.create({
    operation_type: OperationLogModel.OPERATION_TYPE.ALERT_RESOLVE,
    target_type: 'alert',
    target_id: req.params.id,
    operator: res.locals.operator,
    details: `解决报警: ${alert.message}${resolution_notes ? `, 备注: ${resolution_notes}` : ''}`
  });
  
  res.json({ success: true, data: updatedAlert });
});

module.exports = router;
