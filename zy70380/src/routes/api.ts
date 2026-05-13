import express from 'express';
import { 
  createMember, 
  getMemberById, 
  getMemberByPhone, 
  getAllMembers,
  addMemberPoints 
} from '../services/memberService';
import { 
  createTransaction, 
  getTransactionsByMemberId 
} from '../services/transactionService';
import { 
  createPointRuleVersion, 
  freezePointRuleVersion, 
  getPointRuleVersionById,
  getAllPointRuleVersions,
  calculatePointsForTransaction 
} from '../services/pointRuleService';
import { 
  createRedemption, 
  confirmRedemption,
  getConfirmedRedemptionsByMemberId,
  getTotalLockedPoints 
} from '../services/redemptionService';
import { createPointLog, getPointLogsByMemberId } from '../services/pointLogService';
import {
  createRecalculationTask,
  executeRecalculationTask,
  getRecalculationTaskById,
  getMemberRecalculationResult,
  getMemberRecalculationResultsByTaskId,
  getCompensationAdjustmentsByTaskId,
  getCompensationAdjustmentById,
  confirmCompensationAdjustment,
  applyPositiveCompensations,
  searchRecalculationTasks
} from '../services/recalculationService';
import { MemberRecalculationResult, RecalculationTask, CompensationAdjustment } from '../types';

const router = express.Router();

router.post('/members', async (req, res) => {
  try {
    const { name, phone } = req.body;
    const member = await createMember(name, phone);
    res.json(member);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/members', async (req, res) => {
  try {
    const members = await getAllMembers();
    res.json(members);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/members/:id', async (req, res) => {
  try {
    const member = await getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/point-rules', async (req, res) => {
  try {
    const { version, name, rules, effectiveAt, description } = req.body;
    const ruleVersion = await createPointRuleVersion(version, name, rules, effectiveAt, description);
    res.json(ruleVersion);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/point-rules', async (req, res) => {
  try {
    const rules = await getAllPointRuleVersions();
    res.json(rules);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/point-rules/:id/freeze', async (req, res) => {
  try {
    await freezePointRuleVersion(req.params.id);
    const rule = await getPointRuleVersionById(req.params.id);
    res.json(rule);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/transactions', async (req, res) => {
  try {
    const { memberId, amount, category, ruleVersionId, createdAt } = req.body;
    
    const transaction = await createTransaction(memberId, amount, category, createdAt);
    
    if (ruleVersionId) {
      const ruleVersion = await getPointRuleVersionById(ruleVersionId);
      if (ruleVersion) {
        const points = await calculatePointsForTransaction(amount, category, ruleVersion.rules);
        if (points > 0) {
          await createPointLog(
            memberId,
            points,
            'earn',
            `消费获得积分: ${category} x ${amount}元`,
            { transactionId: transaction.id }
          );
        }
      }
    }
    
    res.json(transaction);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/members/:memberId/transactions', async (req, res) => {
  try {
    const { memberId } = req.params;
    const { startTime, endTime } = req.query;
    const transactions = await getTransactionsByMemberId(
      memberId,
      startTime as string,
      endTime as string
    );
    res.json(transactions);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/redemptions', async (req, res) => {
  try {
    const { memberId, points, giftName, giftId } = req.body;
    const redemption = await createRedemption(memberId, points, giftName, giftId);
    res.json(redemption);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/redemptions/:id/confirm', async (req, res) => {
  try {
    await confirmRedemption(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/members/:memberId/locked-points', async (req, res) => {
  try {
    const { memberId } = req.params;
    const lockedPoints = await getTotalLockedPoints(memberId);
    res.json({ memberId, lockedPoints });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/members/:memberId/point-logs', async (req, res) => {
  try {
    const { memberId } = req.params;
    const logs = await getPointLogsByMemberId(memberId);
    res.json(logs);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/recalculation-tasks', async (req, res) => {
  try {
    const { name, ruleVersionId, description, memberIds, startTime, endTime, autoExecute } = req.body;
    
    const task = await createRecalculationTask(
      name,
      ruleVersionId,
      description,
      memberIds,
      startTime,
      endTime
    );
    
    if (autoExecute && task.status === 'pending') {
      await executeRecalculationTask(task.id);
      const updatedTask = await getRecalculationTaskById(task.id);
      return res.json({
        task: updatedTask,
        isExisting: task.status !== 'pending'
      });
    }
    
    res.json({
      task,
      isExisting: task.status !== 'pending'
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/recalculation-tasks/:id/execute', async (req, res) => {
  try {
    await executeRecalculationTask(req.params.id);
    const task = await getRecalculationTaskById(req.params.id);
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/recalculation-tasks', async (req, res) => {
  try {
    const { memberId, startTime, endTime, status } = req.query;
    const tasks = await searchRecalculationTasks({
      memberId: memberId as string,
      startTime: startTime as string,
      endTime: endTime as string,
      status: status as RecalculationTask['status']
    });
    res.json(tasks);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/recalculation-tasks/:id', async (req, res) => {
  try {
    const task = await getRecalculationTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Recalculation task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/recalculation-tasks/:taskId/results', async (req, res) => {
  try {
    const { taskId } = req.params;
    const results = await getMemberRecalculationResultsByTaskId(taskId);
    res.json(results);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/recalculation-tasks/:taskId/results/:memberId', async (req, res) => {
  try {
    const { taskId, memberId } = req.params;
    const result = await getMemberRecalculationResult(taskId, memberId);
    if (!result) {
      return res.status(404).json({ error: 'Member recalculation result not found' });
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/recalculation-tasks/:taskId/report', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await getRecalculationTaskById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Recalculation task not found' });
    }
    
    const results = await getMemberRecalculationResultsByTaskId(taskId);
    const adjustments = await getCompensationAdjustmentsByTaskId(taskId);
    
    const report = {
      task,
      summary: task.summary,
      memberCount: results.length,
      positiveDiffMembers: results.filter(r => r.difference > 0).length,
      negativeDiffMembers: results.filter(r => r.difference < 0).length,
      lockedPointsMembers: results.filter(r => r.lockedPoints > 0).length,
      pendingReviewMembers: results.filter(r => r.status === 'pending_review').length,
      completedMembers: results.filter(r => r.status === 'completed').length,
      totalCompensations: adjustments.filter(a => a.type === 'credit').reduce((sum, a) => sum + a.amount, 0),
      totalDeductions: adjustments.filter(a => a.type === 'debit').reduce((sum, a) => sum + a.amount, 0),
      adjustments
    };
    
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/recalculation-tasks/:taskId/adjustments', async (req, res) => {
  try {
    const { taskId } = req.params;
    const adjustments = await getCompensationAdjustmentsByTaskId(taskId);
    res.json(adjustments);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/compensations/:id/confirm', async (req, res) => {
  try {
    const { operator } = req.body;
    await confirmCompensationAdjustment(req.params.id, operator || 'system');
    const adjustment = await getCompensationAdjustmentById(req.params.id);
    res.json(adjustment);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/recalculation-tasks/:taskId/apply-positive', async (req, res) => {
  try {
    await applyPositiveCompensations(req.params.taskId);
    const task = await getRecalculationTaskById(req.params.taskId);
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
