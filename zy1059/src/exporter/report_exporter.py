import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from collections import Counter

from src.models import Event, Conflict, ValidationError
from src.deduplicator import EventMerger


class ReportExporter:
    def __init__(self):
        pass

    def export_markdown(self, 
                        events: List[Event],
                        conflicts: List[Conflict],
                        validation_errors: List[ValidationError],
                        merged_groups: List[List[Event]],
                        source_files: List[str],
                        output_path: str) -> str:
        report = self._generate_markdown_report(
            events, conflicts, validation_errors, merged_groups, source_files
        )
        
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report)
        
        return output_path

    def export_html(self,
                    events: List[Event],
                    conflicts: List[Conflict],
                    validation_errors: List[ValidationError],
                    merged_groups: List[List[Event]],
                    source_files: List[str],
                    output_path: str) -> str:
        markdown = self._generate_markdown_report(
            events, conflicts, validation_errors, merged_groups, source_files
        )
        html = self._markdown_to_html(markdown)
        
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)
        
        return output_path

    def _generate_markdown_report(self,
                                   events: List[Event],
                                   conflicts: List[Conflict],
                                   validation_errors: List[ValidationError],
                                   merged_groups: List[List[Event]],
                                   source_files: List[str]) -> str:
        lines = []
        
        lines.append("# 日程合并清理报告")
        lines.append(f"")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"")
        
        lines.append("## 一、概览统计")
        lines.append("")
        lines.append("| 项目 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 源文件数 | {len(source_files)} |")
        lines.append(f"| 导入事件数 | {sum(1 for e in events) + sum(len(g) - 1 for g in merged_groups)} |")
        lines.append(f"| 合并事件组 | {len(merged_groups)} |")
        lines.append(f"| 清理后事件数 | {len(events)} |")
        lines.append(f"| 检测到冲突 | {len(conflicts)} |")
        lines.append(f"| 解析错误 | {len(validation_errors)} |")
        lines.append("")
        
        lines.append("## 二、来源文件统计")
        lines.append("")
        
        if events:
            source_counter = Counter(e.source_file for e in events)
            for merged_group in merged_groups:
                for merged_event in merged_group:
                    if merged_event.source_file not in source_counter:
                        source_counter[merged_event.source_file] = 0
            
            lines.append("| 源文件 | 事件数 |")
            lines.append("|--------|--------|")
            for source, count in sorted(source_counter.items(), key=lambda x: x[1], reverse=True):
                lines.append(f"| {source} | {count} |")
        else:
            lines.append("暂无事件统计。")
        lines.append("")
        
        lines.append("## 三、已合并的事件")
        lines.append("")
        
        if merged_groups:
            for idx, group in enumerate(merged_groups, 1):
                if len(group) < 2:
                    continue
                
                main_event = group[0]
                lines.append(f"### 合并组 {idx}: {main_event.title}")
                lines.append("")
                lines.append(f"- **合并日期**: {main_event.start.strftime('%Y-%m-%d')}")
                lines.append(f"- **合并后时间**: {main_event.start.strftime('%H:%M')} - {main_event.end.strftime('%H:%M')}")
                lines.append(f"- **合并后地点**: {main_event.location or '未指定'}")
                lines.append("")
                lines.append("#### 来源事件:")
                lines.append("")
                lines.append("| 序号 | 事件标题 | 源文件 | 时间 | 地点 |")
                lines.append("|------|----------|--------|------|------|")
                for i, event in enumerate(group, 1):
                    time_str = f"{event.start.strftime('%H:%M')} - {event.end.strftime('%H:%M')}" if event.start and event.end else "未知"
                    lines.append(f"| {i} | {event.title} | {event.source_file} | {time_str} | {event.location or '-'} |")
                lines.append("")
        else:
            lines.append("没有检测到需要合并的重复事件。")
        lines.append("")
        
        lines.append("## 四、冲突检测结果")
        lines.append("")
        
        errors = [c for c in conflicts if c.severity == 'error']
        warnings = [c for c in conflicts if c.severity == 'warning']
        infos = [c for c in conflicts if c.severity == 'info']
        
        if errors:
            lines.append("### 🔴 严重错误")
            lines.append("")
            for idx, conflict in enumerate(errors, 1):
                lines.append(f"#### {idx}. {self._get_conflict_type_name(conflict.conflict_type)}")
                lines.append("")
                lines.append(f"- **描述**: {conflict.description}")
                lines.append(f"- **建议**: {conflict.suggestion or '请手动检查'}")
                lines.append("")
                lines.append("**涉及事件**:")
                lines.append("")
                for event in conflict.events:
                    time_str = f"{event.start.strftime('%Y-%m-%d %H:%M')} - {event.end.strftime('%H:%M')}" if event.start and event.end else "未知"
                    lines.append(f"- `{event.title}` ({event.source_file})")
                    lines.append(f"  - 时间: {time_str}")
                    lines.append(f"  - 地点: {event.location or '未指定'}")
                lines.append("")
        
        if warnings:
            lines.append("### 🟡 警告")
            lines.append("")
            for idx, conflict in enumerate(warnings, 1):
                lines.append(f"#### {idx}. {self._get_conflict_type_name(conflict.conflict_type)}")
                lines.append("")
                lines.append(f"- **描述**: {conflict.description}")
                lines.append(f"- **建议**: {conflict.suggestion or '请手动检查'}")
                lines.append("")
                if conflict.events:
                    lines.append("**涉及事件**:")
                    lines.append("")
                    for event in conflict.events:
                        time_str = f"{event.start.strftime('%Y-%m-%d %H:%M')} - {event.end.strftime('%H:%M')}" if event.start and event.end else "未知"
                        lines.append(f"- `{event.title}` ({event.source_file})")
                        lines.append(f"  - 时间: {time_str}")
                        lines.append(f"  - 地点: {event.location or '未指定'}")
                lines.append("")
        
        if infos:
            lines.append("### ℹ️ 提示信息")
            lines.append("")
            for idx, conflict in enumerate(infos, 1):
                lines.append(f"#### {idx}. {self._get_conflict_type_name(conflict.conflict_type)}")
                lines.append("")
                lines.append(f"- **描述**: {conflict.description}")
                lines.append(f"- **建议**: {conflict.suggestion or '请手动检查'}")
                lines.append("")
        
        if not conflicts:
            lines.append("✅ 未检测到任何冲突。")
        lines.append("")
        
        lines.append("## 五、解析错误详情")
        lines.append("")
        
        if validation_errors:
            lines.append("| 序号 | 错误类型 | 严重程度 | 源文件 | 行号 | 事件 | 错误信息 |")
            lines.append("|------|----------|----------|--------|------|------|----------|")
            for idx, error in enumerate(validation_errors, 1):
                severity_icon = "🔴" if error.severity == "error" else "🟡" if error.severity == "warning" else "ℹ️"
                lines.append(f"| {idx} | {self._get_error_type_name(error.error_type)} | {severity_icon} {error.severity} | {error.source_file} | {error.line_number or '-'} | {error.event_title or '-'} | {error.message} |")
        else:
            lines.append("✅ 解析过程中未发现错误。")
        lines.append("")
        
        lines.append("## 六、导出文件")
        lines.append("")
        lines.append("- `clean.ics`: 清理后的日程文件，可直接导入日历应用")
        lines.append("- `conflicts.csv`: 冲突明细表格")
        lines.append("- `report.md` / `report.html`: 本报告")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*报告由日程合并清理工具生成*")
        
        return "\n".join(lines)

    def _get_conflict_type_name(self, conflict_type: str) -> str:
        names = {
            'time_overlap': '时间重叠',
            'commute_buffer_insufficient': '通勤缓冲不足',
            'location_mutually_exclusive': '地点互斥冲突',
            'missing_title': '缺少标题',
            'missing_location': '缺少地点',
            'invalid_end_time': '结束时间无效',
            'cross_day_event': '跨天事件',
            'unexpanded_recurrence': '未展开的重复事件',
            'zero_or_negative_duration': '持续时间无效',
        }
        return names.get(conflict_type, conflict_type)

    def _get_error_type_name(self, error_type: str) -> str:
        names = {
            'file_not_found': '文件不存在',
            'read_error': '读取错误',
            'parse_error': '解析错误',
            'missing_title': '缺少标题',
            'missing_start': '缺少开始时间',
            'missing_end': '缺少结束时间',
            'naive_datetime': '无时区信息',
            'timezone_convert_error': '时区转换错误',
            'invalid_timezone': '无效时区',
            'rrule_parse_error': '重复规则错误',
            'recurrence_limit': '重复事件限制',
            'normalization_error': '规范化错误',
            'row_parse_error': '行解析错误',
            'empty_file': '空文件',
            'event_parse_error': '事件解析错误',
        }
        return names.get(error_type, error_type)

    def _markdown_to_html(self, markdown: str) -> str:
        html_parts = []
        
        html_parts.append('''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>日程合并清理报告</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #2980b9; margin-top: 30px; }
        h3 { color: #34495e; margin-top: 20px; }
        h4 { color: #7f8c8d; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
        }
        th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        tr:nth-child(even) { background-color: #f9f9f9; }
        blockquote {
            border-left: 4px solid #3498db;
            padding-left: 15px;
            color: #7f8c8d;
            margin: 10px 0;
        }
        code {
            background-color: #f1f2f3;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        hr {
            border: none;
            border-top: 1px solid #eee;
            margin: 30px 0;
        }
        .error { color: #e74c3c; }
        .warning { color: #f39c12; }
        .info { color: #3498db; }
    </style>
</head>
<body>
''')
        
        lines = markdown.split('\n')
        in_table = False
        table_rows = []
        
        for line in lines:
            stripped = line.strip()
            
            if stripped.startswith('# '):
                html_parts.append(f'<h1>{stripped[2:]}</h1>')
            elif stripped.startswith('## '):
                html_parts.append(f'<h2>{stripped[3:]}</h2>')
            elif stripped.startswith('### '):
                html_parts.append(f'<h3>{stripped[4:]}</h3>')
            elif stripped.startswith('#### '):
                html_parts.append(f'<h4>{stripped[5:]}</h4>')
            elif stripped.startswith('> '):
                html_parts.append(f'<blockquote>{stripped[2:]}</blockquote>')
            elif stripped.startswith('- **'):
                match = stripped[2:].split('**: ', 1)
                if len(match) == 2:
                    key, value = match
                    html_parts.append(f'<p><strong>{key}:</strong> {value}</p>')
                else:
                    html_parts.append(f'<li>{stripped[2:]}</li>')
            elif stripped.startswith('- `'):
                content = stripped[2:]
                html_parts.append(f'<li>{content}</li>')
            elif stripped.startswith('- '):
                html_parts.append(f'<li>{stripped[2:]}</li>')
            elif stripped.startswith('|') and stripped.endswith('|'):
                if not in_table:
                    in_table = True
                    table_rows = []
                table_rows.append(stripped)
            elif stripped.startswith('---'):
                html_parts.append('<hr>')
            elif stripped == '':
                if in_table and table_rows:
                    html_parts.append(self._table_rows_to_html(table_rows))
                    in_table = False
                    table_rows = []
                html_parts.append('')
            else:
                html_parts.append(f'<p>{stripped}</p>')
        
        if in_table and table_rows:
            html_parts.append(self._table_rows_to_html(table_rows))
        
        html_parts.append('''
</body>
</html>
''')
        
        return '\n'.join(html_parts)

    def _table_rows_to_html(self, rows: List[str]) -> str:
        if len(rows) < 2:
            return ''
        
        header_row = rows[0]
        separator_row = rows[1] if len(rows) > 1 else ''
        data_rows = rows[2:] if len(rows) > 2 else []
        
        headers = [h.strip() for h in header_row.strip('|').split('|')]
        
        is_header_separator = all(c in '|-: ' for c in separator_row) if separator_row else False
        
        html_parts = ['<table>']
        
        html_parts.append('<thead><tr>')
        for h in headers:
            html_parts.append(f'<th>{h}</th>')
        html_parts.append('</tr></thead>')
        
        if is_header_separator:
            actual_data = data_rows
        else:
            actual_data = rows[1:]
        
        html_parts.append('<tbody>')
        for row in actual_data:
            cells = [c.strip() for c in row.strip('|').split('|')]
            html_parts.append('<tr>')
            for cell in cells:
                cell = cell.replace('🔴', '<span class="error">🔴</span>')
                cell = cell.replace('🟡', '<span class="warning">🟡</span>')
                cell = cell.replace('ℹ️', '<span class="info">ℹ️</span>')
                html_parts.append(f'<td>{cell}</td>')
            html_parts.append('</tr>')
        html_parts.append('</tbody>')
        
        html_parts.append('</table>')
        
        return '\n'.join(html_parts)
