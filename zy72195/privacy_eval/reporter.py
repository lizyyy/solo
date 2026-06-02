import json
from dataclasses import asdict
from typing import Dict, Any
from pathlib import Path
from jinja2 import Template
from tabulate import tabulate

from .models import EvaluationSummary, EvaluationResult, Evidence, StratifiedGroup


class ResultReporter:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _to_dict(self, obj: Any) -> Any:
        if hasattr(obj, '__dict__'):
            result = {}
            for k, v in obj.__dict__.items():
                if k.startswith('_'):
                    continue
                if isinstance(v, list):
                    result[k] = [self._to_dict(item) for item in v]
                elif isinstance(v, dict):
                    result[k] = {kk: self._to_dict(vv) for kk, vv in v.items()}
                elif hasattr(v, 'value'):
                    result[k] = v.value
                elif hasattr(v, 'isoformat'):
                    result[k] = v.isoformat()
                else:
                    result[k] = self._to_dict(v)
            return result
        elif isinstance(obj, list):
            return [self._to_dict(item) for item in obj]
        elif isinstance(obj, dict):
            return {kk: self._to_dict(vv) for kk, vv in obj.items()}
        else:
            return obj

    def export_json(self, summary: EvaluationSummary, filename: str = None) -> str:
        if not filename:
            filename = f"evaluation_{summary.model_version}.json"
        filepath = self.output_dir / filename

        data = self._to_dict(summary)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return str(filepath)

    def export_html(self, summary: EvaluationSummary, filename: str = None) -> str:
        if not filename:
            filename = f"evaluation_{summary.model_version}.html"
        filepath = self.output_dir / filename

        template = Template("""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>隐私脱敏效果评估报告 - {{ model_version }}</title>
    <style>
        body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; margin: 20px; }
        h1 { color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px; }
        h2 { color: #4a90e2; margin-top: 30px; }
        h3 { color: #555; }
        .summary-box { background: #f5f8ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; }
        .metric-value { font-size: 24px; font-weight: bold; color: #4a90e2; }
        .metric-label { color: #666; font-size: 14px; }
        .pass { color: #27ae60; }
        .fail { color: #e74c3c; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background: #f0f4f8; color: #333; }
        tr:hover { background: #f9f9f9; }
        .error-row { background: #fff5f5; }
        .correct-row { background: #f5fff5; }
        .evidence { background: #fff9e6; padding: 10px; border-left: 3px solid #f39c12; margin: 8px 0; font-size: 13px; }
        .evidence-source { color: #666; font-size: 12px; }
        .note { background: #e8f4fd; padding: 10px; border-left: 3px solid #3498db; margin: 8px 0; }
        .conflict { background: #fdecea; padding: 10px; border-left: 3px solid #e74c3c; margin: 8px 0; }
        .threshold-alert { background: #fff3cd; padding: 10px; border-left: 3px solid #ffc107; margin: 8px 0; }
        code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
        .link { color: #4a90e2; text-decoration: none; }
        .link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>隐私脱敏效果评估报告</h1>

    <div class="summary-box">
        <div><strong>模型版本：</strong>{{ model_version }}</div>
        <div><strong>评估时间：</strong>{{ eval_time }}</div>
    </div>

    <h2>总体指标</h2>
    <div class="summary-box">
        <div class="metric">
            <div class="metric-value">{{ total_records }}</div>
            <div class="metric-label">总记录数</div>
        </div>
        <div class="metric">
            <div class="metric-value pass">{{ correct_count }}</div>
            <div class="metric-label">正确数</div>
        </div>
        <div class="metric">
            <div class="metric-value fail">{{ error_count }}</div>
            <div class="metric-label">错误数</div>
        </div>
        <div class="metric">
            <div class="metric-value">{{ "%.2f%%"|format(precision*100) }}</div>
            <div class="metric-label">精确率</div>
        </div>
        <div class="metric">
            <div class="metric-value">{{ "%.2f%%"|format(recall*100) }}</div>
            <div class="metric-label">召回率</div>
        </div>
        <div class="metric">
            <div class="metric-value">{{ "%.2f%%"|format(f1_score*100) }}</div>
            <div class="metric-label">F1分数</div>
        </div>
    </div>

    {% if notes %}
    <h2>阈值告警</h2>
    {% for note in notes %}
    <div class="threshold-alert">{{ note }}</div>
    {% endfor %}
    {% endif %}

    {% if conflicts %}
    <h2>未解决冲突 ({{ conflicts|length }})</h2>
    {% for conflict in conflicts %}
    <div class="conflict">
        <strong>[{{ conflict.conflict_type }}]</strong> {{ conflict.record_id }}: {{ conflict.description }}
        <div style="margin-top: 8px;">
            <strong>证据：</strong>
            {% for ev in conflict.evidences %}
            <div class="evidence">
                <div><strong>{{ ev.source_type }}</strong>: {{ ev.field }} = <code>{{ ev.value }}</code></div>
                {% if ev.link %}
                <div class="evidence-source">来源: <a href="{{ ev.link }}" class="link">{{ ev.link }}</a></div>
                {% endif %}
            </div>
            {% endfor %}
        </div>
    </div>
    {% endfor %}
    {% endif %}

    <h2>按敏感类型分层</h2>
    <table>
        <tr>
            <th>敏感类型</th>
            <th>总数</th>
            <th>正确数</th>
            <th>错误数</th>
            <th>准确率</th>
            <th>错误类型分布</th>
        </tr>
        {% for key, group in by_sensitive_type.items() %}
        <tr class="{{ 'error-row' if group.error_count > 0 else 'correct-row' }}">
            <td><strong>{{ group.group_name }}</strong></td>
            <td>{{ group.total_count }}</td>
            <td class="pass">{{ group.correct_count }}</td>
            <td class="fail">{{ group.error_count }}</td>
            <td>{{ "%.2f%%"|format(group.correct_count/group.total_count*100) if group.total_count > 0 else "N/A" }}</td>
            <td>
                {% for et, cnt in group.error_types.items() %}
                <span style="background: #ffe0e0; padding: 2px 6px; margin: 2px; border-radius: 3px; font-size: 12px;">
                    {{ et }}: {{ cnt }}
                </span>
                {% endfor %}
            </td>
        </tr>
        {% endfor %}
    </table>

    <h2>按错误类型分层</h2>
    <table>
        <tr>
            <th>错误类型</th>
            <th>数量</th>
            <th>涉及记录</th>
        </tr>
        {% for key, group in by_error_type.items() %}
        {% if key != 'correct' %}
        <tr class="error-row">
            <td><strong>{{ group.group_name }}</strong></td>
            <td class="fail">{{ group.error_count }}</td>
            <td>
                {% for r in group.records[:5] %}
                <code>{{ r.record_id }}</code>
                {% if not loop.last %}, {% endif %}
                {% endfor %}
                {% if group.records|length > 5 %}
                ... 共 {{ group.records|length }} 条
                {% endif %}
            </td>
        </tr>
        {% endif %}
        {% endfor %}
    </table>

    <h2>错误详情</h2>
    {% for key, group in by_error_type.items() %}
    {% if key != 'correct' and group.error_count > 0 %}
    <h3>{{ group.group_name }} ({{ group.error_count }}条)</h3>
    {% for result in group.records %}
    <div class="error-row" style="padding: 15px; margin: 10px 0; border-radius: 8px;">
        <div><strong>记录ID：</strong><code>{{ result.record_id }}</code></div>
        <div><strong>敏感类型：</strong>{{ result.sensitive_type }}</div>
        <div><strong>检测值：</strong><code>{{ result.detected_value or '(空)' }}</code></div>
        <div><strong>期望值：</strong><code>{{ result.expected_value or '(空)' }}</code></div>
        <div><strong>模型级别：</strong>{{ result.model_level }}</div>
        <div><strong>期望级别：</strong>{{ result.expected_level }}</div>
        {% if result.note %}
        <div class="note"><strong>评估说明：</strong>{{ result.note }}</div>
        {% endif %}
        <div style="margin-top: 8px;">
            <strong>证据：</strong>
            {% for ev in result.evidences %}
            <div class="evidence">
                <div><strong>{{ ev.source_type }}</strong>: {{ ev.field }} = <code>{{ ev.value }}</code></div>
                {% if ev.link %}
                <div class="evidence-source">来源: <a href="{{ ev.link }}" class="link">{{ ev.link }}</a></div>
                {% endif %}
            </div>
            {% endfor %}
        </div>
    </div>
    {% endfor %}
    {% endif %}
    {% endfor %}

    <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px;">
        本报告由隐私脱敏效果评估工具自动生成
    </div>
</body>
</html>
        """)

        from datetime import datetime
        html = template.render(
            model_version=summary.model_version,
            eval_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            total_records=summary.total_records,
            correct_count=summary.correct_count,
            error_count=summary.error_count,
            precision=summary.precision,
            recall=summary.recall,
            f1_score=summary.f1_score,
            notes=summary.notes,
            conflicts=summary.conflicts,
            by_sensitive_type=summary.by_sensitive_type,
            by_error_type=summary.by_error_type
        )

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)

        return str(filepath)

    def print_summary(self, summary: EvaluationSummary):
        print("\n" + "=" * 60)
        print("  隐私脱敏效果评估报告")
        print("=" * 60)
        print(f"  模型版本: {summary.model_version}")
        print(f"  总记录数: {summary.total_records}")
        print(f"  正确: {summary.correct_count} | 错误: {summary.error_count}")
        print(f"  精确率: {summary.precision:.2%} | 召回率: {summary.recall:.2%} | F1: {summary.f1_score:.2%}")
        print("-" * 60)

        if summary.notes:
            print("\n  【阈值告警】")
            for note in summary.notes:
                print(f"    ⚠️  {note}")

        if summary.conflicts:
            print(f"\n  【未解决冲突】({len(summary.conflicts)}条)")
            for cf in summary.conflicts:
                print(f"    ❌ [{cf.conflict_type.value}] {cf.record_id}: {cf.description}")

        print("\n  【按敏感类型分层】")
        type_rows = []
        for key, group in summary.by_sensitive_type.items():
            acc = group.correct_count / group.total_count * 100 if group.total_count > 0 else 0
            type_rows.append([
                group.group_name,
                group.total_count,
                group.correct_count,
                group.error_count,
                f"{acc:.1f}%",
                ", ".join([f"{k}:{v}" for k, v in group.error_types.items()]) or "-"
            ])
        print(tabulate(type_rows, headers=["类型", "总数", "正确", "错误", "准确率", "错误分布"],
                       tablefmt="simple"))

        print("\n  【按错误类型分层】")
        error_rows = []
        for key, group in summary.by_error_type.items():
            if key != 'correct' and group.error_count > 0:
                sample_ids = ", ".join([r.record_id for r in group.records[:3]])
                if len(group.records) > 3:
                    sample_ids += f" ...(共{len(group.records)}条)"
                error_rows.append([group.group_name, group.error_count, sample_ids])
        if error_rows:
            print(tabulate(error_rows, headers=["错误类型", "数量", "示例记录"], tablefmt="simple"))
        else:
            print("    无错误 ✓")

        print("\n" + "=" * 60 + "\n")

    def print_conflicts(self, conflicts):
        print("\n" + "=" * 60)
        print("  冲突案例清单")
        print("=" * 60)

        if not conflicts:
            print("\n  暂无冲突案例 ✓")
            print("\n" + "=" * 60 + "\n")
            return

        for i, cf in enumerate(conflicts, 1):
            status = "✅ 已解决" if cf.resolved else "❌ 未解决"
            print(f"\n  [{i}] {cf.record_id} - {status}")
            print(f"  类型: {cf.conflict_type.value}")
            print(f"  描述: {cf.description}")
            if cf.resolution_note:
                print(f"  解决说明: {cf.resolution_note}")
            print(f"  证据:")
            for ev in cf.evidences:
                print(f"    - {ev.source_type}: {ev.field} = {ev.value}")
                if ev.link:
                    print(f"      来源: {ev.link}")

        print("\n" + "=" * 60 + "\n")

    def print_diff(self, summary_v1: EvaluationSummary, summary_v2: EvaluationSummary):
        print("\n" + "=" * 60)
        print(f"  版本对比: {summary_v1.model_version} → {summary_v2.model_version}")
        print("=" * 60)

        delta_p = summary_v2.precision - summary_v1.precision
        delta_r = summary_v2.recall - summary_v1.recall
        delta_f1 = summary_v2.f1_score - summary_v1.f1_score
        delta_err = summary_v2.error_count - summary_v1.error_count

        def sign(v):
            return "+" if v > 0 else ""

        print(f"\n  指标变化:")
        print(f"    精确率: {summary_v1.precision:.2%} → {summary_v2.precision:.2%} ({sign(delta_p)}{delta_p:+.2%})")
        print(f"    召回率: {summary_v1.recall:.2%} → {summary_v2.recall:.2%} ({sign(delta_r)}{delta_r:+.2%})")
        print(f"    F1分数: {summary_v1.f1_score:.2%} → {summary_v2.f1_score:.2%} ({sign(delta_f1)}{delta_f1:+.2%})")
        print(f"    错误数: {summary_v1.error_count} → {summary_v2.error_count} ({sign(delta_err)}{delta_err:+d})")

        all_types = set(list(summary_v1.by_sensitive_type.keys()) + list(summary_v2.by_sensitive_type.keys()))

        print(f"\n  各类型准确率变化:")
        diff_rows = []
        for st in sorted(all_types):
            g1 = summary_v1.by_sensitive_type.get(st)
            g2 = summary_v2.by_sensitive_type.get(st)
            acc1 = g1.correct_count / g1.total_count * 100 if g1 and g1.total_count > 0 else 0
            acc2 = g2.correct_count / g2.total_count * 100 if g2 and g2.total_count > 0 else 0
            delta = acc2 - acc1
            diff_rows.append([
                st,
                g1.total_count if g1 else 0,
                g2.total_count if g2 else 0,
                f"{acc1:.1f}%",
                f"{acc2:.1f}%",
                f"{sign(delta)}{delta:+.1f}%"
            ])
        print(tabulate(diff_rows, headers=["类型", "v1样本", "v2样本", "v1准确率", "v2准确率", "变化"],
                       tablefmt="simple"))

        print("\n" + "=" * 60 + "\n")
