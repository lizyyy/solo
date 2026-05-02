"""报告生成模块 - 输出 Markdown、CSV 和 HTML"""

import csv
from pathlib import Path
from typing import Any, List

from jinja2 import Template


class MarkdownReporter:
    def generate(self, flags: List[Any], clusters: dict, output_path: Path) -> None:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("# 面试评分偏见审计报告\n\n")
            f.write("## 审计概览\n\n")
            f.write(f"- 发现问题总数: {len(flags)}\n")
            f.write(f"- 高严重性问题: {sum(1 for fl in flags if fl.severity == 'high')}\n")
            f.write(f"- 中严重性问题: {sum(1 for fl in flags if fl.severity == 'medium')}\n\n")

            f.write("## 问题分类统计\n\n")
            type_counts = {}
            for fl in flags:
                type_counts[fl.flag_type] = type_counts.get(fl.flag_type, 0) + 1
            for flag_type, count in sorted(type_counts.items(), key=lambda x: -x[1]):
                f.write(f"- {flag_type}: {count}\n")
            f.write("\n")

            f.write("## 理由聚类结果\n\n")
            for cluster_id, info in clusters.items():
                f.write(f"### {cluster_id}\n")
                f.write(f"- 数量: {info['count']}\n")
                f.write(f"- 关键词: {', '.join(info['top_keywords'])}\n")
                f.write(f"- 示例:\n")
                for reason in info.get("sample_reasons", []):
                    f.write(f"  - {reason}\n")
            f.write("\n")

            f.write("## 详细问题列表\n\n")
            high_flags = [fl for fl in flags if fl.severity == "high"]
            medium_flags = [fl for fl in flags if fl.severity == "medium"]

            if high_flags:
                f.write("### 高严重性问题\n\n")
                for fl in high_flags:
                    f.write(f"#### [{fl.flag_type}] {fl.candidate_name} - {fl.position}\n\n")
                    f.write(f"{fl.description}\n\n")
                    if fl.details:
                        f.write("详情:\n")
                        for k, v in fl.details.items():
                            f.write(f"- {k}: {v}\n")
                    f.write("\n")

            if medium_flags:
                f.write("### 中严重性问题\n\n")
                for fl in medium_flags:
                    f.write(f"#### [{fl.flag_type}] {fl.candidate_name} - {fl.position}\n\n")
                    f.write(f"{fl.description}\n\n")
                    if fl.details:
                        f.write("详情:\n")
                        for k, v in fl.details.items():
                            f.write(f"- {k}: {v}\n")
                    f.write("\n")


class CSVReporter:
    def generate(self, flags: List[Any], output_path: Path) -> None:
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "flag_type",
                "candidate_id",
                "candidate_name",
                "position",
                "severity",
                "description",
                "details",
            ])
            for fl in flags:
                writer.writerow([
                    fl.flag_type,
                    fl.candidate_id,
                    fl.candidate_name,
                    fl.position,
                    fl.severity,
                    fl.description,
                    str(fl.details),
                ])


HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>面试评分地图</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        .card { background: white; border-radius: 8px; padding: 15px; margin: 10px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .high { border-left: 4px solid #e74c3c; }
        .medium { border-left: 4px solid #f39c12; }
        .low { border-left: 4px solid #3498db; }
        .score { font-size: 24px; font-weight: bold; color: #2c3e50; }
        .score.high { color: #27ae60; }
        .score.low { color: #e74c3c; }
        .meta { color: #7f8c8d; font-size: 14px; }
        .flag { display: inline-block; background: #fee; padding: 2px 8px; border-radius: 4px; margin: 2px; color: #c00; }
        .container { max-width: 1200px; margin: 0 auto; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #34495e; color: white; }
        tr:hover { background: #f8f8f8; }
    </style>
</head>
<body>
    <div class="container">
        <h1>面试评分地图</h1>
        <p class="meta">生成时间: {{ timestamp }}</p>

        <h2>评分分布</h2>
        <table>
            <tr>
                <th>候选人</th>
                <th>岗位</th>
                <th>评分</th>
                <th>问题标记</th>
            </tr>
            {% for candidate in candidates %}
            <tr>
                <td>{{ candidate.name }}</td>
                <td>{{ candidate.position }}</td>
                <td class="score {% if candidate.score >= 85 %}high{% elif candidate.score <= 50 %}low{% endif %}">
                    {{ candidate.score }}
                </td>
                <td>
                    {% for flag in candidate.flags %}
                    <span class="flag">{{ flag }}</span>
                    {% endfor %}
                </td>
            </tr>
            {% endfor %}
        </table>

        <h2>问题汇总</h2>
        {% for flag in flags %}
        <div class="card {{ flag.severity }}">
            <strong>[{{ flag.flag_type }}]</strong> {{ flag.candidate_name }} - {{ flag.position }}
            <p>{{ flag.description }}</p>
            <p class="meta">严重性: {{ flag.severity }}</p>
        </div>
        {% endfor %}
    </div>
</body>
</html>
"""


class HTMLReporter:
    def generate(
        self,
        flags: List[Any],
        candidates: list,
        output_path: Path,
    ) -> None:
        from datetime import datetime

        candidates_with_flags = []
        for c in candidates:
            c_flags = [fl.flag_type for fl in flags if fl.candidate_name == c.get("name")]
            score_val = c.get("score", "")
            try:
                score_float = float(score_val) if score_val else 0
            except (ValueError, TypeError):
                score_float = 0
            candidates_with_flags.append({
                "name": c.get("name"),
                "position": c.get("position"),
                "score": score_float,
                "flags": c_flags,
            })

        template = Template(HTML_TEMPLATE)
        html_content = template.render(
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            flags=flags,
            candidates=candidates_with_flags,
        )

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)
