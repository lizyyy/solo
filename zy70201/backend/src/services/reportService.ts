import prisma from '../utils/prisma';
import { AppError } from '../utils/errorHandler';
import * as ExcelJS from 'exceljs';

export interface CreateReportDto {
  taskId: string;
  reporter: string;
  snowThicknessBefore: number;
  snowThicknessAfter: number;
  qualityScore: number;
  issues: string;
  remarks?: string;
}

export const reportService = {
  async getAllReports() {
    return prisma.report.findMany({
      include: { task: { include: { slope: true, vehicle: true } } },
      orderBy: { reportTime: 'desc' }
    });
  },

  async getReportById(id: string) {
    const report = await prisma.report.findUnique({
      where: { id },
      include: { task: { include: { slope: true, vehicle: true } } }
    });
    
    if (!report) {
      throw new AppError('报告不存在', 404);
    }
    
    return report;
  },

  async createReport(data: CreateReportDto) {
    const task = await prisma.task.findUnique({
      where: { id: data.taskId },
      include: { report: true }
    });
    
    if (!task) {
      throw new AppError('任务不存在', 404);
    }
    
    if (task.status !== 'COMPLETED') {
      throw new AppError('只能为已完成的任务创建报告', 400);
    }
    
    if (task.report) {
      throw new AppError('该任务已有作业报告', 400);
    }
    
    if (data.qualityScore < 1 || data.qualityScore > 10) {
      throw new AppError('质量评分必须在1-10之间', 400);
    }
    
    if (!data.reporter || data.reporter.trim().length === 0) {
      throw new AppError('报告人不能为空', 400);
    }
    
    return prisma.report.create({
      data,
      include: { task: { include: { slope: true, vehicle: true } } }
    });
  },

  async approveReport(reportId: string, approver: string) {
    const report = await prisma.report.findUnique({
      where: { id: reportId }
    });
    
    if (!report) {
      throw new AppError('报告不存在', 404);
    }
    
    if (report.isApproved) {
      throw new AppError('报告已经审核过了', 400);
    }
    
    if (!approver || approver.trim().length === 0) {
      throw new AppError('审核人不能为空', 400);
    }
    
    return prisma.report.update({
      where: { id: reportId },
      data: {
        isApproved: true,
        approver,
        approveTime: new Date()
      },
      include: { task: { include: { slope: true, vehicle: true } } }
    });
  },

  async exportReports(format: 'json' | 'excel', startDate?: string, endDate?: string) {
    const where: any = {};
    
    if (startDate || endDate) {
      where.reportTime = {};
      if (startDate) where.reportTime.gte = new Date(startDate);
      if (endDate) where.reportTime.lte = new Date(endDate);
    }
    
    const reports = await prisma.report.findMany({
      where,
      include: { task: { include: { slope: true, vehicle: true } } },
      orderBy: { reportTime: 'desc' }
    });
    
    if (format === 'json') {
      return reports;
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('作业报告');
    
    worksheet.columns = [
      { header: '报告ID', key: 'id', width: 36 },
      { header: '雪道名称', key: 'slopeName', width: 20 },
      { header: '车辆名称', key: 'vehicleName', width: 20 },
      { header: '报告人', key: 'reporter', width: 15 },
      { header: '报告时间', key: 'reportTime', width: 20 },
      { header: '作业前厚度', key: 'snowThicknessBefore', width: 12 },
      { header: '作业后厚度', key: 'snowThicknessAfter', width: 12 },
      { header: '质量评分', key: 'qualityScore', width: 10 },
      { header: '遇到的问题', key: 'issues', width: 40 },
      { header: '备注', key: 'remarks', width: 40 },
      { header: '审核状态', key: 'isApproved', width: 10 },
      { header: '审核人', key: 'approver', width: 15 }
    ];
    
    reports.forEach(report => {
      worksheet.addRow({
        id: report.id,
        slopeName: report.task?.slope?.name,
        vehicleName: report.task?.vehicle?.name || '',
        reporter: report.reporter,
        reportTime: report.reportTime.toISOString(),
        snowThicknessBefore: report.snowThicknessBefore,
        snowThicknessAfter: report.snowThicknessAfter,
        qualityScore: report.qualityScore,
        issues: report.issues,
        remarks: report.remarks || '',
        isApproved: report.isApproved ? '已审核' : '待审核',
        approver: report.approver || ''
      });
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
};
