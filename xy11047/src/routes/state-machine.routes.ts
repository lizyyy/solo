import express from 'express';
import { stateMachine } from '../services/state-machine.service';
import { DepositDeductionStatus } from '../types';

const router = express.Router();

router.get('/transitions', (req, res) => {
  const transitions = stateMachine.getAllTransitions();
  res.json({
    success: true,
    data: transitions,
    message: '查询成功'
  });
});

router.get('/status-descriptions', (req, res) => {
  const descriptions = Object.values(DepositDeductionStatus).map(status => ({
    status,
    description: stateMachine.getStatusDescription(status)
  }));
  res.json({
    success: true,
    data: descriptions,
    message: '查询成功'
  });
});

router.post('/can-perform', (req, res) => {
  const { status, action, role } = req.body;
  const result = stateMachine.canPerformAction(status, action, role);
  res.json({
    success: true,
    data: result,
    message: '查询成功'
  });
});

export default router;