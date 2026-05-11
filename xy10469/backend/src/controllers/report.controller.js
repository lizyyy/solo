const reportService = require('../services/report.service');
const electricityService = require('../services/electricity.service');
const depositService = require('../services/deposit.service');

exports.getBoothCalendar = async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
    const calendar = await reportService.getBoothCalendar(parseInt(year), parseInt(month));
    res.json({
      success: true,
      data: calendar
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getIncomeReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: '请提供开始日期和结束日期' });
    }
    
    const transactions = await depositService.getDepositTransactions({
      startDate,
      endDate
    });
    const summary = await depositService.getDepositSummary();
    
    res.json({
      success: true,
      data: {
        transactions,
        summary
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDeductionDetailsReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: '请提供开始日期和结束日期' });
    }
    
    const Deposit = require('../models/Deposit.model');
    const Acceptance = require('../models/Acceptance.model');
    
    const deductions = await Deposit.find({
      type: 'deduction',
      status: 'confirmed',
      transactionDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
    })
      .populate('merchantId', 'name')
      .populate({
        path: 'applicationId',
        populate: [
          { path: 'boothId', select: 'code name type' },
          { path: 'merchantId', select: 'name' }
        ]
      })
      .sort({ transactionDate: -1 });
    
    const records = await Promise.all(deductions.map(async (d) => {
      let acceptance = null;
      if (d.relatedTransactionId || d.applicationId) {
        acceptance = await Acceptance.findOne({
          applicationId: d.applicationId?._id,
          type: 'withdrawal'
        }).sort({ createdAt: -1 });
      }
      
      let deductionItems = [];
      if (d.deductionDetails && d.deductionDetails.length) {
        deductionItems = d.deductionDetails;
      } else if (acceptance && acceptance.items) {
        deductionItems = acceptance.items
          .filter(item => item.status === 'fail')
          .map(item => ({
            category: item.category,
            name: item.itemName,
            passed: false,
            deductionAmount: item.deductionAmount || 0,
            deductionReason: item.deductionReason || ''
          }));
      }
      
      return {
        ...d.toObject(),
        deductionItems,
        acceptanceId: acceptance
      };
    }));
    
    const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
    
    res.json({
      success: true,
      data: {
        records,
        totalAmount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOccupancyRateReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: '请提供开始日期和结束日期' });
    }
    
    const report = await reportService.getOccupancyRateReport(
      new Date(startDate),
      new Date(endDate)
    );
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getElectricityRiskReport = async (req, res) => {
  try {
    const riskyApprovals = await electricityService.getRiskyApprovals();
    
    const summary = {
      total: riskyApprovals.length,
      highRisk: riskyApprovals.filter(a => a.riskLevel === 'high').length,
      mediumRisk: riskyApprovals.filter(a => a.riskLevel === 'medium').length,
      lowRisk: riskyApprovals.filter(a => a.riskLevel === 'low').length,
      pendingApproval: riskyApprovals.filter(a => a.status === 'pending').length
    };
    
    res.json({
      success: true,
      data: {
        summary,
        details: riskyApprovals
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDepositFlowReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate) query.transactionDate = { $gte: new Date(startDate) };
    if (endDate) query.transactionDate = { ...query.transactionDate, $lte: new Date(endDate) };
    
    const transactions = await depositService.getDepositTransactions(query);
    const summary = await depositService.getDepositSummary();
    
    res.json({
      success: true,
      data: {
        summary,
        transactions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDashboardSummary = async (req, res) => {
  try {
    const Application = require('../models/Application.model');
    const Booth = require('../models/Booth.model');
    const Merchant = require('../models/Merchant.model');
    
    const [
      totalBooths,
      availableBooths,
      totalMerchants,
      activeApplications,
      pendingApplications,
      depositSummary,
      electricityRisk
    ] = await Promise.all([
      Booth.countDocuments({ status: { $ne: 'disabled' } }),
      Booth.countDocuments({ status: 'available' }),
      Merchant.countDocuments({ status: 'active' }),
      Application.countDocuments({ status: { $in: ['approved', 'in_progress'] } }),
      Application.countDocuments({ status: 'pending' }),
      depositService.getDepositSummary(),
      electricityService.getRiskyApprovals()
    ]);
    
    res.json({
      success: true,
      data: {
        booths: {
          total: totalBooths,
          available: availableBooths,
          occupied: totalBooths - availableBooths,
          occupancyRate: totalBooths > 0 
            ? ((totalBooths - availableBooths) / totalBooths * 100).toFixed(1) 
            : 0
        },
        merchants: {
          total: totalMerchants
        },
        applications: {
          active: activeApplications,
          pending: pendingApplications
        },
        finance: {
          totalRent: depositSummary.totalRent,
          totalDeductions: depositSummary.totalDeductions,
          totalElectricity: depositSummary.totalElectricity,
          netRevenue: depositSummary.netRevenue,
          pendingPayments: depositSummary.pendingPayments
        },
        alerts: {
          electricityRisk: electricityRisk.filter(a => a.riskLevel === 'high').length,
          pendingApprovals: electricityRisk.filter(a => a.status === 'pending').length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};