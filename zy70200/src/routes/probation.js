const express = require('express');
const ProbationService = require('../services/probationService');
const ProbationHistoryService = require('../services/probationHistoryService');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { createdBy } = req.headers;
    const plan = await ProbationService.createProbationPlan(req.body, createdBy);
    
    res.status(201).json({
      success: true,
      data: plan,
      message: '试用期计划创建成功'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/start', async (req, res, next) => {
  try {
    const { startedBy } = req.headers;
    const plan = await ProbationService.startProbation(req.params.id, startedBy);
    
    res.json({
      success: true,
      data: plan,
      message: '试用期已启动'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { status, employeeId } = req.query;
    
    let plans;
    if (employeeId) {
      plans = await ProbationService.getEmployeeProbationPlans(employeeId);
    } else {
      plans = await ProbationService.getProbationPlansByStatus(status);
    }
    
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const plan = await ProbationService.getProbationPlan(req.params.id);
    
    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    next(error);
  }
});

router.post('/evaluations', async (req, res, next) => {
  try {
    const { submittedBy } = req.headers;
    const evaluation = await ProbationService.submitPerformanceEvaluation(req.body, submittedBy);
    
    res.status(201).json({
      success: true,
      data: evaluation,
      message: '绩效评价已提交'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/evaluations/:id/approve', async (req, res, next) => {
  try {
    const { approvedBy } = req.headers;
    const evaluation = await ProbationService.approvePerformanceEvaluation(req.params.id, approvedBy);
    
    res.json({
      success: true,
      data: evaluation,
      message: '绩效评价已批准'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/mentor-feedbacks', async (req, res, next) => {
  try {
    const { mentorId } = req.headers;
    if (!mentorId) {
      return res.status(400).json({
        success: false,
        message: '缺少导师ID'
      });
    }
    
    const feedback = await ProbationService.submitMentorFeedback(req.body, mentorId);
    
    res.status(201).json({
      success: true,
      data: feedback,
      message: '导师意见已提交'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/submit-approval', async (req, res, next) => {
  try {
    const { submittedBy } = req.headers;
    const result = await ProbationService.submitForApproval(req.params.id, submittedBy);
    
    res.json({
      success: true,
      data: result,
      message: result.shouldReview 
        ? '已提交审批，但需要人工复核' 
        : '已提交审批'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/approve', async (req, res, next) => {
  try {
    const { approvedBy } = req.headers;
    const { salaryData } = req.body;
    
    const result = await ProbationService.approveProbation(req.params.id, approvedBy, salaryData);
    
    res.json({
      success: true,
      data: result,
      message: '转正审批已通过'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reject', async (req, res, next) => {
  try {
    const { rejectedBy } = req.headers;
    const { reason } = req.body;
    
    const plan = await ProbationService.rejectProbation(req.params.id, rejectedBy, reason);
    
    res.json({
      success: true,
      data: plan,
      message: '转正审批已拒绝'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/extensions', async (req, res, next) => {
  try {
    const { requestedBy } = req.headers;
    const result = await ProbationService.requestExtension(req.body, requestedBy);
    
    res.status(201).json({
      success: true,
      data: result,
      message: '延期申请已提交'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/extensions/:id/approve', async (req, res, next) => {
  try {
    const { approvedBy } = req.headers;
    const { mentorRecommendation } = req.body;
    
    const result = await ProbationService.approveExtension(req.params.id, approvedBy, mentorRecommendation);
    
    res.json({
      success: true,
      data: result,
      message: '延期申请已通过'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/extensions/:id/reject', async (req, res, next) => {
  try {
    const { rejectedBy } = req.headers;
    const { reason } = req.body;
    
    const result = await ProbationService.rejectExtension(req.params.id, rejectedBy, reason);
    
    res.json({
      success: true,
      data: result,
      message: '延期申请已拒绝'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/terminate', async (req, res, next) => {
  try {
    const { terminatedBy } = req.headers;
    const { reason } = req.body;
    
    const plan = await ProbationService.terminateProbation(req.params.id, terminatedBy, reason);
    
    res.json({
      success: true,
      data: plan,
      message: '试用期已终止'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const history = await ProbationHistoryService.getProbationHistory(req.params.id);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
});

router.get('/employee/:employeeId/history', async (req, res, next) => {
  try {
    const history = await ProbationHistoryService.getEmployeeProbationHistory(req.params.employeeId);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
