from typing import Dict, Any, List
from datetime import datetime

class ReportGenerator:
    def generate_json(self, data: Dict[str, Any]) -> str:
        import json
        return json.dumps(data, ensure_ascii=False, indent=2)
    
    def generate_markdown(self, data: Dict[str, Any]) -> str:
        issues = data.get("issues", [])
        stats = data.get("statistics", {})
        summary = data.get("summary", {})
        version_id = data.get("version_id", "unknown")
        
        critical_issues = [i for i in issues if i.get("severity") == "critical"]
        warning_issues = [i for i in issues if i.get("severity") == "warning"]
        info_issues = [i for i in issues if i.get("severity") == "info"]
        
        md = f"""# PCB打样预审报告

## 基本信息
- **报告版本**: {version_id}
- **生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- **板名**: {summary.get('board_name', 'Unknown')}
- **检查时间**: {summary.get('check_timestamp', 'Unknown')}

---

## 检查概览

| 指标 | 数量 |
|------|------|
| 检查的器件数 | {summary.get('components_checked', 0)} |
| 检查的网络数 | {summary.get('nets_checked', 0)} |
| 应用的规则数 | {summary.get('rules_applied', 0)} |
| 通过的规则数 | {summary.get('rules_passed', 0)} |
| 失败的规则数 | {summary.get('rules_failed', 0)} |

---

## 问题统计

| 严重程度 | 数量 |
|----------|------|
| 🔴 严重 (Critical) | {stats.get('critical', 0)} |
| 🟡 警告 (Warning) | {stats.get('warning', 0)} |
| 🔵 提示 (Info) | {stats.get('info', 0)} |
| **总计** | **{stats.get('total', 0)}** |

---
"""
        
        if critical_issues:
            md += """
## 🔴 严重问题

这些问题必须在打样前解决，否则可能导致电路板无法正常工作或无法制造。

"""
            for idx, issue in enumerate(critical_issues, 1):
                md += f"""
### {idx}. {issue.get('title', 'Unknown')}

**问题ID**: {issue.get('id')}  
**规则**: {issue.get('rule_name', 'Unknown')}  
**分类**: {issue.get('category', 'Unknown')}  
**状态**: {issue.get('status', 'open')}  

**描述**:  
{issue.get('description', 'No description')}

**建议**:  
{issue.get('suggestion', 'No suggestion')}

**位置**: 
"""
                location = issue.get('location', {})
                if location.get('x') is not None and location.get('y') is not None:
                    md += f"- 坐标: ({location['x']}, {location['y']}) mm\n"
                if location.get('layer'):
                    md += f"- 层: {location['layer']}\n"
                if location.get('reference'):
                    md += f"- 器件: {location['reference']}\n"
                if location.get('net_name'):
                    md += f"- 网络: {location['net_name']}\n"
                md += "\n---\n"
        
        if warning_issues:
            md += """
## 🟡 警告问题

这些问题建议在打样前检查，可能影响制造良率或后期维护。

"""
            for idx, issue in enumerate(warning_issues, 1):
                md += f"""
### {idx}. {issue.get('title', 'Unknown')}

**问题ID**: {issue.get('id')}  
**规则**: {issue.get('rule_name', 'Unknown')}  
**分类**: {issue.get('category', 'Unknown')}  
**状态**: {issue.get('status', 'open')}  

**描述**:  
{issue.get('description', 'No description')}

**建议**:  
{issue.get('suggestion', 'No suggestion')}

**位置**: 
"""
                location = issue.get('location', {})
                if location.get('x') is not None and location.get('y') is not None:
                    md += f"- 坐标: ({location['x']}, {location['y']}) mm\n"
                if location.get('layer'):
                    md += f"- 层: {location['layer']}\n"
                if location.get('reference'):
                    md += f"- 器件: {location['reference']}\n"
                if location.get('net_name'):
                    md += f"- 网络: {location['net_name']}\n"
                md += "\n---\n"
        
        if info_issues:
            md += """
## 🔵 提示信息

这些是可选的改进建议，不影响基本功能但可以优化设计。

"""
            for idx, issue in enumerate(info_issues, 1):
                md += f"""
### {idx}. {issue.get('title', 'Unknown')}

**问题ID**: {issue.get('id')}  
**规则**: {issue.get('rule_name', 'Unknown')}  
**分类**: {issue.get('category', 'Unknown')}  
**状态**: {issue.get('status', 'open')}  

**描述**:  
{issue.get('description', 'No description')}

**建议**:  
{issue.get('suggestion', 'No suggestion')}

**位置**: 
"""
                location = issue.get('location', {})
                if location.get('x') is not None and location.get('y') is not None:
                    md += f"- 坐标: ({location['x']}, {location['y']}) mm\n"
                if location.get('layer'):
                    md += f"- 层: {location['layer']}\n"
                if location.get('reference'):
                    md += f"- 器件: {location['reference']}\n"
                if location.get('net_name'):
                    md += f"- 网络: {location['net_name']}\n"
                md += "\n---\n"
        
        md += """
---

## 附录

### 状态说明
- `open`: 未处理
- `confirmed`: 已确认
- `false_positive`: 误报
- `resolved`: 已解决

### 严重程度说明
- `critical`: 严重问题，必须修复
- `warning`: 警告问题，建议修复
- `info`: 提示信息，可选改进

---

*本报告由PCB打样预审工具自动生成*
"""
        
        return md
    
    def generate_html(self, data: Dict[str, Any]) -> str:
        issues = data.get("issues", [])
        stats = data.get("statistics", {})
        summary = data.get("summary", {})
        version_id = data.get("version_id", "unknown")
        
        critical_issues = [i for i in issues if i.get("severity") == "critical"]
        warning_issues = [i for i in issues if i.get("severity") == "warning"]
        info_issues = [i for i in issues if i.get("severity") == "info"]
        
        def issues_to_html(issue_list: List[Dict], title: str, color_class: str) -> str:
            if not issue_list:
                return ""
            
            html = f"""
            <div class="section">
                <h2 class="{color_class}">{title}</h2>
            """
            
            for idx, issue in enumerate(issue_list, 1):
                location = issue.get('location', {})
                html += f"""
                <div class="issue-card">
                    <h3>{idx}. {issue.get('title', 'Unknown')}</h3>
                    <div class="issue-meta">
                        <span class="meta-label">ID:</span> <span class="meta-value">{issue.get('id')}</span>
                        <span class="meta-label">规则:</span> <span class="meta-value">{issue.get('rule_name', 'Unknown')}</span>
                        <span class="meta-label">分类:</span> <span class="meta-value">{issue.get('category', 'Unknown')}</span>
                        <span class="meta-label">状态:</span> <span class="meta-value status-{issue.get('status', 'open')}">{issue.get('status', 'open')}</span>
                    </div>
                    <div class="issue-section">
                        <div class="issue-label">描述:</div>
                        <div class="issue-content">{issue.get('description', 'No description')}</div>
                    </div>
                    <div class="issue-section">
                        <div class="issue-label">建议:</div>
                        <div class="issue-content">{issue.get('suggestion', 'No suggestion')}</div>
                    </div>
                """
                
                if location:
                    html += """
                    <div class="issue-section">
                        <div class="issue-label">位置:</div>
                        <div class="issue-content">
                    """
                    if location.get('x') is not None and location.get('y') is not None:
                        html += f"<div>坐标: ({location['x']}, {location['y']}) mm</div>"
                    if location.get('layer'):
                        html += f"<div>层: {location['layer']}</div>"
                    if location.get('reference'):
                        html += f"<div>器件: {location['reference']}</div>"
                    if location.get('net_name'):
                        html += f"<div>网络: {location['net_name']}</div>"
                    html += "</div></div>"
                
                html += "</div>"
            
            html += "</div>"
            return html
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PCB打样预审报告</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #f5f5f5;
            color: #333;
            line-height: 1.6;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 40px;
        }}
        
        h1 {{
            color: #1a1a1a;
            font-size: 28px;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 3px solid #007acc;
        }}
        
        h2 {{
            font-size: 22px;
            margin: 30px 0 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e0e0e0;
        }}
        
        h2.critical {{ color: #dc3545; }}
        h2.warning {{ color: #ffc107; }}
        h2.info {{ color: #17a2b8; }}
        
        h3 {{
            font-size: 18px;
            margin: 20px 0 10px;
            color: #1a1a1a;
        }}
        
        .info-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }}
        
        .info-item {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #007acc;
        }}
        
        .info-label {{
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        
        .info-value {{
            font-size: 16px;
            font-weight: 600;
            color: #1a1a1a;
            margin-top: 5px;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        
        th, td {{
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }}
        
        th {{
            background-color: #f8f9fa;
            font-weight: 600;
            color: #1a1a1a;
        }}
        
        tr:hover {{
            background-color: #f8f9fa;
        }}
        
        .critical-badge {{
            background-color: #dc3545;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }}
        
        .warning-badge {{
            background-color: #ffc107;
            color: #1a1a1a;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }}
        
        .info-badge {{
            background-color: #17a2b8;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }}
        
        .section {{
            margin: 30px 0;
        }}
        
        .issue-card {{
            background: #fafafa;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 20px;
            margin: 15px 0;
        }}
        
        .issue-meta {{
            font-size: 13px;
            color: #666;
            margin-bottom: 15px;
            flex-wrap: wrap;
            display: flex;
            gap: 15px;
        }}
        
        .meta-label {{
            font-weight: 600;
            color: #333;
        }}
        
        .meta-value {{
            color: #666;
        }}
        
        .status-open {{ color: #dc3545; }}
        .status-confirmed {{ color: #ffc107; }}
        .status-false_positive {{ color: #6c757d; }}
        .status-resolved {{ color: #28a745; }}
        
        .issue-section {{
            margin: 10px 0;
        }}
        
        .issue-label {{
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 5px;
        }}
        
        .issue-content {{
            color: #555;
            padding-left: 10px;
            border-left: 3px solid #e0e0e0;
        }}
        
        .footer {{
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #999;
            font-size: 12px;
        }}
        
        hr {{
            border: none;
            border-top: 1px solid #e0e0e0;
            margin: 30px 0;
        }}
        
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }}
        
        .stat-card {{
            text-align: center;
            padding: 20px;
            border-radius: 8px;
        }}
        
        .stat-card.critical {{ background-color: #fff5f5; }}
        .stat-card.warning {{ background-color: #fffbf5; }}
        .stat-card.info {{ background-color: #f0f9ff; }}
        .stat-card.total {{ background-color: #f8f9fa; }}
        
        .stat-number {{
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 5px;
        }}
        
        .stat-number.critical {{ color: #dc3545; }}
        .stat-number.warning {{ color: #ffc107; }}
        .stat-number.info {{ color: #17a2b8; }}
        .stat-number.total {{ color: #1a1a1a; }}
        
        .stat-label {{
            font-size: 13px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>PCB打样预审报告</h1>
        
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">报告版本</div>
                <div class="info-value">{version_id}</div>
            </div>
            <div class="info-item">
                <div class="info-label">生成时间</div>
                <div class="info-value">{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
            </div>
            <div class="info-item">
                <div class="info-label">板名</div>
                <div class="info-value">{summary.get('board_name', 'Unknown')}</div>
            </div>
            <div class="info-item">
                <div class="info-label">检查时间</div>
                <div class="info-value">{summary.get('check_timestamp', 'Unknown')[:19] if summary.get('check_timestamp') else 'Unknown'}</div>
            </div>
        </div>
        
        <h2>检查概览</h2>
        <table>
            <thead>
                <tr>
                    <th>指标</th>
                    <th>数量</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>检查的器件数</td><td>{summary.get('components_checked', 0)}</td></tr>
                <tr><td>检查的网络数</td><td>{summary.get('nets_checked', 0)}</td></tr>
                <tr><td>应用的规则数</td><td>{summary.get('rules_applied', 0)}</td></tr>
                <tr><td>通过的规则数</td><td>{summary.get('rules_passed', 0)}</td></tr>
                <tr><td>失败的规则数</td><td>{summary.get('rules_failed', 0)}</td></tr>
            </tbody>
        </table>
        
        <h2>问题统计</h2>
        <div class="stats-grid">
            <div class="stat-card critical">
                <div class="stat-number critical">{stats.get('critical', 0)}</div>
                <div class="stat-label">严重问题</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-number warning">{stats.get('warning', 0)}</div>
                <div class="stat-label">警告问题</div>
            </div>
            <div class="stat-card info">
                <div class="stat-number info">{stats.get('info', 0)}</div>
                <div class="stat-label">提示信息</div>
            </div>
            <div class="stat-card total">
                <div class="stat-number total">{stats.get('total', 0)}</div>
                <div class="stat-label">总计</div>
            </div>
        </div>
        
        {issues_to_html(critical_issues, '🔴 严重问题', 'critical')}
        {issues_to_html(warning_issues, '🟡 警告问题', 'warning')}
        {issues_to_html(info_issues, '🔵 提示信息', 'info')}
        
        <hr>
        
        <h2>附录</h2>
        <h3>状态说明</h3>
        <table>
            <thead>
                <tr><th>状态</th><th>说明</th></tr>
            </thead>
            <tbody>
                <tr><td><span class="status-open">open</span></td><td>未处理</td></tr>
                <tr><td><span class="status-confirmed">confirmed</span></td><td>已确认</td></tr>
                <tr><td><span class="status-false_positive">false_positive</span></td><td>误报</td></tr>
                <tr><td><span class="status-resolved">resolved</span></td><td>已解决</td></tr>
            </tbody>
        </table>
        
        <h3>严重程度说明</h3>
        <table>
            <thead>
                <tr><th>级别</th><th>说明</th></tr>
            </thead>
            <tbody>
                <tr><td><span class="critical-badge">critical</span></td><td>严重问题，必须修复</td></tr>
                <tr><td><span class="warning-badge">warning</span></td><td>警告问题，建议修复</td></tr>
                <tr><td><span class="info-badge">info</span></td><td>提示信息，可选改进</td></tr>
            </tbody>
        </table>
        
        <div class="footer">
            本报告由PCB打样预审工具自动生成
        </div>
    </div>
</body>
</html>
"""
        return html
