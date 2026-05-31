from __future__ import annotations

import unittest

from models import (
    AnomalyType,
    CADPoint,
    CheckStatus,
    EquipmentNote,
)
from engine import CampusRouteEngine


class TestCampusRouteEngine(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = CampusRouteEngine()
        self.cad_pt_a = CADPoint(id="cad_A", label="入口A", x=1.0, y=2.0, z=0.0)
        self.cad_pt_b = CADPoint(id="cad_B", label="展厅B", x=5.0, y=6.0, z=0.0)
        self.engine.add_cad_point(self.cad_pt_a)
        self.engine.add_cad_point(self.cad_pt_b)

        self.note_a = EquipmentNote(
            id="note_A",
            equipment_name="投影仪",
            model_id="proj_01",
            position_cad_point_id="cad_A",
            remark="入口处主投影",
        )
        self.engine.add_equipment_note(self.note_a)

    def test_duplicate_run_preserves_history(self) -> None:
        batch = "batch_2026_05_31"
        materials = {"models": [], "route_segments": [], "exhibits": []}

        run1 = self.engine.run_route(batch, materials)
        run2 = self.engine.run_route(batch, materials)

        self.assertEqual(run1.run_index, 1)
        self.assertEqual(run2.run_index, 2)

        history = self.engine.get_batch_history(batch)
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0].id, run1.id)
        self.assertEqual(history[1].id, run2.id)

    def test_model_duplicate_flagged_as_pending_confirm(self) -> None:
        materials = {
            "models": [
                {"model_id": "proj_01", "cad_point_id": "cad_A", "equipment_note_id": "note_A"},
                {"model_id": "proj_01", "cad_point_id": "cad_B", "equipment_note_id": "note_A"},
            ],
            "route_segments": [],
            "exhibits": [],
        }
        run = self.engine.run_route("dup_test", materials)
        dup_results = [r for r in run.results if r.anomaly_type == AnomalyType.MODEL_DUPLICATE]
        self.assertEqual(len(dup_results), 1)
        self.assertEqual(dup_results[0].status, CheckStatus.PENDING_CONFIRM)
        self.assertIn("proj_01", dup_results[0].description)
        trace_cad_refs = [ref for ref in dup_results[0].trace_refs if ref.source_type == "cad_point"]
        self.assertEqual(len(trace_cad_refs), 2)

    def test_route_blocked_flagged_as_pending_confirm(self) -> None:
        materials = {
            "models": [],
            "route_segments": [
                {"x1": 0, "y1": 0, "x2": 10, "y2": 0},
            ],
            "exhibits": [
                {"x": 5.0, "y": 0.0, "radius": 2.0, "cad_point_id": "cad_A", "equipment_note_id": "note_A"},
            ],
        }
        run = self.engine.run_route("blocked_test", materials)
        blocked = [r for r in run.results if r.anomaly_type == AnomalyType.ROUTE_BLOCKED]
        self.assertEqual(len(blocked), 1)
        self.assertEqual(blocked[0].status, CheckStatus.PENDING_CONFIRM)

    def test_axis_flipped_flagged_as_pending_confirm(self) -> None:
        materials = {
            "models": [
                {
                    "model_id": "screen_01",
                    "cad_point_id": "cad_A",
                    "equipment_note_id": "note_A",
                    "orientation": {"x_flipped": True},
                },
            ],
            "route_segments": [],
            "exhibits": [],
        }
        run = self.engine.run_route("flip_test", materials)
        flipped = [r for r in run.results if r.anomaly_type == AnomalyType.AXIS_FLIPPED]
        self.assertEqual(len(flipped), 1)
        self.assertEqual(flipped[0].status, CheckStatus.PENDING_CONFIRM)

    def test_trace_from_result_to_cad_and_note(self) -> None:
        materials = {
            "models": [
                {"model_id": "proj_01", "cad_point_id": "cad_A", "equipment_note_id": "note_A"},
                {"model_id": "proj_01", "cad_point_id": "cad_B", "equipment_note_id": "note_A"},
            ],
            "route_segments": [],
            "exhibits": [],
        }
        run = self.engine.run_route("trace_test", materials)
        dup_result = [r for r in run.results if r.anomaly_type == AnomalyType.MODEL_DUPLICATE][0]

        traced = self.engine.get_result_with_trace(dup_result.id)
        self.assertIsNotNone(traced)
        self.assertEqual(len(traced["trace_refs"]), 4)

        cad_ref = [t for t in traced["trace_refs"] if t["source_type"] == "cad_point"][0]
        self.assertIn("resolved", cad_ref)
        self.assertEqual(cad_ref["resolved"]["label"], "入口A")

        note_ref = [t for t in traced["trace_refs"] if t["source_type"] == "equipment_note"][0]
        self.assertIn("resolved", note_ref)
        self.assertEqual(note_ref["resolved"]["equipment_name"], "投影仪")

    def test_cad_version_change_triggers_alert(self) -> None:
        materials = {
            "models": [
                {"model_id": "proj_01", "cad_point_id": "cad_A", "equipment_note_id": "note_A"},
                {"model_id": "proj_01", "cad_point_id": "cad_A", "equipment_note_id": "note_A"},
            ],
            "route_segments": [],
            "exhibits": [],
        }
        self.engine.run_route("cad_change_test", materials)

        updated_pt = CADPoint(id="cad_A", label="入口A-改", x=1.5, y=2.0, z=0.0)
        _, alerts = self.engine.add_cad_point(updated_pt)

        self.assertEqual(len(alerts), 1)
        alert = alerts[0]
        self.assertEqual(alert.old_version, 1)
        self.assertEqual(alert.new_version, 2)
        self.assertIn("x", alert.changes)
        self.assertEqual(alert.changes["x"]["old"], 1.0)
        self.assertEqual(alert.changes["x"]["new"], 1.5)
        self.assertGreater(len(alert.affected_results), 0)

    def test_cad_no_change_no_alert(self) -> None:
        same_pt = CADPoint(id="cad_A", label="入口A", x=1.0, y=2.0, z=0.0)
        _, alerts = self.engine.add_cad_point(same_pt)
        self.assertEqual(len(alerts), 0)

    def test_same_batch_second_run_not_overwritten(self) -> None:
        batch = "preserve_test"
        mat1 = {
            "models": [
                {"model_id": "proj_01", "cad_point_id": "cad_A", "equipment_note_id": "note_A"},
                {"model_id": "proj_01", "cad_point_id": "cad_B", "equipment_note_id": "note_A"},
            ],
            "route_segments": [],
            "exhibits": [],
        }
        run1 = self.engine.run_route(batch, mat1)

        mat2 = {
            "models": [
                {"model_id": "screen_02", "cad_point_id": "cad_B", "orientation": {"y_flipped": True}},
            ],
            "route_segments": [],
            "exhibits": [],
        }
        run2 = self.engine.run_route(batch, mat2)

        self.assertNotEqual(run1.id, run2.id)
        self.assertEqual(len(self.engine.get_batch_history(batch)), 2)

        dup_in_run1 = [r for r in run1.results if r.anomaly_type == AnomalyType.MODEL_DUPLICATE]
        self.assertEqual(len(dup_in_run1), 1)

        dup_in_run2 = [r for r in run2.results if r.anomaly_type == AnomalyType.MODEL_DUPLICATE]
        self.assertEqual(len(dup_in_run2), 0)

        flipped_in_run2 = [r for r in run2.results if r.anomaly_type == AnomalyType.AXIS_FLIPPED]
        self.assertEqual(len(flipped_in_run2), 1)

    def test_cad_point_history_preserved(self) -> None:
        v2 = CADPoint(id="cad_A", label="入口A-v2", x=3.0, y=4.0, z=0.0)
        self.engine.add_cad_point(v2)
        v3 = CADPoint(id="cad_A", label="入口A-v3", x=5.0, y=6.0, z=1.0)
        self.engine.add_cad_point(v3)

        current = self.engine._cad_points["cad_A"]
        self.assertEqual(current.version, 3)

        history = self.engine._cad_point_history["cad_A"]
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0].x, 1.0)
        self.assertEqual(history[1].x, 3.0)

    def test_trace_shows_cad_version_count(self) -> None:
        v2 = CADPoint(id="cad_A", label="入口A-v2", x=3.0, y=4.0, z=0.0)
        self.engine.add_cad_point(v2)

        materials = {
            "models": [
                {"model_id": "proj_01", "cad_point_id": "cad_A", "equipment_note_id": "note_A"},
                {"model_id": "proj_01", "cad_point_id": "cad_A", "equipment_note_id": "note_A"},
            ],
            "route_segments": [],
            "exhibits": [],
        }
        run = self.engine.run_route("version_trace_test", materials)
        dup = [r for r in run.results if r.anomaly_type == AnomalyType.MODEL_DUPLICATE][0]
        traced = self.engine.get_result_with_trace(dup.id)
        cad_refs = [t for t in traced["trace_refs"] if t["source_type"] == "cad_point"]
        for ref in cad_refs:
            self.assertEqual(ref["history_versions"], 2)


if __name__ == "__main__":
    unittest.main()
