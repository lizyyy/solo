const express = require('express');
const router = express.Router();
const jobRepository = require('../repositories/JobRepository');
const Job = require('../models/Job');

router.get('/', async (req, res) => {
  try {
    const { status, serviceType, limit, offset } = req.query;
    const options = {};
    
    if (status) options.status = status;
    if (serviceType) options.serviceType = serviceType;
    if (limit) options.limit = parseInt(limit, 10);
    if (offset) options.offset = parseInt(offset, 10);
    
    const jobs = await jobRepository.findAll(options);
    const total = await jobRepository.count(options);
    
    res.json({
      success: true,
      data: jobs.map(j => j.toJSON()),
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
    const job = await jobRepository.findById(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    res.json({
      success: true,
      data: job.toJSON()
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
    const job = await jobRepository.create(req.body);
    res.status(201).json({
      success: true,
      data: job.toJSON()
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
    const job = await jobRepository.update(req.params.id, req.body);
    res.json({
      success: true,
      data: job.toJSON()
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
    const deleted = await jobRepository.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    res.json({
      success: true,
      message: '任务已删除'
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
    const { jobs, clearExisting } = req.body;
    
    if (!Array.isArray(jobs)) {
      return res.status(400).json({
        success: false,
        error: 'jobs 必须是数组'
      });
    }
    
    if (clearExisting) {
      await jobRepository.deleteAll();
    }
    
    const created = [];
    const errors = [];
    
    for (let i = 0; i < jobs.length; i++) {
      try {
        const job = await jobRepository.create(jobs[i]);
        created.push(job.toJSON());
      } catch (error) {
        errors.push({
          index: i,
          data: jobs[i],
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        created: created.length,
        errors: errors.length,
        createdJobs: created,
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
