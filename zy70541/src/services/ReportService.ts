import prisma from '../utils/prisma';
import secretService from './SecretService';

export interface LineageReport {
  secret: any;
  references: any[];
  replacement_history: any[];
  access_logs: any[];
  corrections: any[];
  summary: {
    total_references: number;
    active_references: number;
    environments: string[];
    services: string[];
    last_access: Date | null;
    created_at: Date;
  };
}

export class ReportService {
  async generateLineageReport(secretName: string): Promise<LineageReport> {
    const secret = await secretService.getSecretByName(secretName);

    const references = await prisma.reference.findMany({
      where: { secret_id: secret.id },
      orderBy: { created_at: 'desc' },
    });

    const replacements = await prisma.replacementPlan.findMany({
      where: { secret_id: secret.id },
      orderBy: { created_at: 'desc' },
    });

    const accessLogs = await prisma.accessLog.findMany({
      where: { secret_id: secret.id },
      orderBy: { accessed_at: 'desc' },
      take: 100,
    });

    const corrections = await prisma.correctionLog.findMany({
      where: { secret_id: secret.id },
      orderBy: { corrected_at: 'desc' },
    });

    const environments = [...new Set(references.map(r => r.environment))];
    const services = [...new Set(references.map(r => r.service_name))];

    return {
      secret,
      references,
      replacement_history: replacements,
      access_logs: accessLogs,
      corrections,
      summary: {
        total_references: references.length,
        active_references: references.filter(r => r.is_active).length,
        environments,
        services,
        last_access: secret.last_access,
        created_at: secret.created_at,
      },
    };
  }

  async exportReportCSV(secretName: string): Promise<string> {
    const report = await this.generateLineageReport(secretName);

    let csv = '';

    csv += '# Secret基本信息\n';
    csv += '字段,值\n';
    csv += `名称,${report.secret.name}\n`;
    csv += `状态,${report.secret.status}\n`;
    csv += `描述,${report.secret.description || ''}\n`;
    csv += `创建时间,${report.secret.created_at.toISOString()}\n`;
    csv += `最后访问,${report.secret.last_access?.toISOString() || ''}\n\n`;

    csv += '# 引用列表\n';
    csv += '服务名称,环境,文件路径,行号,是否活跃,最后访问,创建时间\n';
    for (const ref of report.references) {
      csv += `${ref.service_name},${ref.environment},${ref.file_path || ''},${ref.line_number || ''},${ref.is_active ? '是' : '否'},${ref.last_access?.toISOString() || ''},${ref.created_at.toISOString()}\n`;
    }
    csv += '\n';

    csv += '# 摘要统计\n';
    csv += '统计项,值\n';
    csv += `总引用数,${report.summary.total_references}\n`;
    csv += `活跃引用数,${report.summary.active_references}\n`;
    csv += `涉及环境,${report.summary.environments.join('; ')}\n`;
    csv += `涉及服务,${report.summary.services.join('; ')}\n`;

    return csv;
  }

  async getAllReports() {
    const secrets = await prisma.secret.findMany({
      include: {
        _count: {
          select: { references: true },
        },
      },
    });

    const reports = [];
    for (const secret of secrets) {
      const references = await prisma.reference.findMany({
        where: { secret_id: secret.id, is_active: true },
      });

      reports.push({
        secret: {
          name: secret.name,
          status: secret.status,
          created_at: secret.created_at,
          last_access: secret.last_access,
        },
        reference_count: secret._count.references,
        active_reference_count: references.length,
        has_active_references: references.length > 0,
        can_delete: references.length === 0 && secret.status === 'PENDING_DELETION',
      });
    }

    return reports;
  }
}

export default new ReportService();
