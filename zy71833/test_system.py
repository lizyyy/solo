#!/usr/bin/env python3
import unittest
import os
import shutil
import tempfile
from models import (
    UnitConfig,
    BattleMaterial,
    BattleRecord,
    ChangeLogEntry,
    BattleResult,
    TurnResult,
    RECORD_STATUS,
)
from engine import BattleEngine, RecordManager
from version_diff import VersionDiff
from report_exporter import ReportExporter
from sample_data import (
    create_sample_material_1,
    create_sample_material_2,
    create_modified_material_1,
    create_duplicate_material_1,
)


class TestModels(unittest.TestCase):
    def test_unit_config_to_dict(self):
        unit = UnitConfig(
            unit_id="U001",
            name="测试单位",
            hp=100,
            attack=20,
            defense=10,
            speed=15,
            skills=["重击"],
        )
        d = unit.to_dict()
        self.assertEqual(d["unit_id"], "U001")
        self.assertEqual(d["name"], "测试单位")
        self.assertEqual(d["skills"], ["重击"])

    def test_material_hash_consistency(self):
        mat1 = create_sample_material_1()
        mat2 = create_sample_material_1()
        self.assertEqual(mat1.compute_hash(), mat2.compute_hash())

    def test_material_hash_different_on_content_change(self):
        mat1 = create_sample_material_1()
        mat2 = create_modified_material_1()
        self.assertNotEqual(mat1.compute_hash(), mat2.compute_hash())

    def test_record_duplicate_detection(self):
        mat = create_sample_material_1()
        dup_mat = create_duplicate_material_1()
        record = BattleRecord(
            record_id="TEST-001",
            material=mat,
            operator="test",
        )
        self.assertTrue(record.is_duplicate(dup_mat))

    def test_status_change_logs(self):
        mat = create_sample_material_1()
        record = BattleRecord(
            record_id="TEST-001",
            material=mat,
            operator="test",
        )
        initial_log_count = len(record.change_log)
        record.set_status("processing", "user1", "开始处理")
        self.assertEqual(record.status, "processing")
        self.assertEqual(len(record.change_log), initial_log_count + 1)
        log = record.change_log[-1]
        self.assertEqual(log.field_changed, "status")
        self.assertEqual(log.old_value, "pending")
        self.assertEqual(log.new_value, "processing")
        self.assertEqual(log.operator, "user1")

    def test_invalid_status_raises_error(self):
        mat = create_sample_material_1()
        record = BattleRecord(
            record_id="TEST-001",
            material=mat,
            operator="test",
        )
        with self.assertRaises(ValueError):
            record.set_status("invalid_status", "user1")

    def test_update_material_detects_diff(self):
        mat1 = create_sample_material_1()
        mat2 = create_modified_material_1()
        record = BattleRecord(
            record_id="TEST-001",
            material=mat1,
            operator="test",
        )
        diff = record.update_material(mat2, "user1", "测试更新")
        self.assertIn("turn_order", diff)
        self.assertIn("units[0].hp", diff)
        self.assertIn("units[0].attack", diff)
        self.assertEqual(len(record.material_hash_history), 2)

    def test_pending_reason_set_on_pending(self):
        mat = create_sample_material_1()
        record = BattleRecord(
            record_id="TEST-001",
            material=mat,
            operator="test",
            status="confirmed",
        )
        record.set_status("pending", "user1", "需要重新确认")
        self.assertEqual(record.pending_reason, "需要重新确认")


class TestBattleEngine(unittest.TestCase):
    def setUp(self):
        self.engine = BattleEngine()

    def test_battle_runs_to_completion(self):
        mat = create_sample_material_1()
        result = self.engine.simulate_battle(mat)
        self.assertIsNotNone(result)
        self.assertIsNotNone(result.winner)
        self.assertGreater(result.total_turns, 0)
        self.assertGreaterEqual(result.balance_score, 0)
        self.assertLessEqual(result.balance_score, 100)

    def test_balance_score_is_number(self):
        mat = create_sample_material_2()
        result = self.engine.simulate_battle(mat)
        self.assertIsInstance(result.balance_score, float)

    def test_turn_results_match_total_turns(self):
        mat = create_sample_material_1()
        result = self.engine.simulate_battle(mat)
        self.assertTrue(all(
            tr.turn_number <= result.total_turns
            for tr in result.turn_results
        ))

    def test_final_hp_non_negative(self):
        mat = create_sample_material_2()
        result = self.engine.simulate_battle(mat)
        for hp in result.final_hp.values():
            self.assertGreaterEqual(hp, 0)

    def test_terrain_affects_damage(self):
        units = [
            UnitConfig("U1", "A", 100, 30, 10, 10, []),
            UnitConfig("U2", "B", 100, 30, 10, 9, []),
        ]
        mat_plain = BattleMaterial("M1", "test", units, "plain", "clear", ["U1", "U2"])
        mat_mountain = BattleMaterial("M2", "test", units, "mountain", "clear", ["U1", "U2"])

        res_plain = self.engine.simulate_battle(mat_plain)
        res_mountain = self.engine.simulate_battle(mat_mountain)

        self.assertIsNotNone(res_plain)
        self.assertIsNotNone(res_mountain)

    def test_weather_affects_damage(self):
        units = [
            UnitConfig("U1", "A", 100, 30, 10, 10, []),
            UnitConfig("U2", "B", 100, 30, 10, 9, []),
        ]
        mat_clear = BattleMaterial("M1", "test", units, "plain", "clear", ["U1", "U2"])
        mat_storm = BattleMaterial("M2", "test", units, "plain", "storm", ["U1", "U2"])

        res_clear = self.engine.simulate_battle(mat_clear)
        res_storm = self.engine.simulate_battle(mat_storm)

        self.assertIsNotNone(res_clear)
        self.assertIsNotNone(res_storm)

    def test_max_turns_limit(self):
        units = [
            UnitConfig("U1", "A", 1000, 5, 50, 10, []),
            UnitConfig("U2", "B", 1000, 5, 50, 9, []),
        ]
        mat = BattleMaterial("M1", "test", units, "plain", "clear", ["U1", "U2"])
        self.engine.max_turns = 10
        result = self.engine.simulate_battle(mat)
        self.assertEqual(result.total_turns, 10)
        self.assertTrue(any("超过" in issue for issue in result.issues))


class TestRecordManager(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.storage_path = os.path.join(self.test_dir, "test_records.json")
        self.manager = RecordManager(self.storage_path)

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_add_new_record(self):
        mat = create_sample_material_1()
        record, is_dup = self.manager.add_record(mat, "test_user")
        self.assertFalse(is_dup)
        self.assertIsNotNone(record.record_id)
        self.assertEqual(record.status, "pending")
        self.assertIn(record.record_id, self.manager.records)

    def test_add_duplicate_does_not_create_new(self):
        mat1 = create_sample_material_1()
        mat_dup = create_duplicate_material_1()

        rec1, dup1 = self.manager.add_record(mat1, "user1")
        rec2, dup2 = self.manager.add_record(mat_dup, "user2")

        self.assertFalse(dup1)
        self.assertTrue(dup2)
        self.assertEqual(rec1.record_id, rec2.record_id)
        self.assertEqual(len(self.manager.records), 1)

    def test_run_battle_updates_status(self):
        mat = create_sample_material_1()
        record, _ = self.manager.add_record(mat, "test")
        record = self.manager.run_battle(record.record_id, "test")
        self.assertEqual(record.status, "confirmed")
        self.assertIsNotNone(record.result)
        self.assertGreater(len(record.change_log), 2)

    def test_update_material_clears_result(self):
        mat = create_sample_material_1()
        record, _ = self.manager.add_record(mat, "test")
        record = self.manager.run_battle(record.record_id, "test")
        self.assertIsNotNone(record.result)

        new_mat = create_modified_material_1()
        record, diff, is_dup = self.manager.update_record_material(
            record.record_id, new_mat, "test", "更新材料"
        )

        self.assertFalse(is_dup)
        self.assertGreater(len(diff), 0)
        self.assertIsNone(record.result)
        self.assertEqual(record.status, "pending")

    def test_list_records_by_status(self):
        mat1 = create_sample_material_1()
        mat2 = create_sample_material_2()
        rec1, _ = self.manager.add_record(mat1, "test")
        rec2, _ = self.manager.add_record(mat2, "test")

        self.manager.run_battle(rec1.record_id, "test")

        pending = self.manager.list_records(status="pending")
        confirmed = self.manager.list_records(status="confirmed")

        self.assertEqual(len(pending), 1)
        self.assertEqual(len(confirmed), 1)
        self.assertEqual(pending[0].record_id, rec2.record_id)
        self.assertEqual(confirmed[0].record_id, rec1.record_id)

    def test_delete_record(self):
        mat = create_sample_material_1()
        record, _ = self.manager.add_record(mat, "test")
        self.assertTrue(self.manager.delete_record(record.record_id))
        self.assertNotIn(record.record_id, self.manager.records)
        self.assertFalse(self.manager.delete_record(record.record_id))

    def test_persistence(self):
        mat = create_sample_material_1()
        rec1, _ = self.manager.add_record(mat, "test")
        self.manager.run_battle(rec1.record_id, "test")

        manager2 = RecordManager(self.storage_path)
        self.assertIn(rec1.record_id, manager2.records)
        loaded = manager2.get_record(rec1.record_id)
        self.assertIsNotNone(loaded.result)
        self.assertEqual(loaded.result.winner, rec1.result.winner)


class TestVersionDiff(unittest.TestCase):
    def setUp(self):
        self.diff_tool = VersionDiff()

    def test_compare_identical_materials(self):
        mat1 = create_sample_material_1()
        mat2 = create_duplicate_material_1()
        diff = self.diff_tool.compare_materials(mat1, mat2)
        self.assertEqual(diff, {})

    def test_compare_different_materials(self):
        mat1 = create_sample_material_1()
        mat2 = create_modified_material_1()
        diff = self.diff_tool.compare_materials(mat1, mat2)
        self.assertIn("turn_order", diff)
        self.assertIn("units", diff)
        self.assertIn("version", diff)

    def test_high_impact_changes_detected(self):
        mat1 = create_sample_material_1()
        mat2 = create_modified_material_1()
        report = self.diff_tool.generate_diff_report(mat1, mat2)
        self.assertTrue(report["has_conflicts"])
        self.assertGreater(len(report["high_impact_changes"]), 0)

    def test_warnings_generated(self):
        mat1 = create_sample_material_1()
        mat2 = create_modified_material_1()
        report = self.diff_tool.generate_diff_report(mat1, mat2)
        self.assertGreater(len(report["warnings"]), 0)
        self.assertTrue(any("回合顺序" in w for w in report["warnings"]))

    def test_compare_results(self):
        res1 = BattleResult(
            winner="U001",
            total_turns=10,
            turn_results=[],
            final_hp={"U001": 50, "U002": 0},
            balance_score=75.0,
            issues=[],
        )
        res2 = BattleResult(
            winner="U002",
            total_turns=15,
            turn_results=[],
            final_hp={"U001": 0, "U002": 30},
            balance_score=60.0,
            issues=["测试问题"],
        )
        diff = self.diff_tool.compare_results(res1, res2)
        self.assertIn("winner", diff)
        self.assertIn("total_turns", diff)
        self.assertIn("balance_score", diff)
        self.assertIn("issues", diff)
        self.assertEqual(diff["winner"]["impact"], "high")

    def test_compare_results_one_none(self):
        res1 = BattleResult("U1", 10, [], {}, 50.0, [])
        diff = self.diff_tool.compare_results(res1, None)
        self.assertIn("result_change", diff)
        self.assertEqual(diff["result_change"]["type"], "result_cleared")

        diff2 = self.diff_tool.compare_results(None, res1)
        self.assertIn("result_change", diff2)
        self.assertEqual(diff2["result_change"]["type"], "new_result")


class TestReportExporter(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.exporter = ReportExporter(export_dir=os.path.join(self.test_dir, "reports"))
        self.manager = RecordManager(os.path.join(self.test_dir, "records.json"))

        mat1 = create_sample_material_1()
        mat2 = create_sample_material_2()
        self.rec1, _ = self.manager.add_record(mat1, "张三")
        self.rec2, _ = self.manager.add_record(mat2, "李四")
        self.manager.run_battle(self.rec1.record_id, "张三")

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_export_handover_report(self):
        records = self.manager.list_records()
        shift_info = {"on_duty": "张三", "next_duty": "李四", "notes": "注意REC2"}
        path = self.exporter.export_handover_report(records, shift_info)
        self.assertTrue(os.path.exists(path))
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("交接班复盘报告", content)
        self.assertIn(self.rec1.record_id, content)
        self.assertIn(self.rec2.record_id, content)
        self.assertIn("张三", content)
        self.assertIn("李四", content)

    def test_export_detailed_report(self):
        path = self.exporter.export_detailed_report(self.rec1)
        self.assertTrue(os.path.exists(path))
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn(self.rec1.record_id, content)
        self.assertIn("战斗结果", content)
        self.assertIn("变更历史", content)
        self.assertIn("回合战报", content)

    def test_export_json_report(self):
        records = self.manager.list_records()
        path = self.exporter.export_json_report(records)
        self.assertTrue(os.path.exists(path))
        import json
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertEqual(data["record_count"], 2)
        self.assertIn("status_summary", data)
        self.assertEqual(len(data["records"]), 2)

    def test_report_includes_pending_reason(self):
        self.manager.set_record_status(
            self.rec2.record_id, "pending", "王五", "需要确认单位数据"
        )
        records = self.manager.list_records()
        path = self.exporter.export_handover_report(records)
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("需要确认单位数据", content)


class TestEndToEnd(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.manager = RecordManager(os.path.join(self.test_dir, "e2e_records.json"))
        self.diff_tool = VersionDiff()
        self.exporter = ReportExporter(export_dir=os.path.join(self.test_dir, "reports"))

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_full_workflow(self):
        mat = create_sample_material_1()
        rec, is_dup = self.manager.add_record(mat, "user1")
        self.assertFalse(is_dup)
        self.assertEqual(rec.status, "pending")
        self.assertEqual(rec.pending_reason, "新提交，待处理")

        rec = self.manager.run_battle(rec.record_id, "user1")
        self.assertEqual(rec.status, "confirmed")
        self.assertIsNotNone(rec.result)
        winner1 = rec.result.winner

        new_mat = create_modified_material_1()
        report = self.diff_tool.generate_diff_report(rec, new_mat)
        self.assertTrue(report["has_conflicts"])

        rec, diff, is_dup = self.manager.update_record_material(
            rec.record_id, new_mat, "user2", "平衡性调整"
        )
        self.assertFalse(is_dup)
        self.assertEqual(rec.status, "pending")
        self.assertIsNone(rec.result)

        rec = self.manager.run_battle(rec.record_id, "user2")
        self.assertEqual(rec.status, "confirmed")
        self.assertIsNotNone(rec.result)

        self.assertGreaterEqual(len(rec.change_log), 5)
        operators = set(c.operator for c in rec.change_log)
        self.assertIn("user1", operators)
        self.assertIn("user2", operators)

        dup_mat = create_duplicate_material_1()
        dup_rec, is_dup = self.manager.add_record(dup_mat, "user3")
        self.assertTrue(is_dup)
        self.assertEqual(dup_rec.record_id, rec.record_id)

        records = self.manager.list_records()
        self.assertEqual(len(records), 1)

        path = self.exporter.export_handover_report(records, {
            "on_duty": "user2",
            "next_duty": "user3",
        })
        self.assertTrue(os.path.exists(path))

        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn(rec.record_id, content)
        self.assertIn("user1", content)
        self.assertIn("user2", content)


if __name__ == "__main__":
    unittest.main(verbosity=2)
