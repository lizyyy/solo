const express = require('express');
const router = express.Router();

const basicService = require('../services/basicService');
const membershipCardService = require('../services/membershipCardService');
const appointmentService = require('../services/appointmentService');
const courseConsumptionService = require('../services/courseConsumptionService');
const leaveService = require('../services/leaveService');
const substituteService = require('../services/substituteService');
const reportService = require('../services/reportService');
const exceptionService = require('../services/exceptionService');

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '健身房私教课消课API服务运行正常' });
});

router.post('/members', async (req, res) => {
  try {
    const result = await basicService.createMember(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/members', async (req, res) => {
  try {
    const result = await basicService.getAllMembers();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/members/:id', async (req, res) => {
  try {
    const result = await basicService.getMember(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/coaches', async (req, res) => {
  try {
    const result = await basicService.createCoach(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/coaches', async (req, res) => {
  try {
    const result = await basicService.getAllCoaches();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/coaches/:id', async (req, res) => {
  try {
    const result = await basicService.getCoach(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/course-packages', async (req, res) => {
  try {
    const result = await basicService.createCoursePackage(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/course-packages', async (req, res) => {
  try {
    const result = await basicService.getAllCoursePackages();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/membership-cards', async (req, res) => {
  try {
    const result = await membershipCardService.createMembershipCard(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, errorCode: error.errorCode });
  }
});

router.get('/membership-cards/:id', async (req, res) => {
  try {
    const result = await membershipCardService.getMembershipCard(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/members/:memberId/membership-cards', async (req, res) => {
  try {
    const result = await membershipCardService.getMembershipCardsByMember(req.params.memberId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/membership-cards/:id/freeze', async (req, res) => {
  try {
    const { freeze_start_date, freeze_end_date, operator, remark } = req.body;
    const result = await membershipCardService.freezeCard(req.params.id, freeze_start_date, freeze_end_date, operator, remark);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, errorCode: error.errorCode });
  }
});

router.post('/membership-cards/:id/unfreeze', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await membershipCardService.unfreezeCard(req.params.id, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, errorCode: error.errorCode });
  }
});

router.post('/membership-cards/:id/manual-correction', async (req, res) => {
  try {
    const { correction_type, before_value, after_value, reason, operator } = req.body;
    const result = await membershipCardService.manualCorrection(req.params.id, correction_type, before_value, after_value, reason, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, errorCode: error.errorCode });
  }
});

router.get('/membership-cards/:id/corrections', async (req, res) => {
  try {
    const result = await membershipCardService.getCardCorrections(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/appointments', async (req, res) => {
  try {
    const result = await appointmentService.createAppointment(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, errorCode: error.errorCode });
  }
});

router.get('/appointments/:id', async (req, res) => {
  try {
    const result = await appointmentService.getAppointment(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/members/:memberId/appointments', async (req, res) => {
  try {
    const result = await appointmentService.getAppointmentsByMember(req.params.memberId, req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/appointments/:id/cancel', async (req, res) => {
  try {
    const { cancel_reason, operator } = req.body;
    const result = await appointmentService.cancelAppointment(req.params.id, cancel_reason, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, errorCode: error.errorCode });
  }
});

router.post('/course-consumptions', async (req, res) => {
  try {
    const { appointment_id, operator, remark } = req.body;
    const result = await courseConsumptionService.consumeCourse(appointment_id, operator, remark);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, errorCode: error.errorCode });
  }
});

router.get('/course-consumptions/:id', async (req, res) => {
  try {
    const result = await courseConsumptionService.getConsumptionDetail(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/membership-cards/:cardId/consumptions', async (req, res) => {
  try {
    const result = await courseConsumptionService.getConsumptionsByCard(req.params.cardId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/leaves', async (req, res) => {
  try {
    const result = await leaveService.applyLeave(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, errorCode: error.errorCode });
  }
});

router.post('/leaves/:id/approve', async (req, res) => {
  try {
    const { approved_by, operator } = req.body;
    const result = await leaveService.approveLeave(req.params.id, approved_by, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, errorCode: error.errorCode });
  }
});

router.post('/leaves/:id/reject', async (req, res) => {
  try {
    const { reject_reason, operator } = req.body;
    const result = await leaveService.rejectLeave(req.params.id, reject_reason, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, errorCode: error.errorCode });
  }
});

router.get('/leaves/:id', async (req, res) => {
  try {
    const result = await leaveService.getLeave(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/substitutes', async (req, res) => {
  try {
    const result = await substituteService.createSubstitute(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, errorCode: error.errorCode });
  }
});

router.post('/substitutes/:id/confirm', async (req, res) => {
  try {
    const { confirmed_by, operator } = req.body;
    const result = await substituteService.confirmSubstitute(req.params.id, confirmed_by, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, errorCode: error.errorCode });
  }
});

router.post('/substitutes/:id/reject', async (req, res) => {
  try {
    const { reject_reason, operator } = req.body;
    const result = await substituteService.rejectSubstitute(req.params.id, reject_reason, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, errorCode: error.errorCode });
  }
});

router.get('/substitutes/:id', async (req, res) => {
  try {
    const result = await substituteService.getSubstitute(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/reports/consumptions', async (req, res) => {
  try {
    const result = await reportService.getConsumptionReport(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/reports/consumptions/export', async (req, res) => {
  try {
    const csv = await reportService.exportConsumptionReportCSV(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=consumption_report.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/reports/coach-statistics', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const result = await reportService.getCoachStatistics(start_date, end_date);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/reports/members/:memberId/card-summary', async (req, res) => {
  try {
    const result = await reportService.getMemberCardSummary(req.params.memberId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/exceptions', async (req, res) => {
  try {
    const result = await exceptionService.getExceptions(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
