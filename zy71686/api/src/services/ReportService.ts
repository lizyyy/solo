import type {
  ReportRequest,
  ReportResponse,
  RiskAnalysisResult,
  Customer,
  GuaranteeContract,
  CreditLine,
  CounterGuarantee,
  BatchTask,
  FailedItem
} from '../../../shared/types.js';
import { customerRepository } from '../repositories/CustomerRepository.js';
import { guaranteeRepository } from '../repositories/GuaranteeRepository.js';
import { creditRepository } from '../repositories/CreditRepository.js';
import { riskRepository } from '../repositories/RiskRepository.js';
import { versionRepository } from '../repositories/VersionRepository.js';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const REPORT_DIR = process.env.REPORT_DIR || path.join(process.cwd(), 'reports');

if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

interface ReportData {
  customer: Customer;
  riskResult: RiskAnalysisResult;
  guarantees: GuaranteeContract[];
  credits: CreditLine[];
  counterGuarantees: CounterGuarantee[];
  relatedCustomers: Customer[];
}

export class ReportService {
  async generateReport(request: ReportRequest, operator: string): Promise<ReportResponse> {
    const version = versionRepository.getActiveSnapshot()?.id;
    if (!version) {
      throw new Error('没有可用的数据版本，请先导入数据');
    }

    const reportId = uuidv4();
    const taskId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `risk_report_${timestamp}.${request.format}`;
    const filePath = path.join(REPORT_DIR, fileName);

    const task = creditRepository.createBatchTask({
      type: 'export',
      status: 'running',
      totalCount: request.customerIds.length,
      successCount: 0,
      failedCount: 0,
      progress: 0,
      startedAt: new Date().toISOString(),
      failedItems: []
    });

    setImmediate(async () => {
      try {
        await this.processReportGeneration(
          request,
          version,
          reportId,
          filePath,
          task.id,
          operator
        );
      } catch (error) {
        console.error('Report generation error:', error);
        creditRepository.completeBatchTask(task.id, 'failed', [{
          index: 0,
          objectId: reportId,
          objectName: fileName,
          errorMessage: error instanceof Error ? error.message : '报告生成失败',
          errorCode: 'REPORT_GENERATION_ERROR',
          rawData: { request }
        }]);
      }
    });

    const downloadUrl = `/api/reports/download/${reportId}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      reportId,
      downloadUrl,
      expiresAt
    };
  }

  private async processReportGeneration(
    request: ReportRequest,
    version: string,
    reportId: string,
    filePath: string,
    taskId: string,
    operator: string
  ): Promise<void> {
    const failedItems: FailedItem[] = [];
    const reportDataList: ReportData[] = [];

    for (let i = 0; i < request.customerIds.length; i++) {
      const customerId = request.customerIds[i];
      try {
        const data = this.collectReportData(customerId, version, request.includeSections);
        reportDataList.push(data);
      } catch (error) {
        failedItems.push({
          index: i,
          objectId: customerId,
          objectName: customerId,
          errorMessage: error instanceof Error ? error.message : '收集数据失败',
          errorCode: 'DATA_COLLECTION_ERROR',
          rawData: { customerId }
        });
      }

      if (i % 5 === 0 || i === request.customerIds.length - 1) {
        const progress = Math.round(((i + 1) / request.customerIds.length) * 50);
        creditRepository.updateBatchTaskProgress(taskId, progress, i + 1 - failedItems.length, failedItems.length);
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    try {
      if (request.format === 'excel') {
        this.generateExcelReport(reportDataList, request.includeSections, filePath);
      } else {
        await this.generatePDFReport(reportDataList, request.includeSections, filePath);
      }
    } catch (error) {
      throw new Error(`生成${request.format === 'excel' ? 'Excel' : 'PDF'}失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    creditRepository.updateBatchTaskProgress(taskId, 100, reportDataList.length, failedItems.length);
    creditRepository.completeBatchTask(taskId, failedItems.length === 0 ? 'completed' : 'partial', failedItems);

    versionRepository.createOperationLog({
      operationType: 'report_export',
      operator,
      description: `导出风险报告，${request.type === 'batch' ? '批量' : '单客户'}，共 ${reportDataList.length} 个客户`,
      affectedObjects: request.customerIds.slice(0, 50),
      previousSnapshotId: version,
      canUndo: false
    });
  }

  private collectReportData(
    customerId: string,
    version: string,
    includeSections: string[]
  ): ReportData {
    const customer = customerRepository.findById(customerId, version);
    if (!customer) {
      throw new Error(`客户 ${customerId} 不存在`);
    }

    const riskResult = riskRepository.findByCustomerId(customerId, version);
    if (!riskResult) {
      throw new Error(`客户 ${customer.name} 没有风险分析结果，请先执行风险分析`);
    }

    const guarantees: GuaranteeContract[] = [];
    const credits: CreditLine[] = [];
    const counterGuarantees: CounterGuarantee[] = [];
    const relatedCustomerIds = new Set<string>();

    if (includeSections.includes('guarantees') || includeSections.includes('all')) {
      guarantees.push(
        ...guaranteeRepository.findContractsByGuarantor(customerId, version),
        ...guaranteeRepository.findContractsByGuaranteed(customerId, version)
      );
      guarantees.forEach(g => {
        relatedCustomerIds.add(g.guarantorId);
        relatedCustomerIds.add(g.guaranteedId);
      });
    }

    if (includeSections.includes('credits') || includeSections.includes('all')) {
      credits.push(...creditRepository.findCreditLinesByCustomer(customerId, version));
    }

    if (includeSections.includes('counterGuarantees') || includeSections.includes('all')) {
      for (const g of guarantees) {
        const cgs = guaranteeRepository.findCounterGuaranteesByGuarantee(g.id, version);
        counterGuarantees.push(...cgs);
        cgs.forEach(cg => relatedCustomerIds.add(cg.providerId));
      }
    }

    relatedCustomerIds.delete(customerId);
    const relatedCustomers = Array.from(relatedCustomerIds)
      .map(id => customerRepository.findById(id, version))
      .filter(Boolean) as Customer[];

    return {
      customer,
      riskResult,
      guarantees,
      credits,
      counterGuarantees,
      relatedCustomers
    };
  }

  private generateExcelReport(
    dataList: ReportData[],
    includeSections: string[],
    filePath: string
  ): void {
    const wb = XLSX.utils.book_new();

    const summaryData = dataList.map(d => ({
      '客户名称': d.customer.name,
      '客户类型': d.customer.customerType === 'enterprise' ? '企业' : d.customer.customerType === 'group' ? '集团' : '个人',
      '信用评级': d.customer.creditRating,
      '所属行业': d.customer.industry,
      '风险等级': this.getRiskLevelText(d.riskResult.overallRiskLevel),
      '风险评分': d.riskResult.riskScore,
      '总风险暴露(万元)': this.formatAmount(d.riskResult.totalExposure),
      '担保链风险': this.getRiskLevelText(d.riskResult.guaranteeChainRisk),
      '互保风险': this.getRiskLevelText(d.riskResult.crossGuaranteeRisk),
      '反担保覆盖率': `${(d.riskResult.counterGuaranteeCoverage * 100).toFixed(1)}%`,
      '授信集中度': `${(d.riskResult.creditConcentration * 100).toFixed(1)}%`,
      '风险因素': d.riskResult.riskFactors.map(f => f.name).join('；'),
      '计算时间': new Date(d.riskResult.calculationTime).toLocaleString()
    }));

    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    this.adjustColumnWidth(summaryWs, summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, '风险总览');

    if (includeSections.includes('guarantees') || includeSections.includes('all')) {
      const guaranteeData = dataList.flatMap(d => 
        d.guarantees.map(g => ({
          '客户名称': d.customer.name,
          '合同编号': g.contractNumber,
          '担保方': d.customer.id === g.guarantorId ? d.customer.name : this.getCustomerName(g.guarantorId, d.relatedCustomers, d.customer),
          '被担保方': d.customer.id === g.guaranteedId ? d.customer.name : this.getCustomerName(g.guaranteedId, d.relatedCustomers, d.customer),
          '担保金额(万元)': this.formatAmount(g.amount),
          '币种': g.currency,
          '开始日期': g.startDate,
          '到期日期': g.endDate,
          '是否反担保': g.isCounterGuarantee ? '是' : '否',
          '来源文件': g.sourceFile,
          '来源行号': g.sourceRow
        }))
      );
      if (guaranteeData.length > 0) {
        const guaranteeWs = XLSX.utils.json_to_sheet(guaranteeData);
        this.adjustColumnWidth(guaranteeWs, guaranteeData);
        XLSX.utils.book_append_sheet(wb, guaranteeWs, '担保合同');
      }
    }

    if (includeSections.includes('credits') || includeSections.includes('all')) {
      const creditData = dataList.flatMap(d => 
        d.credits.map(c => ({
          '客户名称': d.customer.name,
          '授信总额(万元)': this.formatAmount(c.totalAmount),
          '已用额度(万元)': this.formatAmount(c.usedAmount),
          '可用额度(万元)': this.formatAmount(c.availableAmount),
          '余额日期': c.asOfDate,
          '币种': c.currency,
          '来源文件': c.sourceFile,
          '来源行号': c.sourceRow
        }))
      );
      if (creditData.length > 0) {
        const creditWs = XLSX.utils.json_to_sheet(creditData);
        this.adjustColumnWidth(creditWs, creditData);
        XLSX.utils.book_append_sheet(wb, creditWs, '授信余额');
      }
    }

    if (includeSections.includes('counterGuarantees') || includeSections.includes('all')) {
      const cgData = dataList.flatMap(d => 
        d.counterGuarantees.map(cg => ({
          '客户名称': d.customer.name,
          '反担保类型': cg.type,
          '提供方': this.getCustomerName(cg.providerId, d.relatedCustomers, d.customer),
          '反担保金额(万元)': this.formatAmount(cg.amount),
          '覆盖率': `${(cg.coverageRatio * 100).toFixed(1)}%`,
          '来源文件': cg.sourceFile,
          '来源行号': cg.sourceRow
        }))
      );
      if (cgData.length > 0) {
        const cgWs = XLSX.utils.json_to_sheet(cgData);
        this.adjustColumnWidth(cgWs, cgData);
        XLSX.utils.book_append_sheet(wb, cgWs, '反担保措施');
      }
    }

    if (includeSections.includes('riskFactors') || includeSections.includes('all')) {
      const riskFactorData = dataList.flatMap(d => 
        d.riskResult.riskFactors.map(f => ({
          '客户名称': d.customer.name,
          '风险代码': f.code,
          '风险名称': f.name,
          '严重程度': this.getRiskLevelText(f.severity),
          '风险描述': f.description,
          '关联对象': f.relatedObjects.join('；')
        }))
      );
      if (riskFactorData.length > 0) {
        const rfWs = XLSX.utils.json_to_sheet(riskFactorData);
        this.adjustColumnWidth(rfWs, riskFactorData);
        XLSX.utils.book_append_sheet(wb, rfWs, '风险因素明细');
      }
    }

    XLSX.writeFile(wb, filePath);
  }

  private async generatePDFReport(
    dataList: ReportData[],
    includeSections: string[],
    filePath: string
  ): Promise<void> {
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    for (const data of dataList) {
      this.addPDFPage(pdfDoc, data, includeSections, helveticaFont, helveticaBoldFont);
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(filePath, pdfBytes);
  }

  private addPDFPage(
    pdfDoc: PDFDocument,
    data: ReportData,
    includeSections: string[],
    normalFont: any,
    boldFont: any
  ): void {
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();
    let yPosition = height - 50;
    const margin = 50;

    page.drawText('担保圈授信风险暴露报告', {
      x: margin,
      y: yPosition,
      size: 18,
      font: boldFont,
      color: rgb(0.1, 0.2, 0.4)
    });
    yPosition -= 30;

    page.drawText(`生成时间: ${new Date().toLocaleString()}`, {
      x: margin,
      y: yPosition,
      size: 10,
      font: normalFont,
      color: rgb(0.4, 0.4, 0.4)
    });
    yPosition -= 20;

    this.drawPDFSection(page, '客户基本信息', margin, yPosition, boldFont);
    yPosition -= 25;

    const customerInfo = [
      ['客户名称', data.customer.name],
      ['客户类型', data.customer.customerType === 'enterprise' ? '企业' : data.customer.customerType === 'group' ? '集团' : '个人'],
      ['信用评级', data.customer.creditRating],
      ['所属行业', data.customer.industry]
    ];
    yPosition = this.drawPDFTable(page, customerInfo, margin, yPosition, normalFont, boldFont);
    yPosition -= 15;

    this.drawPDFSection(page, '风险评估结果', margin, yPosition, boldFont);
    yPosition -= 25;

    const riskColor = this.getRiskColor(data.riskResult.overallRiskLevel);
    page.drawText(`风险等级: ${this.getRiskLevelText(data.riskResult.overallRiskLevel)}`, {
      x: margin,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: rgb(riskColor.r, riskColor.g, riskColor.b)
    });
    yPosition -= 20;

    const riskInfo = [
      ['风险评分', data.riskResult.riskScore.toString()],
      ['总风险暴露', `${this.formatAmount(data.riskResult.totalExposure)} 万元`],
      ['担保链风险', this.getRiskLevelText(data.riskResult.guaranteeChainRisk)],
      ['互保风险', this.getRiskLevelText(data.riskResult.crossGuaranteeRisk)],
      ['反担保覆盖率', `${(data.riskResult.counterGuaranteeCoverage * 100).toFixed(1)}%`],
      ['授信集中度', `${(data.riskResult.creditConcentration * 100).toFixed(1)}%`]
    ];
    yPosition = this.drawPDFTable(page, riskInfo, margin, yPosition, normalFont, boldFont);
    yPosition -= 15;

    if (includeSections.includes('riskFactors') || includeSections.includes('all')) {
      this.drawPDFSection(page, '风险因素', margin, yPosition, boldFont);
      yPosition -= 25;

      for (const factor of data.riskResult.riskFactors) {
        const factorColor = this.getRiskColor(factor.severity);
        page.drawText(`● ${factor.name}`, {
          x: margin + 10,
          y: yPosition,
          size: 11,
          font: boldFont,
          color: rgb(factorColor.r, factorColor.g, factorColor.b)
        });
        yPosition -= 15;
        page.drawText(factor.description, {
          x: margin + 25,
          y: yPosition,
          size: 10,
          font: normalFont,
          color: rgb(0.2, 0.2, 0.2),
          maxWidth: width - margin - 50
        });
        yPosition -= 18;
      }
    }

    if ((includeSections.includes('guarantees') || includeSections.includes('all')) && data.guarantees.length > 0) {
      if (yPosition < 100) {
        this.addPDFPage(pdfDoc, { ...data, guarantees: data.guarantees, credits: [], counterGuarantees: [], relatedCustomers: data.relatedCustomers }, ['guarantees'], normalFont, boldFont);
        return;
      }
      this.drawPDFSection(page, '担保合同明细', margin, yPosition, boldFont);
      yPosition -= 25;
      page.drawText(`共 ${data.guarantees.length} 笔担保合同`, {
        x: margin,
        y: yPosition,
        size: 10,
        font: normalFont,
        color: rgb(0.4, 0.4, 0.4)
      });
      yPosition -= 15;
    }

    if ((includeSections.includes('counterGuarantees') || includeSections.includes('all')) && data.counterGuarantees.length > 0) {
      if (yPosition < 100) {
        this.addPDFPage(pdfDoc, { ...data, guarantees: [], credits: [], counterGuarantees: data.counterGuarantees, relatedCustomers: data.relatedCustomers }, ['counterGuarantees'], normalFont, boldFont);
        return;
      }
      this.drawPDFSection(page, '反担保措施', margin, yPosition, boldFont);
      yPosition -= 25;
      page.drawText(`共 ${data.counterGuarantees.length} 项反担保措施`, {
        x: margin,
        y: yPosition,
        size: 10,
        font: normalFont,
        color: rgb(0.4, 0.4, 0.4)
      });
      yPosition -= 15;
    }

    if ((includeSections.includes('credits') || includeSections.includes('all')) && data.credits.length > 0) {
      if (yPosition < 100) {
        this.addPDFPage(pdfDoc, { ...data, guarantees: [], credits: data.credits, counterGuarantees: [], relatedCustomers: data.relatedCustomers }, ['credits'], normalFont, boldFont);
        return;
      }
      this.drawPDFSection(page, '授信余额', margin, yPosition, boldFont);
      yPosition -= 25;
      page.drawText(`授信总额: ${this.formatAmount(data.credits.reduce((s, c) => s + c.totalAmount, 0))} 万元`, {
        x: margin,
        y: yPosition,
        size: 10,
        font: normalFont,
        color: rgb(0.4, 0.4, 0.4)
      });
      yPosition -= 15;
    }
  }

  private drawPDFSection(page: any, title: string, x: number, y: number, font: any): void {
    page.drawText(title, {
      x,
      y,
      size: 14,
      font,
      color: rgb(0.1, 0.2, 0.4)
    });
    page.drawLine({
      start: { x, y: y - 5 },
      end: { x: x + 500, y: y - 5 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8)
    });
  }

  private drawPDFTable(page: any, rows: string[][], x: number, y: number, normalFont: any, boldFont: any): number {
    const colWidths = [120, 350];
    let currentY = y;

    for (const row of rows) {
      page.drawText(row[0], {
        x: x + 5,
        y: currentY - 15,
        size: 10,
        font: boldFont,
        color: rgb(0.3, 0.3, 0.3)
      });
      page.drawText(row[1], {
        x: x + colWidths[0] + 10,
        y: currentY - 15,
        size: 10,
        font: normalFont,
        color: rgb(0.2, 0.2, 0.2)
      });
      page.drawRectangle({
        x,
        y: currentY - 22,
        width: colWidths[0] + colWidths[1],
        height: 22,
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 0.5
      });
      currentY -= 22;
    }

    return currentY;
  }

  private getRiskLevelText(level: string): string {
    const map: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高',
      critical: '极高'
    };
    return map[level] || level;
  }

  private getRiskColor(level: string): { r: number; g: number; b: number } {
    const map: Record<string, { r: number; g: number; b: number }> = {
      low: { r: 0.2, g: 0.6, b: 0.2 },
      medium: { r: 0.8, g: 0.6, b: 0.1 },
      high: { r: 0.8, g: 0.3, b: 0.1 },
      critical: { r: 0.8, g: 0.1, b: 0.1 }
    };
    return map[level] || { r: 0.4, g: 0.4, b: 0.4 };
  }

  private formatAmount(amount: number): string {
    return (amount / 10000).toFixed(2);
  }

  private getCustomerName(id: string, relatedCustomers: Customer[], currentCustomer: Customer): string {
    if (id === currentCustomer.id) return currentCustomer.name;
    const found = relatedCustomers.find(c => c.id === id);
    return found ? found.name : id;
  }

  private adjustColumnWidth(ws: XLSX.WorkSheet, data: any[]): void {
    if (!data || data.length === 0) return;
    const cols = Object.keys(data[0]);
    ws['!cols'] = cols.map(col => {
      const maxLen = Math.max(
        col.length,
        ...data.map(row => String(row[col] || '').length)
      );
      return { wch: Math.min(maxLen + 2, 50) };
    });
  }

  getReportFilePath(reportId: string): string | null {
    const files = fs.readdirSync(REPORT_DIR);
    const reportFile = files.find(f => f.includes(reportId) || f.includes(reportId.slice(0, 8)));
    return reportFile ? path.join(REPORT_DIR, reportFile) : null;
  }

  getBatchTask(taskId: string): BatchTask | null {
    return creditRepository.getBatchTask(taskId);
  }
}

export const reportService = new ReportService();
