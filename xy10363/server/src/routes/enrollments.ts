import express from 'express';
import { store } from '../data/store';
import { enrollmentService } from '../services/enrollmentService';
import { BusinessError } from '../utils/errors';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const enrollments = store.getEnrollments();
    res.json({
      success: true,
      data: enrollments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取报名列表失败，请稍后重试',
    });
  }
});

router.post('/enroll', (req, res) => {
  try {
    const { studentId, courseId } = req.body;
    
    if (!studentId || !courseId) {
      return res.status(400).json({
        success: false,
        message: '请提供学生ID和课程ID',
      });
    }
    
    const result = enrollmentService.enroll(studentId, courseId);
    const student = store.getStudentById(studentId);
    const course = store.getCourseById(courseId);
    
    if (result.isWaitlist) {
      res.json({
        success: true,
        data: result,
        message: `${student?.name}同学已加入${course?.name}的候补队列，候补顺序：第${result.waitlistPosition}位`,
      });
    } else {
      res.json({
        success: true,
        data: result,
        message: `${student?.name}同学已成功报名${course?.name}`,
      });
    }
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
        message: '报名失败，请稍后重试',
      });
    }
  }
});

router.post('/withdraw/:enrollmentId', (req, res) => {
  try {
    const { enrollmentId } = req.params;
    
    if (!enrollmentId) {
      return res.status(400).json({
        success: false,
        message: '请提供报名ID',
      });
    }
    
    const enrollment = enrollmentService.withdraw(enrollmentId);
    const student = store.getStudentById(enrollment.studentId);
    const course = store.getCourseById(enrollment.courseId);
    
    res.json({
      success: true,
      data: enrollment,
      message: `${student?.name}同学已退出${course?.name}`,
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
        message: '退课失败，请稍后重试',
      });
    }
  }
});

export default router;
