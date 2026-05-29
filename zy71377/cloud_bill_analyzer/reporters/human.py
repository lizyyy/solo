import os
from typing import Any, Dict, List
from datetime import datetime
from jinja2 import Environment, FileSystemLoader, select_autoescape

from ..core.models import AnalysisResult, AnomalyRecord, AnomalyType
from ..core.config import Config
from ..utils.security import mask_sensitive_data, MaskingContext


def _anomaly_to_template_dict(anomaly: AnomalyRecord, config: Config) -> Dict[str, Any]:
    result = {
        "anomaly_type": anomaly.anomaly_type.value,
        "severity": anomaly.severity,
        "message": anomaly.message,
        "provider": anomaly.provider.value if anomaly.provider else None,
        "resource_id": anomaly.resource_id,
        "service": anomaly.service,
        "project": anomaly.project,
        "period": anomaly.period,
        "current_cost": anomaly.current_cost,
        "previous_cost": anomaly.previous_cost,
        "change_percent": anomaly.change_percent,
        "threshold": anomaly.threshold,
        "raw_data": anomaly.raw_data,
    }

    if config.enable_export_masking:
        result = mask_sensitive_data(result, config, MaskingContext.EXPORT)

    return result


def export_human_report(
    result: AnalysisResult,
    config: Config,
    output_file: str,
) -> str:
    template_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
    template_dir = os.path.abspath(template_dir)

    env = Environment(
        loader=FileSystemLoader(template_dir),
        autoescape=select_autoescape(["html", "xml"]),
    )

    template = env.get_template("report_template.html")

    anomalies = [
        _anomaly_to_template_dict(a, config)
        for a in result.anomalies
    ]

    high_anomalies = [a for a in anomalies if a["severity"] == "high"]

    severity_counts = {
        "high": sum(1 for a in anomalies if a["severity"] == "high"),
        "medium": sum(1 for a in anomalies if a["severity"] == "medium"),
        "low": sum(1 for a in anomalies if a["severity"] == "low"),
    }

    anomaly_breakdown = result.summary.get("anomaly_breakdown", {})

    budget_comparison = {}
    if result.budget_comparison:
        budget_comparison = {
            k: mask_sensitive_data(v, config, MaskingContext.EXPORT)
            for k, v in result.budget_comparison.items()
        }

    html_content = template.render(
        summary=mask_sensitive_data(result.summary, config, MaskingContext.EXPORT),
        anomalies=anomalies,
        high_anomalies=high_anomalies,
        anomaly_breakdown=anomaly_breakdown,
        severity_counts=severity_counts,
        duplicate_ri_count=len(result.duplicate_ri_credits),
        currency_errors_count=len(result.currency_errors),
        tag_issues_count=result.tag_issues_count,
        budget_comparison=budget_comparison,
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    )

    os.makedirs(os.path.dirname(os.path.abspath(output_file)) or ".", exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(html_content)

    return html_content
