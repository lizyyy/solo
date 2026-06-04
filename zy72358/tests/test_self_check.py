from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from thermal_runaway_warning.engine import ThermalRunawayEngine
from thermal_runaway_warning.models import ProcessingStatus
from thermal_runaway_warning.result_store import ResultStore
from thermal_runaway_warning.self_check import SelfChecker
from thermal_runaway_warning.workflow import Workflow
from thermal_runaway_warning.api import create_api_response


class TestDuplicateImport(unittest.TestCase):
    def test_duplicate_rows_are_skipped(self):
        engine = ThermalRunawayEngine(operator="test")
        store = ResultStore(engine)
        rows = [
            {"sensor_id": "S-001", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 55.0, "unit": "°C"},
            {"sensor_id": "S-001", "original_row": 2, "timestamp": "2026-06-04T10:01:00", "value": 58.0, "unit": "°C"},
        ]
        first, first_skipped = engine.import_records(rows)
        second, second_skipped = engine.import_records(rows)
        self.assertEqual(len(first), 2)
        self.assertEqual(len(first_skipped), 0)
        self.assertEqual(len(second), 0)
        self.assertEqual(len(second_skipped), 2)

    def test_different_values_same_row_not_duplicate(self):
        engine = ThermalRunawayEngine(operator="test")
        rows_a = [
            {"sensor_id": "S-001", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 55.0, "unit": "°C"},
        ]
        rows_b = [
            {"sensor_id": "S-001", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 56.0, "unit": "°C"},
        ]
        first, _ = engine.import_records(rows_a)
        second, _ = engine.import_records(rows_b)
        self.assertEqual(len(first), 1)
        self.assertEqual(len(second), 1)


class TestThresholdSuppression(unittest.TestCase):
    def test_over_threshold_not_suppressed_by_average(self):
        engine = ThermalRunawayEngine(operator="test")
        rows = [
            {"sensor_id": "S-002", "original_row": 10, "timestamp": "2026-06-04T10:00:00", "value": 75.0, "unit": "°C"},
            {"sensor_id": "S-002", "original_row": 11, "timestamp": "2026-06-04T10:01:00", "value": 30.0, "unit": "°C"},
            {"sensor_id": "S-002", "original_row": 12, "timestamp": "2026-06-04T10:02:00", "value": 35.0, "unit": "°C"},
        ]
        engine.import_records(rows)
        findings = engine.compute_average_suppression_check("S-002")
        self.assertGreater(len(findings), 0)
        self.assertTrue(findings[0]["action_required"])
        self.assertEqual(findings[0]["sensor_id"], "S-002")
        self.assertEqual(findings[0]["original_row"], 10)

    def test_over_threshold_record_stays_visible(self):
        engine = ThermalRunawayEngine(operator="test")
        store = ResultStore(engine)
        rows = [
            {"sensor_id": "S-003", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 80.0, "unit": "°C"},
            {"sensor_id": "S-003", "original_row": 2, "timestamp": "2026-06-04T10:01:00", "value": 40.0, "unit": "°C"},
        ]
        engine.import_records(rows)
        engine.compute_average_suppression_check("S-003")
        results = store.get_results_by_sensor("S-003")
        over = [r for r in results if r.original_row == 1]
        self.assertEqual(len(over), 1)
        self.assertTrue(over[0].is_over_threshold)


class TestSupplementRecalculation(unittest.TestCase):
    def test_recalculate_after_supplement(self):
        engine = ThermalRunawayEngine(operator="test")
        store = ResultStore(engine)
        rows = [
            {"sensor_id": "S-004", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 65.0, "unit": "°C"},
        ]
        engine.import_records(rows)
        supplement = [
            {"sensor_id": "S-004", "original_row": 2, "timestamp": "2026-06-04T10:01:00", "value": 55.0, "unit": "°C"},
        ]
        imported, events = engine.recalculate_after_supplement(supplement)
        self.assertEqual(len(imported), 1)
        self.assertEqual(imported[0].status, ProcessingStatus.RECALCULATED)


class TestExportConsistency(unittest.TestCase):
    def test_all_exports_same_count(self):
        engine = ThermalRunawayEngine(operator="test")
        store = ResultStore(engine)
        rows = [
            {"sensor_id": "S-005", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 55.0, "unit": "°C"},
            {"sensor_id": "S-005", "original_row": 2, "timestamp": "2026-06-04T10:01:00", "value": 62.0, "unit": "°C"},
            {"sensor_id": "S-005", "original_row": 3, "timestamp": "2026-06-04T10:02:00", "value": 58.0, "unit": "°C"},
        ]
        engine.import_records(rows)
        api_resp = store.to_api_response()
        csv_data = store.to_csv()
        json_data = store.to_json()
        page_data = store.to_page_display()

        csv_lines = [l for l in csv_data.strip().split("\n") if l.strip()]
        csv_count = len(csv_lines) - 1
        json_count = len(json.loads(json_data))
        page_count = len(page_data)

        self.assertEqual(api_resp["total_records"], csv_count)
        self.assertEqual(api_resp["total_records"], json_count)
        self.assertEqual(api_resp["total_records"], page_count)


class TestSelfCheck(unittest.TestCase):
    def test_all_self_checks(self):
        engine = ThermalRunawayEngine(operator="self-check")
        store = ResultStore(engine)
        checker = SelfChecker(engine, store)
        results = checker.run_all_checks()
        for r in results:
            self.assertTrue(r["passed"], f"自检失败: {r['check']} - {r['detail']}")


class TestOverThresholdNotAutoNormal(unittest.TestCase):
    def test_over_threshold_never_auto_normal(self):
        engine = ThermalRunawayEngine(operator="test")
        store = ResultStore(engine)
        workflow = Workflow(engine, store)
        rows = [
            {"sensor_id": "S-006", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 80.0, "unit": "°C"},
            {"sensor_id": "S-006", "original_row": 2, "timestamp": "2026-06-04T10:01:00", "value": 40.0, "unit": "°C"},
        ]
        result = workflow.run_full_workflow(
            initial_rows=rows,
            photo_attachments=[{"sensor_id": "S-006", "photo_path": "/photos/s006.jpg", "description": "过热照片"}],
            unit_conversions=[{"from_unit": "°C", "to_unit": "°F", "factor": 1.8, "description": "摄氏转华氏"}],
        )
        over_results = store.get_over_threshold_results()
        auto_normal = [r for r in over_results if r.status == ProcessingStatus.CONFIRMED_NORMAL]
        self.assertEqual(len(auto_normal), 0)


class TestWorkflowIntegration(unittest.TestCase):
    def test_full_workflow_three_steps(self):
        engine = ThermalRunawayEngine(operator="何工")
        store = ResultStore(engine)
        workflow = Workflow(engine, store)

        initial_rows = [
            {"sensor_id": "T-101", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 75.0, "unit": "°C"},
            {"sensor_id": "T-101", "original_row": 2, "timestamp": "2026-06-04T10:01:00", "value": 45.0, "unit": "°C"},
            {"sensor_id": "T-102", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 4.30, "unit": "V"},
        ]

        step1 = workflow.step1_import(initial_rows)
        self.assertEqual(step1["imported_count"], 3)
        self.assertIn("T-101", step1["over_threshold_sensors"])
        self.assertIn("T-102", step1["over_threshold_sensors"])

        photo_attachments = [
            {"sensor_id": "T-101", "photo_path": "/photos/t101_thermal.jpg", "description": "T-101过热工况照片", "attached_by": "何工"},
            {"sensor_id": "T-102", "photo_path": "/photos/t102_voltage.jpg", "description": "T-102过压工况照片", "attached_by": "何工"},
        ]
        step2 = workflow.step2_attach_photos(photo_attachments)
        self.assertEqual(step2["attached_count"], 2)
        self.assertIn("T-101", step2["unreviewed_over_threshold_sensors"])

        unit_conversions = [
            {"from_unit": "°C", "to_unit": "K", "factor": 1.0, "description": "摄氏转开尔文(加273.15偏移)", "updated_by": "何工"},
        ]
        step3 = workflow.step3_update_unit_conversion(unit_conversions)
        self.assertEqual(len(step3["updated_conversions"]), 1)

        over_results = store.get_over_threshold_results()
        auto_normal = [r for r in over_results if r.status == ProcessingStatus.CONFIRMED_NORMAL]
        self.assertEqual(len(auto_normal), 0)

        for r in over_results:
            self.assertIsNotNone(r.sensor_id)
            self.assertGreater(r.original_row, 0)
            self.assertGreater(len(r.audit_trail), 0)


class TestApiResponse(unittest.TestCase):
    def test_api_includes_evidence(self):
        rows = [
            {"sensor_id": "API-001", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 70.0, "unit": "°C"},
        ]
        photos = [
            {"sensor_id": "API-001", "photo_path": "/photos/api001.jpg", "description": "过热照片"},
        ]
        convs = [
            {"from_unit": "°C", "to_unit": "K", "factor": 1.0, "description": "摄氏转开尔文"},
        ]
        result = create_api_response(
            initial_rows=rows,
            photo_attachments=photos,
            unit_conversions=convs,
            operator="何工",
        )
        self.assertIn("evidence_summary", result)
        self.assertGreater(len(result["evidence_summary"]), 0)
        ev = result["evidence_summary"][0]
        self.assertEqual(ev["sensor_id"], "API-001")
        self.assertGreater(len(ev["photo_evidence"]), 0)
        self.assertGreater(len(ev["audit_evidence"]), 0)


class TestCLIExport(unittest.TestCase):
    def test_export_json_file(self):
        engine = ThermalRunawayEngine(operator="test")
        store = ResultStore(engine)
        rows = [
            {"sensor_id": "S-007", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 55.0, "unit": "°C"},
        ]
        engine.import_records(rows)
        json_output = store.to_json()
        parsed = json.loads(json_output)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["sensor_id"], "S-007")


if __name__ == "__main__":
    unittest.main()
