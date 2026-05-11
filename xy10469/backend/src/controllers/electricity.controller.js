const ElectricityApproval = require('../models/ElectricityApproval.model');
const Application = require('../models/Application.model');
const electricityService = require('../services/electricity.service');

exports.getAllApprovals = async (req, res) => {
  try {
    const { status, boothId, merchantId } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (boothId) query.boothId = boothId;
    if (merchantId) query.merchantId = merchantId;
    
    const approvals = await ElectricityApproval.find(query)
      .populate('boothId', 'code name location')
      .populate('merchantId', 'name contactPerson phone')
      .populate('applicationId', 'applicationNo')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: approvals
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getApprovalById = async (req, res) => {
  try {
    const approval = await ElectricityApproval.findById(req.params.id)
      .populate('boothId')
      .populate('merchantId')
      .populate('applicationId');
    
    if (!approval) {
      return res.status(404).json({ success: false, message: '用电审批记录不存在' });
    }
    res.json({
      success: true,
      data: approval
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRiskyApprovals = async (req, res) => {
  try {
    const riskyApprovals = await electricityService.getRiskyApprovals();
    res.json({
      success: true,
      data: riskyApprovals
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.approveElectricity = async (req, res) => {
  try {
    const approval = await ElectricityApproval.findById(req.params.id);
    if (!approval) {
      return res.status(404).json({ success: false, message: '用电审批记录不存在' });
    }
    
    if (approval.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该审批已处理' });
    }
    
    approval.status = 'approved';
    approval.approvedElectricity = req.body.approvedElectricity || approval.requestedElectricity;
    approval.reason = req.body.reason || '人工审批通过';
    approval.safetyCheck = req.body.safetyCheck !== false;
    approval.safetyNote = req.body.safetyNote || '';
    approval.approvedBy = req.body.approvedBy || '系统管理员';
    approval.approvedAt = new Date();
    
    await approval.save();
    
    await Application.findByIdAndUpdate(approval.applicationId, {
      electricityApproved: true
    });
    
    res.json({
      success: true,
      data: approval,
      message: '用电审批通过'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.rejectElectricity = async (req, res) => {
  try {
    const approval = await ElectricityApproval.findById(req.params.id);
    if (!approval) {
      return res.status(404).json({ success: false, message: '用电审批记录不存在' });
    }
    
    if (approval.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该审批已处理' });
    }
    
    approval.status = 'rejected';
    approval.reason = req.body.reason || '用电申请被拒绝';
    approval.approvedBy = req.body.approvedBy || '系统管理员';
    approval.approvedAt = new Date();
    
    await approval.save();
    
    res.json({
      success: true,
      data: approval,
      message: '用电审批已拒绝'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};