from datetime import datetime
from typing import List, Dict, Optional, Tuple
import uuid
import copy
from models import (
    ObstacleRecord,
    RecordStatus,
    ConflictEvidence,
    HistoryEntry,
    Coordinate3D,
    ReviewTrail,
)


class DuplicateNameDetector:
    def __init__(self, records: List[ObstacleRecord]):
        self.records = records
        self.history: List[HistoryEntry] = []
        self.pending_reviews: List[ObstacleRecord] = []
        self.review_trails: List[ReviewTrail] = []

    def detect_duplicate_names(self, actor: str = "system") -> Dict:
        position_groups: Dict[str, List[ObstacleRecord]] = {}

        for record in self.records:
            pos_key = self._position_key(record.position)
            if pos_key not in position_groups:
                position_groups[pos_key] = []
            position_groups[pos_key].append(record)

        for pos_key, group in position_groups.items():
            if len(group) > 1:
                names = [r.obstacle_name for r in group]
                if len(set(names)) > 1:
                    self._mark_duplicate_group(group, pos_key, actor)

        for record in self.records:
            if record.status == RecordStatus.DUPLICATE_NAME:
                self.pending_reviews.append(record)

        return {
            "records": self.records,
            "pending_reviews": self.pending_reviews,
            "review_trails": self.review_trails.copy(),
            "history": self.history.copy(),
        }

    def _position_key(self, pos: Coordinate3D, tolerance: float = 0.5) -> str:
        return f"{round(pos.x / tolerance)}_{round(pos.y / tolerance)}_{round(pos.z / tolerance)}"

    def _record_snapshot(self, record: ObstacleRecord) -> Dict:
        return {
            "record_id": record.record_id,
            "obstacle_name": record.obstacle_name,
            "status": record.status.value,
            "position": {"x": record.position.x, "y": record.position.y, "z": record.position.z},
            "obstacle_type": record.obstacle_type.value,
            "caliber_source": record.caliber_source,
            "photo_number": record.photo_number,
            "origin_id": record.origin_id,
            "duplicate_of": record.duplicate_of,
            "reviewed_by": record.reviewed_by,
            "conflict_evidence": record.conflict_evidence,
        }

    def _make_review_trail(
        self,
        record: ObstacleRecord,
        original: Dict,
        modified: Dict,
        changed_fields: List[str],
        reason: str,
        next_handler: str,
        handled_by: str,
    ) -> ReviewTrail:
        trail = ReviewTrail(
            trail_id=f"trail_{uuid.uuid4().hex[:8]}",
            record_id=record.record_id,
            original_value=copy.deepcopy(original),
            modified_value=copy.deepcopy(modified),
            changed_fields=changed_fields,
            reason=reason,
            next_handler=next_handler,
            handled_by=handled_by,
            handled_at=datetime.now(),
        )
        self.review_trails.append(trail)
        return trail

    def _mark_duplicate_group(
        self,
        group: List[ObstacleRecord],
        pos_key: str,
        actor: str,
    ):
        primary = group[0]
        for record in group[1:]:
            original = self._record_snapshot(record)
            record.status = RecordStatus.DUPLICATE_NAME
            record.duplicate_of = primary.record_id
            record.updated_at = datetime.now()
            modified = self._record_snapshot(record)

            self._make_review_trail(
                record=record,
                original=original,
                modified=modified,
                changed_fields=["status", "duplicate_of"],
                reason=f"同一位置({pos_key})被标注两个名称: {primary.obstacle_name} vs {record.obstacle_name}，原始说法保留双方",
                next_handler="培训学员",
                handled_by=actor,
            )

            self._add_history(
                action="MARK_DUPLICATE_NAME",
                actor=actor,
                details={
                    "record_id": record.record_id,
                    "obstacle_name": record.obstacle_name,
                    "duplicate_of": primary.record_id,
                    "primary_name": primary.obstacle_name,
                    "position_key": pos_key,
                    "all_names": [r.obstacle_name for r in group],
                    "original_value": original,
                    "modified_value": modified,
                    "next_handler": "培训学员",
                    "review_trail_id": self.review_trails[-1].trail_id,
                },
                record_id=record.record_id,
            )

    def resolve_duplicate(
        self,
        record_id: str,
        action: str,
        actor: str,
        canonical_name: Optional[str] = None,
    ) -> Optional[ObstacleRecord]:
        record = next((r for r in self.records if r.record_id == record_id), None)
        if not record or record.status != RecordStatus.DUPLICATE_NAME:
            return None

        original = self._record_snapshot(record)

        if action == "confirm_duplicate":
            record.status = RecordStatus.REJECTED
            record.reviewed_by = actor
            record.reviewed_at = datetime.now()
            modified = self._record_snapshot(record)

            self._make_review_trail(
                record=record,
                original=original,
                modified=modified,
                changed_fields=["status", "reviewed_by", "reviewed_at"],
                reason=f"园区运维/培训学员确认为重复，与{record.duplicate_of}为同一障碍物",
                next_handler="(流程结束: 已驳回)",
                handled_by=actor,
            )

            self._add_history(
                action="RESOLVE_DUPLICATE_REJECT",
                actor=actor,
                details={
                    "record_id": record_id,
                    "obstacle_name": record.obstacle_name,
                    "duplicate_of": record.duplicate_of,
                    "original_value": original,
                    "modified_value": modified,
                    "review_trail_id": self.review_trails[-1].trail_id,
                },
                record_id=record_id,
            )
        elif action == "keep_as_separate":
            record.status = RecordStatus.PENDING_REVIEW
            record.reviewed_by = actor
            record.reviewed_at = datetime.now()
            modified = self._record_snapshot(record)

            self._make_review_trail(
                record=record,
                original=original,
                modified=modified,
                changed_fields=["status", "reviewed_by", "reviewed_at"],
                reason="不急着归正常，交给培训学员深入复核，原始两个名称均保留在modified前/后对比中",
                next_handler="培训学员(二次复核)",
                handled_by=actor,
            )

            self._add_history(
                action="RESOLVE_DUPLICATE_PENDING",
                actor=actor,
                details={
                    "record_id": record_id,
                    "obstacle_name": record.obstacle_name,
                    "note": "留给培训学员复核",
                    "original_value": original,
                    "modified_value": modified,
                    "next_handler": "培训学员(二次复核)",
                    "review_trail_id": self.review_trails[-1].trail_id,
                },
                record_id=record_id,
            )
        elif action == "rename":
            if canonical_name:
                old_name = record.obstacle_name
                record.obstacle_name = canonical_name
                record.status = RecordStatus.NORMAL
                record.duplicate_of = None
                record.reviewed_by = actor
                record.reviewed_at = datetime.now()
                modified = self._record_snapshot(record)

                self._make_review_trail(
                    record=record,
                    original=original,
                    modified=modified,
                    changed_fields=["obstacle_name", "status", "duplicate_of", "reviewed_by", "reviewed_at"],
                    reason=f"原名称 '{old_name}' 已按规范改为 '{canonical_name}'，原说法留痕在original_value",
                    next_handler="(流程结束: 已归为正常)",
                    handled_by=actor,
                )

                self._add_history(
                    action="RESOLVE_DUPLICATE_RENAME",
                    actor=actor,
                    details={
                        "record_id": record_id,
                        "old_name": old_name,
                        "new_name": canonical_name,
                        "original_value": original,
                        "modified_value": modified,
                        "review_trail_id": self.review_trails[-1].trail_id,
                    },
                    record_id=record_id,
                )

        record.updated_at = datetime.now()
        return record

    def _add_history(
        self,
        action: str,
        actor: str,
        details: Dict,
        record_id: Optional[str] = None,
    ):
        entry = HistoryEntry(
            entry_id=f"hist_{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(),
            action=action,
            actor=actor,
            details=details,
            record_id=record_id,
        )
        self.history.append(entry)


class ConflictResolver:
    def __init__(self, records: List[ObstacleRecord]):
        self.records = records
        self.history: List[HistoryEntry] = []
        self.conflicts: List[ConflictEvidence] = []
        self.review_trails: List[ReviewTrail] = []

    def _record_snapshot(self, record: ObstacleRecord) -> Dict:
        return {
            "record_id": record.record_id,
            "obstacle_name": record.obstacle_name,
            "status": record.status.value,
            "position": {"x": record.position.x, "y": record.position.y, "z": record.position.z},
            "obstacle_type": record.obstacle_type.value,
            "caliber_source": record.caliber_source,
            "photo_number": record.photo_number,
            "origin_id": record.origin_id,
            "duplicate_of": record.duplicate_of,
            "reviewed_by": record.reviewed_by,
            "conflict_evidence": record.conflict_evidence,
        }

    def _make_review_trail(
        self,
        record: ObstacleRecord,
        original: Dict,
        modified: Dict,
        changed_fields: List[str],
        reason: str,
        next_handler: str,
        handled_by: str,
    ) -> ReviewTrail:
        trail = ReviewTrail(
            trail_id=f"trail_{uuid.uuid4().hex[:8]}",
            record_id=record.record_id,
            original_value=copy.deepcopy(original),
            modified_value=copy.deepcopy(modified),
            changed_fields=changed_fields,
            reason=reason,
            next_handler=next_handler,
            handled_by=handled_by,
            handled_at=datetime.now(),
        )
        self.review_trails.append(trail)
        return trail

    def detect_conflicts(
        self,
        origin_data_map: Dict[str, Dict],
        photo_data_map: Dict[str, Dict],
        actor: str = "system",
    ) -> Dict:
        for record in self.records:
            if record.origin_id and record.photo_number:
                origin_data = origin_data_map.get(record.record_id)
                photo_data = photo_data_map.get(record.photo_number)

                if origin_data and photo_data:
                    conflicting_fields = self._find_conflicts(
                        origin_data, photo_data
                    )

                    if conflicting_fields:
                        conflict = ConflictEvidence(
                            conflict_id=f"conflict_{uuid.uuid4().hex[:8]}",
                            record_id=record.record_id,
                            origin_data=origin_data,
                            photo_data=photo_data,
                            conflicting_fields=conflicting_fields,
                            detected_at=datetime.now(),
                        )
                        self.conflicts.append(conflict)

                        original = self._record_snapshot(record)
                        record.status = RecordStatus.CONFLICT
                        record.conflict_evidence = {
                            "conflict_id": conflict.conflict_id,
                            "conflicting_fields": conflicting_fields,
                            "origin_evidence": origin_data,
                            "photo_evidence": photo_data,
                        }
                        record.updated_at = datetime.now()
                        modified = self._record_snapshot(record)

                        self._make_review_trail(
                            record=record,
                            original=original,
                            modified=modified,
                            changed_fields=["status", "conflict_evidence"],
                            reason=(
                                f"坐标原点说明(origin)与巡检照片编号(photo)在{conflicting_fields}上存在矛盾，"
                                f"列出冲突证据，不自动拍板，交给园区运维小陶选确认或驳回。"
                                f"原始说法：origin={origin_data}, photo={photo_data}"
                            ),
                            next_handler="园区运维小陶",
                            handled_by=actor,
                        )

                        self._add_history(
                            action="DETECT_CONFLICT",
                            actor=actor,
                            details={
                                "record_id": record.record_id,
                                "obstacle_name": record.obstacle_name,
                                "conflict_id": conflict.conflict_id,
                                "conflicting_fields": conflicting_fields,
                                "origin_data": origin_data,
                                "photo_data": photo_data,
                                "original_value": original,
                                "modified_value": modified,
                                "next_handler": "园区运维小陶",
                                "review_trail_id": self.review_trails[-1].trail_id,
                            },
                            record_id=record.record_id,
                        )

        return {
            "records": self.records,
            "conflicts": self.conflicts,
            "review_trails": self.review_trails.copy(),
            "history": self.history.copy(),
        }

    def _find_conflicts(
        self, origin_data: Dict, photo_data: Dict
    ) -> List[str]:
        conflicting_fields = []

        for field in ["position", "obstacle_type", "obstacle_name"]:
            origin_val = origin_data.get(field)
            photo_val = photo_data.get(field)

            if origin_val and photo_val:
                if field == "position":
                    if not self._positions_match(
                        Coordinate3D(**origin_val),
                        Coordinate3D(**photo_val),
                    ):
                        conflicting_fields.append(field)
                else:
                    if origin_val != photo_val:
                        conflicting_fields.append(field)

        return conflicting_fields

    def _positions_match(self, pos1: Coordinate3D, pos2: Coordinate3D, tolerance: float = 0.5) -> bool:
        return (
            abs(pos1.x - pos2.x) <= tolerance
            and abs(pos1.y - pos2.y) <= tolerance
            and abs(pos1.z - pos2.z) <= tolerance
        )

    def list_conflicts_for_review(self) -> List[Dict]:
        review_list = []
        for conflict in self.conflicts:
            record = next(
                (r for r in self.records if r.record_id == conflict.record_id),
                None,
            )
            if record and record.status == RecordStatus.CONFLICT:
                origin_ev = conflict.origin_data
                photo_ev = conflict.photo_data
                comparison = []
                for field in conflict.conflicting_fields:
                    comparison.append({
                        "field": field,
                        "origin_value": origin_ev.get(field),
                        "photo_value": photo_ev.get(field),
                    })
                review_list.append(
                    {
                        "conflict_id": conflict.conflict_id,
                        "record_id": record.record_id,
                        "obstacle_name": record.obstacle_name,
                        "conflicting_fields": conflict.conflicting_fields,
                        "origin_evidence": origin_ev,
                        "photo_evidence": photo_ev,
                        "field_by_field_comparison": comparison,
                        "message": (
                            f"坐标原点说明与巡检照片编号在{', '.join(conflict.conflicting_fields)}上存在矛盾，"
                            f"请园区运维小陶选确认或驳回，以上为逐条冲突证据列表"
                        ),
                        "review_options": [
                            {"resolution": "confirm_origin", "label": "确认坐标原点说明的口径"},
                            {"resolution": "confirm_photo", "label": "确认巡检照片编号的口径"},
                            {"resolution": "reject_both", "label": "双方均不可信，驳回"},
                        ],
                    }
                )
        return review_list

    def resolve_conflict(
        self,
        conflict_id: str,
        resolution: str,
        actor: str,
    ) -> Optional[ObstacleRecord]:
        conflict = next(
            (c for c in self.conflicts if c.conflict_id == conflict_id), None
        )
        if not conflict:
            return None

        record = next(
            (r for r in self.records if r.record_id == conflict.record_id),
            None,
        )
        if not record:
            return None

        original = self._record_snapshot(record)

        if resolution == "confirm_origin":
            record.status = RecordStatus.CONFIRMED
            record.caliber_source = "coordinate_origin_spec"
            modified = self._record_snapshot(record)

            self._make_review_trail(
                record=record,
                original=original,
                modified=modified,
                changed_fields=["status", "caliber_source", "reviewed_by", "reviewed_at"],
                reason=(
                    f"园区运维小陶确认坐标原点说明的数据。"
                    f"冲突字段 {conflict.conflicting_fields}，origin={conflict.origin_data}，"
                    f"photo={conflict.photo_data}。最终采信：坐标原点说明(coordinate_origin_spec)"
                ),
                next_handler="(流程结束: 已确认，进入清洗路径)",
                handled_by=actor,
            )

            self._add_history(
                action="RESOLVE_CONFLICT_CONFIRM_ORIGIN",
                actor=actor,
                details={
                    "conflict_id": conflict_id,
                    "record_id": record.record_id,
                    "obstacle_name": record.obstacle_name,
                    "chosen_source": "coordinate_origin_spec",
                    "conflicting_fields": conflict.conflicting_fields,
                    "origin_data": conflict.origin_data,
                    "photo_data": conflict.photo_data,
                    "original_value": original,
                    "modified_value": modified,
                    "review_trail_id": self.review_trails[-1].trail_id,
                },
                record_id=record.record_id,
            )
        elif resolution == "confirm_photo":
            record.status = RecordStatus.CONFIRMED
            record.caliber_source = "photo_supplement"
            for field in conflict.conflicting_fields:
                if field in conflict.photo_data:
                    if field == "position":
                        record.position = Coordinate3D(**conflict.photo_data[field])
                    elif field == "obstacle_type":
                        record.obstacle_type = conflict.photo_data[field]
                    elif field == "obstacle_name":
                        record.obstacle_name = conflict.photo_data[field]
            modified = self._record_snapshot(record)

            self._make_review_trail(
                record=record,
                original=original,
                modified=modified,
                changed_fields=(
                    ["status", "caliber_source", "reviewed_by", "reviewed_at"]
                    + conflict.conflicting_fields
                ),
                reason=(
                    f"园区运维小陶确认巡检照片编号的数据。"
                    f"冲突字段 {conflict.conflicting_fields}，origin={conflict.origin_data}，"
                    f"photo={conflict.photo_data}。最终采信：巡检照片编号(photo_supplement)，改后值见modified_value"
                ),
                next_handler="(流程结束: 已确认，进入清洗路径)",
                handled_by=actor,
            )

            self._add_history(
                action="RESOLVE_CONFLICT_CONFIRM_PHOTO",
                actor=actor,
                details={
                    "conflict_id": conflict_id,
                    "record_id": record.record_id,
                    "obstacle_name": record.obstacle_name,
                    "chosen_source": "photo_supplement",
                    "conflicting_fields": conflict.conflicting_fields,
                    "origin_data": conflict.origin_data,
                    "photo_data": conflict.photo_data,
                    "original_value": original,
                    "modified_value": modified,
                    "review_trail_id": self.review_trails[-1].trail_id,
                },
                record_id=record.record_id,
            )
        elif resolution == "reject_both":
            record.status = RecordStatus.REJECTED
            modified = self._record_snapshot(record)

            self._make_review_trail(
                record=record,
                original=original,
                modified=modified,
                changed_fields=["status", "reviewed_by", "reviewed_at"],
                reason=(
                    f"园区运维小陶判定双方数据均不可信，驳回。"
                    f"冲突字段 {conflict.conflicting_fields}，origin={conflict.origin_data}，"
                    f"photo={conflict.photo_data}。原始说法均已留痕，不提前归正常"
                ),
                next_handler="(流程结束: 已驳回，待重新采集)",
                handled_by=actor,
            )

            self._add_history(
                action="RESOLVE_CONFLICT_REJECT",
                actor=actor,
                details={
                    "conflict_id": conflict_id,
                    "record_id": record.record_id,
                    "obstacle_name": record.obstacle_name,
                    "note": "双方数据均不可信，已驳回",
                    "origin_data": conflict.origin_data,
                    "photo_data": conflict.photo_data,
                    "original_value": original,
                    "modified_value": modified,
                    "review_trail_id": self.review_trails[-1].trail_id,
                },
                record_id=record.record_id,
            )

        record.reviewed_by = actor
        record.reviewed_at = datetime.now()
        record.updated_at = datetime.now()
        return record

    def _add_history(
        self,
        action: str,
        actor: str,
        details: Dict,
        record_id: Optional[str] = None,
    ):
        entry = HistoryEntry(
            entry_id=f"hist_{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(),
            action=action,
            actor=actor,
            details=details,
            record_id=record_id,
        )
        self.history.append(entry)
