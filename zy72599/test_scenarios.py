import os
import unittest
from datetime import datetime

from models import WeightStatus, ReviewDecision
from tracker import WeightTracker
from sample_data import (
    create_normal_sample,
    create_threshold_old_report_sample,
    create_training_log_supplement_sample,
)


class TestWeightTracker(unittest.TestCase):
    def setUp(self):
        self.storage_path = "test_records.json"
        if os.path.exists(self.storage_path):
            os.remove(self.storage_path)
        self.tracker = WeightTracker(storage_path=self.storage_path)

    def tearDown(self):
        if os.path.exists(self.storage_path):
            os.remove(self.storage_path)

    def test_normal_scenario(self):
        print("\n=== 测试场景一：正常记录 ===")
        snapshot, training_log, metrics = create_normal_sample()

        record = self.tracker.step1_import_snapshot(snapshot, "data_engineer")
        self.assertEqual(record.status, WeightStatus.PENDING_REVIEW)
        self.assertEqual(len(record.history), 1)
        print(f"  Step 1 完成: 状态={record.status.value}")

        record, review_pkg = self.tracker.step2_check_training_log(
            record.track_id, training_log, "推荐策略老唐"
        )
        self.assertEqual(record.status, WeightStatus.NORMAL)
        self.assertIsNone(review_pkg)
        self.assertEqual(len(record.conflicts), 0)
        print(f"  Step 2 完成: 状态={record.status.value}, 冲突数={len(record.conflicts)}")

        record = self.tracker.step3_update_stratified_metrics(
            record.track_id, metrics, "system"
        )
        self.assertEqual(record.status, WeightStatus.NORMAL)
        self.assertEqual(len(record.stratified_metrics), 3)
        print(f"  Step 3 完成: 状态={record.status.value}, 分层指标数={len(record.stratified_metrics)}")
        print("  ✅ 正常场景通过")

    def test_threshold_changed_without_review_blocks_metrics(self):
        print("\n=== 测试场景二：阈值改过但报告仍写旧值（关键点：未复核不能更新分层指标） ===")
        snapshot, training_log, metrics = create_threshold_old_report_sample()

        record = self.tracker.step1_import_snapshot(snapshot, "data_engineer")
        track_id = record.track_id
        print(f"  Step 1 完成: 状态={record.status.value}")

        record, review_pkg = self.tracker.step2_check_training_log(
            track_id, training_log, "推荐策略老唐"
        )
        self.assertEqual(record.status, WeightStatus.THRESHOLD_CHANGED_REPORT_OLD)
        self.assertIsNotNone(review_pkg)
        self.assertGreater(len(record.conflicts), 0)
        print(f"  Step 2 完成: 状态={record.status.value}, 冲突数={len(record.conflicts)}")
        for i, c in enumerate(record.conflicts, 1):
            print(f"    冲突[{i}]: {c.description}")

        print("  Step 3 尝试（未复核）: 应该暂缓更新...")
        record = self.tracker.step3_update_stratified_metrics(
            track_id, metrics, "system"
        )
        self.assertEqual(len(record.stratified_metrics), 0)
        self.assertTrue(
            any("暂缓更新" in h["action"] for h in record.history)
        )
        print(f"  ✅ 已暂缓更新，分层指标数={len(record.stratified_metrics)}")

        print("  数据科学家复核确认...")
        record = self.tracker.resolve_conflict(
            track_id,
            ReviewDecision.CONFIRM,
            "数据科学家A",
            "确认是阈值更新但报告未同步"
        )
        self.assertEqual(record.review_decision, ReviewDecision.CONFIRM)
        print(f"  复核完成: 决策={record.review_decision.value}")

        print("  Step 3 重试（已复核）: 应该正常更新...")
        record = self.tracker.step3_update_stratified_metrics(
            track_id, metrics, "system"
        )
        self.assertEqual(len(record.stratified_metrics), 3)
        print(f"  ✅ 复核后正常更新，分层指标数={len(record.stratified_metrics)}")
        print("  ✅ 阈值改报告旧值场景通过")

    def test_training_log_supplement(self):
        print("\n=== 测试场景三：从训练日志曲线补录 ===")
        snapshot, training_log, metrics = create_training_log_supplement_sample()

        record = self.tracker.step1_import_snapshot(snapshot, "data_engineer")
        track_id = record.track_id
        print(f"  Step 1 完成: 状态={record.status.value}")

        record, review_pkg = self.tracker.step2_check_training_log(
            track_id, training_log, "推荐策略老唐"
        )
        self.assertEqual(record.status, WeightStatus.FROM_TRAINING_LOG)
        self.assertIsNotNone(review_pkg)
        print(f"  Step 2 完成: 状态={record.status.value}, 冲突数={len(record.conflicts)}")
        for i, c in enumerate(record.conflicts, 1):
            print(f"    冲突[{i}]: {c.description}")

        record = self.tracker.resolve_conflict(
            track_id,
            ReviewDecision.CONFIRM,
            "数据科学家B",
            "确认从TensorBoard回溯补录"
        )
        print(f"  复核完成: 决策={record.review_decision.value}")

        record = self.tracker.step3_update_stratified_metrics(
            track_id, metrics, "system"
        )
        self.assertEqual(len(record.stratified_metrics), 3)
        for m in record.stratified_metrics:
            self.assertEqual(m.source, "training_log_backfill")
        print(f"  Step 3 完成: 分层指标数={len(record.stratified_metrics)}")
        print("  ✅ 从训练日志补录场景通过")

    def test_conflict_evidence_listed_clearly(self):
        print("\n=== 测试场景四：冲突证据清晰列出，不自动拍板 ===")
        snapshot, training_log, _ = create_threshold_old_report_sample()

        record = self.tracker.step1_import_snapshot(snapshot, "data_engineer")
        track_id = record.track_id

        record, review_pkg = self.tracker.step2_check_training_log(
            track_id, training_log, "推荐策略老唐"
        )

        self.assertIsNotNone(review_pkg)
        self.assertEqual(len(review_pkg.conflicts), 2)
        print(f"  生成复核包，包含 {len(review_pkg.conflicts)} 项冲突证据:")
        for i, c in enumerate(review_pkg.conflicts, 1):
            print(f"    [{i}] 字段: {c.field}")
            print(f"        快照值: {c.snapshot_value}")
            print(f"        日志值: {c.log_value}")
            print(f"        说明: {c.description}")

        self.assertEqual(record.review_decision, ReviewDecision.PENDING)
        self.assertIsNone(record.reviewer)
        print(f"  ✅ 未自动拍板，状态: {record.review_decision.value}")
        print("  ✅ 冲突证据清晰列出场景通过")

    def test_export_review_and_replay(self):
        print("\n=== 测试场景五：复盘记录和重跑命令导出 ===")
        snapshot, training_log, metrics = create_normal_sample()

        record = self.tracker.step1_import_snapshot(snapshot, "data_engineer")
        track_id = record.track_id
        self.tracker.step2_check_training_log(track_id, training_log, "推荐策略老唐")
        self.tracker.step3_update_stratified_metrics(track_id, metrics, "system")

        review_text = self.tracker.export_review_record(track_id)
        self.assertIn("样本权重异常追踪 - 复盘记录", review_text)
        self.assertIn("特征快照信息", review_text)
        self.assertIn("训练日志信息", review_text)
        self.assertIn("分层指标", review_text)
        self.assertIn("操作历史", review_text)
        print("  ✅ 复盘记录导出成功")

        replay_commands = self.tracker.export_replay_commands(track_id)
        self.assertTrue(any("import-snapshot" in cmd for cmd in replay_commands))
        self.assertTrue(any("check-log" in cmd for cmd in replay_commands))
        self.assertTrue(any("update-metrics" in cmd for cmd in replay_commands))
        self.assertTrue(any("show" in cmd for cmd in replay_commands))
        print("  ✅ 重跑命令导出成功")
        print("  ✅ 导出功能场景通过")


if __name__ == "__main__":
    print("=" * 60)
    print("样本权重异常追踪 - 核心功能测试")
    print("=" * 60)

    unittest.main(verbosity=0)
