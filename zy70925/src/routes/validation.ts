import express = require('express');
import { Request, Response } from 'express';
import multer = require('multer');
import * as fs from 'fs';
import { ValidationEngine } from '../services/validationEngine';
import { FileParser } from '../services/fileParser';
import { IdempotencyService } from '../services/idempotencyService';
import { AttendanceRecord, AssignmentRecord, CourseRule, ValidationResult } from '../types';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

interface ProcessBatchRequest extends Request {
  body: {
    courseBatch?: string;
    attendance?: AttendanceRecord[];
    assignments?: AssignmentRecord[];
    rule?: CourseRule;
  };
}

router.post('/process', upload.fields([
  { name: 'attendanceFile', maxCount: 1 },
  { name: 'assignmentsFile', maxCount: 1 },
  { name: 'ruleFile', maxCount: 1 }
]), async (req: ProcessBatchRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    let attendanceRecords: AttendanceRecord[] = [];
    let assignmentRecords: AssignmentRecord[] = [];
    let courseRule: CourseRule | null = null;
    let courseBatch = req.body.courseBatch || '';

    if (files?.attendanceFile?.[0]) {
      const filePath = files.attendanceFile[0].path;
      attendanceRecords = await FileParser.parseAttendanceCSV(filePath);
      fs.unlinkSync(filePath);
    } else if (req.body.attendance) {
      attendanceRecords = req.body.attendance;
    }

    if (files?.assignmentsFile?.[0]) {
      const filePath = files.assignmentsFile[0].path;
      const content = fs.readFileSync(filePath, 'utf-8');
      assignmentRecords = FileParser.parseAssignmentsJSON(content);
      fs.unlinkSync(filePath);
    } else if (req.body.assignments) {
      assignmentRecords = req.body.assignments;
    }

    if (files?.ruleFile?.[0]) {
      const filePath = files.ruleFile[0].path;
      const content = fs.readFileSync(filePath, 'utf-8');
      courseRule = FileParser.parseCourseRule(content);
      fs.unlinkSync(filePath);
    } else if (req.body.rule) {
      courseRule = req.body.rule;
    }

    if (!courseRule) {
      return res.status(400).json({
        error: '缺少课程规则配置',
        message: '请上传 ruleFile 或在请求体中提供 rule 字段'
      });
    }

    if (!courseBatch) {
      courseBatch = courseRule.courseBatch;
    }

    if (!courseBatch) {
      return res.status(400).json({
        error: '缺少课程批次信息',
        message: '请在请求体中提供 courseBatch 字段'
      });
    }

    const attendanceHash = attendanceRecords.length.toString();
    const assignmentHash = assignmentRecords.length.toString();

    const duplicateCheck = IdempotencyService.checkDuplicate(courseBatch, attendanceHash, assignmentHash);
    if (duplicateCheck.isDuplicate) {
      return res.json({
        message: '检测到重复批次提交，返回历史处理结果',
        duplicate: true,
        originalSubmission: duplicateCheck.existingBatch,
        result: duplicateCheck.existingResult
      });
    }

    const engine = new ValidationEngine(courseRule);
    const attendanceResults = engine.processAttendance(attendanceRecords);
    const assignmentResults = engine.processAssignments(assignmentRecords);

    const batchId = IdempotencyService.generateBatchId();
    const result: ValidationResult = engine.combineResults(
      batchId,
      courseBatch,
      attendanceResults,
      assignmentResults
    );

    IdempotencyService.registerBatch(
      batchId,
      courseBatch,
      attendanceRecords.length,
      assignmentRecords.length,
      result
    );

    res.json({
      message: '处理完成',
      duplicate: false,
      result
    });
  } catch (error) {
    console.error('处理失败:', error);
    res.status(500).json({
      error: '处理失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.get('/batches', (req: Request, res: Response) => {
  try {
    const batches = IdempotencyService.getAllBatches();
    res.json({ batches });
  } catch (error) {
    res.status(500).json({
      error: '获取批次列表失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.get('/result/:batchId', (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const result = IdempotencyService.getResult(batchId);
    
    if (!result) {
      return res.status(404).json({
        error: '批次不存在',
        message: `未找到批次 ID: ${batchId}`
      });
    }

    res.json({ result });
  } catch (error) {
    res.status(500).json({
      error: '获取处理结果失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.post('/check-certificate', upload.none(), (req: Request, res: Response) => {
  try {
    const { employeeId, rule, attendanceResults, assignmentResults } = req.body;

    if (!employeeId || !rule || !attendanceResults || !assignmentResults) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '请提供 employeeId, rule, attendanceResults, assignmentResults'
      });
    }

    const engine = new ValidationEngine(rule);
    const eligibility = engine.checkCertificateEligibility(
      employeeId,
      attendanceResults,
      assignmentResults
    );

    res.json({ eligibility });
  } catch (error) {
    res.status(500).json({
      error: '证书资格检查失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

export default router;
