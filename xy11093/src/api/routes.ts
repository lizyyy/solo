import express, { Request, Response } from 'express';
import * as signinService from '../services/signinService';
import * as employeeService from '../services/employeeService';
import * as courseService from '../services/courseService';
import { SigninStatus } from '../types';

const router = express.Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/employees', async (req: Request, res: Response) => {
  try {
    const employees = await employeeService.getAllEmployees();
    res.json({ data: employees });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/courses', async (req: Request, res: Response) => {
  try {
    const courses = await courseService.getAllCourses();
    res.json({ data: courses });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/signin', async (req: Request, res: Response) => {
  try {
    const record = await signinService.createSigninSupplement(req.body);
    res.status(201).json({ data: record });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/signin', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const records = await signinService.getSigninRecords(status as SigninStatus);
    res.json({ data: records });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/signin/normal', async (req: Request, res: Response) => {
  try {
    const records = await signinService.getNormalRecords();
    res.json({ data: records });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/signin/abnormal', async (req: Request, res: Response) => {
  try {
    const records = await signinService.getAbnormalRecords();
    res.json({ data: records });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/signin/:id', async (req: Request, res: Response) => {
  try {
    const record = await signinService.getSigninRecordById(req.params.id);
    if (!record) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }
    res.json({ data: record });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/signin/:id/history', async (req: Request, res: Response) => {
  try {
    const history = await signinService.getSigninHistory(req.params.id);
    res.json({ data: history });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/signin/:id/withdraw', async (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName, remark } = req.body;
    const record = await signinService.withdrawRecord(req.params.id, operatorId, operatorName, remark);
    res.json({ data: record });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/signin/:id/resubmit', async (req: Request, res: Response) => {
  try {
    const { signinType, seatNumber, signinTime, operatorId, operatorName } = req.body;
    const record = await signinService.resubmitRecord(
      req.params.id, signinType, seatNumber, signinTime, operatorId, operatorName
    );
    res.json({ data: record });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/signin/:id/manual/start', async (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName, remark } = req.body;
    const record = await signinService.startManualProcess(req.params.id, operatorId, operatorName, remark);
    res.json({ data: record });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/signin/:id/manual/process', async (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName, remark, resolution } = req.body;
    const record = await signinService.processManual({
      recordId: req.params.id,
      operatorId,
      operatorName,
      remark,
      resolution
    });
    res.json({ data: record });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
