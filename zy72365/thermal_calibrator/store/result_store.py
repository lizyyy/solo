from __future__ import annotations

import json
import os
from typing import Optional

from thermal_calibrator.models.calibration_record import CalibrationRecord


class ResultStore:
    def __init__(self, store_dir):
        self._store_dir = store_dir
        os.makedirs(store_dir, exist_ok=True)

    def _path(self, record_id):
        return os.path.join(self._store_dir, f"{record_id}.json")

    def save(self, record):
        data = record.to_dict()
        with open(self._path(record.record_id), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load(self, record_id):
        path = self._path(record_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return self._from_dict(data)

    def list_records(self):
        if not os.path.exists(self._store_dir):
            return []
        return [
            f.replace(".json", "")
            for f in os.listdir(self._store_dir)
            if f.endswith(".json")
        ]

    def get_full_result(self, record_id):
        record = self.load(record_id)
        if record is None:
            return None
        return record.to_dict()

    def get_summary(self, record_id):
        record = self.load(record_id)
        if record is None:
            return None
        return {
            "record_id": record.record_id,
            "device_name": record.device_name,
            "status": record.status.value,
            "has_unit_conflicts": record.has_unit_conflicts(),
            "pending_coach_review_count": sum(
                1 for uc in record.unit_conflicts if uc.needs_coach_review
            ),
            "total_readings": len(record.temperature_readings),
            "total_intervals": len(record.sampling_intervals),
            "handover_report_updated": record.handover_report_updated,
        }

    def export_detail(self, record_id):
        result = self.get_full_result(record_id)
        if result is None:
            return None
        return json.dumps(result, ensure_ascii=False, indent=2)

    def _from_dict(self, data):
        from thermal_calibrator.models.calibration_record import (
            ManualChange,
            RecordStatus,
            SamplingInterval,
            TemperatureReading,
            TemperatureUnit,
            UnitConflictAction,
            UnitConflictRecord,
        )

        intervals = []
        for si in data.get("sampling_intervals", []):
            mcs = [
                ManualChange(
                    changed_at=mc["changed_at"],
                    changed_by=mc["changed_by"],
                    field_name=mc["field_name"],
                    old_value=mc["old_value"],
                    new_value=mc["new_value"],
                    reason=mc["reason"],
                )
                for mc in si.get("manual_changes", [])
            ]
            intervals.append(
                SamplingInterval(
                    original_line_number=si["original_line_number"],
                    interval_seconds=si["interval_seconds"],
                    unit=TemperatureUnit(si["unit"]),
                    raw_text=si["raw_text"],
                    manual_changes=mcs,
                )
            )

        readings = []
        for tr in data.get("temperature_readings", []):
            mcs = [
                ManualChange(
                    changed_at=mc["changed_at"],
                    changed_by=mc["changed_by"],
                    field_name=mc["field_name"],
                    old_value=mc["old_value"],
                    new_value=mc["new_value"],
                    reason=mc["reason"],
                )
                for mc in tr.get("manual_changes", [])
            ]
            readings.append(
                TemperatureReading(
                    original_line_number=tr["original_line_number"],
                    value=tr["value"],
                    unit=TemperatureUnit(tr["unit"]),
                    raw_text=tr["raw_text"],
                    manual_changes=mcs,
                )
            )

        conflicts = []
        for uc in data.get("unit_conflicts", []):
            conflicts.append(
                UnitConflictRecord(
                    line_number=uc["line_number"],
                    detected_units=[TemperatureUnit(u) for u in uc["detected_units"]],
                    action_taken=UnitConflictAction(uc["action_taken"]),
                    original_raw=uc["original_raw"],
                    resolved_value=uc["resolved_value"],
                    resolved_unit=(
                        TemperatureUnit(uc["resolved_unit"])
                        if uc["resolved_unit"]
                        else None
                    ),
                    needs_coach_review=uc["needs_coach_review"],
                    coach_review_note=uc.get("coach_review_note"),
                )
            )

        changes = [
            ManualChange(
                changed_at=mc["changed_at"],
                changed_by=mc["changed_by"],
                field_name=mc["field_name"],
                old_value=mc["old_value"],
                new_value=mc["new_value"],
                reason=mc["reason"],
            )
            for mc in data.get("manual_changes", [])
        ]

        return CalibrationRecord(
            record_id=data["record_id"],
            device_name=data["device_name"],
            imported_at=data["imported_at"],
            status=RecordStatus(data["status"]),
            sampling_intervals=intervals,
            temperature_readings=readings,
            unit_conflicts=conflicts,
            manual_changes=changes,
            engineer_review_at=data.get("engineer_review_at"),
            engineer_review_by=data.get("engineer_review_by"),
            coach_review_at=data.get("coach_review_at"),
            coach_review_by=data.get("coach_review_by"),
            handover_report_updated=data.get("handover_report_updated", False),
        )
