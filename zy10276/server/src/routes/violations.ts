import express from 'express';
import ViolationDAO from '../dao/violation.dao';
import ProcessingHistoryDAO from '../dao/history.dao';
import AppealDAO from '../dao/appeal.dao';
import PenaltyDAO from '../dao/penalty.dao';
import ViolationService from '../services/violation.service';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { plateNumber, driverName, status, violationType, startDate, endDate } = req.query;
    const violations = ViolationDAO.filter({
      plateNumber: plateNumber as string,
      driverName: driverName as string,
      status: status as string,
      violationType: violationType as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.json({ success: true, data: violations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const violation = ViolationDAO.getById(req.params.id);
    if (!violation) {
      return res.status(404).json({ success: false, error: '违章记录不存在' });
    }
    const history = ProcessingHistoryDAO.getByViolationId(req.params.id);
    const appeal = AppealDAO.getByViolationId(req.params.id);
    const penalty = PenaltyDAO.getByViolationId(req.params.id);

    res.json({
      success: true,
      data: {
        ...violation,
        history,
        appeal,
        penalty,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { data, fileName, importedBy } = req.body;
    const result = await ViolationService.importViolations(data, fileName, importedBy);
    res.json({ success: true, data: result, message: `成功导入 ${result.successful} 条记录` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/match-shift', async (req, res) => {
  try {
    const { shiftId, operator, operatorId } = req.body;
    const result = await ViolationService.matchShift(req.params.id, shiftId, operator, operatorId);
    res.json({ success: true, data: result, message: '班次匹配成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const { driverId, operator, operatorId } = req.body;
    const result = await ViolationService.confirmViolation(req.params.id, driverId, operator, operatorId);
    res.json({ success: true, data: result, message: '违章确认成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/appeal', async (req, res) => {
  try {
    const { driverId, reason, materials } = req.body;
    const result = await ViolationService.submitAppeal(req.params.id, driverId, reason, materials || []);
    res.json({ success: true, data: result, message: '申诉提交成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/review-appeal', async (req, res) => {
  try {
    const { approved, reviewNotes, reviewer, reviewerId } = req.body;
    const result = await ViolationService.reviewAppeal(req.params.id, approved, reviewNotes, reviewer, reviewerId);
    res.json({ success: true, data: result, message: approved ? '申诉已通过，处罚已自动回滚' : '申诉已驳回' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/penalty', async (req, res) => {
  try {
    const { operator, operatorId } = req.body;
    const result = await ViolationService.applyPenalty(req.params.id, operator, operatorId);
    res.json({ success: true, data: result, message: '处罚执行成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/rollback-penalty', async (req, res) => {
  try {
    const { reason, operator, operatorId } = req.body;
    const result = await ViolationService.rollbackPenalty(req.params.id, reason, operator, operatorId);
    res.json({ success: true, data: result, message: '处罚已回滚' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
