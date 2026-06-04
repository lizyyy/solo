from __future__ import annotations

import json
import os
import tempfile
import unittest

from thermal_calibrator.models.calibration_record import (
    RecordStatus,
    TemperatureUnit,
)
from thermal_calibrator.store.result_store import ResultStore
from thermal_calibrator.workflow.engine import CalibrationWorkflow


class TestThreeStepWorkflow(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.store = ResultStore(self.tmpdir)
        self.workflow = CalibrationWorkflow(self.store)

    def test_full_three_steps_no_conflict(self):
        raw = [
            "采样间隔 5s",
            "25.3 \u00b0C",
            "26.1 \u00b0C",
        ]
        r = self.workflow.step_import("rec-001", "FLIR-A300", raw)
        self.assertEqual(r.status, RecordStatus.IMPORTED)
        self.assertFalse(r.has_unit_conflicts())

        r2 = self.workflow.step_engineer_review("rec-001", "何工")
        self.assertEqual(r2.status, RecordStatus.REVIEWED_BY_ENGINEER)

        r3 = self.workflow.step_handover_update("rec-001", "何工")
        self.assertTrue(r3.handover_report_updated)

    def test_celsius_kelvin_mixed_triggers_coach_review(self):
        raw = [
            "采样间隔 10s",
            "298.15 K \u00b0C",
        ]
        r = self.workflow.step_import("rec-002", "FLIR-B200", raw)
        self.assertTrue(r.has_unit_conflicts())

        r2 = self.workflow.step_engineer_review("rec-002", "何工", "发现混用单位")
        self.assertEqual(r2.status, RecordStatus.PENDING_COACH_REVIEW)

        with self.assertRaises(ValueError):
            self.workflow.step_handover_update("rec-002", "何工")

    def test_coach_resolve_then_handover(self):
        raw = [
            "采样间隔 5s",
            "298.15 K \u00b0C",
        ]
        r = self.workflow.step_import("rec-003", "FLIR-C100", raw)
        if r.has_pending_coach_review():
            r2 = self.workflow.step_engineer_review("rec-003", "何工")
            self.assertEqual(r2.status, RecordStatus.PENDING_COACH_REVIEW)

            conflict_line = None
            for uc in r2.unit_conflicts:
                if uc.needs_coach_review:
                    conflict_line = uc.line_number
                    break

            self.assertIsNotNone(conflict_line)
            r3 = self.workflow.step_coach_resolve_conflict(
                "rec-003",
                conflict_line,
                25.0,
                TemperatureUnit.CELSIUS,
                "训练教练",
                "确认为摄氏度 25\u00b0C",
            )
            self.assertEqual(r3.status, RecordStatus.COACH_CONFIRMED)

            r4 = self.workflow.step_handover_update("rec-003", "何工")
            self.assertTrue(r4.handover_report_updated)

    def test_rollback_preserves_audit(self):
        raw = [
            "采样间隔 5s",
            "298.15 K \u00b0C",
        ]
        r = self.workflow.step_import("rec-004", "FLIR-D100", raw)
        if r.has_pending_coach_review():
            r2 = self.workflow.step_engineer_review("rec-004", "何工")
            conflict_line = None
            for uc in r2.unit_conflicts:
                if uc.needs_coach_review:
                    conflict_line = uc.line_number
                    break

            r3 = self.workflow.step_coach_resolve_conflict(
                "rec-004",
                conflict_line,
                25.0,
                TemperatureUnit.CELSIUS,
                "训练教练",
                "先确认为25\u00b0C",
            )

            r4 = self.workflow.step_rollback_conflict(
                "rec-004", conflict_line, "何工"
            )
            self.assertEqual(r4.status, RecordStatus.ROLLED_BACK)
            self.assertTrue(len(r4.manual_changes) > 0)

    def test_same_result_for_export_display_api(self):
        raw = [
            "采样间隔 5s",
            "25.0 \u00b0C",
        ]
        self.workflow.step_import("rec-005", "FLIR-E100", raw)

        full = self.store.get_full_result("rec-005")
        exported = json.loads(self.store.export_detail("rec-005"))
        self.assertEqual(full, exported)

        loaded = self.store.load("rec-005")
        self.assertIsNotNone(loaded)
        self.assertEqual(full, loaded.to_dict())

    def test_original_line_numbers_preserved(self):
        raw = [
            "",
            "采样间隔 5s",
            "",
            "25.0 \u00b0C",
        ]
        r = self.workflow.step_import("rec-006", "FLIR-F100", raw)
        self.assertEqual(r.sampling_intervals[0].original_line_number, 2)
        self.assertEqual(r.temperature_readings[0].original_line_number, 4)


if __name__ == "__main__":
    unittest.main()
