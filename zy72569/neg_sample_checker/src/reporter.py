import json
import os
import numpy as np
from datetime import datetime
from typing import Dict, List
from jinja2 import Template
from .data_models import WorkflowStep, CheckResult, ConflictEvidence


class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ project_name }} - 检查报告</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
        h2 { color: #007bff; margin-top: 30px; border-left: 4px solid #007bff; padding-left: 10px; }
        h3 { color: #555; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .summary-card.warning { border-left-color: #ffc107; }
        .summary-card.error { border-left-color: #dc3545; }
        .summary-card.success { border-left-color: #28a745; }
        .card-title { font-size: 0.9em; color: #666; margin-bottom: 5px; }
        .card-value { font-size: 1.5em; font-weight: bold; color: #333; }
        .step-section { margin: 20px 0; padding: 20px; background: #fafafa; border-radius: 6px; }
        .check-item { margin: 15px 0; padding: 15px; background: white; border-radius: 4px; border: 1px solid #e0e0e0; }
        .check-item.passed { border-left: 4px solid #28a745; }
        .check-item.warning { border-left: 4px solid #ffc107; }
        .check-item.error { border-left: 4px solid #dc3545; }
        .check-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .check-name { font-weight: bold; font-size: 1.1em; }
        .badge { padding: 4px 10px; border-radius: 12px; font-size: 0.85em; font-weight: bold; }
        .badge.passed { background: #d4edda; color: #155724; }
        .badge.warning { background: #fff3cd; color: #856404; }
        .badge.error { background: #f8d7da; color: #721c24; }
        .badge.pending { background: #e2e3e5; color: #383d41; }
        .suggestion { margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 4px; color: #856404; }
        .conflict-item { margin: 10px 0; padding: 12px; background: #fff5f5; border-radius: 4px; border: 1px solid #feb2b2; }
        .conflict-header { font-weight: bold; color: #c53030; margin-bottom: 8px; }
        .conflict-data { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .conflict-side { padding: 8px; background: white; border-radius: 4px; }
        .resolution-buttons { margin-top: 10px; }
        .resolution-buttons button { padding: 6px 12px; margin-right: 8px; border: none; border-radius: 4px; cursor: pointer; }
        .btn-confirm { background: #28a745; color: white; }
        .btn-reject { background: #dc3545; color: white; }
        .details-box { margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 0.9em; overflow-x: auto; }
        .meta-info { color: #666; font-size: 0.9em; margin-bottom: 20px; }
        .history-section { margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e0e0e0; }
        th { background: #f8f9fa; font-weight: bold; }
        .warning-note { background: #fff3cd; border: 1px solid #ffeeba; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .warning-note h4 { color: #856404; margin-top: 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>{{ project_name }}</h1>
        <div class="meta-info">
            <p><strong>报告生成时间：</strong>{{ generated_at }}</p>
            <p><strong>版本：</strong>{{ version }}</p>
            <p><strong>当前阈值：</strong>{{ current_threshold }}</p>
        </div>

        <h2>概览</h2>
        <div class="summary-grid">
            <div class="summary-card success">
                <div class="card-title">步骤总数</div>
                <div class="card-value">{{ total_steps }}</div>
            </div>
            <div class="summary-card success">
                <div class="card-title">已完成步骤</div>
                <div class="card-value">{{ completed_steps }}</div>
            </div>
            <div class="summary-card warning">
                <div class="card-title">警告数</div>
                <div class="card-value">{{ total_warnings }}</div>
            </div>
            <div class="summary-card error">
                <div class="card-title">错误数</div>
                <div class="card-value">{{ total_errors }}</div>
            </div>
            <div class="summary-card warning">
                <div class="card-title">待处理冲突</div>
                <div class="card-value">{{ pending_conflicts }}</div>
            </div>
        </div>

        {% if pending_conflicts > 0 or total_warnings > 0 %}
        <div class="warning-note">
            <h4>⚠️ 重要提示</h4>
            <p>检测到需要人工复核的内容。少数类样本被总指标盖住时，<strong>请勿直接归为正常</strong>，请留给算法工程师复核。负样本列表与召回候选表存在冲突时，请数据科学家林姐<strong>确认或驳回</strong>，不要替业务同事自动拍板。</p>
        </div>
        {% endif %}

        {% for step_id, step in steps.items() %}
        <div class="step-section">
            <h2>步骤{{ loop.index }}：{{ step.step_name }} 
                <span class="badge {% if step.status == 'completed' %}passed{% elif step.status == 'failed' %}error{% else %}pending{% endif %}">
                    {{ step.status }}
                </span>
            </h2>
            <p><small>数据版本：{{ step.data_version or 'N/A' }}</small></p>

            {% if step.results %}
            <h3>检查结果</h3>
            {% for result in step.results %}
            <div class="check-item {{ result.severity }}">
                <div class="check-header">
                    <span class="check-name">{{ result.check_name }}</span>
                    <span class="badge {{ 'passed' if result.passed else result.severity }}">
                        {{ '通过' if result.passed else ('警告' if result.severity == 'warning' else '失败') }}
                    </span>
                </div>
                {% if result.suggestion %}
                <div class="suggestion">💡 {{ result.suggestion }}</div>
                {% endif %}
                <details class="details-box">
                    <summary>查看详情</summary>
                    <pre>{{ result.details | tojson_pretty }}</pre>
                </details>
            </div>
            {% endfor %}
            {% endif %}

            {% if step.conflicts %}
            <h3>冲突证据（{{ step.conflicts | length }} 条）</h3>
            {% for conflict in step.conflicts %}
            <div class="conflict-item">
                <div class="conflict-header">
                    {{ conflict.description }}
                    <span class="badge {{ 'passed' if conflict.resolution != 'pending' else 'pending' }}">
                        {{ '已确认' if conflict.resolution == 'confirmed' else ('已驳回' if conflict.resolution == 'rejected' else '待处理') }}
                    </span>
                </div>
                <div class="conflict-data">
                    <div class="conflict-side">
                        <strong>负样本列表：</strong>
                        <pre>{{ conflict.neg_sample_data | tojson_pretty }}</pre>
                    </div>
                    <div class="conflict-side">
                        <strong>召回候选表：</strong>
                        <pre>{{ conflict.recall_candidate_data | tojson_pretty }}</pre>
                    </div>
                </div>
                {% if conflict.resolution == 'pending' %}
                <div class="resolution-buttons">
                    <button class="btn-confirm">✅ 林姐确认</button>
                    <button class="btn-reject">❌ 林姐驳回</button>
                </div>
                {% endif %}
            </div>
            {% endfor %}
            {% endif %}
        </div>
        {% endfor %}

        {% if history %}
        <div class="history-section">
            <h2>历史记录</h2>
            <table>
                <thead>
                    <tr>
                        <th>时间</th>
                        <th>数据源</th>
                        <th>阈值</th>
                        <th>Precision</th>
                        <th>Recall</th>
                    </tr>
                </thead>
                <tbody>
                    {% for h in history %}
                    <tr>
                        <td>{{ h.timestamp }}</td>
                        <td>{{ h.data_source }}</td>
                        <td>{{ h.threshold }}</td>
                        <td>{{ h.metrics.precision if 'precision' in h.metrics else 'N/A' }}</td>
                        <td>{{ h.metrics.recall if 'recall' in h.metrics else 'N/A' }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
        {% endif %}
    </div>
    <script>
        document.querySelectorAll('.btn-confirm, .btn-reject').forEach(btn => {
            btn.addEventListener('click', function() {
                const isConfirm = this.classList.contains('btn-confirm');
                const badge = this.closest('.conflict-item').querySelector('.badge');
                badge.textContent = isConfirm ? '已确认' : '已驳回';
                badge.className = 'badge passed';
                this.parentElement.remove();
            });
        });
    </script>
</body>
</html>
"""


class Reporter:
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_report(
        self,
        engine,
        report_name: str = None
    ) -> Dict[str, str]:
        report_name = report_name or f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        summary = engine.get_summary()
        steps_data = {}
        for sid, step in engine.steps.items():
            steps_data[sid] = {
                "step_name": step.step_name,
                "status": step.status,
                "data_version": step.data_version,
                "results": [
                    {
                        "check_name": r.check_name,
                        "passed": r.passed,
                        "severity": r.severity,
                        "suggestion": r.suggestion,
                        "details": r.details
                    }
                    for r in step.results
                ],
                "conflicts": [
                    {
                        "conflict_id": c.conflict_id,
                        "description": c.description,
                        "neg_sample_data": c.neg_sample_data,
                        "recall_candidate_data": c.recall_candidate_data,
                        "field": c.field,
                        "resolution": c.resolution
                    }
                    for c in step.conflicts
                ]
            }

        total_warnings = sum(
            sum(1 for r in s.results if r.severity == 'warning')
            for s in engine.steps.values()
        )
        total_errors = sum(
            sum(1 for r in s.results if r.severity == 'error')
            for s in engine.steps.values()
        )
        pending_conflicts = sum(
            sum(1 for c in s.conflicts if c.resolution == 'pending')
            for s in engine.steps.values()
        )
        completed_steps = sum(
            1 for s in engine.steps.values() if s.status == 'completed'
        )

        history_data = [
            {
                "timestamp": h.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "data_source": h.data_source,
                "threshold": h.threshold,
                "metrics": h.metrics
            }
            for h in engine.history
        ]

        report_data = {
            "project_name": summary["project"],
            "version": summary["version"],
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "current_threshold": summary["current_threshold"],
            "total_steps": len(engine.steps),
            "completed_steps": completed_steps,
            "total_warnings": total_warnings,
            "total_errors": total_errors,
            "pending_conflicts": pending_conflicts,
            "steps": steps_data,
            "history": history_data
        }

        json_path = os.path.join(self.output_dir, f"{report_name}.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2, cls=NumpyEncoder)

        html_path = os.path.join(self.output_dir, f"{report_name}.html")
        from jinja2 import Environment
        env = Environment()
        env.filters['tojson_pretty'] = lambda x: json.dumps(x, ensure_ascii=False, indent=2, cls=NumpyEncoder)
        template = env.from_string(HTML_TEMPLATE)
        html_content = template.render(**report_data)
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        return {
            "json": json_path,
            "html": html_path
        }
