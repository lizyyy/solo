"""存储层 — 保证原始数据绝不被覆盖。

约定：
- data_dir 下每个工单一个 JSON：``{workorder_id}.json``
- 保存时只追加 ``cleaning_log`` 和 ``timeline``，
  原始 ``raw_snapshot`` / ``raw_entry`` 永远不变
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Iterable, Optional

from .models import (
    WorkOrder,
    SparePart,
    now_iso,
)

DATA_DIR = Path(os.environ.get(
    "BSR_DATA_DIR",
    Path(__file__).resolve().parent.parent / "data",
))


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _path_for(workorder_id: str) -> Path:
    return DATA_DIR / f"{workorder_id}.json"


def load_workorder(workorder_id: str) -> Optional[WorkOrder]:
    """读工单，找不到返回 None。"""
    _ensure_data_dir()
    p = _path_for(workorder_id)
    if not p.exists():
        return None
    with open(p, "r", encoding="utf-8") as f:
        return WorkOrder.from_dict(json.load(f))


def save_workorder(wo: WorkOrder, *, updated_by: str = "system") -> None:
    """保存工单。写入前先更新 updated_at，绝不清理 raw_snapshot/raw_entry。"""
    _ensure_data_dir()
    wo.updated_at = now_iso()

    # 保护：任何情况下 raw_snapshot 都不能被置空
    # 如果之前有保存过的老版本，且新对象里 raw_snapshot 丢了，从旧文件恢复
    p = _path_for(wo.workorder_id)
    if p.exists():
        with open(p, "r", encoding="utf-8") as f:
            old = json.load(f)
        if old.get("raw_snapshot") and not wo.raw_snapshot:
            wo.raw_snapshot = dict(old["raw_snapshot"])
            wo.raw_snapshot_source = old.get("raw_snapshot_source")
            wo.cleaning_log = list(old.get("cleaning_log", [])) + wo.cleaning_log

    with open(p, "w", encoding="utf-8") as f:
        json.dump(wo.to_dict(), f, ensure_ascii=False, indent=2)


def load_all_workorders() -> list[WorkOrder]:
    _ensure_data_dir()
    result: list[WorkOrder] = []
    for p in sorted(DATA_DIR.glob("*.json")):
        try:
            with open(p, "r", encoding="utf-8") as f:
                result.append(WorkOrder.from_dict(json.load(f)))
        except Exception:
            # 坏文件跳过，但保留它 — 不让存储层吞掉原始数据
            continue
    return result


def create_workorder_from_raw(
    workorder_id: str,
    title: str,
    bridge_name: str,
    support_position: str,
    raw_snapshot: dict,
    raw_source: str,
    *,
    created_by: str = "import",
) -> WorkOrder:
    """从原始快照创建工单 — raw_snapshot 永远保留原样。

    后续如果要做字段清洗，通过 ``add_cleaned_spare_part`` 等方法，
    在 cleaning_log 里记下"清洗了什么、依据是什么"。
    """
    from .timeline import _new_event_id

    wo = WorkOrder(
        workorder_id=workorder_id,
        title=title,
        bridge_name=bridge_name,
        support_position=support_position,
        created_at=now_iso(),
        created_by=created_by,
        raw_snapshot=dict(raw_snapshot),
        raw_snapshot_source=raw_source,
    )

    from .models import TimelineEvent, TimelineEventType
    wo.timeline.append(TimelineEvent(
        event_id=_new_event_id(),
        event_type=TimelineEventType.CREATED,
        timestamp=now_iso(),
        actor=created_by,
        summary=f"从 {raw_source} 导入原始工单快照",
        after_snapshot={"raw_snapshot_keys": list(raw_snapshot.keys())},
    ))
    return wo


def add_cleaned_spare_part(
    wo: WorkOrder,
    part_id: str,
    *,
    raw_entry: dict,
    source: str,
    cleaned_name: Optional[str] = None,
    cleaned_spec: Optional[str] = None,
    cleaned_quantity: Optional[float] = None,
    cleaned_unit: Optional[str] = None,
    cleaning_note: str = "",
    actor: str = "cleaner",
) -> SparePart:
    """向工单追加一条备件。

    - ``raw_entry`` 是拿到手的那一行原样（dict），永远不改
    - ``cleaned_*`` 是清洗后的业务字段
    - ``cleaning_note`` 说明"为什么这么清洗"，写进 cleaning_log
    - 如果 part_id 已存在，会 bump version
    """
    from .timeline import _new_event_id

    existing_versions = [
        sp.version for sp in wo.spare_parts if sp.part_id == part_id
    ]
    version = max(existing_versions) + 1 if existing_versions else 1

    sp = SparePart(
        part_id=part_id,
        name=cleaned_name or raw_entry.get("name"),
        spec=cleaned_spec or raw_entry.get("spec"),
        quantity=cleaned_quantity if cleaned_quantity is not None else raw_entry.get("quantity"),
        unit=cleaned_unit or raw_entry.get("unit"),
        raw_entry=dict(raw_entry),
        cleaned_note=cleaning_note or None,
        source=source,
        version=version,
        recorded_at=now_iso(),
    )
    wo.spare_parts.append(sp)

    wo.cleaning_log.append({
        "timestamp": now_iso(),
        "actor": actor,
        "part_id": part_id,
        "version": version,
        "note": cleaning_note or "未填写清洗说明",
        "fields_changed": {
            k: (raw_entry.get(k), v)
            for k, v in {
                "name": cleaned_name,
                "spec": cleaned_spec,
                "quantity": cleaned_quantity,
                "unit": cleaned_unit,
            }.items() if v is not None and raw_entry.get(k) != v
        },
    })

    from .models import TimelineEvent, TimelineEventType
    wo.timeline.append(TimelineEvent(
        event_id=_new_event_id(),
        event_type=TimelineEventType.SPARE_PART_RECORDED,
        timestamp=now_iso(),
        actor=actor,
        summary=f"记录备件 {part_id} (v{version}): {cleaning_note or '原始录入'}",
        before_snapshot={
            "part_id": part_id,
            "previous_count": len(existing_versions),
        },
        after_snapshot={"spare_part": sp.to_dict()},
    ))
    return sp


def export_raw_backup(workorder_id: str, out_dir: Path) -> Path:
    """把原始快照另存为独立 JSON — 提供给需要"拿原始来源去解释"的同事。"""
    wo = load_workorder(workorder_id)
    if wo is None:
        raise FileNotFoundError(workorder_id)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{workorder_id}.raw.json"
    payload = {
        "workorder_id": wo.workorder_id,
        "raw_snapshot_source": wo.raw_snapshot_source,
        "raw_snapshot": wo.raw_snapshot,
        "cleaning_log": wo.cleaning_log,
        "spare_parts_raw_entries": [
            {"part_id": sp.part_id, "version": sp.version, "source": sp.source,
             "raw_entry": sp.raw_entry, "cleaned_note": sp.cleaned_note}
            for sp in wo.spare_parts
        ],
        "exported_at": now_iso(),
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return out_path
