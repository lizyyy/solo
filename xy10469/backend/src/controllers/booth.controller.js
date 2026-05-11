const Booth = require('../models/Booth.model');
const scheduleService = require('../services/schedule.service');

exports.getAllBooths = async (req, res) => {
  try {
    const { type, status } = req.query;
    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    
    const booths = await Booth.find(query).sort({ code: 1 });
    res.json({
      success: true,
      data: booths
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBoothById = async (req, res) => {
  try {
    const booth = await Booth.findById(req.params.id);
    if (!booth) {
      return res.status(404).json({ success: false, message: '摊位不存在' });
    }
    res.json({
      success: true,
      data: booth
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createBooth = async (req, res) => {
  try {
    const booth = new Booth(req.body);
    await booth.save();
    res.status(201).json({
      success: true,
      data: booth,
      message: '摊位创建成功'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateBooth = async (req, res) => {
  try {
    const booth = await Booth.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!booth) {
      return res.status(404).json({ success: false, message: '摊位不存在' });
    }
    res.json({
      success: true,
      data: booth,
      message: '摊位更新成功'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteBooth = async (req, res) => {
  try {
    const booth = await Booth.findByIdAndDelete(req.params.id);
    if (!booth) {
      return res.status(404).json({ success: false, message: '摊位不存在' });
    }
    res.json({
      success: true,
      message: '摊位删除成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBoothCalendar = async (req, res) => {
  try {
    const { id } = req.params;
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
    
    const occupiedDates = await scheduleService.getBoothOccupiedDates(id, parseInt(year), parseInt(month));
    const booth = await Booth.findById(id);
    
    res.json({
      success: true,
      data: {
        booth,
        year: parseInt(year),
        month: parseInt(month),
        occupiedDates
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.checkBoothAvailability = async (req, res) => {
  try {
    const { boothId, startDate, endDate, applicationId } = req.body;
    
    const conflictCheck = await scheduleService.checkScheduleConflict(
      boothId, 
      new Date(startDate), 
      new Date(endDate),
      applicationId
    );
    
    res.json({
      success: true,
      data: conflictCheck
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};