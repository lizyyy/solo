from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from datetime import datetime
import warnings

from ..core.models import (
    NormalizedBill,
    AnomalyRecord,
    AnomalyType,
    CloudProvider,
)
from ..core.config import Config
from ..utils.security import get_masked_logger


def _group_by_period_and_key(
    bills: List[NormalizedBill],
    group_key: str,
) -> Dict[str, Dict[str, float]]:
    groups: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    for bill in bills:
        if bill.billing_period_start.year <= 1:
            continue

        period = bill.billing_period_start.strftime("%Y-%m")

        if group_key == "service":
            key = bill.service or "unknown_service"
        elif group_key == "project":
            key = bill.project or "unknown_project"
        elif group_key == "resource":
            key = bill.resource_id or "unknown_resource"
        elif group_key == "provider":
            key = bill.provider.value if bill.provider else "unknown_provider"
        elif group_key == "team":
            key = bill.team or "unknown_team"
        else:
            key = bill.service or "unknown_service"

        groups[period][key] += bill.normalized_cost

    return groups


def detect_duplicate_ri_credits(
    bills: List[NormalizedBill],
    config: Config,
) -> Tuple[List[NormalizedBill], List[AnomalyRecord]]:
    logger = get_masked_logger(config, "anomaly_detector")

    if not config.duplicate_ri_detection:
        logger.info("Duplicate RI detection is disabled")
        return [], []

    logger.info("Detecting duplicate RI credits")

    ri_groups: Dict[str, List[NormalizedBill]] = defaultdict(list)
    duplicates: List[NormalizedBill] = []
    anomalies: List[AnomalyRecord] = []

    for bill in bills:
        if not bill.is_ri_credit:
            continue

        key_parts = []
        if bill.ri_arn:
            key_parts.append(f"ri:{bill.ri_arn}")
        if bill.resource_id:
            key_parts.append(f"res:{bill.resource_id}")
        key_parts.append(bill.billing_period_start.strftime("%Y-%m-%d"))
        key_parts.append(bill.service or "unknown")

        key = "|".join(key_parts)
        ri_groups[key].append(bill)

    for key, group in ri_groups.items():
        if len(group) > 1:
            total_credit = sum(b.normalized_cost for b in group)
            abs_total = sum(abs(b.normalized_cost) for b in group)

            has_sign_mix = any(b.normalized_cost > 0 for b in group) and any(b.normalized_cost < 0 for b in group)
            has_duplicate_values = len(set(round(b.normalized_cost, 4) for b in group)) < len(group)
            is_suspicious = has_sign_mix or has_duplicate_values or len(group) >= 3

            if is_suspicious or (abs(total_credit) < abs_total * 0.95):
                duplicates.extend(group)

                for bill in group:
                    period = (
                        bill.billing_period_start.strftime("%Y-%m-%d")
                        if bill.billing_period_start.year > 1
                        else "unknown"
                    )
                    anomalies.append(AnomalyRecord(
                        anomaly_type=AnomalyType.DUPLICATE_RI_CREDIT,
                        severity="high",
                        message=(
                            f"Potential duplicate RI credit detected: "
                            f"{len(group)} entries for same RI/resource on {period}, "
                            f"total: {total_credit:.2f} {bill.normalized_currency}, "
                            f"sum of absolute values: {abs_total:.2f} {bill.normalized_currency}"
                        ),
                        provider=bill.provider,
                        resource_id=bill.resource_id,
                        service=bill.service,
                        project=bill.project,
                        period=period,
                        current_cost=bill.normalized_cost,
                        threshold=0.0,
                        normalized_bill=bill,
                        raw_data={
                            "ri_arn": bill.ri_arn,
                            "group_size": len(group),
                            "group_total": total_credit,
                            "group_abs_total": abs_total,
                            "has_sign_mix": has_sign_mix,
                            "has_duplicate_values": has_duplicate_values,
                        },
                    ))

    logger.info(f"Found {len(duplicates)} potential duplicate RI credits in {len(anomalies)} anomalies")
    return duplicates, anomalies


def detect_anomalies(
    bills: List[NormalizedBill],
    config: Config,
    reference_bills: Optional[List[NormalizedBill]] = None,
) -> List[AnomalyRecord]:
    logger = get_masked_logger(config, "anomaly_detector")
    logger.info(f"Detecting anomalies for {len(bills)} bills")

    anomalies: List[AnomalyRecord] = []

    _, ri_anomalies = detect_duplicate_ri_credits(bills, config)
    anomalies.extend(ri_anomalies)

    current_groups = _group_by_period_and_key(bills, "service")

    if reference_bills:
        reference_groups = _group_by_period_and_key(reference_bills, "service")

        current_periods = sorted(current_groups.keys())
        reference_periods = sorted(reference_groups.keys())

        if current_periods and reference_periods:
            current_period = current_periods[-1]
            reference_period = reference_periods[-1]

            current_services = current_groups.get(current_period, {})
            reference_services = reference_groups.get(reference_period, {})

            all_services = set(current_services.keys()) | set(reference_services.keys())

            for service in all_services:
                current_cost = current_services.get(service, 0.0)
                reference_cost = reference_services.get(service, 0.0)

                if reference_cost > 0:
                    change_percent = ((current_cost - reference_cost) / reference_cost) * 100
                elif current_cost > 0:
                    change_percent = 100.0
                else:
                    change_percent = 0.0

                abs_diff = abs(current_cost - reference_cost)

                if abs_diff >= config.anomaly_min_amount:
                    if change_percent >= config.anomaly_threshold_percent:
                        severity = "high" if change_percent >= 100 else "medium"
                        anomalies.append(AnomalyRecord(
                            anomaly_type=AnomalyType.COST_SPIKE,
                            severity=severity,
                            message=(
                                f"Cost spike detected for {service}: "
                                f"{reference_period} {reference_cost:.2f} -> "
                                f"{current_period} {current_cost:.2f} {config.target_currency} "
                                f"(+{change_percent:.1f}%)"
                            ),
                            service=service,
                            period=current_period,
                            current_cost=current_cost,
                            previous_cost=reference_cost,
                            change_percent=change_percent,
                            threshold=config.anomaly_threshold_percent,
                            raw_data={
                                "group_by": "service",
                                "current_period": current_period,
                                "reference_period": reference_period,
                            },
                        ))
                    elif change_percent <= -config.anomaly_threshold_percent:
                        anomalies.append(AnomalyRecord(
                            anomaly_type=AnomalyType.COST_DROP,
                            severity="low",
                            message=(
                                f"Cost drop detected for {service}: "
                                f"{reference_period} {reference_cost:.2f} -> "
                                f"{current_period} {current_cost:.2f} {config.target_currency} "
                                f"({change_percent:.1f}%)"
                            ),
                            service=service,
                            period=current_period,
                            current_cost=current_cost,
                            previous_cost=reference_cost,
                            change_percent=change_percent,
                            threshold=config.anomaly_threshold_percent,
                            raw_data={
                                "group_by": "service",
                                "current_period": current_period,
                                "reference_period": reference_period,
                            },
                        ))

    if len(current_groups) >= 2:
        periods = sorted(current_groups.keys())
        for i in range(1, len(periods)):
            current_period = periods[i]
            previous_period = periods[i - 1]

            current_services = current_groups.get(current_period, {})
            previous_services = current_groups.get(previous_period, {})

            all_services = set(current_services.keys()) | set(previous_services.keys())

            for service in all_services:
                current_cost = current_services.get(service, 0.0)
                previous_cost = previous_services.get(service, 0.0)

                if previous_cost > 0:
                    change_percent = ((current_cost - previous_cost) / previous_cost) * 100
                elif current_cost > 0:
                    change_percent = 100.0
                else:
                    continue

                abs_diff = abs(current_cost - previous_cost)

                if abs_diff >= config.anomaly_min_amount:
                    if change_percent >= config.anomaly_threshold_percent:
                        severity = "high" if change_percent >= 100 else "medium"
                        anomalies.append(AnomalyRecord(
                            anomaly_type=AnomalyType.COST_SPIKE,
                            severity=severity,
                            message=(
                                f"Cost spike detected for {service}: "
                                f"{previous_period} {previous_cost:.2f} -> "
                                f"{current_period} {current_cost:.2f} {config.target_currency} "
                                f"(+{change_percent:.1f}%)"
                            ),
                            service=service,
                            period=current_period,
                            current_cost=current_cost,
                            previous_cost=previous_cost,
                            change_percent=change_percent,
                            threshold=config.anomaly_threshold_percent,
                            raw_data={
                                "group_by": "service",
                            },
                        ))

    resource_groups = _group_by_period_and_key(bills, "resource")
    for period, resources in resource_groups.items():
        for resource_id, cost in resources.items():
            if abs(cost) >= config.anomaly_min_amount * 5:
                related_bills = [
                    b for b in bills
                    if b.resource_id == resource_id
                    and b.billing_period_start.strftime("%Y-%m") == period
                ]
                if related_bills:
                    bill = related_bills[0]
                    if bill.project is None or bill.team is None:
                        anomalies.append(AnomalyRecord(
                            anomaly_type=AnomalyType.MISSING_TAG,
                            severity="medium",
                            message=(
                                f"High-cost resource {resource_id} ({cost:.2f} {config.target_currency}) "
                                f"has missing project/team tags"
                            ),
                            provider=bill.provider,
                            resource_id=resource_id,
                            service=bill.service,
                            period=period,
                            current_cost=cost,
                            raw_data={
                                "has_project": bill.project is not None,
                                "has_team": bill.team is not None,
                            },
                        ))

    logger.info(f"Anomaly detection complete: {len(anomalies)} anomalies found")
    return anomalies
