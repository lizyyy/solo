const Schedule = require('../models/Schedule.model');

exports.getAllSchedules = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;
    
    const schedules = await Schedule.find(query).sort({ startDate: 1 });
    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getScheduleById = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: '档期不存在' });
    }
    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createSchedule = async (req, res) => {
  try {
    const schedule = new Schedule(req.body);
    await schedule.save();
    res.status(201).json({
      success: true,
      data: schedule,
      message: '档期创建成功'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!schedule) {
      return res.status(404).json({ success: false, message: '档期不存在' });
    }
    res.json({
      success: true,
      data: schedule,
      message: '档期更新成功'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: '档期不存在' });
    }
    res.json({
      success: true,
      message: '档期删除成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};