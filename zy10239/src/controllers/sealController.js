const SealService = require('../services/SealService');
const { Parser } = require('json2csv');

function handleError(res, error) {
  res.status(400).json({ success: false, message: error.message });
}

const sealController = {
  getAllSeals: (req, res) => {
    try {
      const seals = SealService.getAllSeals();
      res.json({ success: true, data: seals });
    } catch (error) {
      handleError(res, error);
    }
  },

  getSealById: (req, res) => {
    try {
      const seal = SealService.getSealById(req.params.id);
      if (!seal) {
        return res.status(404).json({ success: false, message: '印章不存在' });
      }
      res.json({ success: true, data: seal });
    } catch (error) {
      handleError(res, error);
    }
  },

  createApplication: (req, res) => {
    try {
      const application = SealService.createApplication(req.body);
      res.status(201).json({ success: true, data: application });
    } catch (error) {
      handleError(res, error);
    }
  },

  approveApplication: (req, res) => {
    try {
      const { applicationId } = req.params;
      const { approverId, approverName, remark } = req.body;
      const application = SealService.approveApplication(applicationId, approverId, approverName, remark);
      res.json({ success: true, data: application });
    } catch (error) {
      handleError(res, error);
    }
  },

  rejectApplication: (req, res) => {
    try {
      const { applicationId } = req.params;
      const { approverId, approverName, reason } = req.body;
      const application = SealService.rejectApplication(applicationId, approverId, approverName, reason);
      res.json({ success: true, data: application });
    } catch (error) {
      handleError(res, error);
    }
  },

  lendSeal: (req, res) => {
    try {
      const { applicationId } = req.params;
      const { lenderId, lenderName, actualLendDate } = req.body;
      const application = SealService.lendSeal(applicationId, lenderId, lenderName, actualLendDate);
      res.json({ success: true, data: application });
    } catch (error) {
      handleError(res, error);
    }
  },

  returnSeal: (req, res) => {
    try {
      const { applicationId } = req.params;
      const { returnerId, returnerName, actualReturnDate } = req.body;
      const application = SealService.returnSeal(applicationId, returnerId, returnerName, actualReturnDate);
      res.json({ success: true, data: application });
    } catch (error) {
      handleError(res, error);
    }
  },

  getApplicationById: (req, res) => {
    try {
      const application = SealService.getApplicationById(req.params.id);
      if (!application) {
        return res.status(404).json({ success: false, message: '申请不存在' });
      }
      res.json({ success: true, data: application });
    } catch (error) {
      handleError(res, error);
    }
  },

  getAllApplications: (req, res) => {
    try {
      const applications = SealService.getAllApplications(req.query);
      res.json({ success: true, data: applications });
    } catch (error) {
      handleError(res, error);
    }
  },

  getOverdueApplications: (req, res) => {
    try {
      const applications = SealService.getOverdueApplications();
      res.json({ success: true, data: applications });
    } catch (error) {
      handleError(res, error);
    }
  },

  exportUsageRecords: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const records = SealService.getUsageRecords(startDate, endDate);
      
      const fields = [
        'applicationId',
        'sealId',
        'sealName',
        'applicantId',
        'applicantName',
        'purpose',
        'approverName',
        'actualLendDate',
        'actualReturnDate',
        'status'
      ];
      
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(records);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=seal-usage-records-${new Date().toISOString().split('T')[0]}.csv`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      handleError(res, error);
    }
  }
};

module.exports = sealController;