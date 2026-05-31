"""
校对引擎
========

比对作品清单和展墙图，检测差异、处理冲突
"""

from typing import Dict, List, Optional, Tuple, Set
from datetime import datetime

from .models import (
    Artwork,
    WallLayout,
    Difference,
    LightingConflict,
    ProofRecord,
    HistoryEntry,
    CatalogProofSession,
)
from .messages import (
    get_field_label,
    format_difference_message,
    format_lighting_conflict_message,
    format_resolution_suggestion,
    format_lighting_next_step,
    format_history_action,
)

COMPARABLE_FIELDS = [
    "title_cn",
    "title_en",
    "artist",
    "artist_en",
    "year",
    "medium",
    "dimensions",
    "estimate",
    "provenance",
    "literature",
    "exhibition",
    "description",
    "notes",
]

LIGHTING_FIELDS = ["lighting_scheme"]

CRITICAL_FIELDS = [
    "title_cn",
    "artist",
    "dimensions",
    "medium",
    "estimate",
]


def _normalize_value(value: Optional[str]) -> str:
    if value is None:
        return ""
    return str(value).strip().replace(" ", "").replace("\u3000", "").replace("\n", "")


def _values_differ(v1: Optional[str], v2: Optional[str]) -> bool:
    n1 = _normalize_value(v1)
    n2 = _normalize_value(v2)
    return n1 != n2


def _get_severity(field_name: str) -> str:
    if field_name in CRITICAL_FIELDS:
        return "critical"
    return "warning"


def find_lot_numbers(
    artworks: Dict[str, Artwork],
    wall_layouts: Dict[str, WallLayout],
) -> Set[str]:
    lots = set(artworks.keys())
    for layout in wall_layouts.values():
        lots.add(layout.lot_number)
    return lots


def run_proof(
    session: CatalogProofSession,
    operator: str = "user",
) -> Tuple[Dict[str, Difference], Dict[str, LightingConflict]]:
    differences: Dict[str, Difference] = {}
    lighting_conflicts: Dict[str, LightingConflict] = {}

    all_lots = find_lot_numbers(session.artworks, session.wall_layouts)

    for lot in all_lots:
        artwork = session.artworks.get(lot)
        wall_layout = None
        for wl in session.wall_layouts.values():
            if wl.lot_number == lot:
                wall_layout = wl
                break

        if artwork is None:
            diff = Difference(
                lot_number=lot,
                field_name="lot_number",
                field_label=get_field_label("lot_number"),
                works_list_value=None,
                wall_layout_value=wall_layout.lot_number if wall_layout else lot,
                status="pending",
                severity="critical",
                message=f"拍品 {lot} 在展墙图里有，但作品清单里找不到。请确认是不是编号写错了，或者作品清单漏了。",
            )
            key = f"{lot}_missing_artwork"
            differences[key] = diff
            continue

        if wall_layout is None:
            diff = Difference(
                lot_number=lot,
                field_name="lot_number",
                field_label=get_field_label("lot_number"),
                works_list_value=artwork.lot_number,
                wall_layout_value=None,
                status="pending",
                severity="warning",
                message=f"拍品 {lot}（{artwork.title_cn}）在作品清单里有，但展墙图里没安排位置。请确认是不是展品调整了，或者展墙图漏了。",
            )
            key = f"{lot}_missing_layout"
            differences[key] = diff
            continue

        for field_name in COMPARABLE_FIELDS:
            art_value = getattr(artwork, field_name, None)
            wall_value = None

            if field_name == "lighting_scheme":
                wall_value = getattr(wall_layout, field_name, None)
            else:
                wall_value = None

            if field_name == "lighting_scheme":
                continue

            if _values_differ(art_value, wall_value):
                severity = _get_severity(field_name)
                message = format_difference_message(
                    field_name, art_value, wall_value
                )
                suggestion = format_resolution_suggestion(
                    field_name, art_value, wall_value
                )

                diff = Difference(
                    lot_number=lot,
                    field_name=field_name,
                    field_label=get_field_label(field_name),
                    works_list_value=art_value,
                    wall_layout_value=wall_value,
                    status="pending",
                    severity=severity,
                    message=message + "\n" + suggestion,
                )
                key = f"{lot}_{field_name}"
                differences[key] = diff

        art_lighting = getattr(artwork, "lighting_scheme", None)
        wall_lighting = getattr(wall_layout, "lighting_scheme", None)

        if art_lighting or wall_lighting:
            if _values_differ(art_lighting, wall_lighting):
                conflict = LightingConflict(
                    lot_number=lot,
                    works_list_lighting=art_lighting,
                    wall_layout_lighting=wall_lighting,
                    status="pending",
                    message=format_lighting_conflict_message(
                        lot, art_lighting, wall_lighting
                    ),
                    next_contact=format_lighting_next_step(
                        bool(art_lighting), bool(wall_lighting)
                    ),
                )
                lighting_conflicts[lot] = conflict

        if lot not in session.proof_records:
            session.proof_records[lot] = ProofRecord(
                lot_number=lot,
                status="pending" if lot in [d.lot_number for d in differences.values()] else "confirmed",
            )

    session.differences = differences
    session.lighting_conflicts = lighting_conflicts

    session.history.append(
        HistoryEntry(
            lot_number="ALL",
            action="proof_run",
            notes=f"执行校对，发现 {len(differences)} 处差异，{len(lighting_conflicts)} 个灯光冲突",
            operator=operator,
        )
    )

    return differences, lighting_conflicts


def confirm_record(
    session: CatalogProofSession,
    lot_number: str,
    operator: str = "user",
    notes: Optional[str] = None,
) -> Optional[ProofRecord]:
    if lot_number not in session.proof_records:
        session.proof_records[lot_number] = ProofRecord(
            lot_number=lot_number,
            status="confirmed",
        )

    record = session.proof_records[lot_number]
    record.status = "confirmed"

    session.history.append(
        HistoryEntry(
            lot_number=lot_number,
            action="confirm",
            notes=notes or "人工确认无误",
            operator=operator,
        )
    )

    for key, diff in list(session.differences.items()):
        if diff.lot_number == lot_number:
            diff.status = "resolved"
            diff.resolution = "确认无误，两边一致"
            diff.resolved_by = operator
            diff.resolved_at = datetime.now().isoformat()

    for key, conflict in list(session.lighting_conflicts.items()):
        if conflict.lot_number == lot_number:
            conflict.status = "resolved"
            conflict.resolution = "确认灯光方案无误"
            conflict.resolved_by = operator
            conflict.resolved_at = datetime.now().isoformat()

    return record


def resolve_difference(
    session: CatalogProofSession,
    difference_key: str,
    use_works_list: bool = True,
    custom_value: Optional[str] = None,
    operator: str = "user",
    notes: Optional[str] = None,
) -> Optional[Difference]:
    if difference_key not in session.differences:
        return None

    diff = session.differences[difference_key]

    if custom_value is not None:
        final_value = custom_value
        resolution_text = f"人工输入：{custom_value}"
    elif use_works_list:
        final_value = diff.works_list_value
        resolution_text = "采用作品清单的值"
    else:
        final_value = diff.wall_layout_value
        resolution_text = "采用展墙图的值"

    diff.final_value = final_value
    diff.status = "resolved"
    diff.resolution = resolution_text
    diff.resolved_by = operator
    diff.resolved_at = datetime.now().isoformat()

    if diff.lot_number in session.artworks:
        artwork = session.artworks[diff.lot_number]
        if hasattr(artwork, diff.field_name):
            old_value = getattr(artwork, diff.field_name)
            setattr(artwork, diff.field_name, final_value)

            session.history.append(
                HistoryEntry(
                    lot_number=diff.lot_number,
                    action="resolve",
                    field_name=diff.field_name,
                    old_value=old_value,
                    new_value=final_value,
                    notes=notes or resolution_text,
                    operator=operator,
                )
            )

    if diff.lot_number in session.proof_records:
        record = session.proof_records[diff.lot_number]
        record.manual_edited = True
        if diff.field_name not in record.edited_fields:
            record.edited_fields.append(diff.field_name)
        record.edit_notes = notes
        record.edited_by = operator
        record.edited_at = datetime.now().isoformat()

    _update_proof_record_status(session, diff.lot_number)

    return diff


def resolve_lighting_conflict(
    session: CatalogProofSession,
    lot_number: str,
    use_works_list: bool = True,
    custom_value: Optional[str] = None,
    operator: str = "user",
    notes: Optional[str] = None,
) -> Optional[LightingConflict]:
    if lot_number not in session.lighting_conflicts:
        return None

    conflict = session.lighting_conflicts[lot_number]

    if custom_value is not None:
        final_value = custom_value
        resolution_text = f"人工输入灯光方案：{custom_value}"
    elif use_works_list:
        final_value = conflict.works_list_lighting
        resolution_text = "采用作品清单的灯光方案"
    else:
        final_value = conflict.wall_layout_lighting
        resolution_text = "采用展墙图的灯光方案"

    conflict.current_value = final_value
    conflict.status = "resolved"
    conflict.resolution = resolution_text
    conflict.resolved_by = operator
    conflict.resolved_at = datetime.now().isoformat()

    for key, layout in session.wall_layouts.items():
        if layout.lot_number == lot_number:
            old_value = layout.lighting_scheme
            layout.lighting_scheme = final_value
            layout.lighting_source = (
                "works_list" if use_works_list and custom_value is None else
                "wall_layout" if not use_works_list and custom_value is None else
                "manual"
            )

            session.history.append(
                HistoryEntry(
                    lot_number=lot_number,
                    action="lighting_resolve",
                    field_name="lighting_scheme",
                    old_value=old_value,
                    new_value=final_value,
                    notes=notes or resolution_text,
                    operator=operator,
                )
            )

    if lot_number in session.proof_records:
        record = session.proof_records[lot_number]
        record.manual_edited = True
        if "lighting_scheme" not in record.edited_fields:
            record.edited_fields.append("lighting_scheme")
        record.edit_notes = notes
        record.edited_by = operator
        record.edited_at = datetime.now().isoformat()

    _update_proof_record_status(session, lot_number)

    return conflict


def mark_needs_info(
    session: CatalogProofSession,
    lot_number: str,
    notes: str,
    operator: str = "user",
) -> Optional[ProofRecord]:
    if lot_number not in session.proof_records:
        session.proof_records[lot_number] = ProofRecord(
            lot_number=lot_number,
            status="needs_info",
        )

    record = session.proof_records[lot_number]
    record.status = "needs_info"

    session.history.append(
        HistoryEntry(
            lot_number=lot_number,
            action="status_change",
            notes=f"标记为待补充：{notes}",
            operator=operator,
        )
    )

    return record


def _update_proof_record_status(session: CatalogProofSession, lot_number: str) -> None:
    pending_diffs = [
        d for d in session.differences.values()
        if d.lot_number == lot_number and d.status == "pending"
    ]
    pending_conflicts = [
        c for c in session.lighting_conflicts.values()
        if c.lot_number == lot_number and c.status == "pending"
    ]

    if lot_number not in session.proof_records:
        return

    record = session.proof_records[lot_number]

    if record.status == "needs_info":
        return

    if pending_diffs or pending_conflicts:
        if record.manual_edited:
            record.status = "manual_edited"
        else:
            record.status = "pending"
    else:
        if record.manual_edited:
            record.status = "manual_edited"
        else:
            record.status = "confirmed"


def get_statistics(session: CatalogProofSession) -> Dict[str, int]:
    stats = {
        "total_lots": len(find_lot_numbers(session.artworks, session.wall_layouts)),
        "confirmed": 0,
        "pending": 0,
        "needs_info": 0,
        "manual_edited": 0,
        "total_differences": len(session.differences),
        "resolved_differences": 0,
        "pending_differences": 0,
        "critical_differences": 0,
        "lighting_conflicts": len(session.lighting_conflicts),
        "resolved_lighting_conflicts": 0,
        "pending_lighting_conflicts": 0,
    }

    for record in session.proof_records.values():
        stats[record.status] = stats.get(record.status, 0) + 1

    for diff in session.differences.values():
        if diff.status == "resolved":
            stats["resolved_differences"] += 1
        else:
            stats["pending_differences"] += 1
        if diff.severity == "critical":
            stats["critical_differences"] += 1

    for conflict in session.lighting_conflicts.values():
        if conflict.status == "resolved":
            stats["resolved_lighting_conflicts"] += 1
        else:
            stats["pending_lighting_conflicts"] += 1

    return stats


def get_lot_history(session: CatalogProofSession, lot_number: str) -> List[HistoryEntry]:
    entries = [
        h for h in session.history
        if h.lot_number == lot_number or h.lot_number == "ALL"
    ]
    entries.sort(key=lambda x: x.timestamp, reverse=True)
    return entries


def format_history_for_display(entries: List[HistoryEntry]) -> List[Dict[str, str]]:
    result = []
    for entry in entries:
        action_text = format_history_action(
            entry.action,
            entry.field_name,
            entry.old_value,
            entry.new_value,
        )
        result.append({
            "timestamp": entry.timestamp,
            "operator": entry.operator or "",
            "action": action_text,
            "notes": entry.notes or "",
            "version": entry.version,
        })
    return result
