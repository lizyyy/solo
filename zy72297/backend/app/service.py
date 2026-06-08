import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import (
    WaterDepthProfile,
    ProfileRecord,
    EvidenceEntry,
    NameConflict,
    EvidenceSource,
    RecordStatus,
    ConflictType,
    WorkflowStep,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)


def _profile_path(profile_id: str) -> Path:
    return DATA_DIR / f"{profile_id}.json"


def _load_profile(profile_id: str) -> WaterDepthProfile:
    p = _profile_path(profile_id)
    if not p.exists():
        raise FileNotFoundError(f"Profile {profile_id} not found")
    return WaterDepthProfile.model_validate_json(p.read_text(encoding="utf-8"))


def _save_profile(profile: WaterDepthProfile) -> None:
    p = _profile_path(profile.profile_id)
    p.write_text(
        json.dumps(profile.model_dump(mode="json"), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _now_iso() -> str:
    return datetime.now().isoformat()


def _add_audit(profile: WaterDepthProfile, action: str, detail: dict) -> None:
    profile.audit_log.append(
        {"timestamp": _now_iso(), "action": action, "detail": detail}
    )
    profile.updated_at = datetime.now()


def create_profile(project_name: str, coordinate_origin_description: str) -> WaterDepthProfile:
    profile = WaterDepthProfile(
        profile_id=str(uuid.uuid4())[:8],
        project_name=project_name,
        coordinate_origin_description=coordinate_origin_description,
    )
    _add_audit(profile, "create_profile", {"project_name": project_name})
    _save_profile(profile)
    return profile


def get_profile(profile_id: str) -> WaterDepthProfile:
    return _load_profile(profile_id)


def list_profiles() -> list[dict]:
    results = []
    for p in sorted(DATA_DIR.glob("*.json")):
        profile = WaterDepthProfile.model_validate_json(p.read_text(encoding="utf-8"))
        results.append(
            {
                "profile_id": profile.profile_id,
                "project_name": profile.project_name,
                "record_count": len(profile.records),
                "conflict_count": len(profile.conflicts),
                "updated_at": profile.updated_at.isoformat(),
            }
        )
    return results


def import_coordinate_origin(
    profile_id: str, lines: list[str], operator: str = "system"
) -> WaterDepthProfile:
    profile = _load_profile(profile_id)
    for i, line in enumerate(lines, start=1):
        parts = line.strip().split("|")
        if len(parts) < 6:
            continue
        obstacle_id, obstacle_name, depth_str, x_str, y_str, z_str = parts[:6]
        evidence = EvidenceEntry(
            source=EvidenceSource.COORDINATE_ORIGIN,
            original_line_number=i,
            original_content=line.strip(),
            operator=operator,
        )
        record = ProfileRecord(
            record_id=str(uuid.uuid4())[:8],
            obstacle_id=obstacle_id.strip(),
            obstacle_name=obstacle_name.strip(),
            water_depth_mm=float(depth_str.strip()),
            position_x=float(x_str.strip()),
            position_y=float(y_str.strip()),
            position_z=float(z_str.strip()),
            evidence_trail=[evidence],
            status=RecordStatus.IMPORTED,
        )
        profile.records.append(record)
    _detect_name_conflicts(profile)
    _add_audit(
        profile,
        "step1_import_origin",
        {"line_count": len(lines), "operator": operator},
    )
    _save_profile(profile)
    return profile


def attach_inspection_photo(
    profile_id: str,
    obstacle_id: str,
    photo_id: str,
    photo_description: str,
    operator: str = "system",
) -> WaterDepthProfile:
    profile = _load_profile(profile_id)
    for record in profile.records:
        if record.obstacle_id == obstacle_id:
            evidence = EvidenceEntry(
                source=EvidenceSource.INSPECTION_PHOTO,
                original_content=photo_description,
                photo_id=photo_id,
                operator=operator,
            )
            record.evidence_trail.append(evidence)
            if record.status == RecordStatus.IMPORTED:
                record.status = RecordStatus.PHOTO_REVIEWED
            record.updated_at = datetime.now()
    _detect_name_conflicts(profile)
    _add_audit(
        profile,
        "step2_review_photos",
        {"obstacle_id": obstacle_id, "photo_id": photo_id, "operator": operator},
    )
    _save_profile(profile)
    return profile


def update_annotation(
    profile_id: str,
    obstacle_id: str,
    new_depth: Optional[float] = None,
    new_position: Optional[dict] = None,
    operator: str = "system",
) -> WaterDepthProfile:
    profile = _load_profile(profile_id)
    for record in profile.records:
        if record.obstacle_id == obstacle_id:
            changes = {}
            if new_depth is not None:
                changes["water_depth_mm"] = {
                    "old": record.water_depth_mm,
                    "new": new_depth,
                }
                record.water_depth_mm = new_depth
            if new_position is not None:
                changes["position"] = {
                    "old": {
                        "x": record.position_x,
                        "y": record.position_y,
                        "z": record.position_z,
                    },
                    "new": new_position,
                }
                record.position_x = new_position.get("x", record.position_x)
                record.position_y = new_position.get("y", record.position_y)
                record.position_z = new_position.get("z", record.position_z)
            manual_entry = EvidenceEntry(
                source=EvidenceSource.MANUAL,
                original_content=f"annotation_update: {changes}",
                operator=operator,
            )
            record.manual_changes.append(manual_entry)
            record.evidence_trail.append(manual_entry)
            if record.status in (RecordStatus.PHOTO_REVIEWED, RecordStatus.IMPORTED):
                record.status = RecordStatus.ANNOTATION_UPDATED
            record.updated_at = datetime.now()
    _add_audit(
        profile,
        "step3_update_annotation",
        {"obstacle_id": obstacle_id, "operator": operator, "changes": str(changes)},
    )
    _save_profile(profile)
    return profile


def _detect_name_conflicts(profile: WaterDepthProfile) -> None:
    obstacle_name_map: dict[str, list[ProfileRecord]] = {}
    for record in profile.records:
        obstacle_name_map.setdefault(record.obstacle_id, []).append(record)

    existing_conflict_ids = {c.conflict_id for c in profile.conflicts}
    for obstacle_id, records in obstacle_name_map.items():
        names = list({r.obstacle_name for r in records})
        if len(names) <= 1:
            continue
        conflict_id = f"conflict_{obstacle_id}"
        if conflict_id in existing_conflict_ids:
            conflict = next(c for c in profile.conflicts if c.conflict_id == conflict_id)
            conflict.names = names
            conflict.evidence = []
            for r in records:
                for e in r.evidence_trail:
                    conflict.evidence.append(e)
            if conflict.status == RecordStatus.CONFIRMED:
                conflict.status = RecordStatus.PENDING_REVIEW
                conflict.resolution = None
                conflict.resolved_by = None
                conflict.resolved_at = None
        else:
            all_evidence = []
            for r in records:
                for e in r.evidence_trail:
                    all_evidence.append(e)
                r.conflict_ids.append(conflict_id)
            conflict = NameConflict(
                conflict_id=conflict_id,
                conflict_type=ConflictType.DUPLICATE_NAME,
                obstacle_id=obstacle_id,
                names=names,
                original_names=list(names),
                evidence=all_evidence,
                status=RecordStatus.PENDING_REVIEW,
            )
            profile.conflicts.append(conflict)

    for record in profile.records:
        if any(
            c.conflict_id in record.conflict_ids and c.status == RecordStatus.PENDING_REVIEW
            for c in profile.conflicts
        ):
            if record.status != RecordStatus.PENDING_REVIEW:
                record.status = RecordStatus.PENDING_REVIEW


def resolve_conflict(
    profile_id: str,
    conflict_id: str,
    chosen_name: str,
    operator: str,
    rollback: bool = False,
    reason: str = "",
    next_reviewer: str = "",
) -> WaterDepthProfile:
    profile = _load_profile(profile_id)
    conflict = next((c for c in profile.conflicts if c.conflict_id == conflict_id), None)
    if conflict is None:
        raise ValueError(f"Conflict {conflict_id} not found")

    if rollback:
        conflict.status = RecordStatus.ROLLED_BACK
        conflict.resolution = f"rolled_back by {operator}"
        conflict.reason = reason if reason else None
        conflict.resolved_by = operator
        conflict.resolved_at = datetime.now()
        for record in profile.records:
            if conflict.conflict_id in record.conflict_ids:
                record.status = RecordStatus.PENDING_REVIEW
        _add_audit(
            profile,
            "rollback_conflict",
            {"conflict_id": conflict_id, "operator": operator, "reason": reason},
        )
    else:
        if chosen_name not in conflict.names:
            raise ValueError(
                f"chosen_name '{chosen_name}' not in conflict names {conflict.names}"
            )
        conflict.status = RecordStatus.CONFIRMED
        conflict.resolution = f"chosen_name={chosen_name}"
        conflict.reason = reason if reason else None
        conflict.resolved_by = operator
        conflict.resolved_at = datetime.now()
        conflict.next_reviewer = next_reviewer if next_reviewer else None
        for record in profile.records:
            if conflict.conflict_id in record.conflict_ids:
                old_name = record.obstacle_name
                record.obstacle_name = chosen_name
                if old_name != chosen_name:
                    change_evidence = EvidenceEntry(
                        source=EvidenceSource.MANUAL,
                        original_content=f"name_changed: {old_name} -> {chosen_name}",
                        operator=operator,
                    )
                    record.evidence_trail.append(change_evidence)
                    record.manual_changes.append(change_evidence)
                record.status = RecordStatus.CONFIRMED
                record.updated_at = datetime.now()
        _add_audit(
            profile,
            "resolve_conflict",
            {
                "conflict_id": conflict_id,
                "chosen_name": chosen_name,
                "operator": operator,
                "reason": reason,
                "next_reviewer": next_reviewer,
                "original_names": conflict.original_names,
            },
        )

    _save_profile(profile)
    return profile


def export_detail(profile_id: str) -> dict:
    profile = _load_profile(profile_id)
    return profile.model_dump(mode="json")
