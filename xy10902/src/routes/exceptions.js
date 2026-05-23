const express = require('express');
const router = express.Router();
const ExceptionLog = require('../models/ExceptionLog');

router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;

    const exceptions = await ExceptionLog.list(parseInt(page), parseInt(pageSize));

    res.json({
      success: true,
      data: exceptions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
