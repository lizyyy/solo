const express = require('express');
const router = express.Router();

const OperationLogModel = require('../models/operationLog');

router.get('/', (req, res) => {
  const { target_type, target_id, operator, limit } = req.query;
  
  let logs;
  
  if (target_type && target_id) {
    logs = OperationLogModel.getByTarget(target_type, target_id);
  } else if (operator) {
    logs = OperationLogModel.getByOperator(operator, parseInt(limit) || 100);
  } else {
    logs = OperationLogModel.getAll(parseInt(limit) || 200);
  }
  
  res.json({ success: true, data: logs });
});

module.exports = router;
