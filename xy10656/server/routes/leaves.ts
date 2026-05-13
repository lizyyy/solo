import { Router, Request, Response } from 'express';
import * as leaveService from '../services/leaveService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { studentId, leaveDate, status, startDate, endDate } = req.query;
    const leaves = leaveService.getLeaveApplications({
      studentId: studentId as string,
      leaveDate: leaveDate as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const leave = leaveService.getLeaveById(req.params.id);
    if (!leave) {
      return res.status(404).json({ error: 'Leave application not found' });
    }
    res.json(leave);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { operator, ...data } = req.body;
    const leave = leaveService.createLeaveApplication(data, operator);
    res.status(201).json(leave);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { operator, ...data } = req.body;
    const leave = leaveService.updateLeaveApplication(req.params.id, data, operator);
    res.json(leave);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/:id/approve', (req: Request, res: Response) => {
  try {
    const { approvedBy } = req.body;
    const leave = leaveService.approveLeave(req.params.id, approvedBy);
    res.json(leave);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/:id/reject', (req: Request, res: Response) => {
  try {
    const { approvedBy, reason } = req.body;
    const leave = leaveService.rejectLeave(req.params.id, approvedBy, reason);
    res.json(leave);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
