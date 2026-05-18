import { Request, Response } from 'express';
import { applicationService } from '../services/applicationService';
import { CreateApplicationRequest } from '../types';

export const createApplication = (req: Request, res: Response) => {
  try {
    const request: CreateApplicationRequest = req.body;
    const application = applicationService.createApplication(request);
    res.status(201).json({
      success: true,
      data: application,
      message: application.status === 'rejected' 
        ? '申请已被系统自动拦截，请查看 rejectionMessage 了解详情'
        : application.status === 'processing'
        ? '申请已进入待人工处理状态，请及时跟进'
        : '申请创建成功，待审核'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '创建申请失败'
    });
  }
};

export const getApplication = (req: Request, res: Response) => {
  const { id } = req.params;
  const application = applicationService.getApplicationById(id);
  
  if (!application) {
    return res.status(404).json({
      success: false,
      message: '申请不存在'
    });
  }

  res.json({
    success: true,
    data: application
  });
};

export const getAllApplications = (req: Request, res: Response) => {
  const { status } = req.query;
  const applications = status 
    ? applicationService.getApplicationsByStatus(status as any)
    : applicationService.getAllApplications();

  res.json({
    success: true,
    data: applications,
    total: applications.length
  });
};

export const approveApplication = (req: Request, res: Response) => {
  const { id } = req.params;
  const { reviewedBy } = req.body;
  
  if (!reviewedBy) {
    return res.status(400).json({
      success: false,
      message: '审核人信息必填'
    });
  }

  const application = applicationService.approveApplication(id, reviewedBy);
  
  if (!application) {
    return res.status(404).json({
      success: false,
      message: '申请不存在'
    });
  }

  res.json({
    success: true,
    data: application,
    message: '申请已批准'
  });
};

export const rejectApplication = (req: Request, res: Response) => {
  const { id } = req.params;
  const { reviewedBy, reason } = req.body;
  
  if (!reviewedBy || !reason) {
    return res.status(400).json({
      success: false,
      message: '审核人信息和驳回理由必填'
    });
  }

  const application = applicationService.rejectApplication(id, reviewedBy, reason);
  
  if (!application) {
    return res.status(404).json({
      success: false,
      message: '申请不存在'
    });
  }

  res.json({
    success: true,
    data: application,
    message: '申请已驳回'
  });
};

export const exportApplication = (req: Request, res: Response) => {
  const { id } = req.params;
  const exported = applicationService.exportApplication(id);
  
  if (!exported) {
    return res.status(404).json({
      success: false,
      message: '申请不存在'
    });
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="replacement-${id}.json"`);
  res.json(exported);
};
