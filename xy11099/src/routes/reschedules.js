const express = require('express');
const { Parser } = require('json2csv');
const rescheduleModel = require('../models/reschedule');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const result = await rescheduleModel.create(req.body);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      store: req.query.store,
      person_in_charge: req.query.person_in_charge,
      scenic_spot: req.query.scenic_spot,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      customer_name: req.query.customer_name
    };

    const result = await rescheduleModel.list(filters);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/export', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      store: req.query.store,
      person_in_charge: req.query.person_in_charge,
      scenic_spot: req.query.scenic_spot,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      customer_name: req.query.customer_name
    };

    const data = await rescheduleModel.list(filters);
    
    const fields = [
      'reschedule_no', 'customer_name', 'customer_phone',
      'original_shot_date', 'new_shot_date', 'original_route',
      'new_route', 'scenic_spot', 'store', 'person_in_charge',
      'reschedule_reason', 'status', 'reschedule_fee', 'remarks',
      'created_at', 'is_reversed'
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=reschedules.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await rescheduleModel.getById(req.params.id);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: '记录不存在'
      });
    }
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const result = await rescheduleModel.getHistory(req.params.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const operator = req.body.operator || 'system';
    delete req.body.operator;
    const result = await rescheduleModel.update(req.params.id, req.body, operator);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/reverse', async (req, res) => {
  try {
    const operator = req.body.operator || 'system';
    const reverseReason = req.body.reverse_reason || '';
    const result = await rescheduleModel.reverse(req.params.id, operator, reverseReason);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/batch-import', async (req, res) => {
  try {
    const { records, operator } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        error: 'records必须是数组'
      });
    }
    const result = await rescheduleModel.batchImport(records, operator || 'system');
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;