import {
  CaseDAO,
  RepaymentDAO,
  RepaymentPlanDAO,
  InvoiceDAO,
  RiskReportDAO,
  ReportHistoryDAO,
} from '../dao/index.js';
import { auditService } from './auditService.js';
import type {
  ReportTemplate,
  PaginatedResponse,
  User,
} from '../../shared/types.js';
import type { ReportHistoryRecord } from '../dao/ReportHistoryDAO.js';

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'collection_progress',
    name: '催收进度报表',
    description: '统计各案件的催收进度和回款情况',
    type: 'collection_progress',
  },
  {
    id: 'risk_assessment',
    name: '风险评估报表',
    description: '分析案件风险分布和趋势',
    type: 'risk_assessment',
  },
  {
    id: 'repayment_detail',
    name: '回款明细报表',
    description: '详细的回款记录和核销情况',
    type: 'repayment_detail',
  },
];

function generateId(prefix: string = 'rpt'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const reportService = {
  getTemplates(): ReportTemplate[] {
    return REPORT_TEMPLATES;
  },

  async generateReport(
    templateId: string,
    filters: Record<string, any>,
    operator: User
  ): Promise<{
    reportId: string;
    templateId: string;
    templateName: string;
    fileName: string;
    data: any[];
    columns: string[];
    generatedAt: string;
    recordCount: number;
  }> {
    if (!templateId) {
      throw new Error('模板ID不能为空');
    }
    if (!operator?.id || !operator?.name) {
      throw new Error('操作员信息不完整');
    }

    const template = REPORT_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`报表模板不存在: ${templateId}`);
    }

    let reportData: any[] = [];
    let columns: string[] = [];

    switch (templateId) {
      case 'collection_progress':
        const result1 = await reportService.generateCollectionProgressReport(filters);
        reportData = result1.data;
        columns = result1.columns;
        break;
      case 'risk_assessment':
        const result2 = await reportService.generateRiskAssessmentReport(filters);
        reportData = result2.data;
        columns = result2.columns;
        break;
      case 'repayment_detail':
        const result3 = await reportService.generateRepaymentDetailReport(filters);
        reportData = result3.data;
        columns = result3.columns;
        break;
      case 'case_overview':
        const result4 = await reportService.generateCaseOverviewReport(filters);
        reportData = result4.data;
        columns = result4.columns;
        break;
      default:
        throw new Error(`不支持的报表模板: ${templateId}`);
    }

    const reportId = generateId();
    const generatedAt = new Date().toISOString();
    const fileName = `${template.name}_${new Date().toISOString().slice(0, 10)}.csv`;
    const csvContent = reportService.convertToCSV({ name: template.name, columns, data: reportData });
    const fileSize = new Blob([csvContent]).size;

    await ReportHistoryDAO.create({
      id: generateId('rh'),
      reportId,
      templateId,
      templateName: template.name,
      fileName,
      fileFormat: 'csv',
      recordCount: reportData.length,
      fileSize,
      operatorId: operator.id,
      operatorName: operator.name,
      filters: JSON.stringify(filters),
      status: 'completed',
    });

    await auditService.logAction(
      operator.id,
      operator.name,
      'generate_report',
      'report',
      reportId,
      `生成报表: ${template.name}，共${reportData.length}条记录`,
    );

    return {
      reportId,
      templateId,
      templateName: template.name,
      fileName,
      data: reportData,
      columns,
      generatedAt,
      recordCount: reportData.length,
    };
  },

  async getHistory(
    page: number = 1,
    pageSize: number = 10,
    filters?: Record<string, any>
  ): Promise<{ list: ReportHistoryRecord[]; total: number; page: number; pageSize: number }> {
    const result = ReportHistoryDAO.list(filters, page, pageSize);
    return {
      list: result.list,
      total: result.total,
      page,
      pageSize,
    };
  },

  async downloadReport(
    reportId: string
  ): Promise<{
    fileName: string;
    content: string;
    mimeType: string;
    templateId: string;
  }> {
    const history = ReportHistoryDAO.getByReportId(reportId);
    if (!history) {
      throw new Error('报表不存在');
    }

    const filters = history.filters ? JSON.parse(history.filters) : {};
    
    let reportData: any[] = [];
    let columns: string[] = [];

    switch (history.templateId) {
      case 'collection_progress':
        const result1 = await reportService.generateCollectionProgressReport(filters);
        reportData = result1.data;
        columns = result1.columns;
        break;
      case 'risk_assessment':
        const result2 = await reportService.generateRiskAssessmentReport(filters);
        reportData = result2.data;
        columns = result2.columns;
        break;
      case 'repayment_detail':
        const result3 = await reportService.generateRepaymentDetailReport(filters);
        reportData = result3.data;
        columns = result3.columns;
        break;
      case 'case_overview':
        const result4 = await reportService.generateCaseOverviewReport(filters);
        reportData = result4.data;
        columns = result4.columns;
        break;
      default:
        throw new Error(`不支持的报表模板: ${history.templateId}`);
    }

    const csv = reportService.convertToCSV({
      name: history.templateName,
      columns,
      data: reportData,
    });

    return {
      fileName: history.fileName,
      content: csv,
      mimeType: 'text/csv; charset=utf-8',
      templateId: history.templateId,
    };
  },

  async generateCollectionProgressReport(filters: Record<string, any>): Promise<{
    data: any[];
    columns: string[];
  }> {
    const columns = [
      '业务编号',
      '买方名称',
      '卖方名称',
      '当前状态',
      '风险等级',
      '总金额',
      '已回款金额',
      '待回款金额',
      '逾期天数',
      '最近催收日期',
      '下次跟进日期',
    ];

    const { list: cases } = await CaseDAO.list(filters, 1, 1000);
    
    const data = await Promise.all(
      cases.map(async caseItem => {
        const repayments = await RepaymentDAO.findByBusinessNo(caseItem.businessNo);
        const totalRepaid = repayments.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
        const plans = await RepaymentPlanDAO.findByBusinessNo(caseItem.businessNo);
        const collectionNotes = await (await import('../dao/index.js')).CollectionNoteDAO.findByBusinessNo(caseItem.businessNo);
        
        return {
          businessNo: caseItem.businessNo,
          buyerName: caseItem.buyerName,
          sellerName: caseItem.sellerName,
          currentStatus: caseItem.currentStatus,
          riskLevel: caseItem.riskLevel,
          totalAmount: caseItem.totalAmount,
          totalRepaid,
          pendingAmount: caseItem.totalAmount - totalRepaid,
          overdueDays: caseItem.overdueDays,
          lastCollectionDate: collectionNotes[0]?.collectionDate || '-',
          followUpDate: collectionNotes[0]?.followUpDate || '-',
        };
      })
    );

    return { data, columns };
  },

  async generateRiskAssessmentReport(filters: Record<string, any>): Promise<{
    data: any[];
    columns: string[];
  }> {
    const columns = [
      '业务编号',
      '买方名称',
      '风险等级',
      '当前状态',
      '逾期天数',
      '总金额',
      '风险评分',
      '风险因素',
      '建议措施',
      '评估日期',
    ];

    const { list: cases } = await CaseDAO.list(filters, 1, 1000);
    
    const data = await Promise.all(
      cases.map(async caseItem => {
        const latestReport = await RiskReportDAO.findLatestByBusinessNo(caseItem.businessNo);
        
        return {
          businessNo: caseItem.businessNo,
          buyerName: caseItem.buyerName,
          riskLevel: caseItem.riskLevel,
          currentStatus: caseItem.currentStatus,
          overdueDays: caseItem.overdueDays,
          totalAmount: caseItem.totalAmount,
          keyFindings: latestReport?.keyFindings || '',
          recommendations: latestReport?.recommendations || '',
          assessmentDate: latestReport?.reportDate || caseItem.updatedAt,
        };
      })
    );

    return { data, columns };
  },

  async generateRepaymentDetailReport(filters: Record<string, any>): Promise<{
    data: any[];
    columns: string[];
  }> {
    const columns = [
      '回款编号',
      '业务编号',
      '还款日期',
      '还款金额',
      '付款人',
      '核销状态',
      '备注',
      '登记时间',
    ];

    const repayments = await RepaymentDAO.findAll(filters);
    
    const data = repayments.map(r => ({
      repaymentId: r.id,
      businessNo: r.businessNo,
      repaymentDate: r.repaymentDate,
      totalAmount: r.totalAmount,
      payer: r.payer,
      writeOffStatus: r.writeOffStatus,
      remark: r.remark,
      createdAt: r.createdAt,
    }));

    return { data, columns };
  },

  async generateCaseOverviewReport(filters: Record<string, any>): Promise<{
    data: any[];
    columns: string[];
  }> {
    const columns = [
      '业务编号',
      '买方名称',
      '卖方名称',
      '总金额',
      '融资金额',
      '当前状态',
      '风险等级',
      '逾期天数',
      '发票数量',
      '合同编号',
      '创建时间',
      '更新时间',
    ];

    const { list: cases } = await CaseDAO.list(filters, 1, 1000);
    
    const data = await Promise.all(
      cases.map(async caseItem => {
        const invoices = await InvoiceDAO.findByBusinessNo(caseItem.businessNo);
        const contracts = await (await import('../dao/index.js')).ContractDAO.findByBusinessNo(caseItem.businessNo);
        
        return {
          businessNo: caseItem.businessNo,
          buyerName: caseItem.buyerName,
          sellerName: caseItem.sellerName,
          totalAmount: caseItem.totalAmount,
          financingAmount: caseItem.financingAmount,
          currentStatus: caseItem.currentStatus,
          riskLevel: caseItem.riskLevel,
          overdueDays: caseItem.overdueDays,
          invoiceCount: invoices.length,
          contractNo: contracts[0]?.contractNo || '-',
          createdAt: caseItem.createdAt,
          updatedAt: caseItem.updatedAt,
        };
      })
    );

    return { data, columns };
  },

  convertToCSV(report: {
    name: string;
    columns: string[];
    data: any[];
  }): string {
    const { columns, data } = report;
    
    const header = columns.join(',');
    const rows = data.map(row => 
      columns.map(col => {
        const key = Object.keys(row)[columns.indexOf(col)];
        const value = row[key] ?? '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    
    return [header, ...rows].join('\n');
  },
};

export default reportService;
