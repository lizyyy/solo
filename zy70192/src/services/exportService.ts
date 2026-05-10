import { Parser } from 'json2csv';
import { 
  getSampleById, 
  listSamples, 
  getSampleSummary 
} from './sampleService';
import { listReviewTasks, getReviewTaskSummary } from './reviewTaskService';
import { getTrialFeedbacksBySample, getTrialFeedbackSummary } from './trialFeedbackService';
import { getFinalizationBySample, getReturnRecordsBySample } from './finalizationService';
import { getHistoryByEntity } from './historyService';

export const exportSampleCSV = (): string => {
  const samples = listSamples({}, 1, 10000);
  
  const fields = [
    { label: '样品编号', value: 'sampleNo' },
    { label: '样品名称', value: 'name' },
    { label: '供应商', value: 'supplier' },
    { label: '分类', value: 'category' },
    { label: '数量', value: 'quantity' },
    { label: '单价', value: 'unitPrice' },
    { label: '总金额', value: 'totalAmount' },
    { label: '状态', value: 'status' },
    { label: '版本', value: 'version' },
    { label: '是否冻结', value: (row: any) => row.isFrozen ? '是' : '否' },
    { label: '创建人', value: 'createdBy' },
    { label: '创建时间', value: 'createdAt' },
    { label: '更新时间', value: 'updatedAt' }
  ];

  const opts = { fields };
  const parser = new Parser(opts);
  
  return parser.parse(samples.items);
};

export const getSampleFullReport = (sampleId: string): Record<string, any> => {
  const sample = getSampleById(sampleId);
  const reviewTasks = listReviewTasks({ sampleId }, 1, 100);
  const trialFeedbacks = getTrialFeedbacksBySample(sampleId);
  const finalization = getFinalizationBySample(sampleId);
  const returnRecords = getReturnRecordsBySample(sampleId);
  const history = getHistoryByEntity('SAMPLE', sampleId);

  let reviewSummary = null;
  let trialSummary = null;

  if (reviewTasks.total > 0) {
    const allReviewTasks = listReviewTasks({}, 1, 10000);
    reviewSummary = {
      total: reviewTasks.total,
      completed: reviewTasks.items.filter(t => t.status === 'COMPLETED').length,
      pending: reviewTasks.items.filter(t => t.status === 'PENDING').length,
      avgRating: reviewTasks.items
        .filter(t => t.rating)
        .reduce((sum, t) => sum + (t.rating || 0), 0) / 
        reviewTasks.items.filter(t => t.rating).length || 0
    };
  }

  if (trialFeedbacks.length > 0) {
    trialSummary = getTrialFeedbackSummary(sampleId);
  }

  return {
    sample,
    reviewTasks: reviewTasks.items,
    reviewSummary,
    trialFeedbacks,
    trialSummary,
    finalization,
    returnRecords,
    history,
    generatedAt: new Date().toISOString()
  };
};

export const getSystemOverview = (): Record<string, any> => {
  const sampleSummary = getSampleSummary();
  const reviewTaskSummary = getReviewTaskSummary();
  const trialSummary = getTrialFeedbackSummary();

  return {
    sampleSummary,
    reviewTaskSummary,
    trialSummary,
    generatedAt: new Date().toISOString()
  };
};

export const exportSampleReportCSV = (sampleId: string): string => {
  const report = getSampleFullReport(sampleId);
  
  let csv = '';
  
  csv += '样品信息\n';
  const sampleFields = ['样品编号', '样品名称', '供应商', '分类', '数量', '单价', '总金额', '状态', '版本', '创建时间'];
  csv += sampleFields.join(',') + '\n';
  const sampleData = [
    report.sample.sampleNo,
    report.sample.name,
    report.sample.supplier,
    report.sample.category,
    report.sample.quantity,
    report.sample.unitPrice,
    report.sample.totalAmount,
    report.sample.status,
    report.sample.version,
    report.sample.createdAt
  ];
  csv += sampleData.join(',') + '\n\n';

  if (report.reviewTasks.length > 0) {
    csv += '评审任务\n';
    const reviewFields = ['任务类型', '负责人', '状态', '优先级', '评分', '意见', '创建时间', '完成时间'];
    csv += reviewFields.join(',') + '\n';
    report.reviewTasks.forEach((task: any) => {
      const row = [
        task.taskType,
        task.assignee,
        task.status,
        task.priority,
        task.rating || '',
        `"${(task.opinion || '').replace(/"/g, '""')}"`,
        task.createdAt,
        task.completedAt || ''
      ];
      csv += row.join(',') + '\n';
    });
    csv += '\n';
  }

  if (report.trialFeedbacks.length > 0) {
    csv += '试用反馈\n';
    const trialFields = ['试用人员', '试用日期', '试用周期', '试用地点', '综合评分', '结论', '建议', '创建时间'];
    csv += trialFields.join(',') + '\n';
    report.trialFeedbacks.forEach((fb: any) => {
      const row = [
        fb.trialUser,
        fb.trialDate,
        fb.trialPeriod,
        fb.trialLocation,
        fb.overallRating,
        `"${fb.conclusion.replace(/"/g, '""')}"`,
        `"${(fb.suggestions || '').replace(/"/g, '""')}"`,
        fb.createdAt
      ];
      csv += row.join(',') + '\n';
    });
    csv += '\n';
  }

  if (report.finalization) {
    csv += '定版信息\n';
    const finalFields = ['定版版本', '审批人', '审批时间', '最终数量', '最终单价', '最终金额', '备注'];
    csv += finalFields.join(',') + '\n';
    const finalRow = [
      report.finalization.finalVersion,
      report.finalization.approvedBy,
      report.finalization.approvedAt,
      report.finalization.finalQuantity,
      report.finalization.finalUnitPrice,
      report.finalization.finalTotalAmount,
      `"${(report.finalization.remarks || '').replace(/"/g, '""')}"`
    ];
    csv += finalRow.join(',') + '\n\n';
  }

  if (report.returnRecords.length > 0) {
    csv += '退样记录\n';
    const returnFields = ['退样类型', '退样原因', '退样数量', '退样人', '退样时间', '物流单号', '签收人', '签收时间'];
    csv += returnFields.join(',') + '\n';
    report.returnRecords.forEach((rr: any) => {
      const row = [
        rr.returnType,
        `"${rr.returnReason.replace(/"/g, '""')}"`,
        rr.returnQuantity,
        rr.returnedBy,
        rr.returnedAt,
        rr.trackingNo || '',
        rr.receivedBy || '',
        rr.receivedAt || ''
      ];
      csv += row.join(',') + '\n';
    });
    csv += '\n';
  }

  csv += '历史记录\n';
  const historyFields = ['操作类型', '描述', '操作人', '操作时间'];
  csv += historyFields.join(',') + '\n';
  report.history.forEach((h: any) => {
    const row = [
      h.action,
      `"${h.description.replace(/"/g, '""')}"`,
      h.operator,
      h.operationTime
    ];
    csv += row.join(',') + '\n';
  });

  return csv;
};
