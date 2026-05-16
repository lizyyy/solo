import { Request, Response } from 'express';
import { demoBatchService } from '../services/demoBatch.service';
import { asyncHandler } from '../middleware/errorHandler';

export const createDemoBatch = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, inputData, createdBy } = req.body;
  const batch = await demoBatchService.createBatch({
    name,
    description,
    inputData,
    createdBy: createdBy || 'demo_user',
  });
  res.status(201).json({
    success: true,
    message: '[演示模式] 批次创建成功（数据存储在内存中）',
    data: batch,
  });
});

export const executeDemoBatch = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await demoBatchService.executeBatch(id);
  res.json({
    success: true,
    message: '[演示模式] 批次执行完成',
    data: result,
  });
});

export const getDemoBatchList = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize, status } = req.query;
  const result = await demoBatchService.getBatchList({
    page: page ? parseInt(page as string) : undefined,
    pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    status: status as string,
  });
  res.json({
    success: true,
    message: '[演示模式] 获取批次列表成功',
    data: result,
  });
});

export const getDemoBatchDetail = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const batch = await demoBatchService.getBatchDetail(id);
  if (!batch) {
    return res.status(404).json({ success: false, error: '批次不存在' });
  }
  res.json({
    success: true,
    message: '[演示模式] 获取批次详情成功',
    data: batch,
  });
});

export const getDemoBatchReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const report = await demoBatchService.generateReport(id);
  res.json({
    success: true,
    message: '[演示模式] 生成报告成功',
    data: report,
  });
});

export const submitDemoReview = asyncHandler(async (req: Request, res: Response) => {
  const { batchId, itemId, reviewComment, reviewedBy, decision } = req.body;
  const result = await demoBatchService.submitReview({
    batchId,
    itemId,
    reviewComment,
    reviewedBy: reviewedBy || 'demo_reviewer',
    decision,
  });
  res.json({
    success: true,
    message: '[演示模式] 提交复核意见成功',
    data: result,
  });
});

export const getDemoRules = asyncHandler(async (req: Request, res: Response) => {
  const rules = demoBatchService.getAllRules();
  res.json({
    success: true,
    message: '[演示模式] 获取规则列表成功',
    data: rules,
  });
});

export const getDemoAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { batchId, page, pageSize } = req.query;
  const result = demoBatchService.getAuditLogs({
    batchId: batchId as string,
    page: page ? parseInt(page as string) : undefined,
    pageSize: pageSize ? parseInt(pageSize as string) : undefined,
  });
  res.json({
    success: true,
    message: '[演示模式] 获取审计日志成功',
    data: result,
  });
});

export const createSampleBatch = asyncHandler(async (req: Request, res: Response) => {
  const sampleData = [
    {
      courseId: 'CS001',
      courseName: 'Node.js 进阶开发',
      traineeId: 'T001',
      traineeName: '张三',
      submissionId: 'SUB001',
      approvalStatus: 'APPROVED',
      approvalComment: '课程完成度达标，同意通过',
      submittedAt: new Date().toISOString(),
    },
    {
      courseId: 'CS002',
      courseName: 'TypeScript 实战',
      traineeId: 'T002',
      traineeName: '李四',
      submissionId: 'SUB002',
      approvalStatus: 'APPROVED',
      approvalComment: '',
      submittedAt: new Date().toISOString(),
    },
    {
      courseId: 'CS003',
      courseName: '数据库设计原理',
      traineeId: 'T003',
      traineeName: '王五',
      submissionId: 'SUB003',
      approvalStatus: 'REJECTED',
      approvalComment: '',
      submittedAt: new Date().toISOString(),
    },
  ];

  const batch = await demoBatchService.createBatch({
    name: '2024年第一季度培训审批数据',
    description: 'Q1 培训课程审批记录批量校验',
    inputData: sampleData,
    createdBy: 'demo_user',
  });

  res.status(201).json({
    success: true,
    message: '[演示模式] 示例批次创建成功，包含 3 条数据（其中 2 条审批意见为空，将被拦截）',
    data: batch,
  });
});
