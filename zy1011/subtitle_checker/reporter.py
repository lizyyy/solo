from typing import Dict, List
from pathlib import Path
from datetime import datetime

from subtitle_checker.models import (
    ScanResult, Issue, IssueType, Severity, SubtitleFile, SubtitleEntry
)


class ReportGenerator:
    """报告生成器"""
    
    def generate_markdown(self, scan_result: ScanResult, output_path: str) -> str:
        lines = []
        
        lines.append("# 字幕时间轴检查报告")
        lines.append("")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 摘要")
        lines.append("")
        lines.append(f"- **扫描文件数**: {scan_result.total_files()}")
        lines.append(f"- **字幕条目总数**: {scan_result.total_entries()}")
        
        severity_counts = scan_result.count_issues_by_severity()
        lines.append(f"- **发现问题数**: {len(scan_result.issues)}")
        lines.append(f"  - 错误 (ERROR): {severity_counts[Severity.ERROR]}")
        lines.append(f"  - 警告 (WARNING): {severity_counts[Severity.WARNING]}")
        lines.append(f"  - 信息 (INFO): {severity_counts[Severity.INFO]}")
        lines.append("")
        
        lines.append("## 问题类型统计")
        lines.append("")
        type_counts = scan_result.get_issues_by_type()
        for issue_type, issues in type_counts.items():
            lines.append(f"- **{self._get_issue_type_name(issue_type)}**: {len(issues)}")
        lines.append("")
        
        lines.append("## 详细问题列表")
        lines.append("")
        
        issues_by_file = scan_result.get_issues_by_file()
        
        for file_path, issues in issues_by_file.items():
            lines.append(f"### 文件: {file_path}")
            lines.append("")
            
            for i, issue in enumerate(issues, 1):
                severity_emoji = self._get_severity_emoji(issue.severity)
                lines.append(f"#### {i}. {severity_emoji} {self._get_issue_type_name(issue.issue_type)}")
                lines.append("")
                lines.append(f"- **严重程度**: {issue.severity.value.upper()}")
                lines.append(f"- **描述**: {issue.message}")
                if issue.subtitle_index is not None:
                    lines.append(f"- **字幕索引**: {issue.subtitle_index}")
                if issue.subtitle_indices:
                    lines.append(f"- **相关字幕**: {', '.join(map(str, issue.subtitle_indices))}")
                if issue.line_number is not None:
                    lines.append(f"- **行号**: {issue.line_number}")
                lines.append("")
                
                if issue.original:
                    lines.append("**原始状态:**")
                    lines.append("")
                    lines.append("```")
                    for key, value in issue.original.items():
                        lines.append(f"  {key}: {value}")
                    lines.append("```")
                    lines.append("")
                
                if issue.suggestion:
                    lines.append(f"**建议修复**: {issue.suggestion}")
                    lines.append("")
                
                if issue.fixed:
                    lines.append("**修复后状态:**")
                    lines.append("")
                    lines.append("```")
                    for key, value in issue.fixed.items():
                        lines.append(f"  {key}: {value}")
                    lines.append("```")
                    lines.append("")
                
                if issue.details:
                    lines.append("**详细信息:**")
                    lines.append("")
                    lines.append("```")
                    for key, value in issue.details.items():
                        lines.append(f"  {key}: {value}")
                    lines.append("```")
                    lines.append("")
        
        if scan_result.chapters:
            lines.append("## 章节信息")
            lines.append("")
            for i, chapter in enumerate(scan_result.chapters, 1):
                lines.append(f"### 第 {i} 章: {chapter.title}")
                lines.append("")
                lines.append(f"- **开始时间**: {self._format_timedelta(chapter.start_time)}")
                lines.append(f"- **结束时间**: {self._format_timedelta(chapter.end_time)}")
                lines.append("")
        
        Path(output_path).write_text('\n'.join(lines), encoding='utf-8')
        return output_path
    
    def generate_html(self, scan_result: ScanResult, output_path: str) -> str:
        severity_counts = scan_result.count_issues_by_severity()
        type_counts = scan_result.get_issues_by_type()
        issues_by_file = scan_result.get_issues_by_file()
        
        html_parts = []
        
        html_parts.append(f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>字幕时间轴检查报告</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; padding: 20px; }}
        header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }}
        h1 {{ font-size: 2em; margin-bottom: 10px; }}
        .subtitle {{ opacity: 0.9; }}
        .summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }}
        .summary-card {{ background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .summary-card h3 {{ font-size: 0.9em; color: #666; margin-bottom: 10px; }}
        .summary-card .value {{ font-size: 2em; font-weight: bold; }}
        .error .value {{ color: #e53e3e; }}
        .warning .value {{ color: #ed8936; }}
        .info .value {{ color: #3182ce; }}
        .section {{ background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }}
        .section h2 {{ font-size: 1.3em; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #667eea; }}
        .file-section {{ margin-bottom: 30px; }}
        .file-section h3 {{ font-size: 1.1em; margin-bottom: 15px; color: #4a5568; }}
        .issue {{ background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 4px solid; }}
        .issue.error {{ border-left-color: #e53e3e; background: #fff5f5; }}
        .issue.warning {{ border-left-color: #ed8936; background: #fffaf0; }}
        .issue.info {{ border-left-color: #3182ce; background: #ebf8ff; }}
        .issue-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }}
        .issue-title {{ font-weight: bold; }}
        .issue-severity {{ font-size: 0.8em; padding: 3px 8px; border-radius: 4px; }}
        .issue-severity.error {{ background: #fed7d7; color: #c53030; }}
        .issue-severity.warning {{ background: #feebc8; color: #c05621; }}
        .issue-severity.info {{ background: #bee3f8; color: #2c5282; }}
        .issue-details {{ font-size: 0.9em; color: #666; }}
        .code-block {{ background: #2d3748; color: #e2e8f0; padding: 10px 15px; border-radius: 5px; font-family: 'Monaco', 'Menlo', monospace; font-size: 0.85em; margin: 10px 0; overflow-x: auto; }}
        .suggestion {{ background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 5px; padding: 10px; margin-top: 10px; }}
        .suggestion-label {{ font-weight: bold; color: #276749; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }}
        th {{ background: #f7fafc; font-weight: 600; }}
        .badge {{ display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: 600; }}
        .badge-error {{ background: #fed7d7; color: #c53030; }}
        .badge-warning {{ background: #feebc8; color: #c05621; }}
        .badge-info {{ background: #bee3f8; color: #2c5282; }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>字幕时间轴检查报告</h1>
            <p class="subtitle">生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </header>
        
        <div class="summary">
            <div class="summary-card">
                <h3>扫描文件数</h3>
                <div class="value">{scan_result.total_files()}</div>
            </div>
            <div class="summary-card">
                <h3>字幕条目总数</h3>
                <div class="value">{scan_result.total_entries()}</div>
            </div>
            <div class="summary-card error">
                <h3>错误</h3>
                <div class="value">{severity_counts[Severity.ERROR]}</div>
            </div>
            <div class="summary-card warning">
                <h3>警告</h3>
                <div class="value">{severity_counts[Severity.WARNING]}</div>
            </div>
            <div class="summary-card info">
                <h3>信息</h3>
                <div class="value">{severity_counts[Severity.INFO]}</div>
            </div>
        </div>
        
        <div class="section">
            <h2>问题类型统计</h2>
            <table>
                <thead>
                    <tr>
                        <th>问题类型</th>
                        <th>数量</th>
                    </tr>
                </thead>
                <tbody>
""")
        
        for issue_type, issues in type_counts.items():
            html_parts.append(f"""
                    <tr>
                        <td>{self._get_issue_type_name(issue_type)}</td>
                        <td>{len(issues)}</td>
                    </tr>
""")
        
        html_parts.append("""
                </tbody>
            </table>
        </div>
""")
        
        if issues_by_file:
            html_parts.append("""
        <div class="section">
            <h2>详细问题列表</h2>
""")
            
            for file_path, issues in issues_by_file.items():
                html_parts.append(f"""
            <div class="file-section">
                <h3>📄 {file_path}</h3>
""")
                
                for i, issue in enumerate(issues, 1):
                    severity_class = issue.severity.value
                    type_name = self._get_issue_type_name(issue.issue_type)
                    
                    html_parts.append(f"""
                <div class="issue {severity_class}">
                    <div class="issue-header">
                        <span class="issue-title">#{i} {type_name}</span>
                        <span class="issue-severity {severity_class}">{severity_class.upper()}</span>
                    </div>
                    <p class="issue-details">{issue.message}</p>
""")
                    
                    if issue.subtitle_index is not None:
                        html_parts.append(f"<p class=\"issue-details\">字幕索引: {issue.subtitle_index}</p>")
                    if issue.subtitle_indices:
                        html_parts.append(f"<p class=\"issue-details\">相关字幕: {', '.join(map(str, issue.subtitle_indices))}</p>")
                    if issue.line_number is not None:
                        html_parts.append(f"<p class=\"issue-details\">行号: {issue.line_number}</p>")
                    
                    if issue.original:
                        html_parts.append("<div class=\"code-block\">")
                        html_parts.append("<strong>原始状态:</strong><br>")
                        for key, value in issue.original.items():
                            html_parts.append(f"  {key}: {value}<br>")
                        html_parts.append("</div>")
                    
                    if issue.suggestion:
                        html_parts.append(f"""
                    <div class="suggestion">
                        <span class="suggestion-label">💡 建议修复:</span> {issue.suggestion}
                    </div>
""")
                    
                    if issue.fixed:
                        html_parts.append("<div class=\"code-block\">")
                        html_parts.append("<strong>修复后状态:</strong><br>")
                        for key, value in issue.fixed.items():
                            html_parts.append(f"  {key}: {value}<br>")
                        html_parts.append("</div>")
                    
                    html_parts.append("                </div>")
                
                html_parts.append("            </div>")
            
            html_parts.append("        </div>")
        
        if scan_result.chapters:
            html_parts.append("""
        <div class="section">
            <h2>章节信息</h2>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>章节标题</th>
                        <th>开始时间</th>
                        <th>结束时间</th>
                    </tr>
                </thead>
                <tbody>
""")
            
            for i, chapter in enumerate(scan_result.chapters, 1):
                html_parts.append(f"""
                    <tr>
                        <td>{i}</td>
                        <td>{chapter.title}</td>
                        <td>{self._format_timedelta(chapter.start_time)}</td>
                        <td>{self._format_timedelta(chapter.end_time)}</td>
                    </tr>
""")
            
            html_parts.append("""
                </tbody>
            </table>
        </div>
""")
        
        html_parts.append("""
    </div>
</body>
</html>
""")
        
        html = ''.join(html_parts)
        Path(output_path).write_text(html, encoding='utf-8')
        return output_path
    
    def _get_issue_type_name(self, issue_type: IssueType) -> str:
        names = {
            IssueType.OVERLAP: "时间重叠",
            IssueType.INVALID_TIME: "非法时间",
            IssueType.LONG_GAP: "间隔过长",
            IssueType.DUPLICATE: "重复字幕",
            IssueType.EMPTY_TEXT: "空文本",
            IssueType.CROSS_CHAPTER: "跨章节",
            IssueType.PARSE_ERROR: "解析错误",
        }
        return names.get(issue_type, issue_type.value)
    
    def _get_severity_emoji(self, severity: Severity) -> str:
        emojis = {
            Severity.ERROR: "🔴",
            Severity.WARNING: "🟡",
            Severity.INFO: "🔵",
        }
        return emojis.get(severity, "⚪")
    
    def _format_timedelta(self, td) -> str:
        from subtitle_checker.parser import format_srt_time
        return format_srt_time(td)
