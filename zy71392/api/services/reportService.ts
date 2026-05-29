import reportRepository from '../repositories/reportRepository.js';
import scriptRepository from '../repositories/scriptRepository.js';
import permissionService from './permissionService.js';
import riskService from './riskService.js';
import activityRepository from '../repositories/activityRepository.js';
import type { ReportItemCategory } from '../types/index.js';

class ReportService {
  generateReport(scriptIds: number[], title: string): { report_id: number } {
    const report = reportRepository.create(title || `审计报告 ${new Date().toLocaleDateString('zh-CN')}`);

    const targetIds = scriptIds.length > 0 ? scriptIds : scriptRepository.list().map(s => s.id);

    for (const scriptId of targetIds) {
      const script = scriptRepository.getById(scriptId);
      if (!script) continue;

      const diff = permissionService.getPermissionDiff(scriptId);

      [...diff.removed, ...diff.added].forEach(p => {
        reportRepository.addItem({
          report_id: report.id,
          script_id: scriptId,
          category: 'permission_change' as ReportItemCategory,
          content_json: JSON.stringify({
            script_name: script.name,
            service: p.service,
            action: p.action,
            type: p.type,
            change_type: p.status,
            reason: p.reason,
          }),
          review_status: 'pending',
        });
      });

      const apiCalls = scriptRepository.getApiCalls(scriptId);
      apiCalls.forEach(call => {
        reportRepository.addItem({
          report_id: report.id,
          script_id: scriptId,
          category: 'api_call' as ReportItemCategory,
          content_json: JSON.stringify({
            script_name: script.name,
            service: call.service,
            action: call.action,
            source: call.source,
            line_number: call.line_number,
            context: call.context,
          }),
          review_status: 'pending',
        });
      });
    }

    const risks = [
      ...riskService.getDynamicMissRisks(),
      ...riskService.getWildcardRisks(),
      ...riskService.getExceptionLongRisks(),
    ];

    risks.forEach(r => {
      if (r.script_id && targetIds.includes(r.script_id)) {
        reportRepository.addItem({
          report_id: report.id,
          script_id: r.script_id,
          category: 'risk_item' as ReportItemCategory,
          content_json: JSON.stringify({
            script_name: r.script_name,
            risk_type: r.type,
            reason: r.reason,
            impact: r.impact,
            next_action: r.next_action,
            score: r.score,
          }),
          review_status: 'pending',
        });
      }
    });

    activityRepository.create('report_generate', `生成报告: ${report.title}`, { reportId: report.id, scriptCount: targetIds.length });

    return { report_id: report.id };
  }

  exportReport(reportId: number, format: 'json' | 'csv' | 'md'): { content: string; filename: string; contentType: string } {
    const report = reportRepository.getById(reportId);
    if (!report) throw new Error('Report not found');

    const items = reportRepository.getItems(reportId);
    const filename = `report-${reportId}.${format}`;

    if (format === 'json') {
      const content = JSON.stringify({
        report: { id: report.id, title: report.title, status: report.status, created_at: report.created_at },
        items: items.map(i => ({ ...i, content: JSON.parse(i.content_json) })),
      }, null, 2);
      return { content, filename, contentType: 'application/json' };
    }

    if (format === 'csv') {
      const headers = ['类别', '脚本', '内容', '复核状态', '复核备注'];
      const rows = items.map(i => {
        const content = JSON.parse(i.content_json);
        const desc = content.service && content.action ? `${content.service}:${content.action}` :
                      content.reason ? content.reason.slice(0, 50) : '';
        return [i.category, content.script_name || '', desc, i.review_status, i.review_note || ''];
      });
      const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      return { content: csv, filename, contentType: 'text/csv; charset=utf-8' };
    }

    if (format === 'md') {
      const permissionChanges = items.filter(i => i.category === 'permission_change');
      const apiCalls = items.filter(i => i.category === 'api_call');
      const risks = items.filter(i => i.category === 'risk_item');

      const md = [
        `# ${report.title}`,
        '',
        `生成时间: ${report.created_at}`,
        `报告状态: ${report.status}`,
        '',
        '## 1. 权限变更',
        '',
        '| 脚本 | 服务 | 操作 | 变更类型 | 原因 | 复核状态 |',
        '|------|------|------|----------|------|----------|',
        ...permissionChanges.map(i => {
          const c = JSON.parse(i.content_json);
          return `| ${c.script_name} | ${c.service} | ${c.action} | ${c.change_type} | ${c.reason || ''} | ${i.review_status} |`;
        }),
        '',
        '## 2. API调用识别',
        '',
        '| 脚本 | 服务 | 操作 | 来源 | 行号 | 上下文 |',
        '|------|------|------|------|------|--------|',
        ...apiCalls.map(i => {
          const c = JSON.parse(i.content_json);
          return `| ${c.script_name} | ${c.service} | ${c.action} | ${c.source} | ${c.line_number || ''} | ${c.context || ''} |`;
        }),
        '',
        '## 3. 风险项',
        '',
        '| 脚本 | 风险类型 | 原因 | 影响 | 下一步 | 评分 |',
        '|------|----------|------|------|--------|------|',
        ...risks.map(i => {
          const c = JSON.parse(i.content_json);
          return `| ${c.script_name} | ${c.risk_type} | ${c.reason} | ${c.impact} | ${c.next_action} | ${c.score} |`;
        }),
        '',
        '---',
        '本报告由脚本权限最小化平台自动生成',
      ].join('\n');

      return { content: md, filename, contentType: 'text/markdown; charset=utf-8' };
    }

    return { content: '', filename, contentType: 'text/plain' };
  }
}

export default new ReportService();
