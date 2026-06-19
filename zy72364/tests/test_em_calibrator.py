import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from em_calibrator.db import Database
from em_calibrator.importer import import_records, reimport_records, get_record_with_evidence
from em_calibrator.workflow import (
    engineer_review,
    safety_review,
    rollback_to_engineer_review,
    get_full_audit_trail,
)
from em_calibrator.boundary import (
    BOUNDARY_RULES,
    validate_transition,
    enforce_caliber_consistency,
)
from em_calibrator.models import RecordStatus, ChangeType, SafetyVerdict


class TestEMCalibrator(unittest.TestCase):
    def setUp(self):
        self.db = Database(":memory:")

    def tearDown(self):
        self.db.close()

    def test_import_idempotency(self):
        records = [
            {
                "original_line_no": 1,
                "sensor_id": "S-001",
                "equipment_position": "POS-01",
                "temperature_value": 25.5,
                "caliber": "PT100",
                "remark": "test",
            }
        ]
        batch_id_1, created_1, updated_1, details_1 = import_records(self.db, records, "file1.csv", "admin")
        self.assertGreater(batch_id_1, 0)
        self.assertEqual(created_1, 1)
        self.assertEqual(updated_1, 0)
        self.assertEqual(len(details_1), 1)
        self.assertEqual(details_1[0]["action"], "new")
        count_1 = self.db.count_records_by_batch(batch_id_1)
        self.assertEqual(count_1, 1)

        batch_id_2, created_2, updated_2, details_2 = import_records(self.db, records, "file1.csv", "admin")
        self.assertEqual(batch_id_2, batch_id_1)
        self.assertEqual(created_2, 0)
        self.assertEqual(updated_2, 0)
        self.assertEqual(len(details_2), 1)
        self.assertEqual(details_2[0]["action"], "duplicate_exact")
        count_2 = self.db.count_records_by_batch(batch_id_1)
        self.assertEqual(count_2, 1)

    def test_three_step_workflow_normal(self):
        records = [
            {
                "original_line_no": 1,
                "sensor_id": "S-001",
                "equipment_position": "POS-01",
                "temperature_value": 25.5,
                "caliber": "PT100",
                "remark": "batch1 line1",
            },
            {
                "original_line_no": 2,
                "sensor_id": "S-002",
                "equipment_position": "POS-02",
                "temperature_value": 26.0,
                "caliber": "PT100",
                "remark": "batch1 line2",
            },
            {
                "original_line_no": 3,
                "sensor_id": "S-003",
                "equipment_position": "POS-03",
                "temperature_value": 24.8,
                "caliber": "PT100",
                "remark": "batch1 line3",
            },
        ]
        batch_id, created, updated, _ = import_records(self.db, records, "temp_log.csv", "admin")
        self.assertEqual(created, 3)

        recs = self.db.get_records_by_batch(batch_id)
        for rec in recs:
            self.assertEqual(rec.status, RecordStatus.IMPORTED.value)

        for rec in recs:
            result = engineer_review(self.db, rec.id, "何工", "engineer reviewed")
            self.assertEqual(result.status, RecordStatus.SAFETY_REVIEW.value)

        for rec in self.db.get_records_by_batch(batch_id):
            result = safety_review(self.db, rec.id, "安全员", approve=True, note="approved")
            self.assertEqual(result.status, RecordStatus.COMPLETED.value)

        final_recs = self.db.get_records_by_batch(batch_id)
        for rec in final_recs:
            audit = get_full_audit_trail(self.db, rec.id)
            self.assertIn("workflow_log", audit)
            self.assertIn("change_history", audit)
            self.assertGreater(len(audit["workflow_log"]), 0)
            change_types = [ch.change_type for ch in audit["change_history"]]
            self.assertIn(ChangeType.IMPORT.value, change_types)
            self.assertIn(ChangeType.STATUS_CHANGE.value, change_types)

    def test_sensor_restart_flow(self):
        batch1_records = [
            {
                "original_line_no": 1,
                "sensor_id": "S-001",
                "equipment_position": "POS-01",
                "temperature_value": 25.0,
                "caliber": "PT100",
                "remark": "batch1",
            }
        ]
        batch_id_1, _, _, _ = import_records(self.db, batch1_records, "b1.csv", "admin")
        recs_1 = self.db.get_records_by_batch(batch_id_1)
        self.assertEqual(recs_1[0].sensor_id, "S-001")

        engineer_review(self.db, recs_1[0].id, "何工", "review")
        safety_review(self.db, recs_1[0].id, "安全员", approve=True, note="done")
        self.assertEqual(self.db.get_record(recs_1[0].id).status, RecordStatus.COMPLETED.value)

        batch2_records = [
            {
                "original_line_no": 1,
                "sensor_id": "S-999",
                "equipment_position": "POS-01",
                "temperature_value": 26.0,
                "caliber": "PT100",
                "remark": "batch2",
            }
        ]
        batch_id_2, _, _, _ = import_records(self.db, batch2_records, "b2.csv", "admin")
        recs_2 = self.db.get_records_by_batch(batch_id_2)
        self.assertEqual(recs_2[0].status, RecordStatus.IMPORTED.value)

        result = engineer_review(self.db, recs_2[0].id, "何工", "review")
        self.assertEqual(result.status, RecordStatus.SENSOR_CHANGED.value)

        mappings = self.db.get_pending_sensor_mappings()
        self.assertEqual(len(mappings), 1)
        self.assertEqual(mappings[0].old_sensor_id, "S-001")
        self.assertEqual(mappings[0].new_sensor_id, "S-999")
        self.assertEqual(mappings[0].equipment_position, "POS-01")
        self.assertEqual(mappings[0].verdict, SafetyVerdict.PENDING.value)

        result = safety_review(self.db, recs_2[0].id, "安全员", approve=False, note="reject sensor change")
        self.assertEqual(result.status, RecordStatus.ENGINEER_REVIEW.value)
        self.assertEqual(result.sensor_id, "S-001")

        history = self.db.get_change_history(recs_2[0].id)
        rollback_entries = [h for h in history if h.change_type == ChangeType.ROLLBACK.value and h.field_name == "sensor_id"]
        self.assertEqual(len(rollback_entries), 1)
        self.assertEqual(rollback_entries[0].old_value, "S-999")
        self.assertEqual(rollback_entries[0].new_value, "S-001")

    def test_sensor_restart_approved(self):
        batch1_records = [
            {
                "original_line_no": 1,
                "sensor_id": "S-001",
                "equipment_position": "POS-01",
                "temperature_value": 25.0,
                "caliber": "PT100",
                "remark": "batch1",
            }
        ]
        batch_id_1, _, _, _ = import_records(self.db, batch1_records, "b1.csv", "admin")
        recs_1 = self.db.get_records_by_batch(batch_id_1)
        engineer_review(self.db, recs_1[0].id, "何工", "review")
        safety_review(self.db, recs_1[0].id, "安全员", approve=True, note="done")

        batch2_records = [
            {
                "original_line_no": 1,
                "sensor_id": "S-888",
                "equipment_position": "POS-01",
                "temperature_value": 26.5,
                "caliber": "PT100",
                "remark": "batch2",
            }
        ]
        batch_id_2, _, _, _ = import_records(self.db, batch2_records, "b2.csv", "admin")
        recs_2 = self.db.get_records_by_batch(batch_id_2)
        result = engineer_review(self.db, recs_2[0].id, "何工", "review")
        self.assertEqual(result.status, RecordStatus.SENSOR_CHANGED.value)

        mappings = self.db.get_pending_sensor_mappings()
        self.assertEqual(len(mappings), 1)

        result = safety_review(self.db, recs_2[0].id, "安全员", approve=True, note="approve sensor change")
        self.assertEqual(result.status, RecordStatus.COMPLETED.value)

        mapping = self.db.get_sensor_mapping(mappings[0].id)
        self.assertEqual(mapping.verdict, SafetyVerdict.APPROVED.value)

    def test_reimport_with_field_change(self):
        records_1 = [
            {
                "original_line_no": 1,
                "sensor_id": "S-001",
                "equipment_position": "POS-01",
                "temperature_value": 25.5,
                "caliber": "PT100",
                "remark": "initial",
            }
        ]
        batch_id_1, created_1, updated_1, details_1 = import_records(self.db, records_1, "f1.csv", "admin")
        self.assertEqual(created_1, 1)
        self.assertEqual(len(details_1), 1)
        self.assertEqual(details_1[0]["action"], "new")

        records_2 = [
            {
                "original_line_no": 1,
                "sensor_id": "S-001",
                "equipment_position": "POS-01",
                "temperature_value": 25.5,
                "caliber": "PT100",
                "remark": "何工 added note",
            }
        ]
        batch_id_2, created_2, updated_2, details_2 = reimport_records(self.db, batch_id_1, records_2, "f1_revised.csv", "何工")
        self.assertEqual(batch_id_2, batch_id_1)
        self.assertEqual(created_2, 0)
        self.assertEqual(updated_2, 1)
        self.assertEqual(len(details_2), 1)
        self.assertEqual(details_2[0]["action"], "updated")
        self.assertEqual(len(details_2[0]["changes"]), 1)
        self.assertEqual(details_2[0]["changes"][0][0], "remark")

        recs = self.db.get_records_by_batch(batch_id_2)
        self.assertEqual(recs[0].remark, "何工 added note")

        history = self.db.get_change_history(recs[0].id)
        manual_edits = [h for h in history if h.change_type == ChangeType.MANUAL_EDIT.value and h.field_name == "remark"]
        self.assertEqual(len(manual_edits), 1)
        self.assertEqual(manual_edits[0].old_value, "initial")
        self.assertEqual(manual_edits[0].new_value, "何工 added note")

        record_id = recs[0].id
        self.assertEqual(self.db.count_records_by_batch(batch_id_2), 1)
        self.assertEqual(self.db.count_records_by_batch(batch_id_1), 1)
        total_rows = self.db._conn.execute("SELECT COUNT(*) FROM temperature_record").fetchone()[0]
        self.assertEqual(total_rows, 1)

        remark_a = self.db.get_record(record_id).remark
        remark_b = self.db.get_record_by_batch_and_line(batch_id_1, 1).remark
        remark_c = get_record_with_evidence(self.db, record_id)["record"].remark
        remark_d = [r.remark for r in self.db.get_records_by_batch(batch_id_1) if r.original_line_no == 1][0]
        self.assertEqual(remark_a, "何工 added note")
        self.assertEqual(remark_b, "何工 added note")
        self.assertEqual(remark_c, "何工 added note")
        self.assertEqual(remark_d, "何工 added note")

        self.assertEqual(manual_edits[0].changed_by, "何工")
        self.assertTrue(manual_edits[0].reason and len(manual_edits[0].reason) > 0)

    def test_reimport_scenarios_distinguished(self):
        records_initial = [
            {
                "original_line_no": 2,
                "sensor_id": "S-001",
                "equipment_position": "POS-01",
                "temperature_value": 25.0,
                "caliber": "PT100",
                "remark": "line2 original",
            },
            {
                "original_line_no": 3,
                "sensor_id": "S-002",
                "equipment_position": "POS-02",
                "temperature_value": 26.0,
                "caliber": "PT100",
                "remark": "line3 original",
            },
        ]
        batch_id_1, created_1, updated_1, details_1 = import_records(
            self.db, records_initial, "scenarios.csv", "admin"
        )
        self.assertEqual(created_1, 2)
        self.assertEqual(updated_1, 0)

        batch_id_dup, created_dup, updated_dup, details_dup = import_records(
            self.db, records_initial, "scenarios.csv", "admin"
        )
        self.assertEqual(batch_id_dup, batch_id_1)
        self.assertEqual(created_dup, 0)
        self.assertEqual(updated_dup, 0)
        self.assertEqual(len(details_dup), 2)
        self.assertEqual(details_dup[0]["action"], "duplicate_exact")
        self.assertEqual(details_dup[1]["action"], "duplicate_exact")

        records_revised = [
            {
                "original_line_no": 2,
                "sensor_id": "S-001",
                "equipment_position": "POS-01",
                "temperature_value": 25.0,
                "caliber": "PT100",
                "remark": "line2 original",
            },
            {
                "original_line_no": 3,
                "sensor_id": "S-002",
                "equipment_position": "POS-02",
                "temperature_value": 26.0,
                "caliber": "PT100",
                "remark": "modified",
            },
            {
                "original_line_no": 5,
                "sensor_id": "S-003",
                "equipment_position": "POS-03",
                "temperature_value": 27.0,
                "caliber": "PT100",
                "remark": "new record",
            },
        ]
        batch_id_2, created_2, updated_2, details_2 = reimport_records(
            self.db, batch_id_1, records_revised, "scenarios_revised.csv", "何工"
        )
        self.assertEqual(batch_id_2, batch_id_1)
        self.assertEqual(created_2, 1)
        self.assertEqual(updated_2, 1)

        self.assertEqual(len(details_2), 3)
        line2_detail = [d for d in details_2 if d["original_line_no"] == 2][0]
        line3_detail = [d for d in details_2 if d["original_line_no"] == 3][0]
        line5_detail = [d for d in details_2 if d["original_line_no"] == 5][0]
        self.assertEqual(line2_detail["action"], "unchanged")
        self.assertEqual(line3_detail["action"], "updated")
        self.assertEqual(line5_detail["action"], "new_in_batch")
        self.assertEqual(len(line3_detail["changes"]), 1)
        self.assertEqual(line3_detail["changes"][0][0], "remark")
        self.assertEqual(line3_detail["changes"][0][1], "line3 original")
        self.assertEqual(line3_detail["changes"][0][2], "modified")

        batch_count = self.db.count_records_by_batch(batch_id_1)
        self.assertEqual(batch_count, 3)

        line3_record = self.db.get_record_by_batch_and_line(batch_id_1, 3)
        line3_history = self.db.get_change_history(line3_record.id)
        line3_manual_edits = [
            h for h in line3_history
            if h.change_type == ChangeType.MANUAL_EDIT.value and h.field_name == "remark"
        ]
        self.assertEqual(len(line3_manual_edits), 1)
        self.assertEqual(line3_manual_edits[0].old_value, "line3 original")
        self.assertEqual(line3_manual_edits[0].new_value, "modified")
        self.assertEqual(line3_manual_edits[0].changed_by, "何工")

    def test_record_evidence(self):
        records = [
            {
                "original_line_no": 1,
                "sensor_id": "S-001",
                "equipment_position": "POS-01",
                "temperature_value": 25.5,
                "caliber": "PT100",
                "remark": "test",
            }
        ]
        batch_id, _, _, _ = import_records(self.db, records, "test.csv", "admin")
        recs = self.db.get_records_by_batch(batch_id)
        record_id = recs[0].id

        evidence = get_record_with_evidence(self.db, record_id)
        self.assertIn("record", evidence)
        self.assertIn("change_history", evidence)
        self.assertIn("original_line_no", evidence)
        self.assertIn("current_status", evidence)
        self.assertEqual(evidence["original_line_no"], 1)
        self.assertEqual(evidence["current_status"], RecordStatus.IMPORTED.value)
        self.assertIsInstance(evidence["change_history"], list)
        self.assertGreater(len(evidence["change_history"]), 0)

    def test_boundary_rules(self):
        self.assertIn("sensor_restart", BOUNDARY_RULES)
        self.assertIn("caliber_mismatch", BOUNDARY_RULES)
        self.assertIn("duplicate_import", BOUNDARY_RULES)
        self.assertIn("status_transition", BOUNDARY_RULES)

        for key in BOUNDARY_RULES:
            rule = BOUNDARY_RULES[key]
            self.assertIn("description", rule)
            self.assertIn("action", rule)
            self.assertIn("rollback", rule)
            self.assertIsInstance(rule["description"], str)
            self.assertIsInstance(rule["action"], str)
            self.assertIsInstance(rule["rollback"], str)
            self.assertGreater(len(rule["description"]), 0)
            self.assertGreater(len(rule["action"]), 0)
            self.assertGreater(len(rule["rollback"]), 0)

    def test_status_transitions(self):
        self.assertTrue(validate_transition(RecordStatus.IMPORTED.value, RecordStatus.ENGINEER_REVIEW.value))
        self.assertFalse(validate_transition(RecordStatus.IMPORTED.value, RecordStatus.SAFETY_REVIEW.value))
        self.assertFalse(validate_transition(RecordStatus.IMPORTED.value, RecordStatus.COMPLETED.value))

        self.assertTrue(validate_transition(RecordStatus.ENGINEER_REVIEW.value, RecordStatus.SAFETY_REVIEW.value))
        self.assertTrue(validate_transition(RecordStatus.ENGINEER_REVIEW.value, RecordStatus.SENSOR_CHANGED.value))
        self.assertFalse(validate_transition(RecordStatus.ENGINEER_REVIEW.value, RecordStatus.COMPLETED.value))

        self.assertTrue(validate_transition(RecordStatus.SENSOR_CHANGED.value, RecordStatus.SAFETY_REVIEW.value))
        self.assertFalse(validate_transition(RecordStatus.SENSOR_CHANGED.value, RecordStatus.ENGINEER_REVIEW.value))

        self.assertTrue(validate_transition(RecordStatus.SAFETY_REVIEW.value, RecordStatus.COMPLETED.value))
        self.assertTrue(validate_transition(RecordStatus.SAFETY_REVIEW.value, RecordStatus.SENSOR_CHANGED.value))
        self.assertTrue(validate_transition(RecordStatus.SAFETY_REVIEW.value, RecordStatus.ENGINEER_REVIEW.value))

        self.assertTrue(validate_transition(RecordStatus.COMPLETED.value, RecordStatus.ENGINEER_REVIEW.value))
        self.assertFalse(validate_transition(RecordStatus.COMPLETED.value, RecordStatus.SAFETY_REVIEW.value))

        self.assertFalse(validate_transition("invalid_status", RecordStatus.IMPORTED.value))

    def test_caliber_mismatch(self):
        records = [
            {
                "original_line_no": 1,
                "sensor_id": "S-001",
                "equipment_position": "POS-01",
                "temperature_value": 25.0,
                "caliber": "PT100",
                "remark": "batch1",
            }
        ]
        import_records(self.db, records, "b1.csv", "admin")

        error_msg = enforce_caliber_consistency(self.db, "POS-01", "PT1000")
        self.assertIsInstance(error_msg, str)
        self.assertIn("POS-01", error_msg)
        self.assertIn("PT100", error_msg)
        self.assertIn("PT1000", error_msg)

        no_error = enforce_caliber_consistency(self.db, "POS-01", "PT100")
        self.assertIsNone(no_error)

        no_error_new_pos = enforce_caliber_consistency(self.db, "POS-99", "PT1000")
        self.assertIsNone(no_error_new_pos)

    def test_rollback_to_engineer_review(self):
        records = [
            {
                "original_line_no": 1,
                "sensor_id": "S-001",
                "equipment_position": "POS-01",
                "temperature_value": 25.0,
                "caliber": "PT100",
                "remark": "test",
            }
        ]
        batch_id, _, _, _ = import_records(self.db, records, "test.csv", "admin")
        recs = self.db.get_records_by_batch(batch_id)
        record_id = recs[0].id

        engineer_review(self.db, record_id, "何工", "review")

        result = rollback_to_engineer_review(self.db, record_id, "安全员", "need recheck")
        self.assertEqual(result.status, RecordStatus.ENGINEER_REVIEW.value)

        history = self.db.get_change_history(record_id)
        rollback_entries = [h for h in history if h.change_type == ChangeType.ROLLBACK.value]
        self.assertEqual(len(rollback_entries), 1)
        self.assertEqual(rollback_entries[0].field_name, "status")
        self.assertEqual(rollback_entries[0].new_value, RecordStatus.ENGINEER_REVIEW.value)


if __name__ == "__main__":
    unittest.main()
