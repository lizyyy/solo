# -*- coding: utf-8 -*-
from typing import Dict, List, Any
from datetime import datetime

class ReportGenerator:
    def __init__(self):
        pass
    
    def generate_markdown(self, project: Dict[str, Any]) -> str:
        lines = []
        
        lines.append(f'# {project.get("name", "客服聊天分析报告")}')
        lines.append('')
        lines.append(f'> 生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        lines.append(f'> 项目ID: {project.get("id", "N/A")}')
        lines.append('')
        
        lines.append('## 一、数据概览')
        lines.append('')
        
        data = project.get('data', {})
        clusters = project.get('clusters', [])
        quality_issues = project.get('quality_issues', [])
        
        stats_lines = [
            '| 指标 | 数值 |',
            '|------|------|',
            f'| 总会话数 | {data.get("total_sessions", 0)} |',
            f'| 聚类簇数 | {len(clusters)} |',
            f'| 质检问题数 | {len(quality_issues)} |'
        ]
        lines.extend(stats_lines)
        lines.append('')
        
        date_range = data.get('date_range', {})
        if date_range:
            try:
                min_date = date_range.get('min', '').split('T')[0]
                max_date = date_range.get('max', '').split('T')[0]
                lines.append(f'数据时间范围: {min_date} 至 {max_date}')
                lines.append('')
            except:
                pass
        
        lines.append('## 二、意图聚类分析')
        lines.append('')
        
        if clusters:
            lines.append('### 2.1 簇分布概览')
            lines.append('')
            
            cluster_table = [
                '| 簇名称 | 会话数 | 关键词 | 平均满意度 | 质检问题 |',
                '|--------|--------|--------|------------|----------|'
            ]
            
            for cluster in clusters:
                name = cluster.get('name', '未命名')
                size = cluster.get('size', 0)
                keywords = ', '.join(cluster.get('keywords', [])[:3])
                sat_stats = cluster.get('satisfaction_stats', {})
                avg_sat = sat_stats.get('mean', 'N/A')
                issues_count = len([i for i in cluster.get('quality_issues', []) if not i.get('resolved', False)])
                
                cluster_table.append(f'| {name} | {size} | {keywords} | {avg_sat} | {issues_count} |')
            
            lines.extend(cluster_table)
            lines.append('')
            
            lines.append('### 2.2 各簇详情')
            lines.append('')
            
            for idx, cluster in enumerate(clusters, 1):
                lines.append(f'#### {idx}. {cluster.get("name", "未命名")}')
                lines.append('')
                
                lines.append(f'- **会话数**: {cluster.get("size", 0)}')
                lines.append(f'- **关键词**: {", ".join(cluster.get("keywords", []))}')
                
                sat_stats = cluster.get('satisfaction_stats', {})
                if sat_stats.get('count', 0) > 0:
                    lines.append(f'- **平均满意度**: {sat_stats.get("mean", "N/A")} (共{sat_stats.get("count")}条评价)')
                
                rep_text = cluster.get('representative_text', '')
                if rep_text:
                    lines.append(f'- **代表性问题**: {rep_text[:150]}{"..." if len(rep_text) > 150 else ""}')
                
                merged_from = cluster.get('merged_from', [])
                if merged_from:
                    merged_names = ', '.join([m.get('name', '') for m in merged_from])
                    lines.append(f'- **合并来源**: {merged_names}')
                
                lines.append('')
                
                sample_sessions = cluster.get('sessions', [])[:3]
                if sample_sessions:
                    lines.append('**样例会话**:')
                    lines.append('')
                    
                    for s_idx, session in enumerate(sample_sessions, 1):
                        lines.append(f'<details>')
                        lines.append(f'<summary>会话 {session.get("session_id", "N/A")}</summary>')
                        lines.append('')
                        
                        messages = session.get('messages', [])
                        for msg in messages:
                            role = '👤 用户' if msg.get('role') == 'user' else '💬 客服'
                            content = msg.get('content', '')
                            lines.append(f'{role}: {content}')
                            lines.append('')
                        
                        lines.append('</details>')
                        lines.append('')
                
                cluster_issues = [i for i in cluster.get('quality_issues', []) if not i.get('resolved', False)]
                if cluster_issues:
                    lines.append('**质检问题**:')
                    lines.append('')
                    
                    for issue in cluster_issues:
                        sev = issue.get('severity', 'medium')
                        sev_icon = '🔴' if sev == 'high' else '🟡' if sev == 'medium' else '🟢'
                        lines.append(f'- {sev_icon} **{issue.get("rule_name", "未知问题")}**')
                        lines.append(f'  - {issue.get("message", "")}')
                        lines.append('')
            
        else:
            lines.append('> 暂无聚类数据，请先运行聚类分析。')
            lines.append('')
        
        lines.append('## 三、质检分析')
        lines.append('')
        
        if quality_issues:
            unresolved = [i for i in quality_issues if not i.get('resolved', False)]
            resolved = [i for i in quality_issues if i.get('resolved', False)]
            
            lines.append(f'- **总问题数**: {len(quality_issues)}')
            lines.append(f'- **待处理**: {len(unresolved)}')
            lines.append(f'- **已解决**: {len(resolved)}')
            lines.append('')
            
            if unresolved:
                lines.append('### 3.1 待处理问题')
                lines.append('')
                
                for issue in unresolved:
                    sev = issue.get('severity', 'medium')
                    sev_text = '高' if sev == 'high' else '中' if sev == 'medium' else '低'
                    sev_icon = '🔴' if sev == 'high' else '🟡' if sev == 'medium' else '🟢'
                    
                    lines.append(f'{sev_icon} **{issue.get("rule_name", "未知")}** (严重程度: {sev_text})')
                    lines.append('')
                    lines.append(f'> 会话: {issue.get("session_id", "N/A")}')
                    lines.append(f'> 簇: {issue.get("cluster_name", "N/A")}')
                    lines.append('')
                    lines.append(f'**问题描述**: {issue.get("message", "")}')
                    lines.append('')
                    
                    details = issue.get('details', {})
                    if details:
                        if 'missing_keywords' in details:
                            lines.append(f'- 缺失关键词: {", ".join(details["missing_keywords"][:5])}')
                        if 'found_forbidden' in details:
                            lines.append(f'- 违规词汇: {", ".join(details["found_forbidden"])}')
                        lines.append('')
                    
                    user_preview = issue.get('user_text_preview', '')
                    agent_preview = issue.get('agent_text_preview', '')
                    
                    if user_preview:
                        lines.append(f'**用户消息**: {user_preview}')
                    if agent_preview:
                        lines.append(f'**客服回复**: {agent_preview}')
                    lines.append('')
                    
                    lines.append('---')
                    lines.append('')
        else:
            lines.append('> 暂无质检问题，数据质量良好！')
            lines.append('')
        
        lines.append('## 四、改进建议')
        lines.append('')
        
        suggestions = self._generate_suggestions(clusters, quality_issues)
        if suggestions:
            for idx, sug in enumerate(suggestions, 1):
                lines.append(f'{idx}. **{sug.get("title", "建议")}**')
                lines.append('')
                lines.append(f'   {sug.get("description", "")}')
                lines.append('')
        else:
            lines.append('> 当前数据表现良好，暂无特别需要改进的地方。')
            lines.append('')
        
        lines.append('---')
        lines.append('')
        lines.append('*本报告由客服聊天意图聚类和质检台自动生成*')
        
        return '\n'.join(lines)
    
    def generate_html(self, project: Dict[str, Any]) -> str:
        md_content = self.generate_markdown(project)
        
        html_template = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #f8f9fa;
        }}
        .container {{
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        }}
        h1 {{ color: #1a1a1a; font-size: 2em; margin-bottom: 0.5em; border-bottom: 3px solid #4a90d9; padding-bottom: 0.3em; }}
        h2 {{ color: #2c3e50; font-size: 1.5em; margin-top: 1.5em; margin-bottom: 0.8em; border-left: 4px solid #4a90d9; padding-left: 12px; }}
        h3 {{ color: #34495e; font-size: 1.2em; margin-top: 1.2em; margin-bottom: 0.6em; }}
        h4 {{ color: #555; font-size: 1.1em; margin-top: 1em; margin-bottom: 0.5em; }}
        blockquote {{
            background: #f8f9fa;
            border-left: 4px solid #ddd;
            margin: 1em 0;
            padding: 10px 15px;
            color: #666;
            border-radius: 0 4px 4px 0;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
            font-size: 0.95em;
        }}
        th, td {{
            border: 1px solid #e0e0e0;
            padding: 12px;
            text-align: left;
        }}
        th {{
            background: #f5f7fa;
            font-weight: 600;
            color: #333;
        }}
        tr:nth-child(even) {{ background: #fafbfc; }}
        ul, ol {{ margin: 1em 0; padding-left: 2em; }}
        li {{ margin: 0.5em 0; }}
        hr {{ 
            border: none; 
            height: 1px; 
            background: #e0e0e0; 
            margin: 2em 0; 
        }}
        details {{
            background: #f8f9fa;
            border-radius: 6px;
            padding: 10px;
            margin: 10px 0;
        }}
        summary {{
            cursor: pointer;
            color: #4a90d9;
            font-weight: 500;
        }}
        summary:hover {{ color: #357abd; }}
        .severity-high {{ color: #dc3545; font-weight: 600; }}
        .severity-medium {{ color: #ffc107; font-weight: 600; }}
        .severity-low {{ color: #28a745; font-weight: 600; }}
        .message-user {{ color: #495057; background: #f1f3f5; padding: 8px 12px; border-radius: 8px; margin: 5px 0; }}
        .message-agent {{ color: #495057; background: #e7f5ff; padding: 8px 12px; border-radius: 8px; margin: 5px 0; }}
        .footer {{ text-align: center; color: #999; font-size: 0.85em; margin-top: 2em; padding-top: 1em; border-top: 1px solid #eee; }}
    </style>
</head>
<body>
    <div class="container">
        {content}
        <div class="footer">本报告由客服聊天意图聚类和质检台自动生成</div>
    </div>
</body>
</html>'''
        
        html_content = self._markdown_to_html(md_content)
        
        return html_template.format(
            title=project.get('name', '客服聊天分析报告'),
            content=html_content
        )
    
    def _markdown_to_html(self, md: str) -> str:
        import re
        
        lines = md.split('\n')
        html_lines = []
        
        i = 0
        in_table = False
        in_code = False
        table_rows = []
        
        while i < len(lines):
            line = lines[i]
            
            if line.startswith('# '):
                html_lines.append(f'<h1>{line[2:]}</h1>')
            elif line.startswith('## '):
                html_lines.append(f'<h2>{line[3:]}</h2>')
            elif line.startswith('### '):
                html_lines.append(f'<h3>{line[4:]}</h3>')
            elif line.startswith('#### '):
                html_lines.append(f'<h4>{line[5:]}</h4>')
            
            elif line.startswith('> '):
                quote_lines = []
                while i < len(lines) and lines[i].startswith('> '):
                    quote_lines.append(lines[i][2:])
                    i += 1
                i -= 1
                html_lines.append(f'<blockquote>{"<br>".join(quote_lines)}</blockquote>')
            
            elif line.strip().startswith('|') and '|' in line:
                if not in_table:
                    in_table = True
                    table_rows = []
                table_rows.append(line)
            
            elif in_table and line.strip() == '':
                if table_rows:
                    html_lines.append(self._parse_table(table_rows))
                    table_rows = []
                in_table = False
                html_lines.append('')
            
            elif line.startswith('- ') or line.startswith('* '):
                list_items = []
                while i < len(lines) and (lines[i].startswith('- ') or lines[i].startswith('* ')):
                    item = lines[i][2:]
                    list_items.append(f'<li>{item}</li>')
                    i += 1
                i -= 1
                html_lines.append(f'<ul>{"".join(list_items)}</ul>')
            
            elif re.match(r'^\d+\.\s', line):
                list_items = []
                while i < len(lines) and re.match(r'^\d+\.\s', lines[i]):
                    item = re.sub(r'^\d+\.\s', '', lines[i])
                    list_items.append(f'<li>{item}</li>')
                    i += 1
                i -= 1
                html_lines.append(f'<ol>{"".join(list_items)}</ol>')
            
            elif line.startswith('---'):
                html_lines.append('<hr>')
            
            elif line.startswith('<details>'):
                html_lines.append(line)
            elif line.startswith('<summary>'):
                html_lines.append(line)
            elif line.startswith('</details>'):
                html_lines.append(line)
            
            elif line.strip() == '':
                if in_table and table_rows:
                    html_lines.append(self._parse_table(table_rows))
                    table_rows = []
                    in_table = False
                html_lines.append('')
            
            else:
                processed = line
                processed = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', processed)
                processed = re.sub(r'\*(.*?)\*', r'<em>\1</em>', processed)
                processed = re.sub(r'👤', '👤', processed)
                processed = re.sub(r'💬', '💬', processed)
                
                if '👤 用户:' in processed:
                    processed = processed.replace('👤 用户:', '')
                    html_lines.append(f'<div class="message-user"><strong>用户:</strong> {processed.strip()}</div>')
                elif '💬 客服:' in processed:
                    processed = processed.replace('💬 客服:', '')
                    html_lines.append(f'<div class="message-agent"><strong>客服:</strong> {processed.strip()}</div>')
                else:
                    html_lines.append(f'<p>{processed}</p>')
            
            i += 1
        
        if in_table and table_rows:
            html_lines.append(self._parse_table(table_rows))
        
        return '\n'.join(html_lines)
    
    def _parse_table(self, rows):
        if len(rows) < 2:
            return ''
        
        header_row = rows[0]
        separator_row = rows[1] if len(rows) > 1 else ''
        
        header_cells = [c.strip() for c in header_row.strip().strip('|').split('|')]
        
        body_rows = []
        for row in rows[2:]:
            if '---' in row:
                continue
            cells = [c.strip() for c in row.strip().strip('|').split('|')]
            body_rows.append(cells)
        
        html = '<table>'
        html += '<thead><tr>'
        for cell in header_cells:
            html += f'<th>{cell}</th>'
        html += '</tr></thead>'
        
        if body_rows:
            html += '<tbody>'
            for row in body_rows:
                html += '<tr>'
                for cell in row:
                    html += f'<td>{cell}</td>'
                html += '</tr>'
            html += '</tbody>'
        
        html += '</table>'
        return html
    
    def _generate_suggestions(self, clusters: List[Dict], issues: List[Dict]) -> List[Dict]:
        suggestions = []
        
        unresolved = [i for i in issues if not i.get('resolved', False)]
        
        high_severity = [i for i in unresolved if i.get('severity') == 'high']
        if high_severity:
            categories = {}
            for i in high_severity:
                cat = i.get('category', '其他')
                categories[cat] = categories.get(cat, 0) + 1
            
            top_cat = max(categories.items(), key=lambda x: x[1])[0] if categories else '服务质量'
            
            suggestions.append({
                'title': f'重点关注{top_cat}类问题',
                'description': f'检测到 {len(high_severity)} 个高优先级质检问题，建议优先处理。主要问题类型: {", ".join(categories.keys())}'
            })
        
        if clusters:
            low_sat_clusters = []
            for c in clusters:
                stats = c.get('satisfaction_stats', {})
                mean = stats.get('mean')
                if mean is not None and mean < 3.5:
                    low_sat_clusters.append(c.get('name', '未命名'))
            
            if low_sat_clusters:
                suggestions.append({
                    'title': '低满意度簇改进',
                    'description': f'以下簇的平均满意度偏低，建议重点分析: {", ".join(low_sat_clusters)}。可抽样查看会话，了解用户不满意的具体原因。'
                })
            
            large_clusters = [c.get('name', '未命名') for c in clusters if c.get('size', 0) > 10]
            if large_clusters:
                suggestions.append({
                    'title': '高频问题标准化',
                    'description': f'以下簇的会话量较大: {", ".join(large_clusters)}。建议为这些高频问题准备标准化回复话术，提高回复一致性和效率。'
                })
        
        return suggestions
