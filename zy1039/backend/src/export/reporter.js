const { marked } = require('marked');

/**
 * 报告生成器
 * 支持导出 Markdown 和 HTML 格式的演练报告
 */
class Reporter {
  /**
   * 生成 Markdown 报告
   * @param {Object} options - 报告选项
   * @param {Object} options.machine - 状态机定义
   * @param {Array} options.timeline - 事件时间线
   * @param {Object} options.checkResults - 检查结果
   * @param {Object} options.project - 项目信息
   * @returns {string} Markdown 内容
   */
  generateMarkdown(options) {
    const { machine, timeline, checkResults, project } = options;
    
    let md = '';
    
    // 标题
    md += `# 状态机演练报告\n\n`;
    md += `> 生成时间: ${new Date().toLocaleString()}\n\n`;
    
    // 项目信息
    if (project) {
      md += `## 项目信息\n\n`;
      md += `- **名称**: ${project.name || '未命名'}\n`;
      md += `- **描述**: ${project.description || '无'}\n`;
      md += `- **状态数**: ${machine ? Object.keys(machine.states || {}).length : 0}\n`;
      md += `- **事件数**: ${machine ? Object.keys(machine.events || {}).length : 0}\n\n`;
    }
    
    // 状态机摘要
    if (machine) {
      md += `## 状态机摘要\n\n`;
      
      // 状态列表
      md += `### 状态列表\n\n`;
      md += `| 状态ID | 名称 | 类型 | 描述 |\n`;
      md += `|--------|------|------|------|\n`;
      
      for (const [stateId, stateDef] of Object.entries(machine.states || {})) {
        const typeIcon = this._getStateTypeIcon(stateDef.type);
        const typeLabel = this._getStateTypeLabel(stateDef.type);
        md += `| \`${stateId}\` | ${stateDef.name} | ${typeIcon} ${typeLabel} | ${stateDef.description || '-'} |\n`;
      }
      md += `\n`;
      
      // 转换列表
      md += `### 转换规则\n\n`;
      
      for (const [stateId, stateDef] of Object.entries(machine.states || {})) {
        const transitionsCount = Object.keys(stateDef.on || {}).reduce((sum, event) => {
          return sum + (stateDef.on[event]?.length || 0);
        }, 0);
        
        if (transitionsCount > 0) {
          md += `#### ${stateDef.name} (\`${stateId}\`)\n\n`;
          
          for (const [eventName, transitions] of Object.entries(stateDef.on || {})) {
            for (const transition of transitions) {
              const targetState = machine.states[transition.target];
              const guardInfo = transition.guard 
                ? ` (守卫: ${this._formatGuard(transition.guard)})` 
                : '';
              const descInfo = transition.description 
                ? ` *${transition.description}*` 
                : '';
              
              md += `- **${eventName}** → \`${transition.target}\` (${targetState?.name || '未知'})${guardInfo}${descInfo}\n`;
            }
          }
          md += `\n`;
        }
      }
    }
    
    // 事件时间线
    if (timeline && timeline.length > 0) {
      md += `## 事件时间线\n\n`;
      
      md += `| 步骤 | 类型 | 状态 | 事件 | 结果 |\n`;
      md += `|------|------|------|------|------|\n`;
      
      for (const entry of timeline) {
        const step = entry.step || 0;
        const type = this._getTimelineTypeLabel(entry.type);
        const state = entry.isFinal 
          ? `**${entry.toStateInfo?.name || entry.toState}** (终态)` 
          : (entry.toStateInfo?.name || entry.toState || entry.stateInfo?.name || entry.state);
        const event = entry.event || '-';
        const result = this._getTimelineResult(entry);
        
        md += `| ${step} | ${type} | ${state} | ${event} | ${result} |\n`;
      }
      md += `\n`;
      
      // 详细时间线
      md += `### 详细记录\n\n`;
      
      for (let i = 0; i < timeline.length; i++) {
        const entry = timeline[i];
        md += `#### 步骤 ${entry.step}: ${this._getTimelineTypeLabel(entry.type)}\n\n`;
        
        if (entry.type === 'initial') {
          md += `- **当前状态**: ${entry.stateInfo?.name || entry.state}\n`;
          md += `- **状态类型**: ${this._getStateTypeLabel(entry.stateInfo?.type)}\n`;
        } else if (entry.type === 'transition') {
          md += `- **触发事件**: \`${entry.event}\`\n`;
          md += `- **源状态**: ${entry.fromStateInfo?.name} (\`${entry.fromState}\`)\n`;
          md += `- **目标状态**: ${entry.toStateInfo?.name} (\`${entry.toState}\`)${entry.isFinal ? ' **(终态)**' : ''}\n`;
          
          if (entry.transition?.guardResult) {
            md += `- **守卫条件**: ${entry.transition.guardResult.passed ? '✅ 通过' : '❌ 失败'}\n`;
            if (entry.transition.guardResult.condition) {
              md += `  - 条件: \`${entry.transition.guardResult.condition}\`\n`;
            }
            if (entry.transition.guardResult.reason) {
              md += `  - 原因: ${entry.transition.guardResult.reason}\n`;
            }
          }
          
          if (entry.transition?.actions?.length > 0) {
            md += `- **执行动作**: ${entry.transition.actions.join(', ')}\n`;
          }
          
          if (entry.transition?.description) {
            md += `- **描述**: ${entry.transition.description}\n`;
          }
        } else if (entry.type === 'invalid_event') {
          md += `- **错误类型**: 非法事件\n`;
          md += `- **触发事件**: \`${entry.event}\`\n`;
          md += `- **当前状态**: ${entry.fromStateInfo?.name} (\`${entry.fromState}\`)\n`;
          if (entry.availableEvents?.length > 0) {
            md += `- **可用事件**: ${entry.availableEvents.map(e => `\`${e}\``).join(', ')}\n`;
          }
        } else if (entry.type === 'guard_failed') {
          md += `- **错误类型**: 守卫条件失败\n`;
          md += `- **触发事件**: \`${entry.event}\`\n`;
          md += `- **当前状态**: ${entry.fromStateInfo?.name} (\`${entry.fromState}\`)\n`;
          md += `- **评估的守卫**: \n`;
          for (const t of entry.transitions || []) {
            const guardDesc = t.guard 
              ? (t.guard.description || t.guard.condition || '无描述') 
              : '无守卫条件';
            md += `  - → ${t.target}: ${guardDesc}\n`;
          }
        } else if (entry.type === 'error') {
          md += `- **错误**: ${entry.message}\n`;
        }
        
        md += `\n`;
      }
    }
    
    // 检查结果
    if (checkResults) {
      md += `## 检查结果\n\n`;
      
      md += `### 概要\n\n`;
      md += `- **总检查项**: ${checkResults.summary?.totalChecks || 0}\n`;
      md += `- **问题总数**: ${checkResults.summary?.totalIssues || 0}\n`;
      md += `- **整体结果**: ${this._getOverallResultIcon(checkResults.summary?.overall)} ${this._getOverallResultLabel(checkResults.summary?.overall)}\n\n`;
      
      if (checkResults.checks) {
        for (const check of checkResults.checks) {
          md += `### ${check.name}\n\n`;
          md += `- **描述**: ${check.description}\n`;
          md += `- **严重程度**: ${check.severity === 'error' ? '🔴 错误' : '🟡 警告'}\n`;
          md += `- **结果**: ${check.passed ? '✅ 通过' : `❌ ${check.count} 个问题`}\n\n`;
          
          if (check.issues && check.issues.length > 0) {
            md += `#### 问题详情\n\n`;
            for (let i = 0; i < check.issues.length; i++) {
              const issue = check.issues[i];
              md += `**${i + 1}. ${issue.message}**\n\n`;
              
              if (issue.detail) {
                md += `${issue.detail}\n\n`;
              }
              
              if (issue.location) {
                md += `- **位置**: `;
                const locParts = [];
                if (issue.location.state) locParts.push(`状态: \`${issue.location.state}\``);
                if (issue.location.event) locParts.push(`事件: \`${issue.location.event}\``);
                if (issue.location.target) locParts.push(`目标: \`${issue.location.target}\``);
                if (issue.location.guard) locParts.push(`守卫: \`${issue.location.guard}\``);
                md += locParts.join(' | ');
                md += `\n\n`;
              }
            }
          }
        }
      }
    }
    
    // 页脚
    md += `---\n\n`;
    md += `*此报告由 stateflow-rehearsal 工具生成*\n`;
    
    return md;
  }
  
  /**
   * 生成 HTML 报告
   * @param {Object} options - 报告选项（与 generateMarkdown 相同）
   * @returns {string} HTML 内容
   */
  generateHTML(options) {
    const markdown = this.generateMarkdown(options);
    const htmlContent = marked.parse(markdown);
    
    // 包装成完整的 HTML 文档
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>状态机演练报告</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f7fa;
      padding: 20px;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    
    h1 {
      font-size: 2em;
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    
    h2 {
      font-size: 1.5em;
      color: #34495e;
      margin-top: 30px;
      margin-bottom: 15px;
      padding-left: 10px;
      border-left: 4px solid #3498db;
    }
    
    h3 {
      font-size: 1.25em;
      color: #566573;
      margin-top: 25px;
      margin-bottom: 12px;
    }
    
    h4 {
      font-size: 1.1em;
      color: #5d6d7e;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    
    blockquote {
      background: #f8f9fa;
      border-left: 4px solid #95a5a6;
      padding: 10px 20px;
      margin: 15px 0;
      color: #7f8c8d;
    }
    
    p {
      margin-bottom: 15px;
    }
    
    ul, ol {
      margin: 15px 0;
      padding-left: 30px;
    }
    
    li {
      margin-bottom: 8px;
    }
    
    code {
      background: #f4f6f8;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.9em;
      color: #e74c3c;
    }
    
    pre {
      background: #2c3e50;
      color: #ecf0f1;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 15px 0;
    }
    
    pre code {
      background: none;
      color: inherit;
      padding: 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    
    th, td {
      border: 1px solid #e0e0e0;
      padding: 12px 15px;
      text-align: left;
    }
    
    th {
      background-color: #f8f9fa;
      font-weight: 600;
      color: #2c3e50;
    }
    
    tr:nth-child(even) {
      background-color: #fafbfc;
    }
    
    tr:hover {
      background-color: #f5f7fa;
    }
    
    hr {
      border: none;
      border-top: 1px solid #e0e0e0;
      margin: 30px 0;
    }
    
    em {
      color: #7f8c8d;
    }
    
    strong {
      color: #2c3e50;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      color: #95a5a6;
      font-size: 0.9em;
    }
    
    .status-icon {
      display: inline-block;
      width: 20px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    ${htmlContent}
    <div class="footer">
      此报告由 <strong>stateflow-rehearsal</strong> 工具生成
    </div>
  </div>
</body>
</html>`;
  }
  
  /**
   * 获取状态类型图标
   * @private
   */
  _getStateTypeIcon(type) {
    switch (type) {
      case 'initial': return '🚀';
      case 'final': return '🏁';
      default: return '📍';
    }
  }
  
  /**
   * 获取状态类型标签
   * @private
   */
  _getStateTypeLabel(type) {
    switch (type) {
      case 'initial': return '初始状态';
      case 'final': return '终态';
      default: return '普通状态';
    }
  }
  
  /**
   * 格式化守卫条件
   * @private
   */
  _formatGuard(guard) {
    if (typeof guard === 'string') {
      return `\`${guard}\``;
    }
    return guard.description || `\`${guard.condition}\`` || '无描述';
  }
  
  /**
   * 获取时间线类型标签
   * @private
   */
  _getTimelineTypeLabel(type) {
    switch (type) {
      case 'initial': return '初始化';
      case 'transition': return '转换';
      case 'invalid_event': return '非法事件';
      case 'guard_failed': return '守卫失败';
      case 'error': return '错误';
      default: return type || '未知';
    }
  }
  
  /**
   * 获取时间线结果
   * @private
   */
  _getTimelineResult(entry) {
    switch (entry.type) {
      case 'initial':
        return '✅ 初始化完成';
      case 'transition':
        return entry.isFinal ? '✅ 到达终态' : '✅ 转换成功';
      case 'invalid_event':
      case 'guard_failed':
      case 'error':
        return '❌ 失败';
      default:
        return '-';
    }
  }
  
  /**
   * 获取整体结果图标
   * @private
   */
  _getOverallResultIcon(overall) {
    switch (overall) {
      case 'pass': return '✅';
      case 'warning': return '⚠️';
      case 'fail': return '❌';
      default: return '❓';
    }
  }
  
  /**
   * 获取整体结果标签
   * @private
   */
  _getOverallResultLabel(overall) {
    switch (overall) {
      case 'pass': return '通过';
      case 'warning': return '有警告';
      case 'fail': return '失败';
      default: return '未知';
    }
  }
}

module.exports = new Reporter();
