import prisma from '../prisma';
import { AppError } from '../middleware/errorHandler';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';

export interface GenerateDiffReportDTO {
  configKey: string;
  baseVersion: number;
  targetVersion: number;
  generatedBy?: string;
}

export class DiffReportService {
  async generateReport(dto: GenerateDiffReportDTO) {
    const baseConfig = await prisma.configItem.findFirst({
      where: { key: dto.configKey, version: dto.baseVersion },
    });

    const targetConfig = await prisma.configItem.findFirst({
      where: { key: dto.configKey, version: dto.targetVersion },
    });

    if (!baseConfig || !targetConfig) {
      throw new AppError('指定版本的配置不存在', 404);
    }

    const diffContent = this.calculateDiff(
      baseConfig.value,
      targetConfig.value
    );

    const latestConfig = await prisma.configItem.findFirst({
      where: { key: dto.configKey },
      orderBy: { version: 'desc' },
    });

    const affectedInstances = await prisma.effectiveState.count({
      where: {
        configId: latestConfig!.id,
        currentVersion: { lt: dto.targetVersion },
      },
    });

    const report = await prisma.diffReport.create({
      data: {
        configId: latestConfig!.id,
        baseVersion: dto.baseVersion,
        targetVersion: dto.targetVersion,
        diffContent: JSON.stringify(diffContent),
        affectedInstances,
        generatedBy: dto.generatedBy,
      },
      include: { configItem: true },
    });

    return report;
  }

  private calculateDiff(oldValue: string, newValue: string) {
    return {
      old: oldValue,
      new: newValue,
      changed: oldValue !== newValue,
      changes: [
        {
          field: 'value',
          oldValue,
          newValue,
        },
      ],
    };
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    configId?: string;
  }) {
    const { page = 1, pageSize = 20, configId } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (configId) where.configId = configId;

    const [reports, total] = await Promise.all([
      prisma.diffReport.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { generatedAt: 'desc' },
        include: { configItem: { select: { key: true } } },
      }),
      prisma.diffReport.count({ where }),
    ]);

    return {
      reports,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findById(id: string) {
    const report = await prisma.diffReport.findUnique({
      where: { id },
      include: { configItem: true },
    });

    if (!report) {
      throw new AppError('差异报告不存在', 404);
    }

    return report;
  }

  async getConfigVersions(configKey: string) {
    const configs = await prisma.configItem.findMany({
      where: { key: configKey },
      select: { version: true, id: true },
      orderBy: { version: 'asc' },
    });

    return configs.map(c => c.version);
  }

  async exportToCSV(reportId: string) {
    const report = await this.findById(reportId);

    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, `diff-report-${reportId}.csv`);

    const diffContent = JSON.parse(report.diffContent);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'configKey', title: '配置项' },
        { id: 'baseVersion', title: '基准版本' },
        { id: 'targetVersion', title: '目标版本' },
        { id: 'oldValue', title: '旧值' },
        { id: 'newValue', title: '新值' },
        { id: 'affectedInstances', title: '受影响实例数' },
        { id: 'generatedAt', title: '生成时间' },
      ],
    });

    await csvWriter.writeRecords([
      {
        configKey: report.configItem.key,
        baseVersion: report.baseVersion,
        targetVersion: report.targetVersion,
        oldValue: diffContent.old,
        newValue: diffContent.new,
        affectedInstances: report.affectedInstances,
        generatedAt: report.generatedAt.toISOString(),
      },
    ]);

    await prisma.diffReport.update({
      where: { id: reportId },
      data: { exportedAt: new Date() },
    });

    return filePath;
  }

  async exportEffectiveStatesCSV(configId: string) {
    const states = await prisma.effectiveState.findMany({
      where: { configId },
      include: { serviceInstance: true },
    });

    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, `effective-states-${configId}.csv`);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'instanceId', title: '实例ID' },
        { id: 'serviceName', title: '服务名' },
        { id: 'ipAddress', title: 'IP地址' },
        { id: 'currentVersion', title: '当前版本' },
        { id: 'effectiveStatus', title: '生效状态' },
        { id: 'compensateStatus', title: '补偿状态' },
        { id: 'lastConfirmedAt', title: '最后确认时间' },
      ],
    });

    await csvWriter.writeRecords(
      states.map((state) => ({
        instanceId: state.serviceInstance.instanceId,
        serviceName: state.serviceInstance.serviceName,
        ipAddress: state.serviceInstance.ipAddress,
        currentVersion: state.currentVersion,
        effectiveStatus: state.effectiveStatus,
        compensateStatus: state.compensateStatus,
        lastConfirmedAt: state.lastConfirmedAt?.toISOString() || '',
      }))
    );

    return filePath;
  }
}

export default new DiffReportService();
