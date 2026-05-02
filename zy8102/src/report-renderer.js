import fs from 'fs';
import mustache from 'mustache';

export class ReportRenderer {
  static generateCSV(issues, outputPath) {
    const header = ['device', 'page', 'language', 'filename', 'issue_type', 'severity', 'message', 'details'];
    const rows = issues.map(issue => [
      issue.device,
      issue.page,
      issue.language,
      issue.filename || '',
      issue.issue_type,
      issue.severity,
      issue.message,
      issue.details || ''
    ]);

    const csv = [header.join(','), ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))].join('\n');
    fs.writeFileSync(outputPath, csv);
  }

  static generateMarkdown(issues, outputPath) {
    const grouped = {};
    issues.forEach(issue => {
      const key = `${issue.device}-${issue.page}`;
      if (!grouped[key]) {
        grouped[key] = {
          device: issue.device,
          page: issue.page,
          issues: []
        };
      }
      grouped[key].issues.push(issue);
    });

    let markdown = `# 截图本地化遮挡检测报告\n\n`;
    markdown += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    markdown += `问题总数: ${issues.length}\n\n`;

    const severityCounts = {
      critical: issues.filter(i => i.severity === 'critical').length,
      error: issues.filter(i => i.severity === 'error').length,
      warning: issues.filter(i => i.severity === 'warning').length
    };
    markdown += `## 问题严重程度统计\n\n`;
    markdown += `- 严重: ${severityCounts.critical}\n`;
    markdown += `- 错误: ${severityCounts.error}\n`;
    markdown += `- 警告: ${severityCounts.warning}\n\n`;

    markdown += `## 问题详情\n\n`;
    Object.values(grouped).forEach(group => {
      markdown += `### ${group.device} - ${group.page}\n\n`;
      group.issues.forEach((issue, idx) => {
        const severityIcon = issue.severity === 'critical' ? '🔴' : issue.severity === 'error' ? '🟠' : '🟡';
        markdown += `${idx + 1}. ${severityIcon} **${issue.message}**\n`;
        markdown += `   - 语言: ${issue.language}\n`;
        if (issue.filename) markdown += `   - 文件: ${issue.filename}\n`;
        if (issue.details) markdown += `   - 详情: ${issue.details}\n`;
        markdown += '\n';
      });
    });

    fs.writeFileSync(outputPath, markdown);
  }

  static generateHTML(issues, manifest, layoutRules, screenshotsDir, outputPath) {
    const grouped = {};
    manifest.forEach(entry => {
      const key = `${entry.device}-${entry.page}`;
      if (!grouped[key]) {
        grouped[key] = {
          device: entry.device,
          page: entry.page,
          screenshots: [],
          textRegions: layoutRules.text_regions.filter(r => 
            (!r.device || r.device === entry.device) && (!r.page || r.page === entry.page)
          ),
          buttonRegions: layoutRules.button_regions.filter(r => 
            (!r.device || r.device === entry.device) && (!r.page || r.page === entry.page)
          ),
          safeArea: layoutRules.safe_areas[entry.device] || {}
        };
      }
      grouped[key].screenshots.push(entry);
    });

    const template = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>截图本地化遮挡检测预览</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5; }
    .header { margin-bottom: 20px; }
    .header h1 { font-size: 24px; color: #333; }
    .header p { color: #666; margin-top: 5px; }
    .stats { display: flex; gap: 20px; margin-bottom: 20px; }
    .stat { padding: 10px 20px; border-radius: 8px; background: white; }
    .stat.critical { border-left: 4px solid #dc2626; }
    .stat.error { border-left: 4px solid #ea580c; }
    .stat.warning { border-left: 4px solid #ca8a04; }
    .groups { display: grid; gap: 20px; }
    .group { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .group-header { padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .group-header h2 { font-size: 18px; }
    .group-header .device { font-size: 14px; opacity: 0.9; margin-top: 4px; }
    .screenshots { display: flex; gap: 1px; background: #eee; }
    .screenshot-item { flex: 1; min-width: 200px; }
    .screenshot-header { padding: 8px 12px; background: #f8f8f8; border-bottom: 1px solid #eee; }
    .screenshot-header .lang { font-weight: 600; }
    .screenshot-header .filename { font-size: 12px; color: #666; margin-top: 2px; }
    .screenshot-container { position: relative; overflow: hidden; }
    .screenshot-container img { width: 100%; display: block; }
    .overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; }
    .region { position: absolute; border: 2px solid rgba(239, 68, 68, 0.6); background: rgba(239, 68, 68, 0.1); }
    .region.text { border-color: rgba(59, 130, 246, 0.6); background: rgba(59, 130, 246, 0.1); }
    .region.button { border-color: rgba(34, 197, 94, 0.6); background: rgba(34, 197, 94, 0.1); }
    .region.safe { border-color: rgba(168, 85, 247, 0.4); background: rgba(168, 85, 247, 0.05); }
    .region-label { position: absolute; top: -20px; left: 0; font-size: 10px; color: #666; white-space: nowrap; }
    .issues { padding: 12px; background: #fef3c7; border-top: 1px solid #fde68a; }
    .issues:empty { display: none; }
    .issue { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; font-size: 13px; }
    .issue.critical { color: #dc2626; }
    .issue.error { color: #ea580c; }
    .issue.warning { color: #ca8a04; }
    .issue-icon { font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📱 截图本地化遮挡检测预览</h1>
    <p>生成时间: {{generateTime}}</p>
  </div>
  <div class="stats">
    <div class="stat critical">严重: {{stats.critical}}</div>
    <div class="stat error">错误: {{stats.error}}</div>
    <div class="stat warning">警告: {{stats.warning}}</div>
  </div>
  <div class="groups">
    {{#groups}}
    <div class="group">
      <div class="group-header">
        <h2>{{page}}</h2>
        <div class="device">设备: {{device}}</div>
      </div>
      <div class="screenshots">
        {{#screenshots}}
        <div class="screenshot-item">
          <div class="screenshot-header">
            <div class="lang">{{language}}</div>
            <div class="filename">{{filename}}</div>
          </div>
          <div class="screenshot-container">
            <img src="screenshots/{{filename}}" alt="{{filename}}" />
            <div class="overlay">
              {{#textRegions}}
              <div class="region text" style="left: {{x}}px; top: {{y}}px; width: {{width}}px; height: {{height}}px;">
                <div class="region-label">文字区</div>
              </div>
              {{/textRegions}}
              {{#buttonRegions}}
              <div class="region button" style="left: {{x}}px; top: {{y}}px; width: {{width}}px; height: {{height}}px;">
                <div class="region-label">按钮区</div>
              </div>
              {{/buttonRegions}}
              {{#safeArea}}
              <div class="region safe" style="left: {{left}}px; top: {{top}}px; width: calc(100% - {{left}}px - {{right}}px); height: calc(100% - {{top}}px - {{bottom}}px);">
                <div class="region-label">安全区</div>
              </div>
              {{/safeArea}}
            </div>
          </div>
          <div class="issues">
            {{#itemIssues}}
            <div class="issue {{severity}}">
              <span class="issue-icon">{{severityIcon}}</span>
              <span>{{message}}</span>
            </div>
            {{/itemIssues}}
          </div>
        </div>
        {{/screenshots}}
      </div>
    </div>
    {{/groups}}
  </div>
</body>
</html>
    `;

    const data = {
      generateTime: new Date().toLocaleString('zh-CN'),
      stats: {
        critical: issues.filter(i => i.severity === 'critical').length,
        error: issues.filter(i => i.severity === 'error').length,
        warning: issues.filter(i => i.severity === 'warning').length
      },
      groups: Object.values(grouped).map(group => ({
        device: group.device,
        page: group.page,
        screenshots: group.screenshots.map(s => ({
          ...s,
          itemIssues: issues.filter(i => 
            i.device === group.device && 
            i.page === group.page && 
            i.language === s.language &&
            i.filename === s.filename
          ).map(i => ({
            ...i,
            severityIcon: i.severity === 'critical' ? '🔴' : i.severity === 'error' ? '🟠' : '🟡'
          }))
        })),
        textRegions: group.textRegions,
        buttonRegions: group.buttonRegions,
        safeArea: Object.keys(group.safeArea).length > 0 ? group.safeArea : null
      }))
    };

    const html = mustache.render(template, data);
    fs.writeFileSync(outputPath, html);
  }
}