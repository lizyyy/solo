import json
import os
from typing import Any, Dict, List
from dataclasses import asdict
from datetime import datetime

from ..core.models import AnalysisResult, NormalizedBill, AnomalyRecord
from ..core.config import Config
from ..utils.security import mask_sensitive_data, MaskingContext


def _bill_to_dict(bill: NormalizedBill, config: Config) -> Dict[str, Any]:
    result = {
        "provider": bill.provider.value if bill.provider else None,
        "resource_id": bill.resource_id,
        "billing_period_start": (
            bill.billing_period_start.isoformat()
            if bill.billing_period_start.year > 1
            else None
        ),
        "billing_period_end": (
            bill.billing_period_end.isoformat()
            if bill.billing_period_end.year > 1
            else None
        ),
        "cost": bill.cost,
        "original_currency": bill.original_currency,
        "normalized_currency": bill.normalized_currency,
        "exchange_rate": bill.exchange_rate,
        "normalized_cost": bill.normalized_cost,
        "service": bill.service,
        "region": bill.region,
        "instance_type": bill.instance_type,
        "tags": bill.tags,
        "project": bill.project,
        "team": bill.team,
        "environment": bill.environment,
        "is_ri_credit": bill.is_ri_credit,
        "ri_arn": bill.ri_arn,
        "missing_fields": bill.missing_fields,
        "issues": [
            {
                "field_name": issue.field_name,
                "issue_type": issue.issue_type.value,
                "original_value": issue.original_value,
                "message": issue.message,
            }
            for issue in bill.issues
        ],
        "source_file": bill.original_record.source_file if bill.original_record else None,
        "line_number": bill.original_record.line_number if bill.original_record else None,
    }

    if config.enable_export_masking:
        result = mask_sensitive_data(result, config, MaskingContext.EXPORT)

    return result


def _anomaly_to_dict(anomaly: AnomalyRecord, config: Config) -> Dict[str, Any]:
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


def export_machine_readable(
    result: AnalysisResult,
    config: Config,
    output_file: str,
    include_bills: bool = False,
) -> Dict[str, Any]:
    output: Dict[str, Any] = {
        "schema_version": "1.0",
        "generated_at": datetime.now().isoformat(),
        "summary": result.summary,
        "anomalies": [
            _anomaly_to_dict(a, config)
            for a in result.anomalies
        ],
        "tag_issues_count": result.tag_issues_count,
        "duplicate_ri_credits_count": len(result.duplicate_ri_credits),
        "currency_errors_count": len(result.currency_errors),
        "missing_fields_count": result.missing_fields_count,
        "total_normalized_cost": result.total_normalized_cost,
        "budget_comparison": (
            {
                k: mask_sensitive_data(v, config, MaskingContext.EXPORT)
                for k, v in result.budget_comparison.items()
            }
            if result.budget_comparison
            else {}
        ),
    }

    if include_bills:
        output["normalized_bills"] = [
            _bill_to_dict(b, config)
            for b in result.normalized_bills
        ]

    output = mask_sensitive_data(output, config, MaskingContext.EXPORT)

    os.makedirs(os.path.dirname(os.path.abspath(output_file)) or ".", exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    return output
