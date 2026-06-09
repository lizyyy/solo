"""时间线构建与补录。"""

from __future__ import annotations

import uuid
from typing import Any, Optional

from .models import (
    TimelineEvent,
    TimelineEventType,
    WorkOrder,
    now_iso,
)


def _new_event_id() -> str:
    return "evt_" + uuid.uuid4().hex[:10]


def build_timeline(wo: WorkOrder, *,
                   include_raw: bool = False) -> list[dict]:
    """把时间线事件转为值班脚本易读的字典列表，按时间升序。

    返回字段结构稳定：
      {event_id, type, timestamp, actor, summary, metadata}
    """
    events = sorted(wo.timeline, key=lambda e: e.timestamp)
    out: list[dict] = []
    for e in events:
        d = {
            "event_id": e.event_id,
            "type": e.event_type.value,
            "timestamp": e.timestamp,
            "actor": e.actor,
            "summary": e.summary,
            "metadata": dict(e.metadata),
        }
        if include_raw:
            d["before"] = dict(e.before_snapshot)
            d["after"] = dict(e.after_snapshot)
        out.append(d)
    return out


def record_supplement(
    wo: WorkOrder,
    *,
    actor: str,
    note: str,
    evidence: dict[str, Any],
    new_conclusion: Optional[str] = None,
    reversal_reason: Optional[str] = None,
) -> TimelineEvent:
    """记录一次补录（或改判）。"""
    before = {
        "current_conclusion": wo.current_conclusion,
        "current_note": wo.current_note,
        "status": wo.status.value,
    }

    old_conclusion = wo.current_conclusion
    if new_conclusion is not None:
        wo.current_conclusion = new_conclusion
    if note:
        wo.current_note = note

    is_reversal = (
        reversal_reason is not None
        or (old_conclusion is not None
            and new_conclusion is not None
            and old_conclusion != new_conclusion)
    )

    if is_reversal:
        event_type = TimelineEventType.REVERSAL
        wo.conclusion_history.append({
            "timestamp": now_iso(),
            "actor": actor,
            "old_conclusion": old_conclusion,
            "new_conclusion": new_conclusion,
            "old_note": before["current_note"],
            "new_note": note or wo.current_note,
            "reversal_reason": reversal_reason or "结论发生变更",
            "evidence_snapshot": dict(evidence),
        })
        summary = (f"[改判] {reversal_reason or '结论变更'}："
                   f"{old_conclusion} → {new_conclusion}")
    else:
        event_type = TimelineEventType.SUPPLEMENT
        summary = f"[补录] {note[:80]}" if note else "补录证据材料"

    after = {
        "current_conclusion": wo.current_conclusion,
        "current_note": wo.current_note,
        "status": wo.status.value,
        "evidence": dict(evidence),
    }

    evt = TimelineEvent(
        event_id=_new_event_id(),
        event_type=event_type,
        timestamp=now_iso(),
        actor=actor,
        summary=summary,
        before_snapshot=before,
        after_snapshot=after,
        metadata={"evidence": dict(evidence)},
    )
    wo.timeline.append(evt)
    return evt


def record_alarm(wo: WorkOrder, *, actor: str, alarm_text: str,
                 details: Optional[dict] = None) -> TimelineEvent:
    evt = TimelineEvent(
        event_id=_new_event_id(),
        event_type=TimelineEventType.ALARM,
        timestamp=now_iso(),
        actor=actor,
        summary=f"[报警] {alarm_text}",
        before_snapshot={"alarm_status": wo.alarm_status},
        after_snapshot={
            "alarm_status": "triggered",
            "alarm_text": alarm_text,
            "details": dict(details or {}),
        },
        metadata={"alarm_text": alarm_text, "details": dict(details or {})},
    )
    wo.timeline.append(evt)
    wo.alarm_status = "triggered"
    return evt


def record_manual_note(wo: WorkOrder, *, actor: str, note: str) -> TimelineEvent:
    evt = TimelineEvent(
        event_id=_new_event_id(),
        event_type=TimelineEventType.MANUAL_NOTE,
        timestamp=now_iso(),
        actor=actor,
        summary=f"[人工备注] {note[:120]}",
        after_snapshot={"note": note},
    )
    wo.timeline.append(evt)
    if wo.current_note:
        wo.current_note = wo.current_note + "\n" + note
    else:
        wo.current_note = note
    return evt


def check_alarm_note_consistency(wo: WorkOrder) -> tuple[bool, Optional[str]]:
    """检查"报警状态 vs 人工备注"是否矛盾 — 老唐最担心的那一条。

    规则：
    - 如果有 alarm_status=triggered，但人工备注里没有提到报警内容 → 不一致
    - 如果备注说"已处理报警"但 alarm_status 没置为 handled → 不一致
    返回 (是否一致, 不一致时的说明)
    """
    alarm_events = [
        e for e in wo.timeline
        if e.event_type == TimelineEventType.ALARM
    ]
    note_events = [
        e for e in wo.timeline
        if e.event_type in (TimelineEventType.MANUAL_NOTE,
                            TimelineEventType.SUPPLEMENT,
                            TimelineEventType.REVERSAL)
    ]
    note_text = "\n".join(
        (ne.summary + " " + (ne.metadata.get("evidence", {}).get("note") or ""))
        for ne in note_events
    )

    if alarm_events and wo.alarm_status == "triggered":
        last_alarm = alarm_events[-1]
        alarm_text = last_alarm.metadata.get("alarm_text", "")
        if alarm_text and alarm_text[:10] not in note_text:
            return False, (f"存在未在备注中回应的报警：[{alarm_text}]，"
                           f"请在人工备注中明确说明如何处理这条报警。")

    if "报警已处理" in note_text and wo.alarm_status != "handled":
        return False, ("备注声称报警已处理，但工单 alarm_status 仍为 "
                       f"{wo.alarm_status!r}，请补一条 alarm_status=handled 的状态变更。")
    return True, None
