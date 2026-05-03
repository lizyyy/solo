import http.server
import os
import socketserver
import sys
import webbrowser
from pathlib import Path
from typing import Optional

try:
    import markdown
    HAS_MARKDOWN = True
except ImportError:
    HAS_MARKDOWN = False


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        :root {{
            --primary-color: #2563eb;
            --secondary-color: #1e40af;
            --critical-bg: #fef2f2;
            --critical-border: #dc2626;
            --warning-bg: #fffbeb;
            --warning-border: #d97706;
            --info-bg: #eff6ff;
            --info-border: #2563eb;
            --text-color: #1f2937;
            --bg-color: #f9fafb;
            --card-bg: #ffffff;
            --border-color: #e5e7eb;
        }}
        
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: var(--text-color);
            background-color: var(--bg-color);
        }}
        
        .container {{
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
        }}
        
        header {{
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            color: white;
            padding: 30px 0;
            margin-bottom: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }}
        
        header h1 {{
            font-size: 2rem;
            margin-bottom: 10px;
            text-align: center;
        }}
        
        header .meta {{
            text-align: center;
            opacity: 0.9;
            font-size: 0.95rem;
        }}
        
        .content {{
            background: var(--card-bg);
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }}
        
        h1 {{
            font-size: 1.8rem;
            margin: 1.5rem 0 1rem 0;
            color: var(--secondary-color);
            border-bottom: 2px solid var(--primary-color);
            padding-bottom: 8px;
        }}
        
        h2 {{
            font-size: 1.4rem;
            margin: 1.3rem 0 0.8rem 0;
            color: var(--primary-color);
        }}
        
        h3 {{
            font-size: 1.2rem;
            margin: 1.2rem 0 0.6rem 0;
            color: #374151;
        }}
        
        p {{
            margin: 0.8rem 0;
        }}
        
        hr {{
            border: none;
            border-top: 2px dashed var(--border-color);
            margin: 2rem 0;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
            font-size: 0.95rem;
        }}
        
        th {{
            background: var(--primary-color);
            color: white;
            padding: 12px 15px;
            text-align: left;
            font-weight: 600;
        }}
        
        th:first-child {{
            border-radius: 8px 0 0 0;
        }}
        
        th:last-child {{
            border-radius: 0 8px 0 0;
        }}
        
        td {{
            padding: 10px 15px;
            border-bottom: 1px solid var(--border-color);
        }}
        
        tr:last-child td:first-child {{
            border-radius: 0 0 0 8px;
        }}
        
        tr:last-child td:last-child {{
            border-radius: 0 0 8px 0;
        }}
        
        tr:hover {{
            background-color: #f8fafc;
        }}
        
        strong {{
            color: var(--secondary-color);
            font-weight: 600;
        }}
        
        ul, ol {{
            margin: 1rem 0;
            padding-left: 1.5rem;
        }}
        
        li {{
            margin: 0.5rem 0;
        }}
        
        .issue-critical {{
            background: var(--critical-bg);
            border-left: 4px solid var(--critical-border);
            padding: 15px 20px;
            margin: 1rem 0;
            border-radius: 0 8px 8px 0;
        }}
        
        .issue-warning {{
            background: var(--warning-bg);
            border-left: 4px solid var(--warning-border);
            padding: 15px 20px;
            margin: 1rem 0;
            border-radius: 0 8px 8px 0;
        }}
        
        .issue-info {{
            background: var(--info-bg);
            border-left: 4px solid var(--info-border);
            padding: 15px 20px;
            margin: 1rem 0;
            border-radius: 0 8px 8px 0;
        }}
        
        .severity-badge {{
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            margin-right: 8px;
        }}
        
        .severity-critical {{
            background: #fee2e2;
            color: #dc2626;
        }}
        
        .severity-warning {{
            background: #fef3c7;
            color: #d97706;
        }}
        
        .severity-info {{
            background: #dbeafe;
            color: #2563eb;
        }}
        
        .timeline-table {{
            font-size: 0.9rem;
        }}
        
        .timeline-table td:first-child {{
            font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
            color: var(--primary-color);
            font-weight: 500;
        }}
        
        footer {{
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: #6b7280;
            font-size: 0.9rem;
        }}
        
        @media (max-width: 768px) {{
            .container {{
                padding: 10px;
            }}
            
            header {{
                border-radius: 0;
                margin: -10px -10px 20px -10px;
                padding: 20px 15px;
            }}
            
            .content {{
                padding: 15px;
            }}
            
            table {{
                display: block;
                overflow-x: auto;
            }}
            
            h1 {{
                font-size: 1.4rem;
            }}
            
            h2 {{
                font-size: 1.2rem;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            {content}
        </div>
        <footer>
            本报告由 Evacuation Review Tool 自动生成 | 消防演练疏散复盘工具
        </footer>
    </div>
</body>
</html>
"""


def convert_markdown_to_html(md_content: str, title: str = "疏散复盘报告") -> str:
    if HAS_MARKDOWN:
        md = markdown.Markdown(
            extensions=['tables', 'fenced_code', 'sane_lists']
        )
        body_html = md.convert(md_content)
    else:
        body_html = simple_markdown_convert(md_content)
    
    body_html = enhance_html(body_html)
    
    return HTML_TEMPLATE.format(
        title=title,
        content=body_html
    )


def simple_markdown_convert(md_content: str) -> str:
    lines = md_content.split('\n')
    html_lines = []
    in_code_block = False
    
    for line in lines:
        stripped = line.strip()
        
        if stripped.startswith('```'):
            in_code_block = not in_code_block
            continue
        
        if in_code_block:
            html_lines.append(f"<code>{line}</code>")
            continue
        
        if stripped.startswith('### '):
            html_lines.append(f"<h3>{stripped[4:]}</h3>")
        elif stripped.startswith('## '):
            html_lines.append(f"<h2>{stripped[3:]}</h2>")
        elif stripped.startswith('# '):
            html_lines.append(f"<h1>{stripped[2:]}</h1>")
        elif stripped.startswith('---'):
            html_lines.append("<hr>")
        elif stripped.startswith('|') and '|' in stripped:
            html_lines.append(line)
        elif stripped.startswith('- '):
            html_lines.append(f"<li>{stripped[2:]}</li>")
        elif stripped == '':
            html_lines.append('')
        else:
            processed = line
            processed = processed.replace('**', '<strong>').replace('**', '</strong>')
            processed = processed.replace('*', '<em>').replace('*', '</em>')
            if processed.strip():
                html_lines.append(f"<p>{processed}</p>")
            else:
                html_lines.append('')
    
    return '\n'.join(html_lines)


def enhance_html(html_content: str) -> str:
    lines = html_content.split('\n')
    result = []
    in_issue_section = False
    issue_type = None
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        if '严重问题' in stripped or 'Critical' in stripped:
            in_issue_section = True
            issue_type = 'critical'
        elif '警告问题' in stripped or 'Warning' in stripped:
            in_issue_section = True
            issue_type = 'warning'
        elif '信息问题' in stripped or 'Info' in stripped:
            in_issue_section = True
            issue_type = 'info'
        elif '<h' in stripped and in_issue_section and '问题' not in stripped:
            pass
        
        if stripped.startswith('<ul>'):
            result.append(line)
            continue
        
        if '严重' in stripped and ('🔴' in stripped or 'critical' in stripped.lower()):
            line = line.replace('🔴', '<span class="severity-badge severity-critical">严重</span>')
        elif '警告' in stripped and ('🟡' in stripped or 'warning' in stripped.lower()):
            line = line.replace('🟡', '<span class="severity-badge severity-warning">警告</span>')
        elif '信息' in stripped and ('🔵' in stripped or 'info' in stripped.lower()):
            line = line.replace('🔵', '<span class="severity-badge severity-info">信息</span>')
        
        if '<table>' in stripped:
            next_idx = i + 1
            lookahead = lines[next_idx] if next_idx < len(lines) else ''
            if '时间' in lookahead or '事件类型' in lookahead or 'timeline' in lookahead.lower():
                line = line.replace('<table>', '<table class="timeline-table">')
        
        result.append(line)
    
    return '\n'.join(result)


def generate_html_report(md_path: Path, output_path: Optional[Path] = None) -> Path:
    if not md_path.exists():
        raise FileNotFoundError(f"Markdown 文件不存在: {md_path}")
    
    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    first_line = md_content.split('\n')[0] if md_content else '疏散复盘报告'
    title = first_line.replace('#', '').strip() if '#' in first_line else '疏散复盘报告'
    
    html_content = convert_markdown_to_html(md_content, title)
    
    if output_path is None:
        output_path = md_path.parent / (md_path.stem + '.html')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    return output_path


class QuietHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def start_preview_server(
    directory: Path,
    port: int = 8080,
    open_browser: bool = True
) -> int:
    os.chdir(directory)
    
    try:
        with socketserver.TCPServer(("", port), QuietHTTPHandler) as httpd:
            preview_url = f"http://localhost:{port}/evacuation_report.html"
            
            print(f"\n✅ 预览服务器已启动")
            print(f"   本地地址: {preview_url}")
            print(f"   按 Ctrl+C 停止服务器")
            
            if open_browser:
                try:
                    webbrowser.open(preview_url)
                    print(f"   已在浏览器中打开")
                except Exception:
                    print(f"   请手动在浏览器中打开上述地址")
            
            print("\n" + "=" * 50)
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n\n👋 服务器已停止")
        return 0
    except OSError as e:
        if 'Address already in use' in str(e):
            print(f"\n⚠️  端口 {port} 已被占用，尝试端口 {port + 1}...")
            return start_preview_server(directory, port + 1, open_browser)
        raise


def run_preview(
    md_path: Optional[Path] = None,
    port: int = 8080,
    open_browser: bool = True
) -> int:
    if md_path is None:
        cwd = Path.cwd()
        candidates = [
            cwd / "output" / "evacuation_report.md",
            cwd / "evacuation_report.md",
        ]
        for candidate in candidates:
            if candidate.exists():
                md_path = candidate
                break
        
        if md_path is None:
            print("❌ 未找到 evacuation_report.md")
            print("   请先运行: python -m evacreview --sample")
            return 1
    
    print(f"📄 正在转换报告: {md_path}")
    
    try:
        html_path = generate_html_report(md_path)
        print(f"✅ HTML 报告已生成: {html_path}")
    except Exception as e:
        print(f"❌ 转换失败: {e}")
        return 1
    
    return start_preview_server(html_path.parent, port, open_browser)
