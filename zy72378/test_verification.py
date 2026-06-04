import unittest
from datetime import datetime

from models import (
    WindSpeedRecord,
    SafetyThreshold,
    Direction,
    InspectionSource,
    ConflictResolution,
)
from verification_engine import VerificationEngine
from workflow import VerificationWorkflow, WorkflowStep


class TestNormalMaterial(unittest.TestCase):
    def setUp(self):
        self.engine = VerificationEngine()
        self.threshold = SafetyThreshold(
            tunnel_id="T001",
            max_wind_speed=10.0,
            min_wind_speed=1.0,
            max_pressure_diff=500.0,
            min_pressure_diff=10.0,
            valid_from=datetime(2025, 1, 1),
        )
        self.engine.load_threshold(self.threshold)

    def test_normal_import_and_verify(self):
        record = WindSpeedRecord(
            record_id="R001",
            tunnel_id="T001",
            timestamp=datetime(2025, 6, 1, 10, 0),
            wind_speed=5.0,
            pressure_diff=200.0,
            direction=Direction.FORWARD,
            source=InspectionSource.HANDWRITTEN_NOTE,
            inspector_name="张师傅",
            remark="正常",
        )
        errors = self.engine.import_record(record)
        self.assertEqual(len(errors), 0)

        verify_errors = self.engine.verify_against_threshold(record)
        self.assertEqual(len(verify_errors), 0)

    def test_normal_workflow_three_steps(self):
        workflow = VerificationWorkflow(self.engine)
        record = WindSpeedRecord(
            record_id="R002",
            tunnel_id="T001",
            timestamp=datetime(2025, 6, 1, 10, 0),
            wind_speed=5.0,
            pressure_diff=200.0,
            direction=Direction.FORWARD,
            source=InspectionSource.HANDWRITTEN_NOTE,
            inspector_name="张师傅",
            remark="正常",
        )

        results = workflow.step1_import_handwritten_notes([record])
        self.assertTrue(results[0].success)
        self.assertFalse(results[0].needs_review)

        result = workflow.step2_coach_review_threshold("老唐")
        self.assertTrue(result.success)

        result = workflow.step3_update_abnormal_table()
        self.assertTrue(result.success)


class TestWrongCaliberMaterial(unittest.TestCase):
    def setUp(self):
        self.engine = VerificationEngine()
        self.threshold = SafetyThreshold(
            tunnel_id="T002",
            max_wind_speed=8.0,
            min_wind_speed=1.0,
            max_pressure_diff=400.0,
            min_pressure_diff=10.0,
            valid_from=datetime(2025, 1, 1),
        )
        self.engine.load_threshold(self.threshold)

    def test_exceeds_threshold(self):
        record = WindSpeedRecord(
            record_id="R101",
            tunnel_id="T002",
            timestamp=datetime(2025, 6, 1, 14, 0),
            wind_speed=12.0,
            pressure_diff=600.0,
            direction=Direction.FORWARD,
            source=InspectionSource.HANDWRITTEN_NOTE,
            inspector_name="李师傅",
            remark="感觉风很大",
        )
        self.engine.import_record(record)
        errors = self.engine.verify_against_threshold(record)
        self.assertTrue(len(errors) >= 2)
        self.assertIn("超", errors[0])
        self.assertIn("超", errors[1])

    def test_direction_left_written_as_negative(self):
        record = WindSpeedRecord(
            record_id="R102",
            tunnel_id="T002",
            timestamp=datetime(2025, 6, 1, 14, 30),
            wind_speed=3.0,
            pressure_diff=150.0,
            direction=Direction.LEFT_WRITTEN_AS_NEGATIVE,
            source=InspectionSource.HANDWRITTEN_NOTE,
            inspector_name="王师傅",
            remark="风向向左",
        )
        errors = self.engine.import_record(record)
        self.assertTrue(any("向左" in e for e in errors))
        self.assertTrue(any("待复核" in e for e in errors))

        pending = self.engine.get_pending_reviews()
        self.assertTrue(len(pending) > 0)
        self.assertTrue(any("方向" in ac.issue_type for ac in pending))

    def test_conflict_detection(self):
        record = WindSpeedRecord(
            record_id="R103",
            tunnel_id="T002",
            timestamp=datetime(2025, 6, 1, 15, 0),
            wind_speed=3.0,
            pressure_diff=150.0,
            direction=Direction.LEFT_WRITTEN_AS_NEGATIVE,
            source=InspectionSource.HANDWRITTEN_NOTE,
            inspector_name="王师傅",
            remark="方向负",
        )
        self.engine.import_record(record)
        conflicts = self.engine.detect_conflicts(record)
        self.assertTrue(len(conflicts) > 0)
        self.assertEqual(conflicts[0].resolution, ConflictResolution.PENDING)

    def test_conflict_not_auto_resolved(self):
        record = WindSpeedRecord(
            record_id="R104",
            tunnel_id="T002",
            timestamp=datetime(2025, 6, 1, 15, 30),
            wind_speed=3.0,
            pressure_diff=150.0,
            direction=Direction.LEFT_WRITTEN_AS_NEGATIVE,
            source=InspectionSource.HANDWRITTEN_NOTE,
            inspector_name="王师傅",
            remark="方向负",
        )
        self.engine.import_record(record)
        conflicts = self.engine.detect_conflicts(record)
        for c in conflicts:
            self.assertEqual(c.resolution, ConflictResolution.PENDING)

    def test_coach_resolve_conflict(self):
        record = WindSpeedRecord(
            record_id="R105",
            tunnel_id="T002",
            timestamp=datetime(2025, 6, 1, 16, 0),
            wind_speed=3.0,
            pressure_diff=150.0,
            direction=Direction.LEFT_WRITTEN_AS_NEGATIVE,
            source=InspectionSource.HANDWRITTEN_NOTE,
            inspector_name="王师傅",
            remark="方向负",
        )
        self.engine.import_record(record)
        self.engine.detect_conflicts(record)

        resolved = self.engine.resolve_conflict(
            "R105", "方向", ConflictResolution.CONFIRMED_BY_COACH, "老唐"
        )
        self.assertTrue(resolved)

        self.engine.resolve_conflict(
            "R105", "风速方向", ConflictResolution.CONFIRMED_BY_COACH, "老唐"
        )

        pending = self.engine.get_pending_conflicts()
        self.assertTrue(all(c.record_id != "R105" for c in pending))


class TestSupplementaryMaterial(unittest.TestCase):
    def setUp(self):
        self.engine = VerificationEngine()
        self.threshold = SafetyThreshold(
            tunnel_id="T003",
            max_wind_speed=10.0,
            min_wind_speed=1.0,
            max_pressure_diff=500.0,
            min_pressure_diff=10.0,
            valid_from=datetime(2025, 1, 1),
        )
        self.engine.load_threshold(self.threshold)

    def test_supplementary_recalculate(self):
        original = WindSpeedRecord(
            record_id="R201",
            tunnel_id="T003",
            timestamp=datetime(2025, 6, 1, 9, 0),
            wind_speed=5.0,
            pressure_diff=200.0,
            direction=Direction.FORWARD,
            source=InspectionSource.HANDWRITTEN_NOTE,
            inspector_name="张师傅",
        )
        self.engine.import_record(original)

        supplementary = WindSpeedRecord(
            record_id="R201-S1",
            tunnel_id="T003",
            timestamp=datetime(2025, 6, 1, 11, 0),
            wind_speed=11.0,
            pressure_diff=550.0,
            direction=Direction.FORWARD,
            source=InspectionSource.HANDWRITTEN_NOTE,
            is_supplementary=True,
            original_record_id="R201",
            inspector_name="张师傅",
            remark="补录：11点复测数据",
        )
        self.engine.import_record(supplementary)

        errors = self.engine.recalculate_after_supplementary()
        self.assertTrue(len(errors) > 0)
        self.assertIn("超", errors[0])

    def test_duplicate_import(self):
        record = WindSpeedRecord(
            record_id="R202",
            tunnel_id="T003",
            timestamp=datetime(2025, 6, 1, 10, 0),
            wind_speed=5.0,
            pressure_diff=200.0,
            direction=Direction.FORWARD,
            source=InspectionSource.HANDWRITTEN_NOTE,
            inspector_name="张师傅",
        )
        self.engine.import_record(record)
        errors = self.engine.import_record(record)
        self.assertTrue(len(errors) > 0)
        self.assertIn("重复", errors[0])

    def test_export_consistency(self):
        record = WindSpeedRecord(
            record_id="R203",
            tunnel_id="T003",
            timestamp=datetime(2025, 6, 1, 10, 0),
            wind_speed=5.0,
            pressure_diff=200.0,
            direction=Direction.FORWARD,
            source=InspectionSource.HANDWRITTEN_NOTE,
            inspector_name="张师傅",
        )
        self.engine.import_record(record)

        good_export = [{"record_id": "R203", "wind_speed": 5.0, "pressure_diff": 200.0}]
        errors = self.engine.check_export_consistency(good_export)
        self.assertEqual(len(errors), 0)

        bad_export = [{"record_id": "R203", "wind_speed": 6.0, "pressure_diff": 200.0}]
        errors = self.engine.check_export_consistency(bad_export)
        self.assertTrue(len(errors) > 0)
        self.assertIn("不一致", errors[0])

    def test_workflow_with_left_direction_not_auto_normalized(self):
        workflow = VerificationWorkflow(self.engine)
        record = WindSpeedRecord(
            record_id="R204",
            tunnel_id="T003",
            timestamp=datetime(2025, 6, 1, 10, 0),
            wind_speed=5.0,
            pressure_diff=200.0,
            direction=Direction.LEFT_WRITTEN_AS_NEGATIVE,
            source=InspectionSource.HANDWRITTEN_NOTE,
            inspector_name="王师傅",
            remark="方向向左",
        )

        results = workflow.step1_import_handwritten_notes([record])
        self.assertTrue(results[0].needs_review)
        self.assertTrue(any("向左" in m for m in results[0].messages))
        self.assertTrue(any("待复核" in m for m in results[0].messages))

        direction_record = next(
            r for r in self.engine.records if r.record_id == "R204"
        )
        self.assertEqual(direction_record.direction, Direction.LEFT_WRITTEN_AS_NEGATIVE)


class TestWorkflowIntegration(unittest.TestCase):
    def setUp(self):
        self.engine = VerificationEngine()
        self.threshold = SafetyThreshold(
            tunnel_id="T004",
            max_wind_speed=10.0,
            min_wind_speed=1.0,
            max_pressure_diff=500.0,
            min_pressure_diff=10.0,
            valid_from=datetime(2025, 1, 1),
        )
        self.engine.load_threshold(self.threshold)
        self.workflow = VerificationWorkflow(self.engine)

    def test_full_workflow_with_conflict(self):
        record = WindSpeedRecord(
            record_id="R301",
            tunnel_id="T004",
            timestamp=datetime(2025, 6, 1, 10, 0),
            wind_speed=5.0,
            pressure_diff=200.0,
            direction=Direction.LEFT_WRITTEN_AS_NEGATIVE,
            source=InspectionSource.HANDWRITTEN_NOTE,
            inspector_name="王师傅",
            remark="方向负",
        )

        results = self.workflow.step1_import_handwritten_notes([record])
        self.assertTrue(results[0].success)
        self.assertTrue(results[0].needs_review)

        result = self.workflow.step2_coach_review_threshold(
            "老唐",
            conflict_resolutions=[
                {"record_id": "R301", "field_name": "方向", "resolution": "confirm"},
                {"record_id": "R301", "field_name": "风速方向", "resolution": "confirm"},
            ],
        )
        self.assertTrue(result.success)

        result = self.workflow.step3_update_abnormal_table()
        self.assertTrue(result.success)

    def test_workflow_step_order_enforcement(self):
        result = self.workflow.step3_update_abnormal_table()
        self.assertFalse(result.success)
        self.assertIn("第一步", result.messages[0])

        record = WindSpeedRecord(
            record_id="R302",
            tunnel_id="T004",
            timestamp=datetime(2025, 6, 1, 10, 0),
            wind_speed=5.0,
            pressure_diff=200.0,
            direction=Direction.FORWARD,
            source=InspectionSource.HANDWRITTEN_NOTE,
            inspector_name="张师傅",
        )
        self.workflow.step1_import_handwritten_notes([record])

        result = self.workflow.step3_update_abnormal_table()
        self.assertFalse(result.success)
        self.assertIn("第二步", result.messages[0])

    def test_abnormal_condition_matches_history(self):
        record = WindSpeedRecord(
            record_id="R303",
            tunnel_id="T004",
            timestamp=datetime(2025, 6, 1, 10, 0),
            wind_speed=12.0,
            pressure_diff=200.0,
            direction=Direction.FORWARD,
            source=InspectionSource.HANDWRITTEN_NOTE,
            inspector_name="张师傅",
        )
        self.engine.import_record(record)
        self.engine.verify_against_threshold(record)

        errors = self.engine.match_abnormal_with_history()
        self.assertEqual(len(errors), 0)


if __name__ == "__main__":
    unittest.main()
