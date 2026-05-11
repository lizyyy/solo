const Application = require('../models/Application.model');
const Deposit = require('../models/Deposit.model');
const Booth = require('../models/Booth.model');
const Acceptance = require('../models/Acceptance.model');
const { getDateRangeDays } = require('../utils/helpers');

const getBoothCalendar = async (year, month) => {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);
  
  const booths = await Booth.find({ status: { $ne: 'disabled' } });
  const applications = await Application.find({
    status: { $in: ['approved', 'in_progress', 'completed', 'admission'] },
    startDate: { $lte: endOfMonth },
    endDate: { $gte: startOfMonth }
  }).populate('merchantId', 'name');
  
  const boothMap = {};
  booths.forEach(b => {
    boothMap[b._id.toString()] = b;
  });
  
  const result = booths.map(booth => {
    const boothApps = applications.filter(
      app => app.boothId && app.boothId.toString() === booth._id.toString()
    );
    
    return {
      _id: booth._id,
      boothCode: booth.code,
      boothName: booth.name,
      boothType: booth.type,
      location: booth.location,
      applications: boothApps.map(app => ({
        _id: app._id,
        applicationNo: app.applicationNo,
        merchantId: app.merchantId,
        startDate: app.startDate,
        endDate: app.endDate,
        status: app.status
      }))
    };
  });
  
  return result;
};

const getIncomeReport = async (startDate, endDate) => {
  const deposits = await Deposit.find({
    transactionDate: { $gte: startDate, $lte: endDate },
    status: 'confirmed'
  });
  
  const report = {
    period: { startDate, endDate },
    totalRent: 0,
    totalDepositDeductions: 0,
    totalElectricityFees: 0,
    totalIncome: 0,
    breakdown: [],
    summaryByType: {
      rent: 0,
      depositDeduction: 0,
      electricity: 0
    }
  };
  
  deposits.forEach(d => {
    let category = null;
    
    switch (d.type) {
      case 'rent':
        report.totalRent += d.amount;
        report.summaryByType.rent += d.amount;
        category = 'rent';
        break;
      case 'deduction':
        report.totalDepositDeductions += d.amount;
        report.summaryByType.depositDeduction += d.amount;
        category = 'depositDeduction';
        break;
      case 'electricity':
        report.totalElectricityFees += d.amount;
        report.summaryByType.electricity += d.amount;
        category = 'electricity';
        break;
    }
    
    if (category) {
      report.breakdown.push({
        transactionNo: d.transactionNo,
        type: d.type,
        category,
        amount: d.amount,
        date: d.transactionDate,
        notes: d.notes
      });
    }
  });
  
  report.totalIncome = report.totalRent + report.totalDepositDeductions + report.totalElectricityFees;
  
  return report;
};

const getDeductionDetailsReport = async (startDate, endDate) => {
  const acceptances = await Acceptance.find({
    type: 'withdrawal',
    overallStatus: 'failed',
    inspectionDate: { $gte: startDate, $lte: endDate }
  })
    .populate('merchantId', 'name')
    .populate('boothId', 'code name');
  
  const report = {
    period: { startDate, endDate },
    totalDeductions: 0,
    totalCases: acceptances.length,
    details: []
  };
  
  acceptances.forEach(a => {
    const failedItems = a.items.filter(item => item.status === 'fail');
    
    failedItems.forEach(item => {
      report.details.push({
        acceptanceNo: a.acceptanceNo,
        merchant: a.merchantId?.name || '未知商户',
        booth: a.boothId?.name || a.boothId?.code || '未知摊位',
        itemName: item.itemName,
        category: item.category,
        deductionAmount: item.deductionAmount || 0,
        deductionReason: item.deductionReason || '未填写',
        inspectionDate: a.inspectionDate,
        inspector: a.inspector
      });
      
      report.totalDeductions += item.deductionAmount || 0;
    });
  });
  
  return report;
};

const getOccupancyRateReport = async (startDate, endDate) => {
  const booths = await Booth.find({ status: 'available' });
  const applications = await Application.find({
    status: { $in: ['approved', 'in_progress', 'completed'] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate }
  });
  
  const totalDays = getDateRangeDays(startDate, endDate);
  const totalBoothDays = booths.length * totalDays;
  let occupiedBoothDays = 0;
  
  applications.forEach(app => {
    const start = new Date(Math.max(app.startDate, startDate));
    const end = new Date(Math.min(app.endDate, endDate));
    occupiedBoothDays += getDateRangeDays(start, end);
  });
  
  return {
    period: { startDate, endDate },
    totalBooths: booths.length,
    totalDays,
    totalBoothDays,
    occupiedBoothDays,
    occupancyRate: totalBoothDays > 0 
      ? ((occupiedBoothDays / totalBoothDays) * 100).toFixed(2) 
      : 0
  };
};

module.exports = {
  getBoothCalendar,
  getIncomeReport,
  getDeductionDetailsReport,
  getOccupancyRateReport
};