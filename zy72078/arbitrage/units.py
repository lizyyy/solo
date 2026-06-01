import math
from datetime import datetime
from collections import defaultdict

from .models import RateRecord, AnomalyRecord


def _parse_unit(unit_str: str) -> float:
    s = unit_str.strip()
    if not s:
        return 1.0
    try:
        return float(s)
    except ValueError:
        return 1.0


def _check_unit_consistency(record: RateRecord) -> list:
    reasons = []
    unit_val = _parse_unit(record.unit)

    if unit_val != 1.0 and record.rate is not None:
        expected_unit_label = f"{record.from_currency}/{record.to_currency}"
        if unit_val > 1:
            reasons.append(
                f"单位系数 {unit_val} > 1，汇率 {record.rate} 可能需要除以 {unit_val} "
                f"才是单位汇率（1 {record.from_currency} = ? {record.to_currency}）"
            )

    if record.rate is not None and record.rate > 1000:
        reasons.append(
            f"汇率值 {record.rate} 异常偏大，可能单位不是 1:{record.from_currency}→{record.to_currency}，"
            f"而是 {record.unit}:{record.from_currency}→{record.to_currency}"
        )

    if record.rate is not None and record.rate < 0.001:
        reasons.append(
            f"汇率值 {record.rate} 异常偏小，可能币种方向写反 "
            f"（{record.to_currency}→{record.from_currency} 的汇率应为 {1/record.rate:.6f}）"
        )

    return reasons


def _check_duplicate_conflict(records: list) -> list:
    edge_map = defaultdict(list)
    for r in records:
        if r.compute_status == "ok":
            key = (r.from_currency, r.to_currency)
            edge_map[key].append(r)

    reasons = []
    for (f, t), recs in edge_map.items():
        if len(recs) > 1:
            rates = [r.rate for r in recs]
            max_r, min_r = max(rates), min(rates)
            if max_r - min_r > 0.01 * max_r:
                sources = [r.original_source or f"行{r.row_index}" for r in recs]
                notes = [r.original_notes or "" for r in recs]
                reasons.append(
                    f"同方向 {f}→{t} 存在 {len(recs)} 条汇率且差异超过1%: "
                    f"rates={rates}, sources={sources}, notes={notes}"
                )
    return reasons


def validate_units(records: list) -> tuple:
    now = datetime.now().isoformat()
    valid = []
    uncomputable = []
    anomalies = []

    for r in records:
        if r.compute_status == "uncomputable":
            uncomputable.append(r)
            anomalies.append(AnomalyRecord(
                row_index=r.row_index,
                from_currency=r.from_currency,
                to_currency=r.to_currency,
                anomaly_type="uncomputable",
                detail=r.compute_reason,
                original_notes=r.original_notes,
                original_source=r.original_source,
                detected_at=now,
            ))
            continue

        unit_reasons = _check_unit_consistency(r)
        if unit_reasons:
            for reason in unit_reasons:
                anomalies.append(AnomalyRecord(
                    row_index=r.row_index,
                    from_currency=r.from_currency,
                    to_currency=r.to_currency,
                    anomaly_type="unit_suspicion",
                    detail=reason,
                    original_notes=r.original_notes,
                    original_source=r.original_source,
                    detected_at=now,
                ))

        adjusted_rate = r.rate
        unit_val = _parse_unit(r.unit)
        if unit_val != 1.0 and r.rate is not None:
            adjusted_rate = r.rate / unit_val

        r.rate = adjusted_rate
        valid.append(r)

    dup_reasons = _check_duplicate_conflict(valid)
    for reason in dup_reasons:
        anomalies.append(AnomalyRecord(
            row_index=-1,
            from_currency="",
            to_currency="",
            anomaly_type="duplicate_conflict",
            detail=reason,
            original_notes="",
            original_source="",
            detected_at=now,
        ))

    return valid, uncomputable, anomalies
