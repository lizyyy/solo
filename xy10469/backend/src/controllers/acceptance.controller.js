const Acceptance = require('../models/Acceptance.model');
const Application = require('../models/Application.model');
const Deposit = require('../models/Deposit.model');
const scheduleService = require('../services/schedule.service');
const depositService = require('../services/deposit.service');
const { generateOrderNo } = require('../utils/helpers');

exports.getAllAcceptances = async (req, res) => {
  try {
    const { type, status, applicationId } = req.query;
    const query = {};
    
    if (type) query.type = type;
    if (status) query.overallStatus = status;
    if (applicationId) query.applicationId = applicationId;
    
    const acceptances = await Acceptance.find(query)
      .populate('merchantId', 'name contactPerson phone')
      .populate('boothId', 'code name location')
      .populate('applicationId', 'applicationNo')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: acceptances
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAcceptanceById = async (req, res) => {
  try {
    const acceptance = await Acceptance.findById(req.params.id)
      .populate('merchantId')
      .populate('boothId')
      .populate('applicationId');
    
    if (!acceptance) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }
    res.json({
      success: true,
      data: acceptance
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAdmissionAcceptance = async (req, res) => {
  try {
    const application = await Application.findById(req.body.applicationId)
      .populate('boothId')
      .populate('merchantId');
    
    if (!application) {
      return res.status(404).json({ success: false, message: '申请不存在' });
    }
    
    if (application.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: '只有进行中的申请可以进行入场验收' });
    }
    
    const existingAcceptance = await Acceptance.findOne({
      applicationId: application._id,
      type: 'admission'
    });
    
    if (existingAcceptance) {
      return res.status(400).json({ success: false, message: '该申请已存在入场验收记录' });
    }
    
    const items = req.body.items || [
      { itemName: '摊位设备完好', category: 'equipment', status: 'pass' },
      { itemName: '场地清洁', category: 'cleanliness', status: 'pass' },
      { itemName: '用电设备正常', category: 'electricity', status: 'pass' },
      { itemName: '结构安全', category: 'structure', status: 'pass' }
    ];
    
    const failedItems = items.filter(item => item.status === 'fail');
    const totalDeduction = scheduleService.calculateDeductionAmount(items);
    
    const acceptance = new Acceptance({
      acceptanceNo: generateOrderNo('AD'),
      applicationId: application._id,
      merchantId: application.merchantId,
      boothId: application.boothId,
      type: 'admission',
      items,
      overallStatus: failedItems.length > 0 ? 'failed' : 'passed',
      totalDeduction,
      canRefundDeposit: failedItems.length === 0,
      inspector: req.body.inspector || '系统管理员',
      inspectionDate: req.body.inspectionDate || new Date(),
      conclusion: req.body.conclusion || (failedItems.length > 0 ? '存在问题需要整改' : '验收通过')
    });
    
    await acceptance.save();
    
    res.json({
      success: true,
      data: acceptance,
      message: acceptance.overallStatus === 'passed' ? '入场验收通过' : '入场验收存在问题'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createWithdrawalAcceptance = async (req, res) => {
  try {
    const application = await Application.findById(req.body.applicationId)
      .populate('boothId')
      .populate('merchantId');
    
    if (!application) {
      return res.status(404).json({ success: false, message: '申请不存在' });
    }
    
    if (application.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: '只有进行中的申请可以进行撤场验收' });
    }
    
    const items = req.body.items || [
      { itemName: '摊位设备归还完好', category: 'equipment', status: 'pass' },
      { itemName: '场地清洁恢复', category: 'cleanliness', status: 'pass' },
      { itemName: '用电设备拆除完好', category: 'electricity', status: 'pass' },
      { itemName: '结构安全检查', category: 'structure', status: 'pass' }
    ];
    
    const failedItems = items.filter(item => item.status === 'fail');
    const totalDeduction = scheduleService.calculateDeductionAmount(items);
    
    const acceptance = new Acceptance({
      acceptanceNo: generateOrderNo('WD'),
      applicationId: application._id,
      merchantId: application.merchantId,
      boothId: application.boothId,
      type: 'withdrawal',
      items,
      overallStatus: failedItems.length > 0 ? 'failed' : 'passed',
      totalDeduction,
      canRefundDeposit: failedItems.length === 0,
      inspector: req.body.inspector || '系统管理员',
      inspectionDate: req.body.inspectionDate || new Date(),
      conclusion: req.body.conclusion || (failedItems.length > 0 ? '撤场验收存在问题，需扣除押金' : '撤场验收通过，可退还押金')
    });
    
    await acceptance.save();
    
    if (failedItems.length > 0 && totalDeduction > 0) {
      const deductionItems = failedItems.map(item => ({
        itemName: item.itemName,
        amount: item.deductionAmount || 0,
        reason: item.deductionReason || item.notes || '验收未通过'
      }));
      
      await depositService.createDeduction(
        application._id,
        deductionItems,
        req.body.inspector || '系统管理员',
        '撤场验收不合格扣款'
      );
    }
    
    if (failedItems.length === 0) {
      application.status = 'completed';
      await application.save();
    }
    
    res.json({
      success: true,
      data: acceptance,
      message: acceptance.overallStatus === 'passed' 
        ? '撤场验收通过，可办理押金退还' 
        : '撤场验收存在问题，押金需扣除后退还',
      failedItems,
      totalDeduction
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.refundDepositAfterAcceptance = async (req, res) => {
  try {
    const { acceptanceId, operator } = req.body;
    
    const acceptance = await Acceptance.findById(acceptanceId)
      .populate('applicationId');
    
    if (!acceptance) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }
    
    if (acceptance.type !== 'withdrawal') {
      return res.status(400).json({ success: false, message: '只能通过撤场验收申请退押金' });
    }
    
    const depositTransaction = await Deposit.findOne({
      applicationId: acceptance.applicationId._id,
      type: 'deposit',
      status: 'confirmed'
    });
    
    if (!depositTransaction) {
      return res.status(404).json({ success: false, message: '未找到有效的押金记录' });
    }
    
    const refundAmount = depositTransaction.amount - acceptance.totalDeduction;
    
    if (refundAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: '押金已全部扣除，无可退还金额',
        totalDeduction: acceptance.totalDeduction,
        originalDeposit: depositTransaction.amount
      });
    }
    
    const refund = await depositService.refundDeposit(
      acceptance.applicationId._id,
      depositTransaction._id,
      refundAmount,
      operator || '系统管理员',
      `撤场验收${acceptance.overallStatus === 'passed' ? '通过' : '部分扣除'}，退还押金`
    );
    
    const application = acceptance.applicationId;
    application.status = 'completed';
    await application.save();
    
    res.json({
      success: true,
      data: {
        refund,
        originalDeposit: depositTransaction.amount,
        totalDeduction: acceptance.totalDeduction,
        refundAmount
      },
      message: `押金退还成功，退还金额：${refundAmount}元`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};