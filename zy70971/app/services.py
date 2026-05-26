import json

from .extensions import db
from .models import Record


MAX_WIND_SPEED = 5.0
MIN_SAFETY_INTERVAL = 4
MIN_REENTRY_HOURS = 24
DOSAGE_OVER_RATIO = 1.2

REQUIRED_FIELDS = (
    "region",
    "pesticide_code",
    "pesticide_name",
    "dosage",
    "standard_dosage",
    "wind_speed",
    "safety_interval_hours",
    "reentry_hours",
    "operator",
    "sprayed_at",
)


def classify_record(record: Record) -> None:
    missing = [f for f in REQUIRED_FIELDS if getattr(record, f, None) in (None, "")]
    if missing:
        record.status = "need_replenish"
        record.reason = "缺少必要字段: " + ", ".join(missing)
        record.action_taken = "请补充上述字段后，重新调用 /records/<id>/submit 提交复核"
        record.final_verdict = None
        return

    reasons = []
    action_parts = []

    if record.wind_speed > MAX_WIND_SPEED:
        reasons.append(
            f"风速 {record.wind_speed} m/s 超过上限 {MAX_WIND_SPEED} m/s，易造成漂移"
        )
        action_parts.append("建议等待风速下降后重喷，或缩小喷洒扇面")

    if record.safety_interval_hours < MIN_SAFETY_INTERVAL:
        reasons.append(
            f"药剂安全间隔 {record.safety_interval_hours}h 小于最小要求 {MIN_SAFETY_INTERVAL}h"
        )
        action_parts.append("需延长施药与下一道工序的时间间隔")

    if record.reentry_hours < MIN_REENTRY_HOURS:
        reasons.append(
            f"区域封闭时间 {record.reentry_hours}h 小于最小要求 {MIN_REENTRY_HOURS}h"
        )
        action_parts.append("需延长区域封闭时间并通知现场管理人员")

    if record.standard_dosage and record.standard_dosage > 0:
        ratio = record.dosage / record.standard_dosage
        if ratio > DOSAGE_OVER_RATIO:
            reasons.append(
                f"用药量超标准 {round((ratio - 1) * 100, 1)}%（实际 {record.dosage}，标准 {record.standard_dosage}）"
            )
            action_parts.append("进入人工复核，由药剂师评估是否调整剂量")

    if reasons:
        if any("超标准" in r for r in reasons):
            record.status = "blocked"
            record.action_taken = "；".join(action_parts)
            record.final_verdict = "overdose_review"
        else:
            record.status = "blocked"
            record.action_taken = "；".join(action_parts)
            record.final_verdict = "needs_condition_fix"
        record.reason = " | ".join(reasons)
        return

    record.status = "normal"
    record.reason = "数据完整且符合风速/安全间隔/封闭时间/用量要求"
    record.action_taken = "自动通过，可进入报告导出"
    record.final_verdict = "passed"


def build_record_from_input(batch_id: int, seq: int, item: dict) -> Record:
    record = Record(
        batch_id=batch_id,
        seq=seq,
        raw_data=json.dumps(item, ensure_ascii=False),
        region=item.get("region"),
        pesticide_code=item.get("pesticide_code"),
        pesticide_name=item.get("pesticide_name"),
        dosage=_to_float(item.get("dosage")),
        dosage_unit=item.get("dosage_unit", "kg/ha"),
        standard_dosage=_to_float(item.get("standard_dosage")),
        wind_speed=_to_float(item.get("wind_speed")),
        safety_interval_hours=_to_int(item.get("safety_interval_hours")),
        reentry_hours=_to_int(item.get("reentry_hours")),
        operator=item.get("operator"),
        sprayed_at=item.get("sprayed_at"),
    )
    classify_record(record)
    return record


def _to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
