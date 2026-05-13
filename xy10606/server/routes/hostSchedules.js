const express = require('express');
const router = express.Router();
const hostScheduleModel = require('../models/hostSchedule');
const { success, error } = require('../utils/response');

router.get('/hosts', async (req, res) => {
  try {
    const hosts = await hostScheduleModel.getAllHosts();
    res.json(success(hosts));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.post('/hosts', async (req, res) => {
  try {
    const { name, department } = req.body;
    if (!name) {
      return res.status(400).json(error('主播名称不能为空'));
    }
    const host = await hostScheduleModel.createHost(name, department);
    res.json(success(host, '主播创建成功'));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.get('/schedules', async (req, res) => {
  try {
    const filter = {};
    if (req.query.host_id) filter.host_id = req.query.host_id;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.start_date) filter.start_date = req.query.start_date;
    if (req.query.end_date) filter.end_date = req.query.end_date;
    
    const schedules = await hostScheduleModel.getAllSchedules(filter);
    res.json(success(schedules));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.get('/schedules/:id', async (req, res) => {
  try {
    const schedule = await hostScheduleModel.getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json(error('排期不存在'));
    }
    res.json(success(schedule));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.post('/schedules', async (req, res) => {
  try {
    const { host_id, schedule_date, start_time, end_time, description, status, created_by } = req.body;
    
    if (!host_id || !schedule_date) {
      return res.status(400).json(error('主播ID和排期日期不能为空'));
    }
    
    const schedule = await hostScheduleModel.createSchedule({
      host_id,
      schedule_date,
      start_time,
      end_time,
      description,
      status,
      created_by
    });
    
    res.json(success(schedule, '排期创建成功'));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.put('/schedules/:id', async (req, res) => {
  try {
    const { change_reason, updated_by, ...updateData } = req.body;
    const schedule = await hostScheduleModel.updateSchedule(req.params.id, {
      ...updateData,
      change_reason
    }, updated_by || 'system');
    
    if (!schedule) {
      return res.status(404).json(error('排期不存在'));
    }
    
    res.json(success(schedule, '排期更新成功'));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.get('/schedules/:id/versions', async (req, res) => {
  try {
    const versions = await hostScheduleModel.getScheduleVersions(req.params.id);
    res.json(success(versions));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

module.exports = router;
