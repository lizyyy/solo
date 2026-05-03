import * as fs from 'fs';
import * as path from 'path';
import { ReleasePlan, RollbackReadiness, ValidationResult } from '../types';
import { ensureDirectory } from '../utils/file-utils';

/**
 * 导出器
 * 支持导出 Markdown/HTML/JSON 格式
 */
export class Exporter {
  private outputDirectory: string;

  constructor(outputDirectory: string) {
    this.outputDirectory = outputDirectory;
    ensureDirectory(outputDirectory);
  }

  /**
   * 导出发布计划到所有格式
   */
  exportReleasePlan(
    plan: ReleasePlan,
    formats: ('json' | 'markdown' | 'html')[] = ['json', 'markdown', 'html']
  ): string[] {
    const exportedFiles: string[] = [];
    const baseName = `release-plan-v${plan.version}`;

    if (formats.includes('json')) {
      const filePath = path.join(this.outputDirectory, `${baseName}.json`);
      this.exportToJson(plan, filePath);
      exportedFiles.push(filePath);
    }

    if (formats.includes('markdown')) {
      const filePath = path.join(this.outputDirectory, `${baseName}.md`);
      this.exportToMarkdown(plan, filePath);
      exportedFiles.push(filePath);
    }

    if (formats.includes('html')) {
      const filePath = path.join(this.outputDirectory, `${baseName}.html`);
      this.exportToHtml(plan, filePath);
      exportedFiles.push(filePath);
    }

    return exportedFiles;
  }

  /**
   * 导出回滚核对清单
   */
  exportRollbackChecklist(
    readiness: RollbackReadiness,
    version: string,
    formats: ('json' | 'markdown' | 'html')[] = ['json', 'markdown', 'html']
  ): string[] {
    const exportedFiles: string[] = [];
    const baseName = `rollback-checklist-v${version}`;

    if (formats.includes('json')) {
      const filePath = path.join(this.outputDirectory, `${baseName}.json`);
      this.exportToJson(readiness, filePath);
      exportedFiles.push(filePath);
    }

    if (formats.includes('markdown')) {
      const filePath = path.join(this.outputDirectory, `${baseName}.md`);
      this.exportRollbackToMarkdown(readiness, version, filePath);
      exportedFiles.push(filePath);
    }

    if (formats.includes('html')) {
      const filePath = path.join(this.outputDirectory, `${baseName}.html`);
      this.exportRollbackToHtml(readiness, version, filePath);
      exportedFiles.push(filePath);
    }

    return exportedFiles;
  }

  /**
   * 导出校验结果
   */
  exportValidationResult(
    result: ValidationResult,
    version: string,
    formats: ('json' | 'markdown' | 'html')[] = ['json', 'markdown']
  ): string[] {
    const exportedFiles: string[] = [];
    const baseName = `validation-result-v${version}`;

    if (formats.includes('json')) {
      const filePath = path.join(this.outputDirectory, `${baseName}.json`);
      this.exportToJson(result, filePath);
      exportedFiles.push(filePath);
    }

    if (formats.includes('markdown')) {
      const filePath = path.join(this.outputDirectory, `${baseName}.md`);
      this.exportValidationToMarkdown(result, version, filePath);
      exportedFiles.push(filePath);
    }

    return exportedFiles;
  }

  /**
   * 导出为JSON
   */
  private exportToJson<T>(data: T, filePath: string): void {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * 导出为Markdown
   */
  private exportToMarkdown(plan: ReleasePlan, filePath: string): void {
    const markdown = this.generateMarkdown(plan);
    fs.writeFileSync(filePath, markdown, 'utf-8');
  }

  /**
   * 导出为HTML
   */
  private exportToHtml(plan: ReleasePlan, filePath: string): void {
    const html = this.generateHtml(plan);
    fs.writeFileSync(filePath, html, 'utf-8');
  }

  /**
   * 生成Markdown内容
   */
  private generateMarkdown(plan: ReleasePlan): string {
    const lines: string[] = [];

    // 标题
    lines.push(`# 发布计划 - v${plan.version}`);
    lines.push('');
    lines.push(`**日期**: ${plan.date}`);
    lines.push('');
    lines.push(`## 摘要`);
    lines.push('');
    lines.push(plan.summary);
    lines.push('');

    // 风险评估
    lines.push(`## 风险评估`);
    lines.push('');
    const riskColor = this.getRiskBadge(plan.analysis.riskAssessment.overallRisk);
    lines.push(`**整体风险等级**: ${riskColor}`);
    lines.push('');

    if (plan.analysis.riskAssessment.riskFactors.length > 0) {
      lines.push('### 风险因素');
      lines.push('');
      lines.push('| 类别 | 描述 | 可能性 | 影响 | 分数 |');
      lines.push('|------|------|--------|------|------|');
      plan.analysis.riskAssessment.riskFactors.forEach(factor => {
        lines.push(`| ${factor.category} | ${factor.description} | ${factor.likelihood.toUpperCase()} | ${factor.impact.toUpperCase()} | ${factor.score} |`);
      });
      lines.push('');
    }

    if (plan.analysis.riskAssessment.mitigationPlan.length > 0) {
      lines.push('### 缓解计划');
      lines.push('');
      plan.analysis.riskAssessment.mitigationPlan.forEach((step, index) => {
        lines.push(`${index + 1}. ${step}`);
      });
      lines.push('');
    }

    // 破坏性变更
    if (plan.analysis.breakingChanges.length > 0) {
      lines.push(`## ⚠️ 破坏性变更`);
      lines.push('');
      plan.analysis.breakingChanges.forEach((change, index) => {
        lines.push(`### ${index + 1}. [${change.type.toUpperCase()}] ${change.description}`);
        lines.push('');
        lines.push(`- **严重程度**: ${change.severity.toUpperCase()}`);
        lines.push(`- **影响区域**: ${change.affectedAreas.join(', ')}`);
        if (change.mitigation) {
          lines.push(`- **缓解措施**: ${change.mitigation}`);
        }
        lines.push('');
      });
    }

    // 影响分析
    lines.push(`## 影响分析`);
    lines.push('');
    lines.push(`- **需要停机**: ${plan.analysis.impactAnalysis.downtimeRequired ? '是' : '否'}`);
    if (plan.analysis.impactAnalysis.downtimeEstimate) {
      lines.push(`- **预计停机时间**: ${plan.analysis.impactAnalysis.downtimeEstimate}`);
    }
    lines.push('');

    if (plan.analysis.impactAnalysis.affectedCustomers.length > 0) {
      lines.push('### 受影响客户');
      lines.push('');
      plan.analysis.impactAnalysis.affectedCustomers.forEach(customer => {
        lines.push(`- ${customer}`);
      });
      lines.push('');
    }

    if (plan.analysis.impactAnalysis.affectedModules.length > 0) {
      lines.push('### 受影响模块');
      lines.push('');
      plan.analysis.impactAnalysis.affectedModules.forEach(module => {
        lines.push(`- ${module}`);
      });
      lines.push('');
    }

    if (plan.analysis.impactAnalysis.dependentServices.length > 0) {
      lines.push('### 依赖服务');
      lines.push('');
      plan.analysis.impactAnalysis.dependentServices.forEach(service => {
        lines.push(`- ${service}`);
      });
      lines.push('');
    }

    // 负责人责任
    if (plan.analysis.ownerResponsibility.length > 0) {
      lines.push(`## 负责人职责`);
      lines.push('');
      plan.analysis.ownerResponsibility.forEach(owner => {
        lines.push(`### ${owner.owner}`);
        lines.push('');
        if (owner.modules.length > 0) lines.push(`- **模块**: ${owner.modules.join(', ')}`);
        if (owner.issues.length > 0) lines.push(`- **Issue**: ${owner.issues.length} 个`);
        if (owner.commits.length > 0) lines.push(`- **提交**: ${owner.commits.length} 条`);
        if (owner.migrations.length > 0) lines.push(`- **迁移**: ${owner.migrations.length} 个`);
        lines.push('');
      });
    }

    // 回滚准备状态
    lines.push(`## 回滚准备状态`);
    lines.push('');
    const readinessStatus = plan.analysis.rollbackReadiness.isReady ? '✅ 已准备就绪' : '⚠️ 未准备就绪';
    lines.push(`**状态**: ${readinessStatus}`);
    lines.push('');

    if (plan.analysis.rollbackReadiness.missingRollbackPlans.length > 0) {
      lines.push('### ❌ 缺失回滚计划');
      lines.push('');
      plan.analysis.rollbackReadiness.missingRollbackPlans.forEach(missing => {
        lines.push(`- [${missing.type.toUpperCase()}] ${missing.description}`);
        lines.push(`  - 建议: ${missing.suggestedAction}`);
      });
      lines.push('');
    }

    if (plan.analysis.rollbackReadiness.rollbackChecklist.length > 0) {
      lines.push('### 📋 回滚核对清单');
      lines.push('');
      
      const grouped: Record<string, typeof plan.analysis.rollbackReadiness.rollbackChecklist> = {};
      plan.analysis.rollbackReadiness.rollbackChecklist.forEach(item => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
      });

      Object.entries(grouped).forEach(([category, items]) => {
        lines.push(`#### ${category}`);
        lines.push('');
        items.forEach((item, index) => {
          const status = item.completed ? '✅' : '⬜';
          const required = item.status === 'required' ? '[必需]' : item.status === 'optional' ? '[可选]' : '[不适用]';
          lines.push(`${index + 1}. ${status} ${required} ${item.task}`);
          if (item.notes) {
            lines.push(`   - 备注: ${item.notes}`);
          }
        });
        lines.push('');
      });
    }

    // 详细变更清单
    lines.push(`## 详细变更清单`);
    lines.push('');

    // 提交记录
    if (plan.commits.length > 0) {
      lines.push('### 提交记录');
      lines.push('');
      lines.push('| ID | 消息 | 作者 | 模块 | 关联Issue | 破坏性 |');
      lines.push('|----|------|------|------|-----------|--------|');
      plan.commits.forEach(commit => {
        lines.push(`| ${commit.id} | ${this.escapeMarkdown(commit.message.substring(0, 50))}... | ${commit.author} | ${commit.module} | ${commit.relatedIssues.length} | ${commit.isBreaking ? '⚠️ 是' : '否'} |`);
      });
      lines.push('');
    }

    // Issue
    if (plan.issues.length > 0) {
      lines.push('### Issue');
      lines.push('');
      lines.push('| ID | 标题 | 优先级 | 负责人 | 模块 | 关联提交 | 有回滚计划 |');
      lines.push('|----|------|--------|--------|------|----------|------------|');
      plan.issues.forEach(issue => {
        lines.push(`| ${issue.id} | ${this.escapeMarkdown(issue.title.substring(0, 40))}... | ${issue.priority.toUpperCase()} | ${issue.assignee || '-'} | ${issue.module} | ${issue.relatedCommits.length} | ${issue.hasRollbackPlan ? '✅' : '❌'} |`);
      });
      lines.push('');
    }

    // 数据库迁移
    if (plan.migrations.length > 0) {
      lines.push('### 数据库迁移');
      lines.push('');
      lines.push('| ID | 文件名 | 描述 | 模块 | 破坏性 | 有回滚脚本 |');
      lines.push('|----|--------|------|------|--------|------------|');
      plan.migrations.forEach(migration => {
        lines.push(`| ${migration.id} | ${migration.filename} | ${this.escapeMarkdown(migration.description.substring(0, 40))}... | ${migration.module} | ${migration.isBreaking ? '⚠️ 是' : '否'} | ${migration.rollbackScript ? '✅' : '❌'} |`);
      });
      lines.push('');
    }

    // 配置变更
    if (plan.configChanges.length > 0) {
      lines.push('### 配置变更');
      lines.push('');
      lines.push('| Key | 旧值 | 新值 | 环境 | 必需 | 有回滚操作 |');
      lines.push('|-----|------|------|------|------|------------|');
      plan.configChanges.forEach(config => {
        lines.push(`| ${config.key} | ${this.escapeMarkdown(config.oldValue.substring(0, 20))}... | ${this.escapeMarkdown(config.newValue.substring(0, 20))}... | ${config.environment} | ${config.isRequired ? '是' : '否'} | ${config.rollbackAction ? '✅' : '❌'} |`);
      });
      lines.push('');
    }

    // 页脚
    lines.push('---');
    lines.push('');
    lines.push(`*文档生成时间: ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  /**
   * 生成HTML内容
   */
  private generateHtml(plan: ReleasePlan): string {
    // 先生成Markdown，然后可以用marked转换，这里简单生成HTML
    const markdown = this.generateMarkdown(plan);
    
    const htmlTemplate = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>发布计划 - v${plan.version}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1, h2, h3, h4 {
      color: #2c3e50;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    h1 {
      border-bottom-color: #3498db;
      color: #3498db;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    th {
      background-color: #f8f9fa;
      font-weight: 600;
    }
    tr:hover {
      background-color: #f8f9fa;
    }
    .risk-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-weight: 600;
    }
    .risk-critical { background-color: #dc3545; color: white; }
    .risk-high { background-color: #fd7e14; color: white; }
    .risk-medium { background-color: #ffc107; color: #333; }
    .risk-low { background-color: #28a745; color: white; }
    .warning-box {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
    }
    .success-box {
      background-color: #d4edda;
      border-left: 4px solid #28a745;
      padding: 15px;
      margin: 20px 0;
    }
    .danger-box {
      background-color: #f8d7da;
      border-left: 4px solid #dc3545;
      padding: 15px;
      margin: 20px 0;
    }
    .checklist-item {
      margin: 10px 0;
    }
    .checklist-required { color: #dc3545; }
    .checklist-optional { color: #6c757d; }
    pre {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
    }
    code {
      background-color: #f8f9fa;
      padding: 2px 6px;
      border-radius: 3px;
    }
    hr {
      border: none;
      border-top: 1px solid #eee;
      margin: 40px 0;
    }
    .footer {
      text-align: center;
      color: #6c757d;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>发布计划 - v${plan.version}</h1>
    <p><strong>日期:</strong> ${plan.date}</p>
    
    <h2>摘要</h2>
    <p>${plan.summary}</p>
    
    <h2>风险评估</h2>
    <p><strong>整体风险等级:</strong> <span class="risk-badge risk-${plan.analysis.riskAssessment.overallRisk}">${plan.analysis.riskAssessment.overallRisk.toUpperCase()}</span></p>
    
    ${this.generateHtmlRiskFactors(plan)}
    ${this.generateHtmlBreakingChanges(plan)}
    ${this.generateHtmlImpactAnalysis(plan)}
    ${this.generateHtmlOwnerResponsibility(plan)}
    ${this.generateHtmlRollbackReadiness(plan)}
    ${this.generateHtmlDetailedChanges(plan)}
    
    <hr>
    <div class="footer">
      <p>文档生成时间: ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>`;

    return htmlTemplate;
  }

  /**
   * 生成风险因素HTML
   */
  private generateHtmlRiskFactors(plan: ReleasePlan): string {
    if (plan.analysis.riskAssessment.riskFactors.length === 0) return '';
    
    let html = '<h3>风险因素</h3>';
    html += '<table><tr><th>类别</th><th>描述</th><th>可能性</th><th>影响</th><th>分数</th></tr>';
    
    plan.analysis.riskAssessment.riskFactors.forEach(factor => {
      html += `<tr><td>${factor.category}</td><td>${factor.description}</td><td>${factor.likelihood.toUpperCase()}</td><td>${factor.impact.toUpperCase()}</td><td>${factor.score}</td></tr>`;
    });
    
    html += '</table>';
    
    if (plan.analysis.riskAssessment.mitigationPlan.length > 0) {
      html += '<h3>缓解计划</h3><ol>';
      plan.analysis.riskAssessment.mitigationPlan.forEach(step => {
        html += `<li>${step}</li>`;
      });
      html += '</ol>';
    }
    
    return html;
  }

  /**
   * 生成破坏性变更HTML
   */
  private generateHtmlBreakingChanges(plan: ReleasePlan): string {
    if (plan.analysis.breakingChanges.length === 0) return '';
    
    let html = '<h2>⚠️ 破坏性变更</h2>';
    
    plan.analysis.breakingChanges.forEach((change, index) => {
      html += `<div class="danger-box">
        <h3>${index + 1}. [${change.type.toUpperCase()}] ${change.description}</h3>
        <p><strong>严重程度:</strong> <span class="risk-badge risk-${change.severity}">${change.severity.toUpperCase()}</span></p>
        <p><strong>影响区域:</strong> ${change.affectedAreas.join(', ')}</p>
        ${change.mitigation ? `<p><strong>缓解措施:</strong> ${change.mitigation}</p>` : ''}
      </div>`;
    });
    
    return html;
  }

  /**
   * 生成影响分析HTML
   */
  private generateHtmlImpactAnalysis(plan: ReleasePlan): string {
    let html = '<h2>影响分析</h2>';
    html += `<p><strong>需要停机:</strong> ${plan.analysis.impactAnalysis.downtimeRequired ? '是' : '否'}</p>`;
    
    if (plan.analysis.impactAnalysis.downtimeEstimate) {
      html += `<p><strong>预计停机时间:</strong> ${plan.analysis.impactAnalysis.downtimeEstimate}</p>`;
    }
    
    if (plan.analysis.impactAnalysis.affectedCustomers.length > 0) {
      html += '<h3>受影响客户</h3><ul>';
      plan.analysis.impactAnalysis.affectedCustomers.forEach(customer => {
        html += `<li>${customer}</li>`;
      });
      html += '</ul>';
    }
    
    if (plan.analysis.impactAnalysis.affectedModules.length > 0) {
      html += '<h3>受影响模块</h3><ul>';
      plan.analysis.impactAnalysis.affectedModules.forEach(module => {
        html += `<li>${module}</li>`;
      });
      html += '</ul>';
    }
    
    return html;
  }

  /**
   * 生成负责人责任HTML
   */
  private generateHtmlOwnerResponsibility(plan: ReleasePlan): string {
    if (plan.analysis.ownerResponsibility.length === 0) return '';
    
    let html = '<h2>负责人职责</h2>';
    
    plan.analysis.ownerResponsibility.forEach(owner => {
      html += `<h3>${owner.owner}</h3><ul>`;
      if (owner.modules.length > 0) html += `<li><strong>模块:</strong> ${owner.modules.join(', ')}</li>`;
      if (owner.issues.length > 0) html += `<li><strong>Issue:</strong> ${owner.issues.length} 个</li>`;
      if (owner.commits.length > 0) html += `<li><strong>提交:</strong> ${owner.commits.length} 条</li>`;
      if (owner.migrations.length > 0) html += `<li><strong>迁移:</strong> ${owner.migrations.length} 个</li>`;
      html += '</ul>';
    });
    
    return html;
  }

  /**
   * 生成回滚准备状态HTML
   */
  private generateHtmlRollbackReadiness(plan: ReleasePlan): string {
    let html = '<h2>回滚准备状态</h2>';
    
    const boxClass = plan.analysis.rollbackReadiness.isReady ? 'success-box' : 'warning-box';
    const statusText = plan.analysis.rollbackReadiness.isReady ? '✅ 已准备就绪' : '⚠️ 未准备就绪';
    html += `<div class="${boxClass}"><strong>状态:</strong> ${statusText}</div>`;
    
    if (plan.analysis.rollbackReadiness.missingRollbackPlans.length > 0) {
      html += '<h3>❌ 缺失回滚计划</h3>';
      plan.analysis.rollbackReadiness.missingRollbackPlans.forEach(missing => {
        html += `<div class="danger-box">
          <strong>[${missing.type.toUpperCase()}]</strong> ${missing.description}<br>
          <em>建议:</em> ${missing.suggestedAction}
        </div>`;
      });
    }
    
    if (plan.analysis.rollbackReadiness.rollbackChecklist.length > 0) {
      html += '<h3>📋 回滚核对清单</h3>';
      
      const grouped: Record<string, typeof plan.analysis.rollbackReadiness.rollbackChecklist> = {};
      plan.analysis.rollbackReadiness.rollbackChecklist.forEach(item => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
      });

      Object.entries(grouped).forEach(([category, items]) => {
        html += `<h4>${category}</h4>`;
        items.forEach((item, index) => {
          const status = item.completed ? '✅' : '⬜';
          const requiredClass = item.status === 'required' ? 'checklist-required' : 'checklist-optional';
          const requiredText = item.status === 'required' ? '[必需]' : item.status === 'optional' ? '[可选]' : '[不适用]';
          html += `<div class="checklist-item">
            ${status} <span class="${requiredClass}">${requiredText}</span> ${index + 1}. ${item.task}
            ${item.notes ? `<br><em>备注: ${item.notes}</em>` : ''}
          </div>`;
        });
      });
    }
    
    return html;
  }

  /**
   * 生成详细变更HTML
   */
  private generateHtmlDetailedChanges(plan: ReleasePlan): string {
    let html = '<h2>详细变更清单</h2>';
    
    if (plan.commits.length > 0) {
      html += '<h3>提交记录</h3><table><tr><th>ID</th><th>消息</th><th>作者</th><th>模块</th><th>关联Issue</th><th>破坏性</th></tr>';
      plan.commits.forEach(commit => {
        html += `<tr><td>${commit.id}</td><td>${commit.message.substring(0, 50)}...</td><td>${commit.author}</td><td>${commit.module}</td><td>${commit.relatedIssues.length}</td><td>${commit.isBreaking ? '⚠️ 是' : '否'}</td></tr>`;
      });
      html += '</table>';
    }
    
    if (plan.issues.length > 0) {
      html += '<h3>Issue</h3><table><tr><th>ID</th><th>标题</th><th>优先级</th><th>负责人</th><th>模块</th><th>关联提交</th><th>有回滚计划</th></tr>';
      plan.issues.forEach(issue => {
        html += `<tr><td>${issue.id}</td><td>${issue.title.substring(0, 40)}...</td><td>${issue.priority.toUpperCase()}</td><td>${issue.assignee || '-'}</td><td>${issue.module}</td><td>${issue.relatedCommits.length}</td><td>${issue.hasRollbackPlan ? '✅' : '❌'}</td></tr>`;
      });
      html += '</table>';
    }
    
    if (plan.migrations.length > 0) {
      html += '<h3>数据库迁移</h3><table><tr><th>ID</th><th>文件名</th><th>描述</th><th>模块</th><th>破坏性</th><th>有回滚脚本</th></tr>';
      plan.migrations.forEach(migration => {
        html += `<tr><td>${migration.id}</td><td>${migration.filename}</td><td>${migration.description.substring(0, 40)}...</td><td>${migration.module}</td><td>${migration.isBreaking ? '⚠️ 是' : '否'}</td><td>${migration.rollbackScript ? '✅' : '❌'}</td></tr>`;
      });
      html += '</table>';
    }
    
    if (plan.configChanges.length > 0) {
      html += '<h3>配置变更</h3><table><tr><th>Key</th><th>旧值</th><th>新值</th><th>环境</th><th>必需</th><th>有回滚操作</th></tr>';
      plan.configChanges.forEach(config => {
        html += `<tr><td>${config.key}</td><td>${config.oldValue.substring(0, 20)}...</td><td>${config.newValue.substring(0, 20)}...</td><td>${config.environment}</td><td>${config.isRequired ? '是' : '否'}</td><td>${config.rollbackAction ? '✅' : '❌'}</td></tr>`;
      });
      html += '</table>';
    }
    
    return html;
  }

  /**
   * 导出回滚核对清单到Markdown
   */
  private exportRollbackToMarkdown(readiness: RollbackReadiness, version: string, filePath: string): void {
    const lines: string[] = [];
    
    lines.push(`# 回滚核对清单 - v${version}`);
    lines.push('');
    lines.push(`**状态**: ${readiness.isReady ? '✅ 已准备就绪' : '⚠️ 未准备就绪'}`);
    lines.push('');

    if (readiness.missingRollbackPlans.length > 0) {
      lines.push('## ❌ 缺失回滚计划');
      lines.push('');
      readiness.missingRollbackPlans.forEach(missing => {
        lines.push(`### [${missing.type.toUpperCase()}] ${missing.description}`);
        lines.push('');
        lines.push(`**建议**: ${missing.suggestedAction}`);
        lines.push('');
      });
    }

    if (readiness.rollbackChecklist.length > 0) {
      lines.push('## 📋 回滚步骤');
      lines.push('');
      
      const grouped: Record<string, typeof readiness.rollbackChecklist> = {};
      readiness.rollbackChecklist.forEach(item => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
      });

      Object.entries(grouped).forEach(([category, items]) => {
        lines.push(`### ${category}`);
        lines.push('');
        items.forEach((item, index) => {
          const status = item.completed ? '[x]' : '[ ]';
          const required = item.status === 'required' ? '**[必需]**' : item.status === 'optional' ? '[可选]' : '[不适用]';
          lines.push(`${status} ${required} ${index + 1}. ${item.task}`);
          if (item.notes) {
            lines.push(`   *备注: ${item.notes}*`);
          }
          lines.push('');
        });
      });
    }

    lines.push('---');
    lines.push('');
    lines.push(`*生成时间: ${new Date().toISOString()}*`);

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }

  /**
   * 导出回滚核对清单到HTML
   */
  private exportRollbackToHtml(readiness: RollbackReadiness, version: string, filePath: string): void {
    // 简单实现，可以更完善
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>回滚核对清单 - v${version}</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .success { color: #28a745; }
    .warning { color: #ffc107; }
    .danger { color: #dc3545; }
    .checklist-item { margin: 10px 0; }
    .completed { text-decoration: line-through; opacity: 0.6; }
  </style>
</head>
<body>
  <h1>回滚核对清单 - v${version}</h1>
  <p><strong>状态:</strong> <span class="${readiness.isReady ? 'success' : 'warning'}">${readiness.isReady ? '✅ 已准备就绪' : '⚠️ 未准备就绪'}</span></p>
  
  ${readiness.missingRollbackPlans.length > 0 ? '<h2>❌ 缺失回滚计划</h2>' + readiness.missingRollbackPlans.map(m => 
    `<div class="danger"><strong>[${m.type.toUpperCase()}]</strong> ${m.description}<br><em>建议: ${m.suggestedAction}</em></div>`
  ).join('') : ''}
  
  <h2>📋 回滚步骤</h2>
  ${readiness.rollbackChecklist.map(item => `
    <div class="checklist-item ${item.completed ? 'completed' : ''}">
      <input type="checkbox" ${item.completed ? 'checked' : ''} disabled>
      ${item.status === 'required' ? '<strong>[必需]</strong>' : '[可选]'}
      ${item.task}
      ${item.notes ? `<br><em>${item.notes}</em>` : ''}
    </div>
  `).join('')}
</body>
</html>`;
    
    fs.writeFileSync(filePath, html, 'utf-8');
  }

  /**
   * 导出校验结果到Markdown
   */
  private exportValidationToMarkdown(result: ValidationResult, version: string, filePath: string): void {
    const lines: string[] = [];
    
    lines.push(`# 校验结果 - v${version}`);
    lines.push('');
    lines.push(`**整体状态**: ${result.valid ? '✅ 通过' : '❌ 失败'}`);
    lines.push('');

    if (result.errors.length > 0) {
      lines.push('## ❌ 错误');
      lines.push('');
      result.errors.forEach(error => {
        const severity = error.severity === 'critical' ? '**[严重]**' : '[错误]';
        lines.push(`${severity} [${error.field}] ${error.message}`);
        lines.push('');
      });
    }

    if (result.warnings.length > 0) {
      lines.push('## ⚠️ 警告');
      lines.push('');
      result.warnings.forEach(warning => {
        lines.push(`[${warning.field}] ${warning.message}`);
        lines.push('');
      });
    }

    if (result.info.length > 0) {
      lines.push('## ℹ️ 信息');
      lines.push('');
      result.info.forEach(info => {
        lines.push(`[${info.field}] ${info.message}`);
        lines.push('');
      });
    }

    lines.push('---');
    lines.push('');
    lines.push(`*校验时间: ${new Date().toISOString()}*`);

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }

  /**
   * 获取风险徽章文本
   */
  private getRiskBadge(risk: string): string {
    const badges: Record<string, string> = {
      'critical': '🔴 CRITICAL',
      'high': '🟠 HIGH',
      'medium': '🟡 MEDIUM',
      'low': '🟢 LOW'
    };
    return badges[risk.toLowerCase()] || risk.toUpperCase();
  }

  /**
   * 转义Markdown特殊字符
   */
  private escapeMarkdown(text: string): string {
    return text
      .replace(/\|/g, '\\|')
      .replace(/\n/g, ' ')
      .replace(/\r/g, '');
  }
}
