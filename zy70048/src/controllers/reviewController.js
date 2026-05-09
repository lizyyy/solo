const ReviewService = require('../services/ReviewService');

exports.createReport = async (req, res, next) => {
  try {
    const report = await ReviewService.createReport(req.params.id, req.body);
    res.status(201).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

exports.getReports = async (req, res, next) => {
  try {
    const reports = await ReviewService.getReportsByLineStop(req.params.id);
    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    next(error);
  }
};

exports.updateReport = async (req, res, next) => {
  try {
    const report = await ReviewService.updateReport(
      req.params.reportId,
      req.body
    );
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

exports.submitReport = async (req, res, next) => {
  try {
    const result = await ReviewService.submitReport(
      req.params.reportId,
      req.body.operator
    );
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.approveReport = async (req, res, next) => {
  try {
    const result = await ReviewService.approveReport(
      req.params.reportId,
      req.body.operator,
      req.body.comments
    );
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectReport = async (req, res, next) => {
  try {
    const result = await ReviewService.rejectReport(
      req.params.reportId,
      req.body.operator,
      req.body.rejectReason
    );
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
