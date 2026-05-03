import json
import os
from dataclasses import asdict, is_dataclass
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from .models import Report, LabeledItem, Cluster, WeaknessPoint, Task
from config.loader import RulesConfig


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if is_dataclass(obj) and not isinstance(obj, type):
            return asdict(obj)
        if hasattr(obj, '__dict__'):
            return obj.__dict__
        return str(obj)


class Exporter:
    def __init__(self, rules_config: RulesConfig):
        self.rules = rules_config

    def export_markdown(
        self,
        report: Report,
        output_path: Path,
        include_evidence: bool = True
    ) -> Path:
        lines = []

        lines.append(f"# 作文错题与薄弱知识点分析报告")
        lines.append(f"")
        lines.append(f"**生成时间**: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        if report.student_name:
            lines.append(f"**分析对象**: {report.student_name}")
        lines.append(f"")

        lines.append(f"## 统计概览")
        lines.append(f"")
        lines.append(f"| 数据类型 | 数量 |")
        lines.append(f"|---------|------|")
        lines.append(f"| 作文记录 | {report.essays_count} |")
        lines.append(f"| 老师反馈 | {report.feedback_count} |")
        lines.append(f"| 错题记录 | {report.mistakes_count} |")
        lines.append(f"| 发现问题 | {len(report.labeled_items)} |")
        lines.append(f"| 问题聚类 | {len(report.clusters)} |")
        lines.append(f"| 薄弱知识点 | {len(report.weakness_points)} |")
        lines.append(f"| 复习任务 | {len(report.tasks)} |")
        lines.append(f"")

        if report.filters_applied:
            lines.append(f"## 应用的筛选条件")
            lines.append(f"")
            for key, value in report.filters_applied.items():
                lines.append(f"- **{key}**: {value}")
            lines.append(f"")

        lines.append(f"## 薄弱知识点优先级排序")
        lines.append(f"")

        if report.weakness_points:
            for idx, wp in enumerate(report.weakness_points, 1):
                rule = self.rules.labels.get(wp.label)
                label_name = rule.display_name if rule else wp.label

                priority_stars = "⭐" * wp.priority

                lines.append(f"### {idx}. {label_name} {priority_stars}")
                lines.append(f"")
                lines.append(f"- **优先级**: {wp.priority}/10")
                lines.append(f"- **出现次数**: {wp.frequency} 次")
                lines.append(f"- **平均置信度**: {wp.avg_confidence:.1%}")
                lines.append(f"- **影响分数**: {wp.impact_score}")
                if wp.recent_date:
                    lines.append(f"- **最近出现**: {wp.recent_date}")
                lines.append(f"")
                lines.append(f"**复习建议**:")
                lines.append(f"{wp.suggestion}")
                lines.append(f"")

                if include_evidence and wp.evidence:
                    lines.append(f"**问题证据**:")
                    lines.append(f"")
                    for ev_idx, ev in enumerate(wp.evidence[:3], 1):
                        lines.append(f"**证据 {ev_idx}**:")
                        if ev.get('matched_text'):
                            lines.append(f"- 匹配关键词: `{ev.get('matched_text')}`")
                        if ev.get('confidence'):
                            lines.append(f"- 置信度: {ev.get('confidence'):.0%}")
                        if ev.get('text'):
                            text = ev.get('text', '')
                            if len(text) > 150:
                                text = text[:150] + "..."
                            lines.append(f"- 文本片段: {text}")
                        lines.append(f"")
        else:
            lines.append(f"未发现薄弱知识点。")
            lines.append(f"")

        lines.append(f"## 相似问题聚类")
        lines.append(f"")

        if report.clusters:
            for idx, cluster in enumerate(report.clusters, 1):
                rule = self.rules.labels.get(cluster.label)
                label_name = rule.display_name if rule else cluster.label

                lines.append(f"### {idx}. {label_name}")
                lines.append(f"")
                lines.append(f"- **聚类大小**: {len(cluster.items)} 条记录")
                lines.append(f"- **平均相似度**: {cluster.avg_similarity:.1%}")
                lines.append(f"")

                if cluster.explanation:
                    lines.append(f"**聚类说明**:")
                    for line in cluster.explanation.split('\n'):
                        lines.append(line)
                    lines.append(f"")
        else:
            lines.append(f"没有足够的相似问题形成聚类。")
            lines.append(f"")

        lines.append(f"## 复习任务清单")
        lines.append(f"")

        if report.tasks:
            for idx, task in enumerate(report.tasks, 1):
                rule = self.rules.labels.get(task.weakness_label)
                label_name = rule.display_name if rule else task.weakness_label

                priority_stars = "⭐" * task.priority

                lines.append(f"### 任务 {idx}: {label_name} {priority_stars}")
                lines.append(f"")
                lines.append(f"- **学生**: {task.student_name}")
                lines.append(f"- **优先级**: {task.priority}/10")
                lines.append(f"- **预计时间**: {task.estimated_time}")
                lines.append(f"- **难度**: {task.difficulty}")
                if task.deadline:
                    lines.append(f"- **建议完成日期**: {task.deadline}")
                lines.append(f"- **状态**: {task.status}")
                lines.append(f"")
                lines.append(f"**任务描述**:")
                for line in task.task_description.split('\n'):
                    lines.append(line)
                lines.append(f"")

                if include_evidence and task.evidence:
                    lines.append(f"**相关证据**:")
                    lines.append(f"")
                    for ev_idx, ev in enumerate(task.evidence[:2], 1):
                        if ev.get('matched_text'):
                            lines.append(f"- 关键词「{ev.get('matched_text')}」:")
                        if ev.get('text'):
                            text = ev.get('text', '')
                            if len(text) > 100:
                                text = text[:100] + "..."
                            lines.append(f"  {text}")
                    lines.append(f"")
        else:
            lines.append(f"未生成复习任务。")
            lines.append(f"")

        lines.append(f"## 附录：发现的所有问题")
        lines.append(f"")

        if report.labeled_items:
            student_groups: Dict[str, List[LabeledItem]] = {}
            for item in report.labeled_items:
                if item.student_name not in student_groups:
                    student_groups[item.student_name] = []
                student_groups[item.student_name].append(item)

            for student_name, items in student_groups.items():
                lines.append(f"### {student_name}")
                lines.append(f"")

                for item_idx, item in enumerate(items, 1):
                    label_names = []
                    for label in item.labels:
                        rule = self.rules.labels.get(label)
                        label_names.append(rule.display_name if rule else label)

                    conf_strs = []
                    for label, conf in item.confidence.items():
                        rule = self.rules.labels.get(label)
                        name = rule.display_name if rule else label
                        conf_strs.append(f"{name}: {conf:.0%}")

                    lines.append(f"**{item_idx}. [{item.item_type.upper()}]** {', '.join(label_names)}")
                    if conf_strs:
                        lines.append(f"   置信度: {', '.join(conf_strs)}")
                    if item.explanation:
                        lines.append(f"   说明: {item.explanation}")
                    lines.append(f"")
        else:
            lines.append(f"未发现问题。")
            lines.append(f"")

        lines.append(f"---")
        lines.append(f"*报告由作文错题归类助手自动生成*")

        content = '\n'.join(lines)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return output_path

    def export_html(
        self,
        report: Report,
        output_path: Path,
        include_evidence: bool = True
    ) -> Path:
        html_parts = []

        html_parts.append('''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>作文错题与薄弱知识点分析报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background: #f9f9f9;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        h2 {
            color: #2980b9;
            margin-top: 40px;
            margin-bottom: 20px;
            padding-left: 10px;
            border-left: 4px solid #3498db;
        }
        h3 {
            color: #34495e;
            margin-top: 25px;
            margin-bottom: 15px;
        }
        .meta {
            background: #ecf0f1;
            padding: 15px 20px;
            border-radius: 5px;
            margin-bottom: 30px;
        }
        .meta p { margin: 5px 0; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th, td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #3498db;
            color: white;
        }
        tr:hover { background: #f8f9fa; }
        .priority-stars { color: #f39c12; font-size: 1.1em; }
        .card {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .card-title { font-size: 1.1em; font-weight: bold; }
        .card-meta { color: #666; font-size: 0.9em; }
        .evidence {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 10px 15px;
            margin: 10px 0;
            font-size: 0.95em;
        }
        .suggestion {
            background: #d1ecf1;
            border-left: 4px solid #17a2b8;
            padding: 10px 15px;
            margin: 10px 0;
        }
        .task-status {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 0.85em;
        }
        .status-pending { background: #fff3cd; color: #856404; }
        .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 0.9em;
        }
        ul { margin: 10px 0 10px 30px; }
        li { margin: 5px 0; }
    </style>
</head>
<body>
<div class="container">
''')

        html_parts.append(f'<h1>📝 作文错题与薄弱知识点分析报告</h1>')
        html_parts.append('<div class="meta">')
        html_parts.append(f'<p><strong>生成时间:</strong> {report.generated_at.strftime("%Y-%m-%d %H:%M:%S")}</p>')
        if report.student_name:
            html_parts.append(f'<p><strong>分析对象:</strong> {report.student_name}</p>')
        html_parts.append('</div>')

        html_parts.append('<h2>📊 统计概览</h2>')
        html_parts.append('<table>')
        html_parts.append('<tr><th>数据类型</th><th>数量</th></tr>')
        html_parts.append(f'<tr><td>作文记录</td><td>{report.essays_count}</td></tr>')
        html_parts.append(f'<tr><td>老师反馈</td><td>{report.feedback_count}</td></tr>')
        html_parts.append(f'<tr><td>错题记录</td><td>{report.mistakes_count}</td></tr>')
        html_parts.append(f'<tr><td>发现问题</td><td>{len(report.labeled_items)}</td></tr>')
        html_parts.append(f'<tr><td>问题聚类</td><td>{len(report.clusters)}</td></tr>')
        html_parts.append(f'<tr><td>薄弱知识点</td><td>{len(report.weakness_points)}</td></tr>')
        html_parts.append(f'<tr><td>复习任务</td><td>{len(report.tasks)}</td></tr>')
        html_parts.append('</table>')

        if report.filters_applied:
            html_parts.append('<h2>🔍 应用的筛选条件</h2>')
            html_parts.append('<ul>')
            for key, value in report.filters_applied.items():
                html_parts.append(f'<li><strong>{key}:</strong> {value}</li>')
            html_parts.append('</ul>')

        html_parts.append('<h2>🎯 薄弱知识点优先级排序</h2>')

        if report.weakness_points:
            for idx, wp in enumerate(report.weakness_points, 1):
                rule = self.rules.labels.get(wp.label)
                label_name = rule.display_name if rule else wp.label
                priority_stars = "⭐" * wp.priority

                html_parts.append('<div class="card">')
                html_parts.append(f'<div class="card-header"><span class="card-title">{idx}. {label_name}</span><span class="priority-stars">{priority_stars}</span></div>')
                html_parts.append('<ul>')
                html_parts.append(f'<li><strong>优先级:</strong> {wp.priority}/10</li>')
                html_parts.append(f'<li><strong>出现次数:</strong> {wp.frequency} 次</li>')
                html_parts.append(f'<li><strong>平均置信度:</strong> {wp.avg_confidence:.1%}</li>')
                html_parts.append(f'<li><strong>影响分数:</strong> {wp.impact_score}</li>')
                if wp.recent_date:
                    html_parts.append(f'<li><strong>最近出现:</strong> {wp.recent_date}</li>')
                html_parts.append('</ul>')
                html_parts.append(f'<p><strong>复习建议:</strong></p>')
                html_parts.append(f'<div class="suggestion">{wp.suggestion}</div>')

                if include_evidence and wp.evidence:
                    html_parts.append('<p><strong>问题证据:</strong></p>')
                    for ev_idx, ev in enumerate(wp.evidence[:3], 1):
                        text = ev.get('text', '')
                        if len(text) > 150:
                            text = text[:150] + "..."
                        matched = ev.get('matched_text', '')
                        conf = ev.get('confidence', 0)
                        html_parts.append(f'<div class="evidence">')
                        html_parts.append(f'<p><strong>证据 {ev_idx}:</strong> 关键词「{matched}」(置信度 {conf:.0%})</p>')
                        html_parts.append(f'<p>{text}</p>')
                        html_parts.append('</div>')

                html_parts.append('</div>')
        else:
            html_parts.append('<p>未发现薄弱知识点。</p>')

        html_parts.append('<h2>🔗 相似问题聚类</h2>')

        if report.clusters:
            for idx, cluster in enumerate(report.clusters, 1):
                rule = self.rules.labels.get(cluster.label)
                label_name = rule.display_name if rule else cluster.label

                html_parts.append('<div class="card">')
                html_parts.append(f'<h3>{idx}. {label_name}</h3>')
                html_parts.append('<ul>')
                html_parts.append(f'<li><strong>聚类大小:</strong> {len(cluster.items)} 条记录</li>')
                html_parts.append(f'<li><strong>平均相似度:</strong> {cluster.avg_similarity:.1%}</li>')
                html_parts.append('</ul>')

                if cluster.explanation:
                    html_parts.append(f'<p><strong>聚类说明:</strong></p>')
                    for line in cluster.explanation.split('\n'):
                        if line.strip().startswith('-'):
                            html_parts.append(f'<p>{line}</p>')
                        else:
                            html_parts.append(f'<p>{line}</p>')

                html_parts.append('</div>')
        else:
            html_parts.append('<p>没有足够的相似问题形成聚类。</p>')

        html_parts.append('<h2>✅ 复习任务清单</h2>')

        if report.tasks:
            for idx, task in enumerate(report.tasks, 1):
                rule = self.rules.labels.get(task.weakness_label)
                label_name = rule.display_name if rule else task.weakness_label
                priority_stars = "⭐" * task.priority

                html_parts.append('<div class="card">')
                html_parts.append(f'''<div class="card-header">
                    <span class="card-title">任务 {idx}: {label_name}</span>
                    <span class="priority-stars">{priority_stars}</span>
                </div>''')
                html_parts.append('<ul>')
                html_parts.append(f'<li><strong>学生:</strong> {task.student_name}</li>')
                html_parts.append(f'<li><strong>优先级:</strong> {task.priority}/10</li>')
                html_parts.append(f'<li><strong>预计时间:</strong> {task.estimated_time}</li>')
                html_parts.append(f'<li><strong>难度:</strong> {task.difficulty}</li>')
                if task.deadline:
                    html_parts.append(f'<li><strong>建议完成日期:</strong> {task.deadline}</li>')
                html_parts.append(f'<li><strong>状态:</strong> <span class="task-status status-pending">{task.status}</span></li>')
                html_parts.append('</ul>')

                html_parts.append('<p><strong>任务描述:</strong></p>')
                html_parts.append('<div class="suggestion">')
                for line in task.task_description.split('\n'):
                    html_parts.append(f'<p>{line}</p>')
                html_parts.append('</div>')

                if include_evidence and task.evidence:
                    html_parts.append('<p><strong>相关证据:</strong></p>')
                    for ev in task.evidence[:2]:
                        text = ev.get('text', '')
                        if len(text) > 100:
                            text = text[:100] + "..."
                        html_parts.append(f'<div class="evidence">{text}</div>')

                html_parts.append('</div>')
        else:
            html_parts.append('<p>未生成复习任务。</p>')

        html_parts.append('''
<div class="footer">
    <p>📋 报告由作文错题归类助手自动生成</p>
</div>
</div>
</body>
</html>
''')

        content = '\n'.join(html_parts)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return output_path

    def export_json(
        self,
        report: Report,
        output_path: Path
    ) -> Path:
        report_dict = {
            'generated_at': report.generated_at.isoformat(),
            'student_name': report.student_name,
            'filters_applied': report.filters_applied,
            'summary': {
                'essays_count': report.essays_count,
                'feedback_count': report.feedback_count,
                'mistakes_count': report.mistakes_count,
                'labeled_items_count': len(report.labeled_items),
                'clusters_count': len(report.clusters),
                'weakness_points_count': len(report.weakness_points),
                'tasks_count': len(report.tasks),
            },
            'weakness_points': [
                {
                    'label': wp.label,
                    'label_name': self.rules.labels.get(wp.label, wp.label).display_name if self.rules.labels.get(wp.label) else wp.label,
                    'student_name': wp.student_name,
                    'frequency': wp.frequency,
                    'avg_confidence': wp.avg_confidence,
                    'impact_score': wp.impact_score,
                    'recent_date': wp.recent_date.isoformat() if wp.recent_date else None,
                    'priority': wp.priority,
                    'evidence': wp.evidence,
                    'suggestion': wp.suggestion
                }
                for wp in report.weakness_points
            ],
            'clusters': [
                {
                    'cluster_id': cluster.cluster_id,
                    'label': cluster.label,
                    'label_name': self.rules.labels.get(cluster.label, cluster.label).display_name if self.rules.labels.get(cluster.label) else cluster.label,
                    'representative_text': cluster.representative_text,
                    'items_count': len(cluster.items),
                    'avg_similarity': cluster.avg_similarity,
                    'explanation': cluster.explanation
                }
                for cluster in report.clusters
            ],
            'tasks': [
                {
                    'task_id': task.task_id,
                    'student_name': task.student_name,
                    'weakness_label': task.weakness_label,
                    'label_name': self.rules.labels.get(task.weakness_label, task.weakness_label).display_name if self.rules.labels.get(task.weakness_label) else task.weakness_label,
                    'priority': task.priority,
                    'task_description': task.task_description,
                    'estimated_time': task.estimated_time,
                    'difficulty': task.difficulty,
                    'evidence': task.evidence,
                    'status': task.status,
                    'deadline': task.deadline.isoformat() if task.deadline else None
                }
                for task in report.tasks
            ]
        }

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report_dict, f, ensure_ascii=False, indent=2, cls=EnhancedJSONEncoder)

        return output_path
