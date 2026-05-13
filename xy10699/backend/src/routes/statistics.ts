import express, { Request, Response } from 'express';
import ReleaseRequest from '../models/ReleaseRequest';
import AffectedService from '../models/AffectedService';
import ReleaseReport from '../models/ReleaseReport';
import RollbackAction from '../models/RollbackAction';

const router = express.Router();

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const totalRequests = await ReleaseRequest.countDocuments();
    const pendingRequests = await ReleaseRequest.countDocuments({ status: 'pending' });
    const processingRequests = await ReleaseRequest.countDocuments({ status: 'processing' });
    const completedRequests = await ReleaseRequest.countDocuments({ status: 'completed' });
    const rolledBackRequests = await ReleaseRequest.countDocuments({ status: 'rolled_back' });
    
    const totalServices = await AffectedService.countDocuments();
    const failedServices = await AffectedService.countDocuments({ status: 'failed' });
    
    const totalReports = await ReleaseReport.countDocuments();
    const successReports = await ReleaseReport.countDocuments({ overallStatus: 'success' });
    const failedReports = await ReleaseReport.countDocuments({ overallStatus: 'failed' });
    const rolledBackReports = await ReleaseReport.countDocuments({ overallStatus: 'rolled_back' });
    
    const totalRollbacks = await RollbackAction.countDocuments();
    
    const recentRequests = await ReleaseRequest.find()
      .sort({ createdAt: -1 })
      .limit(5);
    
    const exceptions = await AffectedService.find({ status: 'failed' })
      .sort({ updatedAt: -1 })
      .limit(10);
    
    const statusByType = await ReleaseRequest.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    
    const statusByDepartment = await ReleaseRequest.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      data: {
        overview: {
          totalRequests,
          pendingRequests,
          processingRequests,
          completedRequests,
          rolledBackRequests,
          totalServices,
          failedServices,
          totalReports,
          successReports,
          failedReports,
          rolledBackReports,
          totalRollbacks
        },
        recentRequests,
        exceptions: exceptions.map(e => ({
          serviceName: e.serviceName,
          requestId: e.requestId,
          environment: e.environment,
          impactLevel: e.impactLevel,
          errorMessage: `${e.serviceName} 发布失败`,
          occurredAt: e.updatedAt
        })),
        statusByType,
        statusByDepartment
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取统计数据失败', error });
  }
});

export default router;
