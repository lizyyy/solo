const express = require('express');
const router = express.Router();
const workerRepository = require('../repositories/WorkerRepository');

router.get('/', async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    const options = {};
    
    if (status) options.status = status;
    if (limit) options.limit = parseInt(limit, 10);
    if (offset) options.offset = parseInt(offset, 10);
    
    const workers = await workerRepository.findAll(options);
    const total = await workerRepository.count(options);
    
    res.json({
      success: true,
      data: workers.map(w => w.toJSON()),
      pagination: {
        total,
        limit: options.limit || total,
        offset: options.offset || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const worker = await workerRepository.findById(req.params.id);
    if (!worker) {
      return res.status(404).json({
        success: false,
        error: '师傅不存在'
      });
    }
    res.json({
      success: true,
      data: worker.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const worker = await workerRepository.create(req.body);
    res.status(201).json({
      success: true,
      data: worker.toJSON()
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
    const worker = await workerRepository.update(req.params.id, req.body);
    res.json({
      success: true,
      data: worker.toJSON()
    });
  } catch (error) {
    if (error.message.includes('不存在')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await workerRepository.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: '师傅不存在'
      });
    }
    res.json({
      success: true,
      message: '师傅已删除'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { workers, clearExisting } = req.body;
    
    if (!Array.isArray(workers)) {
      return res.status(400).json({
        success: false,
        error: 'workers 必须是数组'
      });
    }
    
    if (clearExisting) {
      await workerRepository.deleteAll();
    }
    
    const created = [];
    const errors = [];
    
    for (let i = 0; i < workers.length; i++) {
      try {
        const worker = await workerRepository.create(workers[i]);
        created.push(worker.toJSON());
      } catch (error) {
        errors.push({
          index: i,
          data: workers[i],
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        created: created.length,
        errors: errors.length,
        createdWorkers: created,
        errorDetails: errors
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
