import express from 'express';
import { store } from '../data/store';
import { enrollmentService } from '../services/enrollmentService';
import { BusinessError } from '../utils/errors';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const courses = enrollmentService.getCourseStatistics();
    res.json({
      success: true,
      data: courses,
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
        message: '获取课程列表失败，请稍后重试',
      });
    }
  }
});

router.get('/:courseId', (req, res) => {
  try {
    const { courseId } = req.params;
    const course = store.getCourseById(courseId);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: '未找到该课程',
      });
    }
    
    const statistics = enrollmentService.getCourseStatistics();
    const courseStats = statistics.find(c => c.id === courseId);
    
    res.json({
      success: true,
      data: courseStats,
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
        message: '获取课程详情失败，请稍后重试',
      });
    }
  }
});

export default router;
