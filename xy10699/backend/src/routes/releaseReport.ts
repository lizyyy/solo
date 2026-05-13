import express, { Request, Response } from 'express';
import ReleaseReport from '../models/ReleaseReport';
import ReleaseRequest from '../models/ReleaseRequest';
import AffectedService from '../models/AffectedService';
import ApprovalOpinion from '../models/ApprovalOpinion';
import GrayBatch from '../models/GrayBatch';
import RollbackAction from '../models/RollbackAction';
import ExcelJS from 'exceljs';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { requestId, overallStatus, responsiblePerson, startDate, endDate } = req.query;
    const query: any = {};
    
    if (requestId) query.requestId = requestId;
    if (overallStatus) query.overallStatus = overallStatus;
    if (responsiblePerson) query.responsiblePerson = responsiblePerson;
    if (startDate || endDate) {
      query.generatedAt = {};
      if (startDate) query.generatedAt.$gte = new Date(startDate as string);
      if (endDate) query.generatedAt.$lte = new Date(endDate as string);
    }
    
    const reports = await ReleaseReport.find(query).sort({ generatedAt: -1 });
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取发布报告列表失败', error });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const report = await ReleaseReport.findOne({ requestId: req.params.id });
    if (!report) {
      return res.status(404).json({ success: false, message: '发布报告不存在' });
    }
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取发布报告失败', error });
  }
});

router.post('/generate/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { generatedBy } = req.body;
    
    const request = await ReleaseRequest.findOne({ requestId });
    if (!request) {
      return res.status(404).json({ success: false, message: '发布申请不存在' });
    }
    
    const services = await AffectedService.find({ requestId });
    const opinions = await ApprovalOpinion.find({ requestId });
    const batches = await GrayBatch.find({ requestId });
    const rollbacks = await RollbackAction.find({ requestId });
    
    const successfulServices = services.filter(s => s.status === 'completed').length;
    const failedServices = services.filter(s => s.status === 'failed').length;
    const totalDowntime = services.reduce((sum, s) => sum + (s.actualDowntime || 0), 0);
    const maxDowntime = Math.max(...services.map(s => s.actualDowntime || 0));
    
    let overallStatus: 'success' | 'partial_success' | 'failed' | 'rolled_back';
    if (rollbacks.length > 0) {
      overallStatus = 'rolled_back';
    } else if (failedServices === 0) {
      overallStatus = 'success';
    } else if (successfulServices > 0) {
      overallStatus = 'partial_success';
    } else {
      overallStatus = 'failed';
    }
    
    const count = await ReleaseReport.countDocuments();
    const reportId = `RPT${String(count + 1).padStart(6, '0')}`;
    
    const report = new ReleaseReport({
      requestId,
      reportId,
      generatedBy,
      overallStatus,
      totalServices: services.length,
      successfulServices,
      failedServices,
      totalDowntime,
      maxDowntime,
      approvalSummary: {
        approverCount: opinions.length,
        approvedCount: opinions.filter(o => o.opinion === 'approved').length,
        rejectedCount: opinions.filter(o => o.opinion === 'rejected').length
      },
      grayBatchSummary: batches.map(b => ({
        batchName: b.batchName,
        targetPercentage: b.targetPercentage,
        actualPercentage: b.actualPercentage || 0,
        status: b.status,
        successRate: b.instanceCount > 0 ? (b.successCount || 0) / b.instanceCount * 100 : 0
      })),
      rollbackSummary: rollbacks.length > 0 ? {
        hasRollback: true,
        rollbackReason: rollbacks[0].reason,
        rollbackScope: rollbacks[0].rollbackScope,
        affectedBatches: rollbacks[0].affectedBatches.length
      } : undefined,
      exceptions: services.filter(s => s.status === 'failed').map(s => ({
        serviceName: s.serviceName,
        errorType: 'service_failure',
        errorMessage: `${s.serviceName} 发布失败`,
        occurredAt: s.updatedAt,
        resolved: false,
        beforeValue: '未发布',
        afterValue: '发布失败'
      })),
      responsiblePerson: request.applicant,
      startTime: request.createdAt,
      endTime: new Date(),
      duration: Math.floor((Date.now() - request.createdAt.getTime()) / 1000 / 60)
    });
    
    await report.save();
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: '生成发布报告失败', error });
  }
});

router.get('/export/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const report = await ReleaseReport.findOne({ requestId });
    
    if (!report) {
      return res.status(404).json({ success: false, message: '发布报告不存在' });
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('发布报告');
    
    worksheet.columns = [
      { header: '字段', key: 'field', width: 30 },
      { header: '值', key: 'value', width: 50 }
    ];
    
    worksheet.addRow({ field: '报告ID', value: report.reportId });
    worksheet.addRow({ field: '申请ID', value: report.requestId });
    worksheet.addRow({ field: '生成人', value: report.generatedBy });
    worksheet.addRow({ field: '生成时间', value: report.generatedAt.toLocaleString() });
    worksheet.addRow({ field: '总体状态', value: report.overallStatus });
    worksheet.addRow({ field: '责任人', value: report.responsiblePerson });
    worksheet.addRow({ field: '服务总数', value: report.totalServices });
    worksheet.addRow({ field: '成功服务数', value: report.successfulServices });
    worksheet.addRow({ field: '失败服务数', value: report.failedServices });
    worksheet.addRow({ field: '总停机时间(分钟)', value: report.totalDowntime });
    worksheet.addRow({ field: '最大停机时间(分钟)', value: report.maxDowntime });
    
    worksheet.addRow({ field: '', value: '' });
    worksheet.addRow({ field: '审批摘要', value: '' });
    worksheet.addRow({ field: '审批人数', value: report.approvalSummary.approverCount });
    worksheet.addRow({ field: '通过数', value: report.approvalSummary.approvedCount });
    worksheet.addRow({ field: '拒绝数', value: report.approvalSummary.rejectedCount });
    
    if (report.rollbackSummary?.hasRollback) {
      worksheet.addRow({ field: '', value: '' });
      worksheet.addRow({ field: '回滚摘要', value: '' });
      worksheet.addRow({ field: '回滚原因', value: report.rollbackSummary.rollbackReason });
      worksheet.addRow({ field: '回滚范围', value: report.rollbackSummary.rollbackScope });
      worksheet.addRow({ field: '影响批次数', value: report.rollbackSummary.affectedBatches });
    }
    
    if (report.exceptions.length > 0) {
      worksheet.addRow({ field: '', value: '' });
      worksheet.addRow({ field: '异常列表', value: '' });
      report.exceptions.forEach((ex, idx) => {
        worksheet.addRow({ field: `异常${idx + 1} - 服务`, value: ex.serviceName });
        worksheet.addRow({ field: `异常${idx + 1} - 类型`, value: ex.errorType });
        worksheet.addRow({ field: `异常${idx + 1} - 消息`, value: ex.errorMessage });
        worksheet.addRow({ field: `异常${idx + 1} - 发生时间`, value: ex.occurredAt.toLocaleString() });
        worksheet.addRow({ field: `异常${idx + 1} - 修改前`, value: ex.beforeValue || '' });
        worksheet.addRow({ field: `异常${idx + 1} - 修改后`, value: ex.afterValue || '' });
      });
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=release-report-${requestId}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: '导出发布报告失败', error });
  }
});

export default router;
