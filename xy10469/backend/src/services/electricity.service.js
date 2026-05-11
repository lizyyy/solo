const ElectricityApproval = require('../models/ElectricityApproval.model');
const Booth = require('../models/Booth.model');

const checkElectricityExceed = (standardElectricity, requestedElectricity) => {
  const exceeds = requestedElectricity > standardElectricity;
  const excess = Math.max(0, requestedElectricity - standardElectricity);
  const excessPercentage = standardElectricity > 0 
    ? (excess / standardElectricity * 100).toFixed(1) 
    : 0;
  
  return {
    exceeds,
    excess,
    excessPercentage: parseFloat(excessPercentage),
    standardElectricity,
    requestedElectricity
  };
};

const createApproval = async (application, booth, equipmentList = []) => {
  const electricityCheck = checkElectricityExceed(
    booth.standardElectricity,
    application.requiredElectricity
  );
  
  const approval = new ElectricityApproval({
    approvalNo: `EL${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    applicationId: application._id,
    merchantId: application.merchantId,
    boothId: booth._id,
    standardElectricity: booth.standardElectricity,
    requestedElectricity: application.requiredElectricity,
    exceedsStandard: electricityCheck.exceeds,
    equipmentList,
    status: electricityCheck.exceeds ? 'pending' : 'approved',
    approvedElectricity: electricityCheck.exceeds ? null : application.requiredElectricity,
    reason: electricityCheck.exceeds 
      ? `超出标准用电${electricityCheck.excessPercentage}%，需要审批` 
      : '用电需求在标准范围内，自动通过'
  });
  
  if (!electricityCheck.exceeds) {
    approval.approvedBy = '系统自动审批';
    approval.approvedAt = new Date();
    approval.safetyCheck = true;
  }
  
  return approval.save();
};

const getRiskyApprovals = async () => {
  const approvals = await ElectricityApproval.find({
    $or: [
      { status: 'pending' },
      { exceedsStandard: true }
    ]
  })
    .populate('boothId', 'code name location')
    .populate('merchantId', 'name contactPerson phone')
    .sort({ createdAt: -1 });
  
  return approvals.map(approval => {
    const excess = approval.requestedElectricity - approval.standardElectricity;
    const riskLevel = approval.exceedsStandard 
      ? (excess > 10 ? 'high' : excess > 5 ? 'medium' : 'low')
      : 'none';
    
    return {
      ...approval.toObject(),
      riskLevel,
      excess,
      riskDescription: getRiskDescription(riskLevel, excess)
    };
  });
};

const getRiskDescription = (riskLevel, excess) => {
  switch (riskLevel) {
    case 'high':
      return `高风险：超出标准用电${excess}kW，存在安全隐患`;
    case 'medium':
      return `中风险：超出标准用电${excess}kW，需要加强监控`;
    case 'low':
      return `低风险：超出标准用电${excess}kW，建议优化设备配置`;
    default:
      return '正常用电';
  }
};

const getElectricityUsageReport = async (startDate, endDate) => {
  const approvals = await ElectricityApproval.find({
    createdAt: { $gte: startDate, $lte: endDate },
    status: 'approved'
  }).populate('boothId', 'code name');
  
  const totalApproved = approvals.length;
  const totalExceeding = approvals.filter(a => a.exceedsStandard).length;
  const averageApproved = totalApproved > 0 
    ? approvals.reduce((sum, a) => sum + (a.approvedElectricity || 0), 0) / totalApproved 
    : 0;
  
  return {
    period: { startDate, endDate },
    totalApproved,
    totalExceeding,
    exceedingRate: totalApproved > 0 
      ? ((totalExceeding / totalApproved) * 100).toFixed(1) 
      : 0,
    averageApprovedElectricity: parseFloat(averageApproved.toFixed(2)),
    details: approvals.map(a => ({
      approvalNo: a.approvalNo,
      booth: a.boothId?.name || '未知摊位',
      standard: a.standardElectricity,
      approved: a.approvedElectricity,
      excess: a.exceedsStandard ? a.approvedElectricity - a.standardElectricity : 0
    }))
  };
};

module.exports = {
  checkElectricityExceed,
  createApproval,
  getRiskyApprovals,
  getElectricityUsageReport
};