import csv
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from collections import defaultdict

from jinja2 import Template

from .models import (
    Contract,
    Sample,
    FieldDrift,
    DriftReport,
    ConfirmationRecord,
    ConfirmationStatus,
    Consumer,
)


class ReportGenerator:
    def __init__(self):
        self.html_template = self._get_html_template()

    def generate_report(
        self,
        contract: Contract,
        samples: List[Sample],
        drifts: List[FieldDrift],
        consumers: List[Consumer],
        confirmations: List[ConfirmationRecord],
    ) -> DriftReport:
        drift_ids = {d.drift_id for d in drifts}
        related_confirmations = [
            c for c in confirmations if c.drift_id in drift_ids
        ]

        status_counts = defaultdict(int)
        for c in related_confirmations:
            status_counts[c.status.value] += 1

        summary = self._build_summary(
            contract, samples, drifts, consumers, status_counts
        )

        report_id = self._generate_report_id(contract.id, [s.id for s in samples])

        return DriftReport(
            report_id=report_id,
            generated_at=datetime.now(),
            contract_id=contract.id,
            contract_version=contract.version,
            sample_ids=[s.id for s in samples],
            consumer_ids=[c.id for c in consumers],
            total_drifts=len(drifts),
            pending_confirmations=status_counts[ConfirmationStatus.PENDING.value],
            confirmed_drifts=status_counts[ConfirmationStatus.CONFIRMED.value],
            rejected_drifts=status_counts[ConfirmationStatus.REJECTED.value],
            drifts=sorted(drifts, key=lambda d: (d.sample_id, d.field_path)),
            confirmations=sorted(
                related_confirmations, key=lambda c: c.created_at, reverse=True
            ),
            summary=summary,
        )

    def _build_summary(
        self,
        contract: Contract,
        samples: List[Sample],
        drifts: List[FieldDrift],
        consumers: List[Consumer],
        status_counts: Dict[str, int],
    ) -> Dict[str, Any]:
        drift_by_type = defaultdict(int)
        drift_by_sample = defaultdict(int)
        drift_by_field = defaultdict(int)

        for drift in drifts:
            drift_by_type[drift.diff_type.value] += 1
            drift_by_sample[drift.sample_id] += 1
            drift_by_field[drift.field_path] += 1

        return {
            "contract": {
                "id": contract.id,
                "name": contract.name,
                "version": contract.version,
                "api_path": contract.api_path,
                "method": contract.method,
                "field_count": len(contract.fields),
            },
            "samples": {
                "count": len(samples),
                "sample_names": [s.name for s in samples],
            },
            "drifts": {
                "total": len(drifts),
                "by_type": dict(drift_by_type),
                "by_sample": dict(drift_by_sample),
                "by_field": dict(drift_by_field),
            },
            "consumers": {
                "count": len(consumers),
                "confirmations": dict(status_counts),
            },
        }

    def _generate_report_id(self, contract_id: str, sample_ids: List[str]) -> str:
        key = f"{contract_id}:{':'.join(sorted(sample_ids))}:{datetime.now().isoformat()}"
        return hashlib.md5(key.encode()).hexdigest()[:12]

    def export_json(self, report: DriftReport, output_path: str) -> str:
        path = Path(output_path)
        if path.is_dir():
            path = path / f"drift-report-{report.report_id}.json"

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(report.model_dump(), default=str, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return str(path)

    def export_html(self, report: DriftReport, output_path: str) -> str:
        path = Path(output_path)
        if path.is_dir():
            path = path / f"drift-report-{report.report_id}.html"

        path.parent.mkdir(parents=True, exist_ok=True)

        template = Template(self.html_template)
        html_content = template.render(report=report.model_dump())
        path.write_text(html_content, encoding="utf-8")
        return str(path)

    def export_csv(self, report: DriftReport, output_path: str) -> str:
        path = Path(output_path)
        if path.is_dir():
            path = path / f"drift-report-{report.report_id}.csv"

        path.parent.mkdir(parents=True, exist_ok=True)

        with path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "drift_id",
                "sample_id",
                "field_path",
                "diff_type",
                "expected",
                "actual",
                "message",
                "source_file",
                "line_number",
            ])

            for drift in report.drifts:
                source = drift.sample_source
                writer.writerow([
                    drift.drift_id,
                    drift.sample_id,
                    drift.field_path,
                    drift.diff_type.value,
                    str(drift.expected) if drift.expected else "",
                    str(drift.actual) if drift.actual else "",
                    drift.message,
                    source.file_path if source else "",
                    source.line_start if source else "",
                ])

        return str(path)

    def export_markdown(self, report: DriftReport, output_path: str) -> str:
        path = Path(output_path)
        if path.is_dir():
            path = path / f"drift-report-{report.report_id}.md"

        path.parent.mkdir(parents=True, exist_ok=True)

        md_content = self._build_markdown(report)
        path.write_text(md_content, encoding="utf-8")
        return str(path)

    def _build_markdown(self, report: DriftReport) -> str:
        summary = report.summary
        drift_count = summary["drifts"]["total"]

        lines = [
            "# 契约漂移检测报告",
            "",
            f"- **报告ID**: {report.report_id}",
            f"- **生成时间**: {report.generated_at}",
            f"- **契约版本**: {report.contract_version}",
            f"- **样例数量**: {len(report.sample_ids)}",
            f"- **漂移总数**: {report.total_drifts}",
            f"- **待确认**: {report.pending_confirmations}",
            f"- **已确认**: {report.confirmed_drifts}",
            f"- **已拒绝**: {report.rejected_drifts}",
            "",
            "## 1. 契约信息",
            "",
            f"- **接口**: {summary['contract']['method']} {summary['contract']['api_path']}",
            f"- **名称**: {summary['contract']['name']}",
            f"- **字段数**: {summary['contract']['field_count']}",
            "",
            "## 2. 漂移统计",
            "",
            f"总计发现 **{drift_count}** 处漂移问题。",
            "",
            "### 按类型分布",
            "",
        ]

        for dtype, count in sorted(summary["drifts"]["by_type"].items()):
            lines.append(f"- {dtype}: {count} 处")

        lines.extend(["", "### 按字段分布", ""])

        sorted_fields = sorted(
            summary["drifts"]["by_field"].items(), key=lambda x: (-x[1], x[0])
        )
        for field, count in sorted_fields:
            lines.append(f"- `{field}`: {count} 处")

        lines.extend(["", "## 3. 详细漂移列表", ""])

        current_sample = None
        for drift in sorted(
            report.drifts, key=lambda d: (d.sample_id, d.field_path)
        ):
            if drift.sample_id != current_sample:
                current_sample = drift.sample_id
                lines.extend([f"### 样例: {drift.sample_id}", ""])

            lines.extend([
                f"#### {drift.field_path}",
                f"- **类型**: {drift.diff_type.value}",
                f"- **描述**: {drift.message}",
            ])

            if drift.expected is not None:
                lines.append(f"- **期望**: `{drift.expected}`")
            if drift.actual is not None:
                lines.append(f"- **实际**: `{drift.actual}`")

            if drift.sample_source:
                lines.append(
                    f"- **位置**: {drift.sample_source.file_path}:{drift.sample_source.line_start}"
                )

            lines.append("")

        lines.extend(["", "## 4. 确认记录", ""])

        if report.confirmations:
            for conf in report.confirmations:
                lines.extend([
                    f"- **{conf.status.value}** - {conf.field_path}",
                    f"  消费方: {conf.consumer_id}",
                    f"  时间: {conf.confirmed_at}",
                ])
                if conf.comment:
                    lines.append(f"  备注: {conf.comment}")
                lines.append("")
        else:
            lines.append("暂无确认记录")

        return "\n".join(lines)

    def _get_html_template(self) -> str:
        return """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>契约漂移检测报告 - {{ report.report_id }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f7fa;
            color: #333;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
        }
        .header h1 { font-size: 28px; margin-bottom: 15px; }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .stat-card {
            background: rgba(255,255,255,0.15);
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-card .value { font-size: 28px; font-weight: bold; }
        .stat-card .label { font-size: 12px; opacity: 0.9; }

        .section {
            background: white;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .section h2 {
            font-size: 20px;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #eee;
        }
        .section h3 {
            font-size: 16px;
            margin: 20px 0 10px;
            color: #555;
        }

        .drift-list { margin-top: 15px; }
        .drift-item {
            padding: 15px;
            border-left: 4px solid;
            margin-bottom: 10px;
            background: #fafafa;
            border-radius: 0 8px 8px 0;
        }
        .drift-item.field_added { border-color: #10b981; }
        .drift-item.field_missing { border-color: #f59e0b; }
        .drift-item.type_mismatch { border-color: #ef4444; }
        .drift-item.required_violation { border-color: #dc2626; }
        .drift-item.format_mismatch { border-color: #8b5cf6; }

        .drift-field { font-family: 'Monaco', monospace; font-weight: bold; margin-bottom: 8px; }
        .drift-message { color: #666; margin-bottom: 8px; }
        .drift-meta {
            font-size: 12px;
            color: #888;
            display: flex;
            gap: 15px;
        }

        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
        }
        .badge.pending { background: #fef3c7; color: #d97706; }
        .badge.confirmed { background: #d1fae5; color: #059669; }
        .badge.rejected { background: #fee2e2; color: #dc2626; }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .info-row:last-child { border-bottom: none; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 契约漂移检测报告</h1>
        <div>报告ID: {{ report.report_id }} | 生成时间: {{ report.generated_at }}</div>
        <div class="stats">
            <div class="stat-card">
                <div class="value">{{ report.total_drifts }}</div>
                <div class="label">漂移总数</div>
            </div>
            <div class="stat-card">
                <div class="value">{{ report.pending_confirmations }}</div>
                <div class="label">待确认</div>
            </div>
            <div class="stat-card">
                <div class="value">{{ report.confirmed_drifts }}</div>
                <div class="label">已确认</div>
            </div>
            <div class="stat-card">
                <div class="value">{{ report.sample_ids|length }}</div>
                <div class="label">样例数量</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>📋 契约信息</h2>
        <div class="grid-2">
            <div>
                <div class="info-row">
                    <span>接口</span>
                    <strong>{{ report.summary.contract.method }} {{ report.summary.contract.api_path }}</strong>
                </div>
                <div class="info-row">
                    <span>名称</span>
                    <span>{{ report.summary.contract.name }}</span>
                </div>
                <div class="info-row">
                    <span>版本</span>
                    <span>{{ report.contract_version }}</span>
                </div>
            </div>
            <div>
                <div class="info-row">
                    <span>字段数量</span>
                    <span>{{ report.summary.contract.field_count }}</span>
                </div>
                <div class="info-row">
                    <span>消费方数量</span>
                    <span>{{ report.summary.consumers.count }}</span>
                </div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>⚠️ 漂移详情</h2>
        <div class="drift-list">
            {% for drift in report.drifts %}
            <div class="drift-item {{ drift.diff_type.value }}">
                <div class="drift-field">{{ drift.field_path }}</div>
                <div class="drift-message">{{ drift.message }}</div>
                {% if drift.expected or drift.actual %}
                <div style="margin: 8px 0; font-family: monospace; font-size: 13px;">
                    {% if drift.expected %}期望: <code>{{ drift.expected }}</code>{% endif %}
                    {% if drift.expected and drift.actual %} | {% endif %}
                    {% if drift.actual %}实际: <code>{{ drift.actual }}</code>{% endif %}
                </div>
                {% endif %}
                <div class="drift-meta">
                    <span>样例: {{ drift.sample_id[:8] }}</span>
                    {% if drift.sample_source %}
                    <span>位置: {{ drift.sample_source.file_path }}:{{ drift.sample_source.line_start }}</span>
                    {% endif %}
                    <span>类型: {{ drift.diff_type.value }}</span>
                </div>
            </div>
            {% endfor %}
        </div>
    </div>

    {% if report.confirmations %}
    <div class="section">
        <h2>✅ 确认记录</h2>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            {% for conf in report.confirmations %}
            <div style="padding: 12px; background: #f8fafc; border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>{{ conf.field_path }}</strong>
                    <span class="badge {{ conf.status.value }}">{{ conf.status.value }}</span>
                </div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    消费方: {{ conf.consumer_id }} | 时间: {{ conf.confirmed_at }}
                </div>
                {% if conf.comment %}
                <div style="margin-top: 8px; font-size: 13px; color: #444;">
                    备注: {{ conf.comment }}
                </div>
                {% endif %}
            </div>
            {% endfor %}
        </div>
    </div>
    {% endif %}
</body>
</html>
"""
