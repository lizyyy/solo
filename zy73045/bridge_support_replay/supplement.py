"""补录证据与结论改判。

老唐关心的"补录后结论变化要看到旧材料/新备注/改判原因"在这里落地。
"""

from __future__ import annotations

from typing import Any, Optional

from .models import (
    WorkOrder,
    WorkOrderStatus,
    PhotoRecord,
    now_iso,
)
from .storage import save_workorder, load_workorder
from .timeline import record_supplement


def supplement_evidence(
    workorder_id: str,
    *,
    actor: str,
    note: str,
    evidence: Optional[dict[str, Any]] = None,
    new_photos: Optional[list[dict]] = None,
    new_spare_parts: Optional[list[dict]] = None,
    new_conclusion: Optional[str] = None,
    reversal_reason: Optional[str] = None,
    new_status: Optional[WorkOrderStatus] = None,
) -> WorkOrder:
    """补录证据。

    Parameters
    ----------
    workorder_id : 工单ID
    actor        : 操作人（例："老唐"、"值班脚本"）
    note         : 补录说明（必填，给接手同事看）
    evidence     : 任意证据字典（会写入历史快照）
    new_photos   : 新增照片列表，每项是 PhotoRecord.from_dict 能接受的 dict
    new_spare_parts: 新增备件列表，每项是 {"part_id":..., "raw_entry":..., ...}
    new_conclusion: 如果改结论，填这里
    reversal_reason: 为什么改判（结论变更时建议必填）
    new_status   : 变更状态（例：从 PENDING_EVIDENCE → HANDLED）
    """
    wo = load_workorder(workorder_id)
    if wo is None:
        raise FileNotFoundError(f"工单 {workorder_id} 不存在")

    evidence = dict(evidence or {})
    if new_photos:
        added = []
        for p in new_photos:
            pr = PhotoRecord.from_dict(p)
            wo.photos.append(pr)
            added.append(pr.photo_id)
        evidence["added_photo_ids"] = added

    if new_spare_parts:
        from .storage import add_cleaned_spare_part
        added_parts = []
        for sp in new_spare_parts:
            sp2 = add_cleaned_spare_part(
                wo,
                part_id=sp["part_id"],
                raw_entry=sp.get("raw_entry", {}),
                source=sp.get("source", "补录"),
                cleaned_name=sp.get("cleaned_name"),
                cleaned_spec=sp.get("cleaned_spec"),
                cleaned_quantity=sp.get("cleaned_quantity"),
                cleaned_unit=sp.get("cleaned_unit"),
                cleaning_note=sp.get("cleaning_note", "补录备件"),
                actor=actor,
            )
            added_parts.append(sp2.part_id)
        evidence["added_spare_part_ids"] = added_parts

    if not evidence.get("note"):
        evidence["note"] = note

    record_supplement(
        wo,
        actor=actor,
        note=note,
        evidence=evidence,
        new_conclusion=new_conclusion,
        reversal_reason=reversal_reason,
    )

    if new_status is not None:
        wo.status = new_status

    save_workorder(wo, updated_by=actor)
    return wo


def reverse_decision(
    workorder_id: str,
    *,
    actor: str,
    reversal_reason: str,
    new_conclusion: str,
    note: str = "",
    evidence: Optional[dict[str, Any]] = None,
) -> WorkOrder:
    """专门用于结论改判的便捷函数。"""
    return supplement_evidence(
        workorder_id,
        actor=actor,
        note=note or reversal_reason,
        evidence=evidence,
        new_conclusion=new_conclusion,
        reversal_reason=reversal_reason,
    )
