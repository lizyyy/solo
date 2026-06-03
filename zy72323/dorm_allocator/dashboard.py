import json
from pathlib import Path
from typing import Optional

from .core import DormAllocator
from .models import ReviewRole, RecordStatus


class SimpleDashboard:
    def __init__(self, data_dir: str = "./data"):
        self.allocator = DormAllocator(data_dir=data_dir)

    def render_html(self) -> str:
        runs_html = ""
        for run_id in self.allocator.list_run_ids():
            log = self.allocator.get_run_log(run_id)
            if log:
                runs_html += f"""
                <div class="run-card" onclick="showRunDetails('{run_id}')">
                    <div class="run-id">{run_id}</div>
                    <div class="run-type">{log.run_type}</div>
                    <div class="run-meta">{log.operator} | {log.record_count}条记录</div>
                </div>
                """

        demo_results = self.allocator.get_classroom_demo_results()
        demo_html = ""
        for result in demo_results:
            status_class = "status-issue" if "问题" in result.status_explanation else "status-ok"
            annotations_html = "".join([
                f'<div class="annotation">{ann}</div>'
                for ann in result.annotations_summary
            ])
            missing_html = "".join([
                f'<span class="missing-tag">{m}</span>'
                for m in result.missing_materials
            ])

            demo_html += f"""
            <div class="demo-card">
                <div class="demo-header">
                    <span class="student-name">{result.student_name}</span>
                    <span class="arrow">→</span>
                    <span class="dorm">{result.assigned_dorm}</span>
                    <span class="status-badge {status_class}">{result.status}</span>
                </div>
                <div class="demo-formula">
                    <strong>公式:</strong> {result.formula_used}
                </div>
                <div class="demo-calc">
                    <strong>计算:</strong> {result.calculation} = <span class="result">{result.result_display}</span>
                </div>
                <div class="demo-section">
                    <strong>状态说明:</strong> {result.status_explanation}
                </div>
                <div class="demo-section">
                    <strong>为何保留:</strong> {result.why_kept}
                </div>
                {f'<div class="demo-section"><strong>缺少材料:</strong> {missing_html}</div>' if result.missing_materials else ''}
                <div class="demo-section">
                    <strong>下一步:</strong> {result.next_action}
                </div>
                <div class="demo-section">
                    <strong>联系人:</strong> {result.next_contact}
                </div>
                {f'<div class="demo-annotations"><strong>批注:</strong>{annotations_html}</div>' if result.annotations_summary else ''}
            </div>
            """

        html = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>约束满足宿舍分配 - 教研看板</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; padding: 20px; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        h1 {{ color: #2c3e50; margin-bottom: 30px; text-align: center; }}
        h2 {{ color: #34495e; margin: 30px 0 15px; border-bottom: 2px solid #3498db; padding-bottom: 8px; }}
        
        .run-list {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }}
        .run-card {{ background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer; transition: transform 0.2s; }}
        .run-card:hover {{ transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }}
        .run-id {{ font-size: 18px; font-weight: bold; color: #2980b9; }}
        .run-type {{ color: #7f8c8d; font-size: 14px; margin: 5px 0; }}
        .run-meta {{ color: #95a5a6; font-size: 12px; }}
        
        .demo-card {{ background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }}
        .demo-header {{ display: flex; align-items: center; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }}
        .student-name {{ font-size: 20px; font-weight: bold; color: #2c3e50; }}
        .arrow {{ color: #95a5a6; }}
        .dorm {{ font-size: 18px; color: #27ae60; font-weight: 600; }}
        .status-badge {{ padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }}
        .status-issue {{ background: #ffebee; color: #c62828; }}
        .status-ok {{ background: #e8f5e9; color: #2e7d32; }}
        
        .demo-formula, .demo-calc {{ background: #f8f9fa; padding: 10px 15px; border-radius: 6px; margin: 8px 0; font-family: monospace; }}
        .result {{ font-weight: bold; color: #e67e22; font-size: 16px; }}
        .demo-section {{ margin: 10px 0; line-height: 1.6; color: #34495e; }}
        .demo-section strong {{ color: #2c3e50; }}
        
        .missing-tag {{ display: inline-block; background: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin: 2px; }}
        .demo-annotations {{ margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; }}
        .annotation {{ background: #e3f2fd; padding: 8px 12px; border-radius: 6px; margin: 5px 0; font-size: 14px; color: #1565c0; }}
        
        .workflow {{ background: white; padding: 25px; border-radius: 10px; margin-top: 30px; }}
        .step {{ display: flex; align-items: flex-start; gap: 15px; margin: 15px 0; }}
        .step-number {{ width: 30px; height: 30px; background: #3498db; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }}
        .step-content {{ flex: 1; }}
        .step-title {{ font-weight: bold; color: #2c3e50; margin-bottom: 5px; }}
        .step-desc {{ color: #7f8c8d; font-size: 14px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🏠 约束满足宿舍分配 - 教研看板</h1>
        
        <h2>📋 运行记录</h2>
        <div class="run-list">
            {runs_html}
        </div>
        
        <h2>🎓 课堂演示结果</h2>
        {demo_html}
        
        <div class="workflow">
            <h2>🔄 完整工作流程</h2>
            <div class="step">
                <div class="step-number">1</div>
                <div class="step-content">
                    <div class="step-title">旧公式截图第一次导入</div>
                    <div class="step-desc">系统自动检测分母为0的问题，保留原始空字符串，不自动归正常，标记为待复核</div>
                </div>
            </div>
            <div class="step">
                <div class="step-number">2</div>
                <div class="step-content">
                    <div class="step-title">教研负责人吴老师补看老师批注</div>
                    <div class="step-desc">老师批注后来补录到群里，吴老师回看时补充批注并审核</div>
                </div>
            </div>
            <div class="step">
                <div class="step-number">3</div>
                <div class="step-content">
                    <div class="step-title">课堂演示结果更新</div>
                    <div class="step-desc">补录批注后，演示结果自动更新，显示完整的审核轨迹和下一步动作</div>
                </div>
            </div>
            <div class="step">
                <div class="step-number">4</div>
                <div class="step-content">
                    <div class="step-title">数据复核人处理分母为0问题</div>
                    <div class="step-desc">分母为0的问题不自动修正，留给数据复核人确认后手动修正</div>
                </div>
            </div>
        </div>
    </div>
    <script>
        function showRunDetails(runId) {{
            alert('运行ID: ' + runId + '\\n\\n使用命令行查看详情:\\npython -m dorm_allocator.cli demo --run-id ' + runId);
        }}
    </script>
</body>
</html>
        """
        return html

    def save_dashboard(self, output_path: str = "dashboard.html"):
        html = self.render_html()
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"看板已生成: {output_path}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="生成宿舍分配教研看板")
    parser.add_argument("--data-dir", default="./data", help="数据目录")
    parser.add_argument("--output", default="dashboard.html", help="输出文件")
    args = parser.parse_args()

    dashboard = SimpleDashboard(data_dir=args.data_dir)
    dashboard.save_dashboard(args.output)
