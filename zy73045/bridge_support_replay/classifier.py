"""工单状态分类 — 已处理 / 待补证据 / 卡壳。"""

from __future__ import annotations

from typing import Optional

from .models import (
    WorkOrder,
    WorkOrderStatus,
    TimelineEventType,
)
from .storage import load_all_workorders
from .validators import validate_all_photos
from .timeline import check_alarm_note_consistency


def classify_workorder(wo: WorkOrder) -> dict:
    """把一个工单分类，并给出分类依据（便于写周报/交代进展）。

    返回 dict：
      {"status": WorkOrderStatus,
       "reasons": [为什么这么分],
       "missing_items": [缺什么材料],
       "blockers": [什么东西卡住了]}
    """
    reasons: list[str] = []
    missing: list[str] = []
    blockers: list[str] = []

    # 1. 先看有没有明确状态
    if wo.status == WorkOrderStatus.HANDLED:
        reasons.append("工单已标记为已处理")
    elif wo.status == WorkOrderStatus.PENDING_EVIDENCE:
        missing.append("工单状态本身标记为待补证据")

    # 2. 备件清单不齐整 → 待补证据
    if not wo.spare_parts:
        missing.append("备件清单为空，需要确认是否需要补充")
    else:
        missing_fields_parts = []
        for sp in wo.spare_parts:
            if sp.name is None:
                missing_fields_parts.append(f"{sp.part_id} 缺 name")
            if sp.quantity is None:
                missing_fields_parts.append(f"{sp.part_id} 缺 quantity")
        if missing_fields_parts:
            missing.append("备件字段不完整：" + "；".join(missing_fields_parts))

    # 3. 照片时间错位 high/critical → 卡壳
    photo_results, photo_blocker = validate_all_photos(wo.photos)
    if photo_blocker:
        high_critical = [r for r in photo_results if r.severity in ("high", "critical")]
        for r in high_critical:
            blockers.append(
                f"照片 {r.photo_id}: {r.human_readable_summary}；"
                f"建议动作→" + " → ".join(r.suggested_actions[:2])
            )

    # 4. 报警与人工备注对不上 → 卡壳
    consistent, inconsistency_note = check_alarm_note_consistency(wo)
    if not consistent:
        blockers.append(f"报警/备注不一致：{inconsistency_note}")

    # 5. 结论缺失 → 待补证据
    if wo.current_conclusion is None:
        missing.append("尚未填写处理结论")

    # 最终判定：有 blockers → STUCK；缺材料但不卡 → PENDING_EVIDENCE；否则 HANDLED
    if blockers:
        status = WorkOrderStatus.STUCK
        reasons.extend(blockers)
    elif missing or wo.status == WorkOrderStatus.PENDING_EVIDENCE or wo.status == WorkOrderStatus.CREATED:
        status = WorkOrderStatus.PENDING_EVIDENCE
        reasons.append("待补材料")
    else:
        status = WorkOrderStatus.HANDLED

    # 如果工单的硬标记和分类器真实判断不一致，要特别标注
    override_note = ""
    if wo.status != status:
        override_note = (f"⚠️ 工单标记为『{wo.status.value}』，"
                         f"但分类器基于实际材料判断为『{status.value}』，"
                         f"请确认是否真的闭环。")

    return {
        "workorder_id": wo.workorder_id,
        "title": wo.title,
        "status": status,
        "status_label": {
            "handled": "✅ 已处理",
            "pending_evidence": "📋 待补证据",
            "stuck": "🚧 还卡着",
            "created": "📝 初始录入",
        }[status.value],
        "reasons": reasons,
        "missing_items": missing,
        "blockers": blockers,
        "override_note": override_note,
    }


def list_workorders(status_filter: Optional[WorkOrderStatus] = None) -> dict:
    """按状态分组返回所有工单 — 接手同事拿这个直接去交代进展。

    返回::
      {"handled":          [分类结果...],
       "pending_evidence": [分类结果...],
       "stuck":            [分类结果...]}
    """
    all_wos = load_all_workorders()
    bucket: dict[str, list[dict]] = {
        "handled": [],
        "pending_evidence": [],
        "stuck": [],
    }
    for wo in all_wos:
        c = classify_workorder(wo)
        bucket[c["status"].value].append(c)

    for k in bucket:
        bucket[k].sort(key=lambda x: x["workorder_id"])

    if status_filter is not None:
        return {"requested_status": status_filter.value,
                "items": bucket[status_filter.value]}
    return {
        "summary": {
            "handled_count": len(bucket["handled"]),
            "pending_evidence_count": len(bucket["pending_evidence"]),
            "stuck_count": len(bucket["stuck"]),
            "total": len(all_wos),
        },
        **bucket,
    }
