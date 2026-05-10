import express from 'express';
import { store } from '../data/store';
import { enrollmentService } from '../services/enrollmentService';
import { BusinessError } from '../utils/errors';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const students = store.getStudents();
    res.json({
      success: true,
      data: students,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取学生列表失败，请稍后重试',
    });
  }
});

router.get('/:studentId', (req, res) => {
  try {
    const { studentId } = req.params;
    const student = store.getStudentById(studentId);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: '未找到该学生',
      });
    }
    
    res.json({
      success: true,
      data: student,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取学生信息失败，请稍后重试',
    });
  }
});

router.get('/:studentId/schedule', (req, res) => {
  try {
    const { studentId } = req.params;
    const schedule = enrollmentService.getStudentSchedule(studentId);
    
    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(400).json({
        success: false,
        message: error.userMessage,
        errorCode: error.code,
      });
    } else {
      res.status(500).json({
        success: false,
        message: '获取学生课表失败，请稍后重试',
      });
    }
  }
});

export default router;
