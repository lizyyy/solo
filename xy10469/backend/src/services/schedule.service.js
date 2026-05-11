const Application = require('../models/Application.model');
const { isDateOverlap } = require('../utils/helpers');

const checkScheduleConflict = async (boothId, startDate, endDate, excludeApplicationId = null) => {
  const query = {
    boothId,
    status: { $in: ['approved', 'in_progress'] },
    _id: { $ne: excludeApplicationId }
  };
  
  const existingApplications = await Application.find(query);
  
  const conflicts = existingApplications.filter(app => {
    return isDateOverlap(startDate, endDate, app.startDate, app.endDate);
  });
  
  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
};

const checkMerchantDoubleBooking = async (merchantId, startDate, endDate, excludeApplicationId = null) => {
  const query = {
    merchantId,
    status: { $in: ['approved', 'in_progress'] },
    _id: { $ne: excludeApplicationId }
  };
  
  const existingApplications = await Application.find(query);
  
  const conflicts = existingApplications.filter(app => {
    return isDateOverlap(startDate, endDate, app.startDate, app.endDate);
  });
  
  return {
    hasDoubleBooking: conflicts.length > 0,
    conflicts
  };
};

const getBoothOccupiedDates = async (boothId, year, month) => {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);
  
  const applications = await Application.find({
    boothId,
    status: { $in: ['approved', 'in_progress', 'completed'] },
    $or: [
      { startDate: { $lte: endOfMonth }, endDate: { $gte: startOfMonth } }
    ]
  }).populate('merchantId', 'name');
  
  const occupiedDates = {};
  applications.forEach(app => {
    const start = new Date(Math.max(app.startDate, startOfMonth));
    const end = new Date(Math.min(app.endDate, endOfMonth));
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (!occupiedDates[dateStr]) {
        occupiedDates[dateStr] = {
          status: app.status,
          merchant: app.merchantId?.name || '未知商户',
          applicationNo: app.applicationNo
        };
      }
    }
  });
  
  return occupiedDates;
};

const checkCanAdmission = (application) => {
  return application.depositPaid && 
         application.electricityApproved && 
         application.status === 'approved';
};

const checkCanWithdraw = (application) => {
  return application.status === 'in_progress' || 
         application.status === 'approved';
};

const checkCanRefundDeposit = async (applicationId) => {
  const Acceptance = require('../models/Acceptance.model');
  
  const acceptance = await Acceptance.findOne({
    applicationId,
    type: 'withdrawal',
    overallStatus: { $in: ['passed', 'failed'] }
  }).sort({ createdAt: -1 });
  
  if (!acceptance) {
    return {
      canRefund: false,
      reason: '撤场验收未完成',
      acceptance: null
    };
  }
  
  const failedItems = acceptance.items.filter(item => item.status === 'fail');
  
  return {
    canRefund: acceptance.canRefundDeposit,
    reason: failedItems.length > 0 ? `存在${failedItems.length}项未通过验收项` : '验收通过',
    acceptance,
    failedItems
  };
};

const calculateDeductionAmount = (acceptanceItems) => {
  return acceptanceItems
    .filter(item => item.status === 'fail')
    .reduce((sum, item) => sum + (item.deductionAmount || 0), 0);
};

module.exports = {
  checkScheduleConflict,
  checkMerchantDoubleBooking,
  getBoothOccupiedDates,
  checkCanAdmission,
  checkCanWithdraw,
  checkCanRefundDeposit,
  calculateDeductionAmount
};