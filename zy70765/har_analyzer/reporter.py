import csv
import os
from typing import Dict, Any, List
from datetime import datetime
from jinja2 import Template
from .parser import HarEntry


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HAR延迟分桶分析报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f7fa; }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { color: #2c3e50; margin-bottom: 20px; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin: 25px 0 15px; font-size: 1.3em; }
        h3 { color: #5d6d7e; margin: 15px 0 10px; font-size: 1.1em; }
        .summary-card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .summary-item { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 6px; }
        .summary-value { font-size: 1.8em; font-weight: bold; color: #2c3e50; }
        .summary-label { font-size: 0.85em; color: #7f8c8d; margin-top: 5px; }
        .table-container { background: white; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
        th { background: #34495e; color: white; font-weight: 600; }
        tr:hover { background: #f8f9fa; }
        .bad-row { background: #ffebee; }
        .bad-row:hover { background: #ffcdd2; }
        .badge { padding: 4px 8px; border-radius: 12px; font-size: 0.75em; font-weight: 600; }
        .badge-fast { background: #c8e6c9; color: #2e7d32; }
        .badge-normal { background: #bbdefb; color: #1565c0; }
        .badge-slow { background: #ffe082; color: #f57f17; }
        .badge-very_slow { background: #ffab91; color: #d84315; }
        .badge-extreme { background: #ef9a9a; color: #c62828; }
        .badge-success { background: #c8e6c9; color: #2e7d32; }
        .badge-error { background: #ef9a9a; color: #c62828; }
        .progress-bar { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 4px; }
        .metadata { color: #7f8c8d; font-size: 0.85em; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .url-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    </style>
</head>
<body>
    <div class="container">
        <h1>HAR延迟分桶分析报告</h1>
        <div class="metadata">
            生成时间: {{ generated_at }} | 源文件: {{ source_file }}
        </div>

        <div class="summary-card">
            <h2>概览统计</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-value">{{ summary.total_entries }}</div>
                    <div class="summary-label">总请求数</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{{ summary.valid_entries }}</div>
                    <div class="summary-label">有效请求</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{{ summary.bad_entries }}</div>
                    <div class="summary-label">坏行数</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{{ summary.unique_domains }}</div>
                    <div class="summary-label">域名数</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{{ "%.1f"|format(summary.percentiles.p50) }}ms</div>
                    <div class="summary-label">P50 延迟</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{{ "%.1f"|format(summary.percentiles.p95) }}ms</div>
                    <div class="summary-label">P95 延迟</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>按域名统计</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>域名</th>
                            <th>请求数</th>
                            <th>平均延迟</th>
                            <th>最慢请求</th>
                            <th>耗时分布</th>
                            <th>状态码分布</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for domain, stats in by_domain.items() %}
                        <tr>
                            <td><strong>{{ domain }}</strong></td>
                            <td>{{ stats.count }}</td>
                            <td>{{ "%.1f"|format(stats.avg_time) }}ms</td>
                            <td>{{ "%.1f"|format(stats.max_time) }}ms</td>
                            <td>
                                {% for bucket, count in stats.time_buckets.items() %}
                                <span class="badge badge-{{ bucket }}">{{ bucket }}: {{ count }}</span>
                                {% endfor %}
                            </td>
                            <td>
                                {% for bucket, count in stats.status_buckets.items() %}
                                <span class="badge {% if 'success' in bucket %}badge-success{% elif 'error' in bucket %}badge-error{% endif %}">{{ bucket }}: {{ count }}</span>
                                {% endfor %}
                            </td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="section">
            <h2>按资源类型统计</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>资源类型</th>
                            <th>请求数</th>
                            <th>平均延迟</th>
                            <th>最慢请求</th>
                            <th>耗时分布</th>
                            <th>涉及域名数</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for resource_type, stats in by_resource_type.items() %}
                        <tr>
                            <td><strong>{{ resource_type }}</strong></td>
                            <td>{{ stats.count }}</td>
                            <td>{{ "%.1f"|format(stats.avg_time) }}ms</td>
                            <td>{{ "%.1f"|format(stats.max_time) }}ms</td>
                            <td>
                                {% for bucket, count in stats.time_buckets.items() %}
                                <span class="badge badge-{{ bucket }}">{{ bucket }}: {{ count }}</span>
                                {% endfor %}
                            </td>
                            <td>{{ stats.domains|length }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="section">
            <h2>耗时分桶分布</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>分桶</th>
                            <th>请求数</th>
                            <th>占比</th>
                            <th>资源类型</th>
                            <th>域名数</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for bucket, stats in by_time_bucket.items() %}
                        <tr>
                            <td><span class="badge badge-{{ bucket }}">{{ bucket }}</span></td>
                            <td>{{ stats.count }}</td>
                            <td>{{ "%.1f"|format(stats.count / summary.valid_entries * 100) }}%</td>
                            <td>{{ stats.resource_types|length }} 种</td>
                            <td>{{ stats.domains|length }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="section">
            <h2>异常慢请求样本 (TOP {{ anomalies.slowest_entries|length }})</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>排名</th>
                            <th>原始位置</th>
                            <th>耗时(ms)</th>
                            <th>分桶</th>
                            <th>域名</th>
                            <th>资源类型</th>
                            <th>状态码</th>
                            <th>URL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for entry in anomalies.slowest_entries %}
                        <tr>
                            <td>{{ loop.index }}</td>
                            <td>#{{ entry.raw_index }}</td>
                            <td><strong>{{ "%.1f"|format(entry.time) }}</strong></td>
                            <td><span class="badge badge-{{ get_time_bucket(entry.time) }}">{{ get_time_bucket(entry.time) }}</span></td>
                            <td>{{ entry.domain }}</td>
                            <td>{{ entry.resource_type }}</td>
                            <td>{{ entry.status }}</td>
                            <td class="url-cell" title="{{ entry.url }}">{{ entry.url }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </div>

        {% if bad_entries %}
        <div class="section">
            <h2>坏行详情 (保留原始位置)</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>原始位置</th>
                            <th>源文件</th>
                            <th>错误原因</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for entry in bad_entries %}
                        <tr class="bad-row">
                            <td>#{{ entry.raw_index }}</td>
                            <td>{{ entry.source_file }}</td>
                            <td>{{ entry.bad_reason }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </div>
        {% endif %}
    </div>
</body>
</html>
"""


class Reporter:
    def __init__(self, analysis_result: Dict[str, Any]):
        self.analysis = analysis_result

    def _get_time_bucket(self, time_ms: float) -> str:
        buckets = [
            ("fast", 0, 100),
            ("normal", 100, 500),
            ("slow", 500, 1000),
            ("very_slow", 1000, 3000),
            ("extreme", 3000, float("inf")),
        ]
        for bucket_name, min_time, max_time in buckets:
            if min_time <= time_ms < max_time:
                return bucket_name
        return "unknown"

    def generate_html(self, output_path: str, source_file: str = "") -> None:
        template = Template(HTML_TEMPLATE)
        html_content = template.render(
            generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            source_file=source_file,
            summary=self.analysis["summary"],
            by_domain=self.analysis["by_domain"],
            by_resource_type=self.analysis["by_resource_type"],
            by_time_bucket=self.analysis["by_time_bucket"],
            anomalies=self.analysis["anomalies"],
            bad_entries=self.analysis["bad_entries"],
            get_time_bucket=self._get_time_bucket,
        )

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)

    def generate_csv(self, output_path: str, include_entries: bool = True) -> None:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)

            writer.writerow(["=== 域名统计 ==="])
            writer.writerow([
                "域名", "请求数", "平均延迟(ms)", "最小延迟(ms)", "最大延迟(ms)",
                "fast_count", "normal_count", "slow_count", "very_slow_count", "extreme_count"
            ])
            for domain, stats in self.analysis["by_domain"].items():
                tb = stats["time_buckets"]
                writer.writerow([
                    domain, stats["count"],
                    round(stats["avg_time"], 2), round(stats["min_time"], 2), round(stats["max_time"], 2),
                    tb.get("fast", 0), tb.get("normal", 0), tb.get("slow", 0),
                    tb.get("very_slow", 0), tb.get("extreme", 0)
                ])

            writer.writerow([])
            writer.writerow(["=== 资源类型统计 ==="])
            writer.writerow([
                "资源类型", "请求数", "平均延迟(ms)", "最小延迟(ms)", "最大延迟(ms)",
                "fast_count", "normal_count", "slow_count", "very_slow_count", "extreme_count"
            ])
            for resource_type, stats in self.analysis["by_resource_type"].items():
                tb = stats["time_buckets"]
                writer.writerow([
                    resource_type, stats["count"],
                    round(stats["avg_time"], 2), round(stats["min_time"], 2), round(stats["max_time"], 2),
                    tb.get("fast", 0), tb.get("normal", 0), tb.get("slow", 0),
                    tb.get("very_slow", 0), tb.get("extreme", 0)
                ])

            writer.writerow([])
            writer.writerow(["=== 异常慢请求样本 ==="])
            writer.writerow([
                "排名", "原始位置", "耗时(ms)", "分桶", "域名",
                "资源类型", "状态码", "URL"
            ])
            for idx, entry in enumerate(self.analysis["anomalies"]["slowest_entries"], 1):
                writer.writerow([
                    idx, entry.raw_index, round(entry.time, 2),
                    self._get_time_bucket(entry.time), entry.domain,
                    entry.resource_type, entry.status, entry.url
                ])

            writer.writerow([])
            writer.writerow(["=== 坏行记录 ==="])
            writer.writerow(["原始位置", "源文件", "错误原因"])
            for entry in self.analysis["bad_entries"]:
                writer.writerow([entry.raw_index, entry.source_file, entry.bad_reason])

            if include_entries:
                writer.writerow([])
                writer.writerow(["=== 所有请求详情 (按原始顺序) ==="])
                writer.writerow([
                    "原始位置", "URL", "域名", "资源类型", "状态码",
                    "耗时(ms)", "分桶", "是否坏行", "错误原因", "开始时间"
                ])
                all_entries = sorted(
                    self.analysis["by_domain"][next(iter(self.analysis["by_domain"]))]["entries"]
                    if self.analysis["by_domain"] else [],
                    key=lambda x: x.raw_index
                )
                domain_entries = []
                for stats in self.analysis["by_domain"].values():
                    domain_entries.extend(stats["entries"])
                all_entries = sorted(domain_entries + self.analysis["bad_entries"], key=lambda x: x.raw_index)

                for entry in all_entries:
                    writer.writerow([
                        entry.raw_index, entry.url, entry.domain,
                        entry.resource_type, entry.status,
                        round(entry.time, 2),
                        self._get_time_bucket(entry.time) if not entry.is_bad else "",
                        entry.is_bad, entry.bad_reason,
                        entry.started_date_time
                    ])

    def generate_all(self, output_dir: str, base_name: str = "har_analysis") -> Dict[str, str]:
        os.makedirs(output_dir, exist_ok=True)

        html_path = os.path.join(output_dir, f"{base_name}.html")
        csv_path = os.path.join(output_dir, f"{base_name}.csv")

        self.generate_html(html_path)
        self.generate_csv(csv_path)

        return {
            "html": html_path,
            "csv": csv_path,
        }
