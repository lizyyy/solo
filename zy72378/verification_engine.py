from datetime import datetime
from typing import Optional, List, Dict

from models import (
    WindSpeedRecord,
    SafetyThreshold,
    AbnormalCondition,
    ConflictEvidence,
    Direction,
    InspectionSource,
    ConflictResolution,
)
from error_messages import get_error_message


class VerificationEngine:
    def __init__(self):
        self.records: List[WindSpeedRecord] = []
        self.thresholds: Dict[str, SafetyThreshold] = {}
        self.abnormal_conditions: List[AbnormalCondition] = []
        self.conflict_evidences: List[ConflictEvidence] = []
        self._imported_ids: set = set()
        self._history: List[Dict] = []

    def load_threshold(self, threshold: SafetyThreshold):
        self.thresholds[threshold.tunnel_id] = threshold

    def import_record(self, record: WindSpeedRecord) -> List[str]:
        errors = []

        dup_error = self._check_duplicate(record)
        if dup_error:
            errors.append(dup_error)
            return errors

        validation_errors = self._validate_record(record)
        errors.extend(validation_errors)

        direction_errors = self._check_direction(record)
        errors.extend(direction_errors)

        self.records.append(record)
        self._imported_ids.add(record.record_id)
        self._history.append({
            "action": "import",
            "record_id": record.record_id,
            "timestamp": datetime.now().isoformat(),
            "is_supplementary": record.is_supplementary,
        })

        return errors

    def _check_duplicate(self, record: WindSpeedRecord) -> Optional[str]:
        if record.record_id in self._imported_ids:
            return get_error_message("duplicate_import", record_id=record.record_id)
        return None

    def _validate_record(self, record: WindSpeedRecord) -> List[str]:
        errors = []
        if record.wind_speed < 0:
            errors.append(get_error_message("invalid_wind_speed", value=record.wind_speed))
        return errors

    def _check_direction(self, record: WindSpeedRecord) -> List[str]:
        errors = []
        if record.direction == Direction.LEFT_WRITTEN_AS_NEGATIVE:
            errors.append(
                get_error_message("negative_direction_written_as_left")
            )
            self.abnormal_conditions.append(
                AbnormalCondition(
                    record_id=record.record_id,
                    tunnel_id=record.tunnel_id,
                    timestamp=record.timestamp,
                    issue_type="方向标识待复核",
                    detail="负方向被现场师傅写成向左，待实验老师复核",
                    needs_review=True,
                    review_status="pending",
                )
            )
        return errors

    def verify_against_threshold(self, record: WindSpeedRecord) -> List[str]:
        errors = []
        threshold = self.thresholds.get(record.tunnel_id)
        if threshold is None:
            errors.append(
                get_error_message("missing_threshold_table", tunnel_id=record.tunnel_id)
            )
            return errors

        if record.wind_speed > threshold.max_wind_speed:
            errors.append(
                get_error_message(
                    "wind_speed_exceeds_max",
                    value=record.wind_speed,
                    threshold=threshold.max_wind_speed,
                )
            )
            self._add_abnormal_if_new(record, "风速超上限")

        if record.wind_speed < threshold.min_wind_speed:
            errors.append(
                get_error_message(
                    "wind_speed_below_min",
                    value=record.wind_speed,
                    threshold=threshold.min_wind_speed,
                )
            )
            self._add_abnormal_if_new(record, "风速低于下限")

        if record.pressure_diff > threshold.max_pressure_diff:
            errors.append(
                get_error_message(
                    "pressure_diff_exceeds_max",
                    value=record.pressure_diff,
                    threshold=threshold.max_pressure_diff,
                )
            )
            self._add_abnormal_if_new(record, "压差超上限")

        if record.pressure_diff < threshold.min_pressure_diff:
            errors.append(
                get_error_message(
                    "pressure_diff_below_min",
                    value=record.pressure_diff,
                    threshold=threshold.min_pressure_diff,
                )
            )
            self._add_abnormal_if_new(record, "压差低于下限")

        return errors

    def _add_abnormal_if_new(self, record: WindSpeedRecord, issue_type: str):
        for ac in self.abnormal_conditions:
            if ac.record_id == record.record_id and ac.issue_type == issue_type:
                return
        self.abnormal_conditions.append(
            AbnormalCondition(
                record_id=record.record_id,
                tunnel_id=record.tunnel_id,
                timestamp=record.timestamp,
                issue_type=issue_type,
                detail=f"隧道{record.tunnel_id}在{record.timestamp}的{issue_type}",
                needs_review=True,
                review_status="pending",
            )
        )

    def detect_conflicts(self, record: WindSpeedRecord) -> List[ConflictEvidence]:
        conflicts = []
        threshold = self.thresholds.get(record.tunnel_id)
        if threshold is None:
            return conflicts

        if record.source == InspectionSource.HANDWRITTEN_NOTE:
            if record.direction == Direction.LEFT_WRITTEN_AS_NEGATIVE:
                conflict = ConflictEvidence(
                    record_id=record.record_id,
                    handwritten_value="向左(手写)",
                    threshold_value="负向(阈值表)",
                    field_name="方向",
                )
                conflicts.append(conflict)
                self.conflict_evidences.append(conflict)

            if record.remark and "负" in record.remark and record.wind_speed >= 0:
                conflict = ConflictEvidence(
                    record_id=record.record_id,
                    handwritten_value=record.remark,
                    threshold_value=f"风速={record.wind_speed}(非负)",
                    field_name="风速方向",
                )
                conflicts.append(conflict)
                self.conflict_evidences.append(conflict)

        return conflicts

    def resolve_conflict(
        self,
        record_id: str,
        field_name: str,
        resolution: ConflictResolution,
        resolved_by: str,
    ) -> bool:
        for c in self.conflict_evidences:
            if c.record_id == record_id and c.field_name == field_name:
                c.resolution = resolution
                c.resolved_by = resolved_by
                return True
        return False

    def recalculate_after_supplementary(self) -> List[str]:
        errors = []
        supplementary_records = [r for r in self.records if r.is_supplementary]
        if not supplementary_records:
            return errors

        for rec in supplementary_records:
            if rec.original_record_id is None:
                errors.append(
                    get_error_message("supplementary_recalc_needed")
                )
                continue
            original = next(
                (r for r in self.records if r.record_id == rec.original_record_id),
                None,
            )
            if original is None:
                errors.append(
                    get_error_message("abnormal_condition_mismatch", record_id=rec.original_record_id)
                )
                continue

            threshold_errors = self.verify_against_threshold(rec)
            errors.extend(threshold_errors)

        self._history.append({
            "action": "recalculate",
            "timestamp": datetime.now().isoformat(),
            "supplementary_count": len(supplementary_records),
        })

        return errors

    def check_export_consistency(self, export_data: List[Dict]) -> List[str]:
        errors = []
        current_records = {
            r.record_id: {"wind_speed": r.wind_speed, "pressure_diff": r.pressure_diff}
            for r in self.records
        }

        for item in export_data:
            rid = item.get("record_id")
            if rid not in current_records:
                errors.append(
                    get_error_message("export_inconsistency")
                )
                continue
            if (
                item.get("wind_speed") != current_records[rid]["wind_speed"]
                or item.get("pressure_diff") != current_records[rid]["pressure_diff"]
            ):
                errors.append(
                    get_error_message("export_inconsistency")
                )

        return errors

    def match_abnormal_with_history(self) -> List[str]:
        errors = []
        record_ids = {r.record_id for r in self.records}
        for ac in self.abnormal_conditions:
            if ac.record_id not in record_ids:
                errors.append(
                    get_error_message("abnormal_condition_mismatch", record_id=ac.record_id)
                )
        return errors

    def get_pending_reviews(self) -> List[AbnormalCondition]:
        return [ac for ac in self.abnormal_conditions if ac.needs_review and ac.review_status == "pending"]

    def get_pending_conflicts(self) -> List[ConflictEvidence]:
        return [c for c in self.conflict_evidences if c.resolution == ConflictResolution.PENDING]
