const Application = require('../models/Application.model');
const Booth = require('../models/Booth.model');
const Merchant = require('../models/Merchant.model');
const scheduleService = require('../services/schedule.service');
const depositService = require('../services/deposit.service');
const electricityService = require('../services/electricity.service');
const { generateOrderNo } = require('../utils/helpers');

exports.getAllApplications = async (req, res) => {
  try {
    const { status, merchantId, boothId, keyword } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (merchantId) query.merchantId = merchantId;
    if (boothId) query.boothId = boothId;
    
    let applications = await Application.find(query)
      .populate('merchantId', 'name contactPerson phone')
      .populate('boothId', 'code name type location')
      .populate('scheduleId', 'name')
      .sort({ createdAt: -1 });
    
    if (keyword) {
      applications = applications.filter(app => 
        app.applicationNo?.includes(keyword) ||
        app.merchantId?.name?.includes(keyword) ||
        app.boothId?.code?.includes(keyword)
      );
    }
    
    res.json({
      success: true,
      data: applications
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getApplicationById = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('merchantId')
      .populate('boothId')
      .populate('scheduleId');
    
    if (!application) {
      return res.status(404).json({ success: false, message: '申请不存在' });
    }
    
    const canAdmission = scheduleService.checkCanAdmission(application);
    const refundCheck = await scheduleService.checkCanRefundDeposit(application._id);
    
    res.json({
      success: true,
      data: {
        ...application.toObject(),
        canAdmission,
        refundCheck
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createApplication = async (req, res) => {
  try {
    const { merchantId, boothId, scheduleId, startDate, endDate } = req.body;
    
    const [merchant, booth, schedule] = await Promise.all([
      Merchant.findById(merchantId),
      Booth.findById(boothId),
      Schedule.findById(scheduleId)
    ]);
    
    if (!merchant) {
      return res.status(400).json({ success: false, message: '商户不存在' });
    }
    if (!booth) {
      return res.status(400).json({ success: false, message: '摊位不存在' });
    }
    if (!schedule) {
      return res.status(400).json({ success: false, message: '档期不存在' });
    }
    
    if (merchant.status !== 'active') {
      return res.status(400).json({ success: false, message: `商户状态为"${merchant.status}"，无法申请` });
    }
    
    if (booth.status === 'disabled' || booth.status === 'maintenance') {
      return res.status(400).json({ success: false, message: `摊位状态为"${booth.status}"，无法申请` });
    }
    
    const scheduleConflict = await scheduleService.checkScheduleConflict(
      boothId, 
      new Date(startDate), 
      new Date(endDate)
    );
    
    if (scheduleConflict.hasConflict) {
      return res.status(400).json({ 
        success: false, 
        message: '档期冲突：该摊位在申请时间段内已被占用',
        conflicts: scheduleConflict.conflicts
      });
    }
    
    const doubleBooking = await scheduleService.checkMerchantDoubleBooking(
      merchantId,
      new Date(startDate),
      new Date(endDate)
    );
    
    if (doubleBooking.hasDoubleBooking) {
      return res.status(400).json({ 
        success: false, 
        message: '同一商户重复占位：该商户在申请时间段内已有其他摊位申请',
        conflicts: doubleBooking.conflicts
      });
    }
    
    const application = new Application({
      ...req.body,
      applicationNo: generateOrderNo('AP'),
      status: 'pending'
    });
    
    await application.save();
    
    res.status(201).json({
      success: true,
      data: application,
      message: '申请创建成功'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateApplication = async (req, res) => {
  try {
    const application = await Application.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!application) {
      return res.status(404).json({ success: false, message: '申请不存在' });
    }
    res.json({
      success: true,
      data: application,
      message: '申请更新成功'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.approveApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).populate('boothId');
    if (!application) {
      return res.status(404).json({ success: false, message: '申请不存在' });
    }
    
    if (application.status !== 'pending') {
      return res.status(400).json({ success: false, message: '只有待审核状态的申请可以审批' });
    }
    
    application.status = 'approved';
    application.reviewedBy = req.body.reviewedBy || '系统管理员';
    application.reviewedAt = new Date();
    application.reviewNote = req.body.reviewNote || '';
    await application.save();
    
    const depositTransaction = await depositService.createDepositPayment(application, application.boothId);
    const rentTransaction = await depositService.createRentPayment(application, application.boothId);
    await electricityService.createApproval(application, application.boothId, req.body.equipmentList);
    
    res.json({
      success: true,
      data: {
        application,
        transactions: {
          deposit: depositTransaction,
          rent: rentTransaction
        }
      },
      message: '申请审批通过，已生成押金和租金待支付记录'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.rejectApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: '申请不存在' });
    }
    
    if (application.status !== 'pending') {
      return res.status(400).json({ success: false, message: '只有待审核状态的申请可以拒绝' });
    }
    
    application.status = 'rejected';
    application.reviewedBy = req.body.reviewedBy || '系统管理员';
    application.reviewedAt = new Date();
    application.reviewNote = req.body.reviewNote || '';
    await application.save();
    
    res.json({
      success: true,
      data: application,
      message: '申请已拒绝'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.confirmAdmission = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: '申请不存在' });
    }
    
    const canAdmission = scheduleService.checkCanAdmission(application);
    if (!canAdmission) {
      const missingConditions = [];
      if (!application.depositPaid) missingConditions.push('未缴纳押金');
      if (!application.electricityApproved) missingConditions.push('用电未审批通过');
      if (application.status !== 'approved') missingConditions.push('申请未通过审核');
      
      return res.status(400).json({ 
        success: false, 
        message: `无法入场：${missingConditions.join('；')}` 
      });
    }
    
    application.status = 'in_progress';
    application.admissionConfirmed = true;
    await application.save();
    
    res.json({
      success: true,
      data: application,
      message: '入场确认成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: '申请不存在' });
    }
    
    if (!['pending', 'approved'].includes(application.status)) {
      return res.status(400).json({ success: false, message: '该状态的申请无法取消' });
    }
    
    application.status = 'cancelled';
    await application.save();
    
    res.json({
      success: true,
      data: application,
      message: '申请已取消'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};