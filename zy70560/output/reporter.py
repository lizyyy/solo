import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List


class Reporter:
    def __init__(self, verbose=False):
        self.verbose = verbose

    def print_summary(self, analysis):
        print("=" * 70)
        print("  Python 导入影子 CLI - 诊断报告")
        print("=" * 70)
        print()
        print("模块名称:", analysis["module_name"])
        print("候选数量:", analysis["total_candidates"])
        conflict_status = "发现冲突!" if analysis["has_conflicts"] else "无冲突 ✓"
        print("冲突状态:", conflict_status)
        
        if analysis.get("has_path_errors"):
            print("路径错误: 发现", len(analysis.get("path_errors", [])), "个错误 ⚠️")
        print()

        if analysis["primary_candidate"]:
            primary = analysis["primary_candidate"]
            print("-> 实际将导入的模块:")
            print("   路径:", primary["path"])
            print("   类型:", primary["module_type"])
            if primary.get("errors"):
                for err in primary["errors"]:
                    print("   ⚠️ ", err)
        print()
        print("导入说明:", analysis["import_explanation"])
        print()

        if analysis["conflicts_detail"]:
            print("!" * 50)
            print("  发现冲突! 以下模块将被遮蔽:")
            print("!" * 50)
            print()
            for conflict in analysis["conflicts_detail"]:
                print("  冲突 #", conflict["conflict_index"])
                print("    被遮蔽:", conflict["shadowed_path"])
                print("    原因:", conflict["reason"])
                print()
        
        if analysis.get("has_path_errors"):
            print("x" * 50)
            print("  路径/搜索错误:")
            print("x" * 50)
            print()
            for err in analysis.get("path_errors", []):
                print("  错误 #", err.get("position", 0))
                print("    输入:", err.get("raw_input", "N/A"))
                print("    原因:", err.get("reason", "N/A"))
                print()
        
        print("-" * 70)
        print("搜索路径顺序 (前10个):")
        for idx, path in enumerate(analysis["search_paths"][:10]):
            print("  #", idx, ":", path)
        if len(analysis["search_paths"]) > 10:
            print("  ... 还有", len(analysis["search_paths"]) - 10, "个路径")
        print()

    def write_json(self, analysis, output_path):
        output = {
            "generated_at": datetime.now().isoformat(),
            "version": "1.0.0",
        }
        output.update(analysis)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print("JSON 结果已保存到:", output_path)
    
    def write_html_report(self, analysis, output_path):
        has_conflict_class = "conflict" if analysis["has_conflicts"] else "no-conflict"
        conflict_badge = "发现冲突 ⚠️" if analysis["has_conflicts"] else "无冲突 ✓"
        has_errors = analysis.get("has_path_errors", False)
        error_badge = "有路径错误 ⚠️" if has_errors else ""
        
        candidates_html = ""
        for idx, cand in enumerate(analysis["all_candidates"]):
            is_primary = idx == 0
            row_class = "primary" if is_primary else "shadowed"
            badge = "✓ 将导入" if is_primary else "被遮蔽"
            errors_html = ""
            if cand.get("errors"):
                errors_html = "<br>".join([f'<span style="color: #dc2626;">⚠️ {err}</span>' for err in cand["errors"]])
            candidates_html += f'''            <tr class="{row_class}">
                <td>{idx + 1}</td>
                <td>{badge}</td>
                <td><code>{cand["path"]}</code>{errors_html}</td>
                <td>{cand["module_type"]}</td>
                <td>#{cand["priority"]}</td>
            </tr>
            '''
        
        errors_html = ""
        if analysis.get("path_errors"):
            errors_html = '''
        <div class="card errors-card">
            <h3>❌ 路径/搜索错误</h3>
            <table class="error-table">
                <thead><tr><th>#</th><th>原始输入</th><th>原因</th></tr></thead>
                <tbody>
            '''
            for err in analysis["path_errors"]:
                errors_html += f'''
                <tr>
                    <td>{err.get("position", 0)}</td>
                    <td><code>{err.get("raw_input", "N/A")}</code></td>
                    <td>{err.get("reason", "N/A")}</td>
                </tr>
                '''
            errors_html += '''
                </tbody>
            </table>
        </div>
            '''
        
        search_paths_html = "".join(
            f'<li class="search-path"><code>{p}</code></li>'
            for p in analysis["search_paths"][:20]
        )
        
        html_content = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Python 导入影子 - {analysis["module_name"]}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6; padding: 2rem; max-width: 1000px; margin: 0 auto; color: #1f2937; }}
        h1 {{ color: #2d3748; margin-bottom: 1rem; }}
        h3 {{ color: #2d3748; margin-bottom: 1rem; font-size: 1.125rem; }}
        .badges {{ display: flex; gap: 0.5rem; margin-bottom: 2rem; }}
        .badge {{ display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px;
                 font-weight: 600; font-size: 0.875rem; }}
        .conflict {{ background: #fed7d7; color: #c53030; }}
        .no-conflict {{ background: #c6f6d5; color: #22543d; }}
        .errors-badge {{ background: #fef3c7; color: #92400e; }}
        .header {{ display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }}
        .card {{ background: #f7fafc; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }}
        .card.errors-card {{ background: #fef2f2; }}
        code {{ background: #edf2f7; padding: 0.125rem 0.375rem; border-radius: 4px; font-family: 'Monaco', monospace; }}
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ text-align: left; padding: 0.75rem; border-bottom: 1px solid #e2e8f0; }}
        th {{ background: #edf2f7; font-weight: 600; }}
        .primary {{ background: #f0fff4; }}
        .shadowed {{ background: #fff5f5; }}
        ul {{ margin-left: 1.5rem; }}
        li {{ margin-bottom: 0.5rem; }}
        .explanation {{ background: #ebf8ff; border-left: 4px solid #3182ce; padding: 1rem; margin: 1rem 0; border-radius: 0 4px 4px 0; }}
        .footer {{ margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;
                   color: #718096; font-size: 0.875rem; text-align: center; }}
        .error-table th {{ background: #fecaca; }}
        .error-table tr:nth-child(even) {{ background: #fef2f2; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🐍 Python 导入影子诊断报告</h1>
        <div class="badges">
            <span class="badge {has_conflict_class}">{conflict_badge}</span>
            {f'<span class="badge errors-badge">{error_badge}</span>' if has_errors else ''}
        </div>
    </div>

    <div class="card">
        <h3>📦 模块信息</h3>
        <p><strong>模块名:</strong> <code>{analysis["module_name"]}</code></p>
        <p><strong>候选数量:</strong> {analysis["total_candidates"]} 个</p>
        <div class="explanation">
            <strong>导入说明:</strong> {analysis["import_explanation"]}
        </div>
    </div>

    <div class="card">
        <h3>🔍 候选模块列表</h3>
        <table>
            <thead>
                <tr>
                    <th>序号</th>
                    <th>状态</th>
                    <th>路径</th>
                    <th>类型</th>
                    <th>优先级</th>
                </tr>
            </thead>
            <tbody>
                {candidates_html}
            </tbody>
        </table>
    </div>

    {errors_html}

    <div class="card">
        <h3>📋 搜索路径顺序</h3>
        <ol>
            {search_paths_html}
        </ol>
        {f'<p style="color: #6b7280; margin-top: 0.5rem;">... 还有 {len(analysis["search_paths"]) - 20} 个路径</p>' if len(analysis["search_paths"]) > 20 else ''}
    </div>

    <div class="footer">
        <p>生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        <p>Python 导入影子 CLI v1.1.0</p>
    </div>
</body>
</html>
'''
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print("HTML 报告已保存到:", output_path)

    def print_error(self, message):
        print("错误:", message, file=sys.stderr)

