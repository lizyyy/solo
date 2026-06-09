from __future__ import annotations

import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from thermal_runaway_warning.engine import ThermalRunawayEngine, normalize_row, CSV_COLUMN_ALIASES
from thermal_runaway_warning.models import ProcessingStatus, OVER_THRESHOLD_STATUSES
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


class TestNormalizeRow(unittest.TestCase):
    def test_chinese_alias_mapping(self):
        raw = {"传感器编号": "T-A", "行号": 5, "采集时间": "2026-06-09T10:00:00", "读数": 70.0, "单位": "°C"}
        norm = normalize_row(raw)
        self.assertEqual(norm["sensor_id"], "T-A")
        self.assertEqual(norm["original_row"], 5)
        self.assertEqual(norm["timestamp"], "2026-06-09T10:00:00")
        self.assertEqual(norm["value"], 70.0)
        self.assertEqual(norm["unit"], "°C")

    def test_english_alias_mapping(self):
        raw = {"sensorId": "T-B", "row": 3, "time": "xxx", "val": 65.0, "uom": "V", "source": "may.csv"}
        norm = normalize_row(raw)
        self.assertEqual(norm["sensor_id"], "T-B")
        self.assertEqual(norm["original_row"], 3)
        self.assertEqual(norm["value"], 65.0)
        self.assertEqual(norm["unit"], "V")
        self.assertEqual(norm["source"], "may.csv")


class TestThresholdSuppression(unittest.TestCase):
    def test_over_threshold_status_really_set(self):
        engine = ThermalRunawayEngine(operator="test")
        store = ResultStore(engine)
        rows = [
            {"sensor_id": "S-002", "original_row": 10, "timestamp": "2026-06-04T10:00:00", "value": 75.0, "unit": "°C"},
            {"sensor_id": "S-002", "original_row": 11, "timestamp": "2026-06-04T10:01:00", "value": 30.0, "unit": "°C"},
            {"sensor_id": "S-002", "original_row": 12, "timestamp": "2026-06-04T10:02:00", "value": 35.0, "unit": "°C"},
        ]
        engine.import_records(rows)
        findings = engine.run_all_suppression_checks()
        store.invalidate()
        self.assertGreater(len(findings), 0)
        self.assertTrue(findings[0]["action_required"])

        record = engine._find_record("S-002", 10)
        self.assertEqual(record.status, ProcessingStatus.SUPPRESSED_BY_AVERAGE)

        event = engine._find_event("S-002", 10)
        self.assertEqual(event.status, ProcessingStatus.SUPPRESSED_BY_AVERAGE)
        self.assertIsNotNone(event.average_value)
        self.assertTrue(event.suppressed_by_avg)
        self.assertEqual(event.next_reviewer, "维修师傅")

        results = store.get_results_by_sensor("S-002")
        row_10 = next(r for r in results if r.original_row == 10)
        self.assertTrue(row_10.is_over_threshold)
        self.assertTrue(row_10.suppressed_by_average)
        self.assertEqual(row_10.next_reviewer, "维修师傅")

    def test_suppressed_in_over_threshold_list(self):
        engine = ThermalRunawayEngine(operator="test")
        store = ResultStore(engine)
        rows = [
            {"sensor_id": "S-003", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 80.0, "unit": "°C"},
            {"sensor_id": "S-003", "original_row": 2, "timestamp": "2026-06-04T10:01:00", "value": 40.0, "unit": "°C"},
        ]
        engine.import_records(rows)
        engine.run_all_suppression_checks()
        store.invalidate()
        over = store.get_over_threshold_results()
        self.assertEqual(len(over), 1)
        self.assertEqual(over[0].sensor_id, "S-003")
        self.assertTrue(over[0].suppressed_by_average)


class TestCSVViaEngine(unittest.TestCase):
    def test_import_csv(self):
        engine = ThermalRunawayEngine(operator="test")
        store = ResultStore(engine)
        csv_text = (
            "传感器编号,序号,时间,采集值,计量单位\n"
            "T-CSV,1,2026-06-09T10:00:00,80,°C\n"
            "T-CSV,2,2026-06-09T10:01:00,40,°C\n"
        )
        imported, _ = engine.import_csv(csv_text, source_name="csv_test")
        engine.run_all_suppression_checks()
        store.invalidate()
        self.assertEqual(len(imported), 2)
        over = store.get_over_threshold_results()
        self.assertEqual(len(over), 1)
        self.assertTrue(over[0].suppressed_by_average)


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
    def test_all_exports_same_count_and_over_threshold(self):
        engine = ThermalRunawayEngine(operator="test")
        store = ResultStore(engine)
        rows = [
            {"sensor_id": "S-005", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 55.0, "unit": "°C"},
            {"sensor_id": "S-005", "original_row": 2, "timestamp": "2026-06-04T10:01:00", "value": 80.0, "unit": "°C"},
            {"sensor_id": "S-005", "original_row": 3, "timestamp": "2026-06-04T10:02:00", "value": 45.0, "unit": "°C"},
        ]
        engine.import_records(rows)
        engine.run_all_suppression_checks()
        store.invalidate()
        api_resp = store.to_api_response()
        csv_data = store.to_csv()
        json_data = store.to_json()
        page_data = store.to_page_display()
        summary = store.to_summary()

        api_count = api_resp["total_records"]
        csv_lines = [l for l in csv_data.strip().split("\n") if l.strip()]
        csv_count = len(csv_lines) - 1
        json_count = len(json.loads(json_data))
        page_count = len(page_data)
        self.assertEqual(api_count, csv_count)
        self.assertEqual(api_count, json_count)
        self.assertEqual(api_count, page_count)
        self.assertEqual(summary["total"], api_count)

        api_over = api_resp["over_threshold_count"]
        summary_over = summary["over_threshold_count"]
        json_over = sum(1 for d in json.loads(json_data) if d.get("is_over_threshold"))
        self.assertEqual(api_over, summary_over)
        self.assertEqual(api_over, json_over)


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
        workflow.run_full_workflow(
            initial_rows=rows,
            photo_attachments=[{"sensor_id": "S-006", "photo_path": "/photos/s006.jpg", "description": "过热照片"}],
            unit_conversions=[{"from_unit": "°C", "to_unit": "K", "factor": 1.0, "description": "摄氏转华氏"}],
        )
        over_results = store.get_over_threshold_results()
        auto_normal = [r for r in over_results if r.status == ProcessingStatus.CONFIRMED_NORMAL]
        self.assertEqual(len(auto_normal), 0)


class TestWorkflowIntegration(unittest.TestCase):
    def test_full_workflow_three_steps_plus_review(self):
        engine = ThermalRunawayEngine(operator="何工")
        store = ResultStore(engine)
        workflow = Workflow(engine, store)

        initial_rows = [
            {"传感器编号": "T-101", "行号": 1, "采集时间": "2026-06-04T10:00:00", "读数": 75.0, "单位": "°C"},
            {"传感器编号": "T-101", "行号": 2, "采集时间": "2026-06-04T10:01:00", "读数": 45.0, "单位": "°C"},
            {"传感器编号": "T-102", "行号": 1, "采集时间": "2026-06-04T10:00:00", "读数": 4.30, "单位": "V"},
        ]

        step1 = workflow.step1_import(rows=initial_rows, source_name="6月批次.json")
        self.assertIn("T-101", step1["over_threshold_sensors"])
        self.assertIn("T-102", step1["over_threshold_sensors"])

        photo_attachments = [
            {"sensor_id": "T-101", "photo_path": "/photos/t101_thermal.jpg", "description": "T-101过热工况照片", "attached_by": "何工", "original_row": 1},
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

        amendments = [
            {"sensor_id": "T-101", "original_row": 1, "new_value": 62.0, "amendment_note": "现场重测读数，原探头接触不良，修正为62°C"},
        ]
        step4 = workflow.step4_he_gong_amendment(amendments)
        self.assertEqual(step4["amended_count"], 1)

        reviews = [
            {
                "sensor_id": "T-101",
                "original_row": 1,
                "final_status": "confirmed_abnormal",
                "original_statement": "初始导入值75.0°C，超阈值60°C，被平均值48.5°C盖掉，后何工修正为62°C",
                "amended_reason": "现场确认电芯微短路导致温度偏高，虽修正后仍超阈值，确认异常",
                "reviewer": "维修师傅张师傅",
                "next_reviewer": "质量主管李工",
                "amended_value": 62.0,
            },
            {
                "sensor_id": "T-102",
                "original_row": 1,
                "final_status": "awaiting_review",
                "original_statement": "T-102电压4.3V超阈值4.25V",
                "amended_reason": "工况照片待确认，先继续等下一位确认",
                "reviewer": "维修师傅王师傅",
                "next_reviewer": "高级工程师陈工",
            },
        ]
        step5 = workflow.step5_manual_review(reviews)
        self.assertEqual(step5["decisions_count"], 2)

        over_results = store.get_over_threshold_results()
        auto_normal = [r for r in over_results if r.status == ProcessingStatus.CONFIRMED_NORMAL]
        self.assertEqual(len(auto_normal), 0)

        for r in over_results:
            self.assertIsNotNone(r.sensor_id)
            self.assertGreater(r.original_row, 0)
            self.assertGreater(len(r.audit_trail), 0)

        api = store.to_api_response()
        csv_text = store.to_csv()
        page = store.to_page_display()
        summary = store.to_summary()
        self.assertEqual(api["over_threshold_count"], summary["over_threshold_count"])
        self.assertGreater(summary["over_threshold_count"], 0)
        for sid in ("T-101", "T-102"):
            self.assertTrue(any("T-101" in line for line in csv_text.splitlines()))
            self.assertTrue(any(str(r.get("传感器编号")) == sid for r in page))


class TestApiResponse(unittest.TestCase):
    def test_api_includes_full_evidence_and_consistency(self):
        rows = [
            {"sensor_id": "API-001", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 70.0, "unit": "°C"},
            {"sensor_id": "API-001", "original_row": 2, "timestamp": "2026-06-04T10:01:00", "value": 40.0, "unit": "°C"},
        ]
        photos = [
            {"sensor_id": "API-001", "photo_path": "/photos/api001.jpg", "description": "过热照片", "original_row": 1},
        ]
        convs = [
            {"from_unit": "°C", "to_unit": "K", "factor": 1.0, "description": "摄氏转开尔文"},
        ]
        reviews = [
            {
                "sensor_id": "API-001",
                "original_row": 1,
                "final_status": "awaiting_review",
                "original_statement": "70°C>60°C被平均值55°C盖掉",
                "amended_reason": "先暂挂待二次现场确认",
                "reviewer": "维修师傅",
                "next_reviewer": "主管",
            },
        ]
        result = create_api_response(
            initial_rows=rows,
            photo_attachments=photos,
            unit_conversions=convs,
            manual_reviews=reviews,
            operator="何工",
        )
        self.assertIn("summary", result)
        self.assertIn("evidence_summary", result)
        self.assertIn("warning_result", result)
        self.assertIn("page_display", result)
        self.assertIn("consistency_note", result)
        self.assertGreater(len(result["evidence_summary"]), 0)
        ev = result["evidence_summary"][0]
        self.assertEqual(ev["sensor_id"], "API-001")
        self.assertGreater(len(ev["photo_evidence"]), 0)
        self.assertGreater(len(ev["audit_evidence"]), 0)
        self.assertTrue(ev["suppressed_by_average"])
        self.assertTrue(ev["is_over_threshold"])
        self.assertIsNotNone(ev["review_decision"])
        self.assertEqual(ev["review_decision"]["next_reviewer"], "主管")

        self.assertEqual(result["summary"]["over_threshold_count"], result["warning_result"]["over_threshold_count"])
        self.assertEqual(result["summary"]["total"], result["warning_result"]["total_records"])


class TestCLIExport(unittest.TestCase):
    def test_export_json_file(self):
        engine = ThermalRunawayEngine(operator="test")
        store = ResultStore(engine)
        rows = [
            {"sensor_id": "S-007", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 70.0, "unit": "°C"},
            {"sensor_id": "S-007", "original_row": 2, "timestamp": "2026-06-04T10:01:00", "value": 40.0, "unit": "°C"},
        ]
        engine.import_records(rows)
        engine.run_all_suppression_checks()
        store.invalidate()
        json_output = store.to_json()
        parsed = json.loads(json_output)
        self.assertEqual(len(parsed), 2)
        over = [r for r in parsed if r["sensor_id"] == "S-007" and r["original_row"] == 1][0]
        self.assertTrue(over["suppressed_by_average"])
        self.assertTrue(over["is_over_threshold"])
        self.assertEqual(over["next_reviewer"], "维修师傅")


if __name__ == "__main__":
    unittest.main()
