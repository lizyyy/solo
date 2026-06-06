import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from difflib import unified_diff

from ..models import (
    DJShow,
    ModificationRecord,
    EnergyCurve,
    EnergyPoint,
    Batch,
    Ticket,
)


class HistoryEngine:
    @staticmethod
    def record_modification(
        show: DJShow,
        entity_type: str,
        entity_id: str,
        field_name: str,
        old_value: Optional[Any],
        new_value: Optional[Any],
        modified_by: str,
        reason: Optional[str] = None,
    ) -> ModificationRecord:
        record = ModificationRecord(
            id=f"mod_{uuid.uuid4().hex[:8]}",
            show_id=show.id,
            entity_type=entity_type,
            entity_id=entity_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            modified_by=modified_by,
            reason=reason,
        )
        show.modification_history.append(record)
        return record

    @staticmethod
    def get_entity_history(
        show: DJShow,
        entity_type: str,
        entity_id: str,
    ) -> List[ModificationRecord]:
        return [
            r for r in show.modification_history
            if r.entity_type == entity_type and r.entity_id == entity_id
        ]

    @staticmethod
    def format_diff(
        old_value: Optional[str],
        new_value: Optional[str],
    ) -> str:
        old = str(old_value) if old_value is not None else ""
        new = str(new_value) if new_value is not None else ""

        if "\n" in old or "\n" in new:
            diff = unified_diff(
                old.splitlines(keepends=True),
                new.splitlines(keepends=True),
                fromfile="修改前",
                tofile="修改后",
            )
            return "".join(diff)
        else:
            return f'"{old}" → "{new}"'

    @staticmethod
    def show_entity_diff(
        show: DJShow,
        entity_type: str,
        entity_id: str,
    ) -> str:
        records = HistoryEngine.get_entity_history(show, entity_type, entity_id)
        if not records:
            return "未找到修改记录"

        output = []
        for r in records:
            time_str = r.modified_at.strftime("%Y-%m-%d %H:%M:%S")
            diff = HistoryEngine.format_diff(r.old_value, r.new_value)
            reason = f" (原因: {r.reason})" if r.reason else ""
            output.append(
                f"[{time_str}] {r.modified_by} 修改 {r.field_name}:\n{diff}{reason}"
            )
        return "\n\n".join(output)

    @staticmethod
    def compare_energy_curve_versions(
        curve_v1: EnergyCurve,
        curve_v2: EnergyCurve,
    ) -> List[Dict[str, Any]]:
        differences = []

        points1 = {p.track_name: p for p in curve_v1.points}
        points2 = {p.track_name: p for p in curve_v2.points}

        all_names = set(points1.keys()) | set(points2.keys())

        for name in sorted(all_names):
            p1 = points1.get(name)
            p2 = points2.get(name)

            if p1 is None:
                differences.append({
                    "track": name,
                    "change": "新增",
                    "field": "曲目",
                    "old": None,
                    "new": f"能量{p2.energy_level}, BPM{p2.bpm}",
                })
            elif p2 is None:
                differences.append({
                    "track": name,
                    "change": "删除",
                    "field": "曲目",
                    "old": f"能量{p1.energy_level}, BPM{p1.bpm}",
                    "new": None,
                })
            else:
                if p1.energy_level != p2.energy_level:
                    differences.append({
                        "track": name,
                        "change": "修改",
                        "field": "能量等级",
                        "old": p1.energy_level,
                        "new": p2.energy_level,
                    })
                if p1.bpm != p2.bpm:
                    differences.append({
                        "track": name,
                        "change": "修改",
                        "field": "BPM",
                        "old": p1.bpm,
                        "new": p2.bpm,
                    })
                if p1.note != p2.note:
                    differences.append({
                        "track": name,
                        "change": "修改",
                        "field": "备注",
                        "old": p1.note,
                        "new": p2.note,
                    })

        return differences

    @staticmethod
    def get_full_audit_log(
        show: DJShow,
        since: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        logs = []
        for r in show.modification_history:
            if since and r.modified_at < since:
                continue
            logs.append({
                "时间": r.modified_at.strftime("%Y-%m-%d %H:%M:%S"),
                "操作人": r.modified_by,
                "对象类型": r.entity_type,
                "对象ID": r.entity_id,
                "字段": r.field_name,
                "修改前": r.old_value,
                "修改后": r.new_value,
                "原因": r.reason or "",
            })
        return sorted(logs, key=lambda x: x["时间"])

    @staticmethod
    def update_batch_ticket_note(
        show: DJShow,
        batch_id: str,
        ticket_id: str,
        new_note: str,
        operator: str,
        reason: str = "",
    ) -> bool:
        for batch in show.batches:
            if batch.id == batch_id:
                for ticket in batch.tickets:
                    if ticket.id == ticket_id:
                        old_note = ticket.note
                        ticket.note = new_note
                        HistoryEngine.record_modification(
                            show=show,
                            entity_type="ticket",
                            entity_id=ticket_id,
                            field_name="note",
                            old_value=old_note,
                            new_value=new_note,
                            modified_by=operator,
                            reason=reason or "更新票备注",
                        )
                        return True
        return False

    @staticmethod
    def update_batch_note(
        show: DJShow,
        batch_id: str,
        field_name: str,
        new_value: Any,
        operator: str,
        reason: str = "",
    ) -> bool:
        for batch in show.batches:
            if batch.id == batch_id:
                old_value = getattr(batch, field_name, None)
                if old_value == new_value:
                    return False
                setattr(batch, field_name, new_value)
                HistoryEngine.record_modification(
                    show=show,
                    entity_type="batch",
                    entity_id=batch_id,
                    field_name=field_name,
                    old_value=old_value,
                    new_value=new_value,
                    modified_by=operator,
                    reason=reason or f"更新批次{field_name}",
                )
                return True
        return False
