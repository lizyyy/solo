import express from 'express';
import { store } from '../data/store';
import { enrollmentService } from '../services/enrollmentService';
import { BusinessError } from '../utils/errors';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const transfers = store.getTransferRequests();
    const enrichedTransfers = transfers.map(t => {
      const student = store.getStudentById(t.studentId);
      const fromCourse = store.getCourseById(t.fromCourseId);
      const toCourse = store.getCourseById(t.toCourseId);
      
      return {
        ...t,
        studentName: student?.name,
        studentClass: student?.className,
        fromCourseName: fromCourse?.name,
        toCourseName: toCourse?.name,
        statusText: t.status === 'pending' ? '待处理' : t.status === 'approved' ? '已通过' : '已拒绝',
      };
    });
    
    res.json({
      success: true,
      data: enrichedTransfers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取改选申请列表失败，请稍后重试',
    });
  }
});

router.post('/request', (req, res) => {
  try {
    const { studentId, fromCourseId, toCourseId } = req.body;
    
    if (!studentId || !fromCourseId || !toCourseId) {
      return res.status(400).json({
        success: false,
        message: '请提供学生ID、原课程ID和目标课程ID',
      });
    }
    
    if (fromCourseId === toCourseId) {
      return res.status(400).json({
        success: false,
        message: '原课程和目标课程不能相同',
      });
    }
    
    const transfer = enrollmentService.requestTransfer(studentId, fromCourseId, toCourseId);
    const student = store.getStudentById(studentId);
    const fromCourse = store.getCourseById(fromCourseId);
    const toCourse = store.getCourseById(toCourseId);
    
    res.json({
      success: true,
      data: transfer,
      message: `${student?.name}同学的改选申请已提交：从${fromCourse?.name}改选至${toCourse?.name}，请等待审核`,
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
        message: '提交改选申请失败，请稍后重试',
      });
    }
  }
});

router.post('/approve/:requestId', (req, res) => {
  try {
    const { requestId } = req.params;
    
    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: '请提供改选申请ID',
      });
    }
    
    const result = enrollmentService.approveTransfer(requestId);
    const request = store.getTransferRequests().find(t => t.id === requestId);
    const student = request ? store.getStudentById(request.studentId) : undefined;
    const toCourse = request ? store.getCourseById(request.toCourseId) : undefined;
    
    if (result.isWaitlist) {
      res.json({
        success: true,
        data: result,
        message: `改选申请已通过，${student?.name}同学已加入${toCourse?.name}的候补队列，候补顺序：第${result.waitlistPosition}位`,
      });
    } else {
      res.json({
        success: true,
        data: result,
        message: `改选申请已通过，${student?.name}同学已成功改选至${toCourse?.name}`,
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
        message: '审批改选申请失败，请稍后重试',
      });
    }
  }
});

router.post('/reject/:requestId', (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    
    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: '请提供改选申请ID',
      });
    }
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '请填写拒绝原因',
      });
    }
    
    const result = enrollmentService.rejectTransfer(requestId, reason);
    const student = store.getStudentById(result.studentId);
    const toCourse = store.getCourseById(result.toCourseId);
    
    res.json({
      success: true,
      data: result,
      message: `${student?.name}同学改选至${toCourse?.name}的申请已拒绝，原因：${reason}`,
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
        message: '拒绝改选申请失败，请稍后重试',
      });
    }
  }
});

export default router;
