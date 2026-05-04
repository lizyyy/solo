from datetime import datetime
from typing import List, Dict, Any, Optional
from backup_checker.comparator import format_file_size


ANOMALY_TYPE_LABELS = {
    'missing_in_target': '目标目录缺失',
    'extra_in_target': '目标目录多余',
    'possible_duplicate': '疑似重复',
    'hash_mismatch': '哈希不一致',
}

ANOMALY_TYPE_COLORS = {
    'missing_in_target': '#dc3545',
    'extra_in_target': '#ffc107',
    'possible_duplicate': '#fd7e14',
    'hash_mismatch': '#6f42c1',
}


def generate_markdown_report(comparison: Dict[str, Any], 
                              anomalies: List[Dict[str, Any]]) -> str:
    task_name = comparison.get('task_name', 'Unknown')
    started_at = comparison.get('scan_started_at', datetime.now().isoformat())
    
    if 'T' in started_at:
        started_at = started_at.replace('T', ' ')[:19]
    
    total_anomalies = len(anomalies)
    unconfirmed = sum(1 for a in anomalies if not a.get('manually_confirmed'))
    
    missing = [a for a in anomalies if a['anomaly_type'] == 'missing_in_target']
    extra = [a for a in anomalies if a['anomaly_type'] == 'extra_in_target']
    duplicates = [a for a in anomalies if a['anomaly_type'] == 'possible_duplicate']
    mismatches = [a for a in anomalies if a['anomaly_type'] == 'hash_mismatch']
    
    lines = []
    lines.append(f"# 备份巡检报告 - {task_name}")
    lines.append("")
    lines.append(f"**扫描时间**: {started_at}")
    lines.append(f"**比较记录 ID**: {comparison.get('id', 'N/A')}")
    lines.append("")
    lines.append("## 概要")
    lines.append("")
    lines.append(f"- **源目录文件数**: {comparison.get('missing_in_target', 0) + comparison.get('hash_mismatch', 0)}")
    lines.append(f"- **目标目录文件数**: {comparison.get('extra_in_target', 0) + comparison.get('hash_mismatch', 0)}")
    lines.append(f"- **目标目录缺失**: {len(missing)} 个文件")
    lines.append(f"- **目标目录多余**: {len(extra)} 个文件")
    lines.append(f"- **疑似重复**: {len(duplicates)} 组")
    lines.append(f"- **哈希不一致**: {len(mismatches)} 个文件")
    lines.append(f"- **待确认异常**: {unconfirmed} 个")
    lines.append("")
    
    if missing:
        lines.append("## 目标目录缺失的文件")
        lines.append("")
        lines.append("| # | 源路径 | 详情 | 状态 |")
        lines.append("|---|--------|------|------|")
        for i, a in enumerate(missing, 1):
            status = "已确认" if a.get('manually_confirmed') else "待确认"
            lines.append(f"| {i} | {a.get('source_path', 'N/A')} | {a.get('details', '')} | {status} |")
        lines.append("")
    
    if extra:
        lines.append("## 目标目录多余的文件")
        lines.append("")
        lines.append("| # | 目标路径 | 详情 | 状态 |")
        lines.append("|---|----------|------|------|")
        for i, a in enumerate(extra, 1):
            status = "已确认" if a.get('manually_confirmed') else "待确认"
            lines.append(f"| {i} | {a.get('target_path', 'N/A')} | {a.get('details', '')} | {status} |")
        lines.append("")
    
    if duplicates:
        lines.append("## 疑似重复文件")
        lines.append("")
        lines.append("| # | 哈希值 | 位置 | 文件数量 | 状态 |")
        lines.append("|---|--------|------|----------|------|")
        for i, a in enumerate(duplicates, 1):
            status = "已确认" if a.get('manually_confirmed') else "待确认"
            lines.append(f"| {i} | {a.get('details', '')[:50]}... | {a.get('details', '').split('位置: ')[-1].split()[0] if '位置:' in a.get('details','') else 'N/A'} | 多个 | {status} |")
        lines.append("")
        lines.append("### 详细文件列表")
        lines.append("")
        for i, a in enumerate(duplicates, 1):
            lines.append(f"#### 重复组 {i}")
            lines.append("")
            lines.append("```")
            lines.append(a.get('details', ''))
            lines.append("```")
            lines.append("")
    
    if mismatches:
        lines.append("## 哈希不一致的文件")
        lines.append("")
        lines.append("| # | 源路径 | 目标路径 | 状态 |")
        lines.append("|---|--------|----------|------|")
        for i, a in enumerate(mismatches, 1):
            status = "已确认" if a.get('manually_confirmed') else "待确认"
            lines.append(f"| {i} | {a.get('source_path', 'N/A')} | {a.get('target_path', 'N/A')} | {status} |")
        lines.append("")
    
    lines.append("---")
    lines.append("")
    lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
    
    return '\n'.join(lines)


def generate_html_report(comparison: Dict[str, Any],
                         anomalies: List[Dict[str, Any]]) -> str:
    task_name = comparison.get('task_name', 'Unknown')
    started_at = comparison.get('scan_started_at', datetime.now().isoformat())
    
    if 'T' in started_at:
        started_at = started_at.replace('T', ' ')[:19]
    
    missing = [a for a in anomalies if a['anomaly_type'] == 'missing_in_target']
    extra = [a for a in anomalies if a['anomaly_type'] == 'extra_in_target']
    duplicates = [a for a in anomalies if a['anomaly_type'] == 'possible_duplicate']
    mismatches = [a for a in anomalies if a['anomaly_type'] == 'hash_mismatch']
    
    total_anomalies = len(anomalies)
    unconfirmed = sum(1 for a in anomalies if not a.get('manually_confirmed'))
    
    html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>备份巡检报告 - {task_name}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .container {{ background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 15px; margin-bottom: 20px; }}
        h2 {{ color: #34495e; margin: 30px 0 15px; border-left: 4px solid #3498db; padding-left: 10px; }}
        h3 {{ color: #5d6d7e; margin: 20px 0 10px; }}
        .summary {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }}
        .summary-card {{
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            border: 1px solid #e9ecef;
        }}
        .summary-card .number {{
            font-size: 2em;
            font-weight: bold;
            color: #3498db;
        }}
        .summary-card .label {{
            color: #6c757d;
            font-size: 0.9em;
            margin-top: 5px;
        }}
        .summary-card.danger .number {{ color: #dc3545; }}
        .summary-card.warning .number {{ color: #ffc107; }}
        .summary-card.success .number {{ color: #28a745; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }}
        th, td {{
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }}
        tr:hover {{ background: #f8f9fa; }}
        .badge {{
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 500;
        }}
        .badge.pending {{ background: #fff3cd; color: #856404; }}
        .badge.confirmed {{ background: #d4edda; color: #155724; }}
        .meta {{
            color: #6c757d;
            font-size: 0.95em;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #e9ecef;
        }}
        .meta span {{ margin-right: 20px; }}
        .no-data {{
            text-align: center;
            padding: 40px;
            color: #6c757d;
            background: #f8f9fa;
            border-radius: 8px;
        }}
        pre {{
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 15px;
            overflow-x: auto;
            font-size: 0.9em;
            line-height: 1.5;
        }}
        footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            text-align: center;
            color: #6c757d;
            font-size: 0.9em;
        }}
        .anomaly-section {{ margin-bottom: 30px; }}
        .path-cell {{
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: monospace;
            font-size: 0.9em;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>备份巡检报告 - {task_name}</h1>
        
        <div class="meta">
            <span><strong>扫描时间:</strong> {started_at}</span>
            <span><strong>比较记录 ID:</strong> {comparison.get('id', 'N/A')}</span>
        </div>
        
        <h2>概要</h2>
        <div class="summary">
            <div class="summary-card danger">
                <div class="number">{len(missing)}</div>
                <div class="label">目标目录缺失</div>
            </div>
            <div class="summary-card warning">
                <div class="number">{len(extra)}</div>
                <div class="label">目标目录多余</div>
            </div>
            <div class="summary-card warning">
                <div class="number">{len(duplicates)}</div>
                <div class="label">疑似重复</div>
            </div>
            <div class="summary-card">
                <div class="number">{len(mismatches)}</div>
                <div class="label">哈希不一致</div>
            </div>
            <div class="summary-card {'' if unconfirmed > 0 else 'success'}">
                <div class="number">{unconfirmed}</div>
                <div class="label">待确认异常</div>
            </div>
        </div>
'''
    
    if missing:
        html += f'''
        <div class="anomaly-section">
            <h2>目标目录缺失的文件 ({len(missing)})</h2>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>源路径</th>
                        <th>详情</th>
                        <th>状态</th>
                    </tr>
                </thead>
                <tbody>
'''
        for i, a in enumerate(missing, 1):
            status_class = 'confirmed' if a.get('manually_confirmed') else 'pending'
            status_text = '已确认' if a.get('manually_confirmed') else '待确认'
            html += f'''
                    <tr>
                        <td>{i}</td>
                        <td class="path-cell" title="{a.get('source_path', '')}">{a.get('source_path', 'N/A')}</td>
                        <td>{a.get('details', '')}</td>
                        <td><span class="badge {status_class}">{status_text}</span></td>
                    </tr>
'''
        html += '''
                </tbody>
            </table>
        </div>
'''
    
    if extra:
        html += f'''
        <div class="anomaly-section">
            <h2>目标目录多余的文件 ({len(extra)})</h2>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>目标路径</th>
                        <th>详情</th>
                        <th>状态</th>
                    </tr>
                </thead>
                <tbody>
'''
        for i, a in enumerate(extra, 1):
            status_class = 'confirmed' if a.get('manually_confirmed') else 'pending'
            status_text = '已确认' if a.get('manually_confirmed') else '待确认'
            html += f'''
                    <tr>
                        <td>{i}</td>
                        <td class="path-cell" title="{a.get('target_path', '')}">{a.get('target_path', 'N/A')}</td>
                        <td>{a.get('details', '')}</td>
                        <td><span class="badge {status_class}">{status_text}</span></td>
                    </tr>
'''
        html += '''
                </tbody>
            </table>
        </div>
'''
    
    if duplicates:
        html += f'''
        <div class="anomaly-section">
            <h2>疑似重复文件 ({len(duplicates)})</h2>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>哈希值</th>
                        <th>位置</th>
                        <th>状态</th>
                    </tr>
                </thead>
                <tbody>
'''
        for i, a in enumerate(duplicates, 1):
            status_class = 'confirmed' if a.get('manually_confirmed') else 'pending'
            status_text = '已确认' if a.get('manually_confirmed') else '待确认'
            location = 'source' if '位置: source' in a.get('details', '') else 'target'
            html += f'''
                    <tr>
                        <td>{i}</td>
                        <td class="path-cell">{a.get('details', '')[:50]}...</td>
                        <td>{location}</td>
                        <td><span class="badge {status_class}">{status_text}</span></td>
                    </tr>
'''
        html += '''
                </tbody>
            </table>
            <h3>详细文件列表</h3>
'''
        for i, a in enumerate(duplicates, 1):
            html += f'''
            <h4>重复组 {i}</h4>
            <pre>{a.get('details', '')}</pre>
'''
        html += '''
        </div>
'''
    
    if mismatches:
        html += f'''
        <div class="anomaly-section">
            <h2>哈希不一致的文件 ({len(mismatches)})</h2>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>源路径</th>
                        <th>目标路径</th>
                        <th>状态</th>
                    </tr>
                </thead>
                <tbody>
'''
        for i, a in enumerate(mismatches, 1):
            status_class = 'confirmed' if a.get('manually_confirmed') else 'pending'
            status_text = '已确认' if a.get('manually_confirmed') else '待确认'
            html += f'''
                    <tr>
                        <td>{i}</td>
                        <td class="path-cell" title="{a.get('source_path', '')}">{a.get('source_path', 'N/A')}</td>
                        <td class="path-cell" title="{a.get('target_path', '')}">{a.get('target_path', 'N/A')}</td>
                        <td><span class="badge {status_class}">{status_text}</span></td>
                    </tr>
'''
        html += '''
                </tbody>
            </table>
        </div>
'''
    
    if total_anomalies == 0:
        html += '''
        <div class="no-data">
            <h3>🎉 备份状态良好！</h3>
            <p>未发现任何异常。</p>
        </div>
'''
    
    html += f'''
        <footer>
            报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        </footer>
    </div>
</body>
</html>
'''
    
    return html
