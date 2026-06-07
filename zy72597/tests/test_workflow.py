#!/usr/bin/env python3
"""
线上离线打分差异 - 单元测试
"""

import sys
import os
import tempfile
import shutil
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from online_offline_diff import (
    ResultStore,
    WorkflowEngine,
    DiffEngine,
    ProcessingStatus,
)


class TestWorkflow(unittest.TestCase):
    def setUp(self):
        self.data_dir = tempfile.mkdtemp(prefix="diff_test_")
        self.store = ResultStore(data_dir=self.data_dir)
        self.engine = WorkflowEngine(self.store)

    def tearDown(self):
        shutil.rmtree(self.data_dir)

    def test_three_step_workflow_normal(self):
        """测试正常三步工作流"""
        record = self.engine.step1_import_snapshot(
            snapshot_id="SNAP-TEST-001",
            original_line_number=100,
            main_flow="测试主流程",
            raw_data={"test": "data"},
            online_score=0.90,
            offline_score=0.88,
        )
        self.assertEqual(record.current_status, ProcessingStatus.IMPORTED)
        self.assertEqual(record.feature_snapshot.original_line_number, 100)

        record = self.engine.step2_review_training_logs(
            record_id=record.record_id,
            on_site_statement="测试现场说法",
            curve_data={"x": [1, 2, 3]},
            reviewed_by="林姐",
        )
        self.assertEqual(record.current_status, ProcessingStatus.LOGS_REVIEWED)
        self.assertEqual(len(record.training_logs), 1)

        record = self.engine.step3_update_tier_metrics(
            record_id=record.record_id,
            tier_metrics={"tier1": {"precision": 0.9}},
        )
        self.assertEqual(record.current_status, ProcessingStatus.METRICS_UPDATED)
        self.assertIsNotNone(record.tier_metrics)

        record = self.engine.confirm_normal(
            record_id=record.record_id,
            confirmed_by="林姐",
        )
        self.assertEqual(record.current_status, ProcessingStatus.CONFIRMED_NORMAL)
        self.assertTrue(ProcessingStatus.is_final(record.current_status))

        audits = self.store.get_audit_logs(record.record_id)
        self.assertEqual(len(audits), 4)

    def test_threshold_mismatch_stops_for_review(self):
        """测试阈值改过但报告仍写旧值时，停在待复核状态，不自动归为正常"""
        record = self.engine.step1_import_snapshot(
            snapshot_id="SNAP-TEST-002",
            original_line_number=200,
            main_flow="测试阈值不匹配",
            raw_data={},
            online_score=0.75,
            offline_score=0.85,
        )

        record = self.engine.add_threshold_change(
            record_id=record.record_id,
            field_name="test_threshold",
            old_value=0.5,
            new_value=0.6,
            changed_by="测试用户",
            report_still_shows_old=True,
        )

        self.assertEqual(record.current_status, ProcessingStatus.THRESHOLD_MISMATCH)
        self.assertTrue(record.has_threshold_mismatch())

        record = self.engine.step2_review_training_logs(
            record_id=record.record_id,
            on_site_statement="测试",
            curve_data={},
        )
        self.assertEqual(record.current_status, ProcessingStatus.THRESHOLD_MISMATCH)

        record = self.engine.step3_update_tier_metrics(
            record_id=record.record_id,
            tier_metrics={},
        )
        self.assertEqual(record.current_status, ProcessingStatus.THRESHOLD_MISMATCH)

        record = self.engine.confirm_abnormal(
            record_id=record.record_id,
            confirmed_by="林姐",
        )
        self.assertEqual(record.current_status, ProcessingStatus.CONFIRMED_ABNORMAL)

        with self.assertRaises(ValueError):
            self.engine.step2_review_training_logs(
                record_id=record.record_id,
                on_site_statement="不能再修改终态",
                curve_data={},
            )

    def test_original_line_number_preserved_in_export(self):
        """测试原始行号在导出中保留"""
        record = self.engine.step1_import_snapshot(
            snapshot_id="SNAP-TEST-003",
            original_line_number=42,
            main_flow="测试行号保留",
            raw_data={},
            online_score=0.8,
            offline_score=0.8,
        )

        export_path = os.path.join(self.data_dir, "test_export.json")
        self.store.export_records(output_path=export_path)

        import json
        with open(export_path) as f:
            data = json.load(f)

        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["original_line_number"], 42)
        self.assertIn("threshold_changes", data[0])
        self.assertIn("manual_changes", data[0])

    def test_manual_change_audited(self):
        """测试人工改动被审计"""
        record = self.engine.step1_import_snapshot(
            snapshot_id="SNAP-TEST-004",
            original_line_number=10,
            main_flow="测试人工改动",
            raw_data={},
            online_score=0.7,
            offline_score=0.7,
        )

        record = self.engine.add_manual_change(
            record_id=record.record_id,
            field_name="online_score",
            old_value=0.7,
            new_value=0.72,
            changed_by="测试用户",
            change_reason="修正分数",
        )

        self.assertEqual(len(record.manual_changes), 1)
        mc = record.manual_changes[0]
        self.assertEqual(mc.field_name, "online_score")
        self.assertEqual(mc.old_value, 0.7)
        self.assertEqual(mc.new_value, 0.72)
        self.assertEqual(mc.changed_by, "测试用户")

        audits = self.store.get_audit_logs(record.record_id)
        audit_actions = [a.action for a in audits]
        self.assertIn("add_manual_change", audit_actions)

    def test_single_source_of_truth(self):
        """测试单一数据源：API、页面展示、导出读取同一份数据"""
        record = self.engine.step1_import_snapshot(
            snapshot_id="SNAP-TEST-005",
            original_line_number=55,
            main_flow="测试单一数据源",
            raw_data={"key": "value"},
            online_score=0.95,
            offline_score=0.93,
        )

        api_records = list(self.store.iterate_records_for_api())
        page_records = self.store.list_records()
        export_path = os.path.join(self.data_dir, "test_export2.json")
        self.store.export_records(output_path=export_path)
        import json
        with open(export_path) as f:
            export_records = json.load(f)

        self.assertEqual(len(api_records), 1)
        self.assertEqual(len(page_records), 1)
        self.assertEqual(len(export_records), 1)

        self.assertEqual(api_records[0]["snapshot_id"], "SNAP-TEST-005")
        self.assertEqual(page_records[0].snapshot_id, "SNAP-TEST-005")
        self.assertEqual(export_records[0]["snapshot_id"], "SNAP-TEST-005")

        self.assertEqual(api_records[0]["original_line_number"], 55)
        self.assertEqual(page_records[0].feature_snapshot.original_line_number, 55)
        self.assertEqual(export_records[0]["original_line_number"], 55)

    def test_boundary_rules_in_code(self):
        """测试边界规则定义在代码中"""
        rules = DiffEngine.get_boundary_rules()
        self.assertIn("threshold_report_mismatch", rules)
        self.assertIn("original_line_preservation", rules)
        self.assertIn("manual_change_audit", rules)
        self.assertIn("pending_before_confirm", rules)
        self.assertIn("single_source_of_truth", rules)

        self.assertIn("THRESHOLD_MISMATCH", rules["threshold_report_mismatch"])
        self.assertIn("原始行号", rules["original_line_preservation"])

    def test_invalid_status_transition(self):
        """测试无效的状态转换会抛出异常"""
        record = self.engine.step1_import_snapshot(
            snapshot_id="SNAP-TEST-006",
            original_line_number=1,
            main_flow="测试无效转换",
            raw_data={},
            online_score=0.5,
            offline_score=0.5,
        )

        record = self.engine.confirm_normal(
            record_id=record.record_id,
            confirmed_by="林姐",
        )

        with self.assertRaises(ValueError):
            self.engine.step2_review_training_logs(
                record_id=record.record_id,
                on_site_statement="不能再修改终态",
                curve_data={},
            )

    def test_rollback(self):
        """测试状态回滚"""
        record = self.engine.step1_import_snapshot(
            snapshot_id="SNAP-TEST-007",
            original_line_number=777,
            main_flow="测试回滚",
            raw_data={},
            online_score=0.6,
            offline_score=0.6,
        )

        record = self.engine.step2_review_training_logs(
            record_id=record.record_id,
            on_site_statement="临时审核",
            curve_data={},
        )
        self.assertEqual(record.current_status, ProcessingStatus.LOGS_REVIEWED)

        record = self.engine.rollback_status(
            record_id=record.record_id,
            target_status=ProcessingStatus.IMPORTED,
            rolled_back_by="林姐",
            reason="审核有误，重新来",
        )
        self.assertEqual(record.current_status, ProcessingStatus.IMPORTED)

        audits = self.store.get_audit_logs(record.record_id)
        audit_actions = [a.action for a in audits]
        self.assertIn("rollback_status", audit_actions)


if __name__ == "__main__":
    unittest.main(verbosity=2)
