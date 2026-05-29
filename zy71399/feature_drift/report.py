from __future__ import annotations

import csv
import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from .models import DriftReport


def report_to_dict(report: DriftReport) -> Dict[str, Any]:
    return asdict(report)


def export_json(report: DriftReport, path: str) -> str:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)

    data = report_to_dict(report)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    return str(p)


def export_csv(report: DriftReport, path: str) -> str:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    for result in report.feature_results:
        row = {
            "report_id": report.report_id,
            "generated_at": report.generated_at,
            "feature_name": result["feature_name"] if isinstance(result, dict) else result.feature_name,
            "feature_type": result["feature_type"] if isinstance(result, dict) else result.feature_type.value,
            "drift_metric": result["drift_metric"] if isinstance(result, dict) else result.drift_metric,
            "metric_name": result["metric_name"] if isinstance(result, dict) else result.metric_name,
            "is_drifted": result["is_drifted"] if isinstance(result, dict) else result.is_drifted,
            "baseline_missing_rate": result["baseline_missing_rate"] if isinstance(result, dict) else result.baseline_missing_rate,
            "online_missing_rate": result["online_missing_rate"] if isinstance(result, dict) else result.online_missing_rate,
            "missing_rate_delta": result["missing_rate_delta"] if isinstance(result, dict) else result.missing_rate_delta,
            "model_version": result["model_version"] if isinstance(result, dict) else result.model_version,
        }
        rows.append(row)

    if not rows:
        rows.append({"report_id": report.report_id, "generated_at": report.generated_at})

    fieldnames = list(rows[0].keys())
    with open(p, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return str(p)


def format_summary(report: DriftReport) -> str:
    lines = []
    lines.append(f"=" * 60)
    lines.append(f"特征漂移检测报告  {report.report_id}")
    lines.append(f"生成时间: {report.generated_at}")
    lines.append(f"=" * 60)

    lines.append(f"\n【总览】")
    lines.append(f"  检测特征数: {len(report.feature_results)}")
    drifted = [r for r in report.feature_results if r.is_drifted]
    lines.append(f"  漂移特征数: {len(drifted)}")
    lines.append(f"  需人工处理: {len(report.needs_manual_review)}")

    critical = [a for a in report.alerts if a.level.value == "critical"]
    warning = [a for a in report.alerts if a.level.value == "warning"]
    lines.append(f"  CRITICAL 告警: {len(critical)}")
    lines.append(f"  WARNING 告警:  {len(warning)}")

    if report.window_issues:
        lines.append(f"\n【窗口问题】(优先暴露)")
        for wi in report.window_issues:
            icon = "🔴" if wi.severity.value == "critical" else "🟡"
            lines.append(f"  {icon} [{wi.window_id}] {wi.issue_type}: {wi.message}")

    if report.version_slices:
        lines.append(f"\n【版本切片】")
        for vs in report.version_slices:
            status = "有漂移" if vs.has_drift else "正常"
            lines.append(f"  版本 {vs.version}: {vs.sample_count} 样本, {status}")
            for fr in vs.feature_results:
                if fr.is_drifted:
                    lines.append(f"    - {fr.feature_name}: {fr.metric_name}={fr.drift_metric:.4f}")

    if report.needs_manual_review:
        lines.append(f"\n【需人工处理】")
        for fn in report.needs_manual_review:
            alert = next((a for a in report.alerts if a.feature_name == fn), None)
            if alert:
                lines.append(f"  ⚠ {fn}: {alert.explanation}")
            else:
                lines.append(f"  ⚠ {fn}")

    if report.dedup_log:
        lines.append(f"\n【去重记录】({len(report.dedup_log)} 条)")
        for log_entry in report.dedup_log[:10]:
            lines.append(f"  - {log_entry}")
        if len(report.dedup_log) > 10:
            lines.append(f"  ... 共 {len(report.dedup_log)} 条")

    lines.append(f"\n" + "=" * 60)
    return "\n".join(lines)
