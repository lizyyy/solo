import pandas as pd
import numpy as np
import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from jinja2 import Template


HTML_REPORT_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>发酵曲线异常判读报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2C3E50;
            border-bottom: 3px solid #3498DB;
            padding-bottom: 15px;
            margin-bottom: 30px;
        }
        h2 {
            color: #2C3E50;
            margin: 30px 0 20px;
            padding-left: 10px;
            border-left: 4px solid #3498DB;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .summary-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #e9ecef;
        }
        .summary-card .number {
            font-size: 36px;
            font-weight: bold;
            margin: 10px 0;
        }
        .pass { color: #2ECC71; }
        .warning { color: #F39C12; }
        .fail { color: #E74C3C; }
        .recheck {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
        }
        .table-container {
            overflow-x: auto;
            margin: 20px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }
        th, td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #3498DB;
            color: white;
            font-weight: 600;
        }
        tr:hover {
            background-color: #f5f5f5;
        }
        .status-badge {
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        .status-pass { background: #D4EFDF; color: #1E8449; }
        .status-warning { background: #FEF9E7; color: #D68910; }
        .status-fail { background: #FADBD8; color: #C0392B; }
        .sample-section {
            margin: 30px 0;
            padding: 20px;
            background: #fafafa;
            border-radius: 8px;
            border-left: 4px solid #ccc;
        }
        .sample-pass { border-left-color: #2ECC71; }
        .sample-warning { border-left-color: #F39C12; }
        .sample-fail { border-left-color: #E74C3C; }
        .rule-result {
            display: inline-block;
            padding: 3px 8px;
            margin: 2px 4px;
            border-radius: 3px;
            font-size: 12px;
        }
        .section {
            margin: 30px 0;
        }
        .recheck-section {
            background: #FFF8E1;
            border: 1px solid #FFC107;
            padding: 20px;
            border-radius: 8px;
        }
        .error-box {
            background: #FFEBEE;
            border: 1px solid #E53935;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
        }
        .timestamp {
            color: #666;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔬 发酵曲线异常判读报告</h1>

        <div class="section">
            <h2>📊 总体概览</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <div>总样本数</div>
                    <div class="number">{{ summary.total_samples }}</div>
                </div>
                <div class="summary-card">
                    <div>通过</div>
                    <div class="number pass">{{ summary.pass_count }}</div>
                </div>
                <div class="summary-card">
                    <div>警告</div>
                    <div class="number warning">{{ summary.warning_count }}</div>
                </div>
                <div class="summary-card">
                    <div>失败</div>
                    <div class="number fail">{{ summary.fail_count }}</div>
                </div>
                <div class="summary-card recheck">
                    <div>需复检</div>
                    <div class="number">{{ summary.requires_recheck_count }}</div>
                </div>
                <div class="summary-card">
                    <div>通过率</div>
                    <div class="number">{{ (summary.pass_rate * 100) | round(1) }}%</div>
                </div>
            </div>
        </div>

        {% if summary.recheck_samples or summary.failed_samples %}
        <div class="recheck-section">
            <h2>⚠️ 需复检样本</h2>
            {% if summary.recheck_samples %}
            <h3>质控异常样本</h3>
            <div class="table-container">
                <table>
                    <tr>
                        <th>样本ID</th>
                        <th>状态</th>
                        <th>原因</th>
                    </tr>
                    {% for sample in summary.recheck_samples %}
                    <tr>
                        <td>{{ sample.sample_id }}</td>
                        <td><span class="status-badge status-{{ sample.status | lower }}">{{ sample.status }}</span></td>
                        <td>{{ sample.reason }}</td>
                    </tr>
                    {% endfor %}
                </table>
            </div>
            {% endif %}

            {% if summary.failed_samples %}
            <h3>预处理失败样本</h3>
            {% for sample in summary.failed_samples %}
            <div class="error-box">
                <strong>{{ sample.sample_id }}</strong>: {{ sample.reason }}
                {% if sample.errors %}
                <ul>
                    {% for error in sample.errors %}
                    <li>{{ error.message }}</li>
                    {% endfor %}
                </ul>
                {% endif %}
            </div>
            {% endfor %}
            {% endif %}
        </div>
        {% endif %}

        <div class="section">
            <h2>📋 详细结果</h2>
            {% for sample_id, result in qc_results.items() %}
            <div class="sample-section sample-{{ result.overall_status | lower }}">
                <h3>{{ sample_id }}
                    <span class="status-badge status-{{ result.overall_status | lower }}">{{ result.overall_status }}</span>
                    {% if result.requires_recheck %}
                    <span style="color: #E74C3C; margin-left: 10px;">⚠️ 需复检</span>
                    {% endif %}
                </h3>
                {% if result.recheck_reason %}
                <p><strong>复检原因:</strong> {{ result.recheck_reason }}</p>
                {% endif %}

                {% for param_name, param_rules in result.parameters.items() %}
                <h4>{{ param_name }}</h4>
                <div>
                    {% for rule_name, rule_result in param_rules.items() %}
                    <span class="rule-result status-{{ rule_result.status | lower }}">
                        {{ rule_name }}: {{ rule_result.status }}
                    </span>
                    {% endfor %}
                </div>
                {% if param_rules %}
                {% for rule_name, rule_result in param_rules.items() %}
                {% if rule_result.violations %}
                <ul style="margin: 10px 0 10px 30px;">
                    {% for violation in rule_result.violations[:3] %}
                    <li>{{ rule_result.rule }}: {{ violation }}</li>
                    {% endfor %}
                    {% if rule_result.violations|length > 3 %}
                    <li>... 还有 {{ rule_result.violations|length - 3 }} 个违规点</li>
                    {% endif %}
                </ul>
                {% endif %}
                {% endfor %}
                {% endif %}
                {% endfor %}

                {% if result.phase_consistency and result.phase_consistency.violations %}
                <h4>阶段一致性检查</h4>
                <span class="rule-result status-{{ result.phase_consistency.status | lower }}">
                    PHASE_CONSISTENCY_CHECK: {{ result.phase_consistency.status }}
                </span>
                {% endif %}
            </div>
            {% endfor %}
        </div>

        {% if processing_log %}
        <div class="section">
            <h2>📝 处理日志</h2>
            <div class="table-container">
                <table>
                    <tr>
                        <th>时间</th>
                        <th>级别</th>
                        <th>样本</th>
                        <th>消息</th>
                    </tr>
                    {% for log in processing_log[:50] %}
                    <tr>
                        <td>{{ log.timestamp }}</td>
                        <td>{{ log.level }}</td>
                        <td>{{ log.sample_id or '-' }}</td>
                        <td>{{ log.message }}</td>
                    </tr>
                    {% endfor %}
                </table>
            </div>
        </div>
        {% endif %}

        <div class="timestamp">
            报告生成时间: {{ report_time }}
        </div>
    </div>
</body>
</html>
"""


class ReportGenerator:
    def __init__(self):
        self.template = Template(HTML_REPORT_TEMPLATE)

    def _flatten_dict(self, d: Dict, parent_key: str = '', sep: str = '.') -> Dict:
        items = []
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(self._flatten_dict(v, new_key, sep=sep).items())
            elif isinstance(v, list):
                items.append((new_key, str(v)))
            else:
                items.append((new_key, v))
        return dict(items)

    def generate_html_report(
        self,
        qc_results: Dict[str, Any],
        processing_log: Optional[List] = None,
        output_path: Optional[str] = None,
    ) -> str:
        summary = qc_results.get("summary", {})
        results = qc_results.get("results", {})

        rendered = self.template.render(
            summary=summary,
            qc_results=results,
            processing_log=processing_log or [],
            report_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        )

        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(rendered)

        return rendered

    def generate_excel_report(
        self,
        qc_results: Dict[str, Any],
        processed_samples: Dict[str, Any],
        output_path: str,
    ) -> None:
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            summary = qc_results.get("summary", {})
            results = qc_results.get("results", {})

            summary_df = pd.DataFrame([
                {
                    "指标": [
                        "总样本数",
                        "通过数量",
                        "警告数量",
                        "失败数量",
                        "需复检数量",
                        "通过率",
                    ],
                    "数值": [
                        summary.get("total_samples", 0),
                        summary.get("pass_count", 0),
                        summary.get("warning_count", 0),
                        summary.get("fail_count", 0),
                        summary.get("requires_recheck_count", 0),
                        f"{summary.get('pass_rate', 0) * 100:.1f}%",
                    ]
                }
            ])
            summary_df.to_excel(writer, sheet_name="概览", index=False)

            sample_rows = []
            for sample_id, result in results.items():
                row = {
                    "样本ID": sample_id,
                    "整体状态": result.get("overall_status"),
                    "需复检": result.get("requires_recheck", False),
                    "复检原因": result.get("recheck_reason", ""),
                }

                for param_name, param_rules in result.get("parameters", {}).items():
                    for rule_name, rule_result in param_rules.items():
                        row[f"{param_name}_{rule_name}_状态"] = rule_result.get("status")
                        row[f"{param_name}_{rule_name}_违规数"] = len(rule_result.get("violations", []))

                sample_rows.append(row)

            if sample_rows:
                pd.DataFrame(sample_rows).to_excel(
                    writer,
                    sheet_name="样本详情",
                    index=False,
                )

            if summary.get("recheck_samples"):
                recheck_df = pd.DataFrame(summary["recheck_samples"])
                recheck_df.to_excel(
                    writer,
                    sheet_name="需复检样本",
                    index=False,
                )

            if summary.get("failed_samples"):
                failed_df = pd.DataFrame(summary["failed_samples"])
                failed_df.to_excel(
                    writer,
                    sheet_name="预处理失败样本",
                    index=False,
                )

    def generate_csv_reports(
        self,
        qc_results: Dict[str, Any],
        output_dir: str,
    ) -> Dict[str, str]:
        os.makedirs(output_dir, exist_ok=True)
        generated_files = {}

        summary = qc_results.get("summary", {})
        results = qc_results.get("results", {})

        sample_rows = []
        for sample_id, result in results.items():
            row = {
                "样本ID": sample_id,
                "整体状态": result.get("overall_status"),
                "需复检": result.get("requires_recheck", False),
                "复检原因": result.get("recheck_reason", ""),
            }

            for param_name, param_rules in result.get("parameters", {}).items():
                for rule_name, rule_result in param_rules.items():
                    row[f"{param_name}_{rule_name}_状态"] = rule_result.get("status")

            sample_rows.append(row)

        if sample_rows:
            summary_path = os.path.join(output_dir, "sample_results.csv")
            pd.DataFrame(sample_rows).to_csv(summary_path, index=False, encoding='utf-8-sig')
            generated_files["sample_results"] = summary_path

        if summary.get("recheck_samples"):
            recheck_path = os.path.join(output_dir, "recheck_samples.csv")
            pd.DataFrame(summary["recheck_samples"]).to_csv(
                recheck_path,
                index=False,
                encoding='utf-8-sig'
            )
            generated_files["recheck_samples"] = recheck_path

        if summary.get("failed_samples"):
            failed_path = os.path.join(output_dir, "failed_samples.csv")
            pd.DataFrame(summary["failed_samples"]).to_csv(
                failed_path,
                index=False,
                encoding='utf-8-sig'
            )
            generated_files["failed_samples"] = failed_path

        return generated_files

    def generate_json_report(
        self,
        qc_results: Dict[str, Any],
        processing_log: Optional[List] = None,
        output_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        report = {
            "report_metadata": {
                "generated_at": datetime.now().isoformat(),
                "qc_results": qc_results,
                "processing_log": processing_log or [],
            }
        }

        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2, default=str)

        return report

    def export_all(
        self,
        qc_results: Dict[str, Any],
        processed_samples: Dict[str, Any],
        output_dir: str,
        processing_log: Optional[List] = None,
        formats: List[str] = None,
    ) -> Dict[str, str]:
        os.makedirs(output_dir, exist_ok=True)
        formats = formats or ["html", "excel", "csv", "json"]
        generated_files = {}

        if "html" in formats:
            html_path = os.path.join(output_dir, "report.html")
            self.generate_html_report(qc_results, processing_log, html_path)
            generated_files["html"] = html_path

        if "excel" in formats:
            excel_path = os.path.join(output_dir, "report.xlsx")
            self.generate_excel_report(qc_results, processed_samples, excel_path)
            generated_files["excel"] = excel_path

        if "csv" in formats:
            csv_dir = os.path.join(output_dir, "csv_reports")
            csv_files = self.generate_csv_reports(qc_results, csv_dir)
            generated_files["csv"] = csv_files

        if "json" in formats:
            json_path = os.path.join(output_dir, "report.json")
            self.generate_json_report(qc_results, processing_log, json_path)
            generated_files["json"] = json_path

        return generated_files
