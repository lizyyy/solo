import { Router, Request, Response } from 'express';
import * as coreService from '../services/coreService';
import * as auditService from '../services/auditService';
import * as detectionService from '../services/detectionService';
import * as statisticsService from '../services/statisticsService';
import { SupplementData } from '../types';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/classes', async (req: Request, res: Response) => {
  try {
    const { name, operator } = req.body;
    const result = await coreService.createClass(name, operator);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/classes', async (req: Request, res: Response) => {
  try {
    const result = await coreService.getAllClasses();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/classes/:id', async (req: Request, res: Response) => {
  try {
    const result = await coreService.getClassById(req.params.id);
    if (!result) {
      res.status(404).json({ error: 'Class not found' });
    } else {
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/students', async (req: Request, res: Response) => {
  try {
    const { classId, name, studentNo, operator } = req.body;
    const result = await coreService.createStudent(classId, name, studentNo, operator);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/classes/:classId/students', async (req: Request, res: Response) => {
  try {
    const result = await coreService.getStudentsByClass(req.params.classId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/questions', async (req: Request, res: Response) => {
  try {
    const { practiceDate, type, questionNo, standardAnswer, description, operator } = req.body;
    const result = await coreService.createQuestion(practiceDate, type, questionNo, standardAnswer, description, operator);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/questions', async (req: Request, res: Response) => {
  try {
    const { practiceDate, type } = req.query;
    const result = await coreService.getQuestionsByDate(practiceDate as string, type as any);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/submissions', async (req: Request, res: Response) => {
  try {
    const { studentId, questionId, studentAnswer, practiceDate, notes, operator } = req.body;
    const result = await coreService.createSubmission(studentId, questionId, studentAnswer, practiceDate, notes, operator);
    if (result === null) {
      res.status(409).json({ error: 'Duplicate submission' });
    } else {
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/submissions/import', async (req: Request, res: Response) => {
  try {
    const { studentId, questionId, studentAnswer, practiceDate, isCorrect, score, notes, operator } = req.body;
    const result = await coreService.importSubmissionWithCheck(
      studentId, questionId, studentAnswer, practiceDate, isCorrect, score, notes, operator
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/submissions', async (req: Request, res: Response) => {
  try {
    const { practiceDate } = req.query;
    const result = await coreService.getSubmissionsByDate(practiceDate as string);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/submissions/:id', async (req: Request, res: Response) => {
  try {
    const result = await coreService.getSubmissionById(req.params.id);
    if (!result) {
      res.status(404).json({ error: 'Submission not found' });
    } else {
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/submissions/:id/grade', async (req: Request, res: Response) => {
  try {
    const { isCorrect, score, operator } = req.body;
    const result = await coreService.gradeSubmission(req.params.id, isCorrect, score, operator);
    if (!result) {
      res.status(404).json({ error: 'Submission not found' });
    } else {
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/submissions/:id/autograde', async (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    const result = await coreService.autoGradeSubmission(req.params.id, operator);
    if (!result) {
      res.status(404).json({ error: 'Submission or question not found' });
    } else {
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/supplement', async (req: Request, res: Response) => {
  try {
    const data: SupplementData = req.body;
    await coreService.supplementData(data);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const result = await auditService.getAuditLogsByEntity(entityType as any, entityId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const result = await auditService.getAllAuditLogs(limit ? parseInt(limit as string) : 100);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/detection/issues', async (req: Request, res: Response) => {
  try {
    const { isResolved, type, limit } = req.query;
    const result = await detectionService.getDetectionIssues(
      isResolved !== undefined ? isResolved === 'true' : undefined,
      type as any,
      limit ? parseInt(limit as string) : 100
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/detection/issues/:id/resolve', async (req: Request, res: Response) => {
  try {
    await detectionService.resolveDetectionIssue(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/statistics/class/:classId', async (req: Request, res: Response) => {
  try {
    const { practiceDate } = req.query;
    const result = await statisticsService.getClassStatistics(req.params.classId, practiceDate as string);
    if (!result) {
      res.status(404).json({ error: 'Class not found' });
    } else {
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/statistics/class/:classId/wrong/:type', async (req: Request, res: Response) => {
  try {
    const { practiceDate } = req.query;
    const result = await statisticsService.getWrongQuestionsByType(
      req.params.classId,
      practiceDate as string,
      req.params.type as any
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/class/:classId', async (req: Request, res: Response) => {
  try {
    const { practiceDate } = req.query;
    const buffer = await statisticsService.exportToExcel(req.params.classId, practiceDate as string);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="scores_${req.params.classId}_${practiceDate}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
