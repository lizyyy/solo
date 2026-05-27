from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Tuple

from .config import settings
from .schemas import (
    AnalysisReport,
    BatchIngestRequest,
    FailedItem,
    ItemTrace,
    NormalItem,
    PackageRow,
    PendingItem,
    ReturnRule,
    SmsRecord,
    Suggestion,
)


def _mask_phone(phone: str) -> str:
    if not phone:
        return ""
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) < 7:
        return "*" * len(digits)
    return digits[:3] + "*" * (len(digits) - 7) + digits[-4:]


def _get_rule(req: BatchIngestRequest, rule_type: str) -> ReturnRule | None:
    for r in req.rules:
        if r.enabled and r.rule_type == rule_type:
            return r
    return None


def classify(req: BatchIngestRequest, now: datetime | None = None) -> Tuple[
    AnalysisReport, List[ItemTrace]
]:
    now = now or datetime.now()
    overstay_rule = _get_rule(req, "overdue_return")
    overstay_days = (
        overstay_rule.overstay_days if overstay_rule else settings.default_overstay_days
    )
    repeat_rule = _get_rule(req, "repeat_remind")
    privacy_rule = _get_rule(req, "privacy_mask")

    reminders: Dict[str, List[SmsRecord]] = {}
    for s in req.sms_records:
        reminders.setdefault(s.tracking_no, []).append(s)

    failed: List[FailedItem] = []
    pending: List[PendingItem] = []
    normal: List[NormalItem] = []
    traces: List[ItemTrace] = []
    report_ref = f"reports/{req.batch_id}.json"

    repeat_threshold = 3
    if repeat_rule and "threshold" in repeat_rule.params:
        repeat_threshold = int(repeat_rule.params["threshold"])

    for pkg in req.packages:
        reasons: List[str] = []
        suggestions: List[Suggestion] = []

        days = (now - pkg.inbound_at).total_seconds() / 86400.0
        if days >= overstay_days:
            reasons.append("overdue_overstay")
            suggestions.append(
                Suggestion(
                    code="suggest_return_or_compensate",
                    text=f"已滞留 {days:.1f} 天(阈值 {overstay_days} 天)，建议发起退回或赔付流程",
                )
            )

        cnt = len(reminders.get(pkg.tracking_no, []))
        if cnt >= repeat_threshold:
            reasons.append("excessive_reminders")
            suggestions.append(
                Suggestion(
                    code="suggest_contact_station",
                    text=f"累计催取 {cnt} 次(阈值 {repeat_threshold})，建议驿站站长人工确认，避免骚扰",
                )
            )

        if not pkg.tracking_no or not pkg.recipient_phone:
            reasons.append("missing_key_fields")
            suggestions.append(
                Suggestion(
                    code="suggest_fill_fields",
                    text="运单号或手机号缺失，建议补录原始材料",
                )
            )

        display_phone = pkg.recipient_phone
        if privacy_rule is None or privacy_rule.enabled:
            display_phone = _mask_phone(pkg.recipient_phone)

        original = dict(pkg.raw)
        if privacy_rule is None or privacy_rule.enabled:
            if "recipient_phone" in original:
                original["recipient_phone"] = display_phone
            if "手机号" in original:
                original["手机号"] = display_phone
            for name_key in ("recipient_name", "收件人"):
                if original.get(name_key) and len(str(original[name_key])) > 1:
                    original[name_key] = str(original[name_key])[0] + "*"

        if "missing_key_fields" in reasons:
            failed.append(
                FailedItem(
                    tracking_no=pkg.tracking_no or "(缺失)",
                    reason_codes=reasons,
                    original=original,
                    suggestions=suggestions,
                )
            )
            classification = "failed"
        elif reasons:
            pending.append(
                PendingItem(
                    tracking_no=pkg.tracking_no,
                    reason_codes=reasons,
                    original=original,
                    suggestions=suggestions,
                )
            )
            classification = "pending"
        else:
            normal.append(
                NormalItem(
                    tracking_no=pkg.tracking_no,
                    status=pkg.status,
                    summary=f"入库 {days:.1f} 天，催取 {cnt} 次，处理正常",
                )
            )
            classification = "normal"

        traces.append(
            ItemTrace(
                tracking_no=pkg.tracking_no or "(缺失)",
                batch_id=req.batch_id,
                original=original,
                classification=classification,
                reason_codes=reasons,
                suggestions=suggestions,
                report_ref=report_ref,
            )
        )

    report = AnalysisReport(
        batch_id=req.batch_id,
        generated_at=now,
        normal_count=len(normal),
        pending_count=len(pending),
        failed_count=len(failed),
        normal=normal,
        pending=pending,
        failed=failed,
    )
    return report, traces
