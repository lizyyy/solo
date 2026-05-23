const express = require('express');
const router = express.Router();
const { getFactById, getFactByAppointment, listFacts } = require('../services/factService');

router.get('/', async (req, res) => {
  try {
    const options = {
      status: req.query.status,
      has_dirty: req.query.has_dirty === 'true' ? true : (req.query.has_dirty === 'false' ? false : null),
      page: parseInt(req.query.page) || 1,
      page_size: parseInt(req.query.page_size) || 20,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };
    
    const result = listFacts(options);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:factId', async (req, res) => {
  try {
    const fact = getFactById(req.params.factId);
    if (!fact) {
      return res.status(404).json({
        success: false,
        error: '事实记录不存在'
      });
    }
    res.json({
      success: true,
      data: fact
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/appointment/:appointmentNo', async (req, res) => {
  try {
    const fact = getFactByAppointment(req.params.appointmentNo);
    if (!fact) {
      return res.status(404).json({
        success: false,
        error: '事实记录不存在'
      });
    }
    res.json({
      success: true,
      data: fact
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
