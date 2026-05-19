const express = require('express');
const OperationLog = require('../models/OperationLog');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const logs = await OperationLog.findAll(req.query);
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
