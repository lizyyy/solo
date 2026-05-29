from typing import List, Optional
from collections import defaultdict

from ..core.models import (
    BillRecord,
    NormalizedBill,
    AnomalyRecord,
    BudgetLine,
    AnalysisResult,
    CloudProvider,
    AnomalyType,
)
from ..core.config import Config
from ..utils.security import get_masked_logger
from ..parsers import get_parser
from .normalization import normalize_bills
from .tag_fixer import fix_and_validate_tags
from .anomaly_detector import detect_anomalies, detect_duplicate_ri_credits
from .budget_comparator import compare_budgets


def run_full_pipeline(
    bill_files: List[str],
    config: Config,
    provider_hints: Optional[List[CloudProvider]] = None,
    reference_bill_files: Optional[List[str]] = None,
    budget_file: Optional[str] = None,
) -> AnalysisResult:
    logger = get_masked_logger(config, "pipeline")
    logger.info("Starting full analysis pipeline")

    all_records: List[BillRecord] = []
    for i, filepath in enumerate(bill_files):
        provider_hint = provider_hints[i] if provider_hints and i < len(provider_hints) else None
        parser = get_parser(filepath, config, provider_hint)
        records = parser.parse(filepath)
        all_records.extend(records)

    logger.info(f"Total records parsed: {len(all_records)}")

    normalized_bills, normalization_anomalies = normalize_bills(all_records, config)

    normalized_bills, tag_anomalies, tag_issues_count = fix_and_validate_tags(
        normalized_bills, config
    )

    reference_bills: List[NormalizedBill] = []
    if reference_bill_files:
        reference_records: List[BillRecord] = []
        for i, filepath in enumerate(reference_bill_files):
            provider_hint = provider_hints[i] if provider_hints and i < len(provider_hints) else None
            parser = get_parser(filepath, config, provider_hint)
            records = parser.parse(filepath)
            reference_records.extend(records)
        reference_bills, _ = normalize_bills(reference_records, config)

    cost_anomalies = detect_anomalies(
        normalized_bills, config,
        reference_bills=reference_bills if reference_bills else None,
    )

    duplicate_ri_credits, ri_anomalies = detect_duplicate_ri_credits(normalized_bills, config)

    currency_errors = [
        a for a in normalization_anomalies
        if a.anomaly_type == AnomalyType.CURRENCY_ERROR
    ]

    budget_comparison = {}
    budget_anomalies: List[AnomalyRecord] = []
    if budget_file:
        from .budget_comparator import load_budget_file
        budgets = load_budget_file(budget_file, config)
        budget_comparison, budget_anomalies = compare_budgets(
            normalized_bills, budgets, config
        )

    all_anomalies = (
        normalization_anomalies
        + tag_anomalies
        + cost_anomalies
        + ri_anomalies
        + budget_anomalies
    )

    all_anomalies = list({
        (a.anomaly_type, a.message, a.period or "", a.resource_id or "", a.service or ""): a
        for a in all_anomalies
    }.values())

    total_normalized_cost = sum(
        bill.normalized_cost for bill in normalized_bills
        if not bill.is_ri_credit
    )

    missing_fields_count = sum(
        len(bill.missing_fields) for bill in normalized_bills
    )

    provider_counts = defaultdict(int)
    for bill in normalized_bills:
        provider_counts[bill.provider.value] += 1

    period_range = []
    valid_dates = [
        b.billing_period_start for b in normalized_bills
        if b.billing_period_start.year > 1
    ]
    if valid_dates:
        period_range = [min(valid_dates).strftime("%Y-%m-%d"), max(valid_dates).strftime("%Y-%m-%d")]

    summary = {
        "total_records": len(all_records),
        "total_normalized_bills": len(normalized_bills),
        "total_anomalies": len(all_anomalies),
        "total_tag_issues": sum(tag_issues_count.values()),
        "total_normalized_cost": total_normalized_cost,
        "target_currency": config.target_currency,
        "provider_breakdown": dict(provider_counts),
        "period_range": period_range,
        "anomaly_breakdown": _get_anomaly_breakdown(all_anomalies),
    }

    result = AnalysisResult(
        normalized_bills=normalized_bills,
        anomalies=all_anomalies,
        tag_issues_count=tag_issues_count,
        duplicate_ri_credits=duplicate_ri_credits,
        currency_errors=currency_errors,
        missing_fields_count=missing_fields_count,
        total_normalized_cost=total_normalized_cost,
        budget_comparison=budget_comparison,
        summary=summary,
    )

    logger.info(
        f"Pipeline complete: {len(normalized_bills)} bills, "
        f"{len(all_anomalies)} anomalies, "
        f"total cost: {total_normalized_cost:.2f} {config.target_currency}"
    )

    return result


def _get_anomaly_breakdown(anomalies: List[AnomalyRecord]) -> dict:
    breakdown = defaultdict(int)
    severity_breakdown = defaultdict(int)
    for a in anomalies:
        breakdown[a.anomaly_type.value] += 1
        severity_breakdown[a.severity] += 1
    return {
        "by_type": dict(breakdown),
        "by_severity": dict(severity_breakdown),
    }
