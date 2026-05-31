import unittest
from datetime import datetime
from typing import Set, List

from models import (
    MaterialInfo, TrainingLog, ThresholdConfig, RollbackRecord,
    RollbackStatus, AbnormalType, UserFriendlyError
)
from storage import Storage
from anomaly_detector import AnomalyDetector
from version_comparator import VersionComparator
from threshold_rollback_service import ThresholdRollbackService
from exceptions import ThresholdRollbackException


class TestStorage(unittest.TestCase):
    def setUp(self):
        self.storage = Storage()

    def test_save_and_get_material(self):
        material = MaterialInfo(material_id="mat_001", name="测试材料", version="v1.0")
        self.storage.save_material(material)
        retrieved = self.storage.get_material("mat_001")
        self.assertEqual(retrieved.material_id, "mat_001")
        self.assertEqual(retrieved.name, "测试材料")

    def test_save_and_get_training_log(self):
        log1 = TrainingLog(
            log_id="log_001", material_id="mat_001", version="v1.0",
            metrics={"accuracy": 0.95}, feature_stats={"total_samples": 1000},
            label_mapping={"cat": "0", "dog": "1"}, training_set_ids=["s1", "s2", "s3"]
        )
        log2 = TrainingLog(
            log_id="log_002", material_id="mat_001", version="v1.1",
            metrics={"accuracy": 0.96}, feature_stats={"total_samples": 1000},
            label_mapping={"cat": "0", "dog": "1"}, training_set_ids=["s1", "s2", "s4"]
        )
        self.storage.save_training_log(log1)
        self.storage.save_training_log(log2)

        latest = self.storage.get_latest_log("mat_001")
        self.assertEqual(latest.log_id, "log_002")

        all_logs = self.storage.get_all_logs("mat_001")
        self.assertEqual(len(all_logs), 2)

    def test_get_log_by_hash(self):
        log = TrainingLog(
            log_id="log_001", material_id="mat_001", version="v1.0",
            metrics={"accuracy": 0.95}, feature_stats={"total_samples": 1000},
            label_mapping={"cat": "0", "dog": "1"}, training_set_ids=["s1", "s2", "s3"]
        )
        self.storage.save_training_log(log)
        content_hash = log.content_hash()
        retrieved = self.storage.get_log_by_hash("mat_001", content_hash)
        self.assertEqual(retrieved.log_id, "log_001")

    def test_save_and_mark_rollback_record(self):
        record = RollbackRecord(
            record_id="rec_001", material_id="mat_001",
            material_name="测试材料", log_id="log_001",
            log_version="v1.0", status=RollbackStatus.SUCCESS
        )
        self.storage.save_rollback_record(record)

        retrieved = self.storage.get_active_successful_record("mat_001")
        self.assertEqual(retrieved.record_id, "rec_001")
        self.assertFalse(retrieved.is_historical)

        self.storage.mark_record_as_historical("rec_001", "rec_002")
        historical = self.storage.get_active_successful_record("mat_001")
        self.assertIsNone(historical)


class TestAnomalyDetector(unittest.TestCase):
    def setUp(self):
        self.grayscale_ids: Set[str] = {"g1", "g2", "g3", "g4", "g5"}
        self.detector = AnomalyDetector(grayscale_set_ids=self.grayscale_ids)

    def test_detect_metric_changed(self):
        old_log = TrainingLog(
            log_id="log_old", material_id="mat_001", version="v1.0",
            metrics={"accuracy": 0.95, "precision": 0.92},
            feature_stats={}, label_mapping={}, training_set_ids=[]
        )
        new_log = TrainingLog(
            log_id="log_new", material_id="mat_001", version="v1.1",
            metrics={"accuracy": 0.96, "recall": 0.90},
            feature_stats={}, label_mapping={}, training_set_ids=[]
        )

        abnormalities = self.detector.detect_all(new_log, old_log)
        self.assertEqual(len(abnormalities), 1)
        self.assertEqual(abnormalities[0].abnormal_type, AbnormalType.METRIC_CHANGED)
        self.assertIn("precision", abnormalities[0].details["missing_metrics"])
        self.assertIn("recall", abnormalities[0].details["new_metrics"])
        self.assertIn("accuracy", abnormalities[0].details["changed_values"])

    def test_detect_data_leakage(self):
        log = TrainingLog(
            log_id="log_001", material_id="mat_001", version="v1.0",
            metrics={}, feature_stats={}, label_mapping={},
            training_set_ids=["s1", "s2", "g1", "g2", "g3"]
        )

        abnormalities = self.detector.detect_all(log, None)
        self.assertEqual(len(abnormalities), 1)
        self.assertEqual(abnormalities[0].abnormal_type, AbnormalType.DATA_LEAKAGE)
        self.assertEqual(abnormalities[0].details["leaked_sample_count"], 3)
        self.assertEqual(abnormalities[0].details["leakage_ratio"], 0.6)

    def test_detect_label_missing(self):
        log = TrainingLog(
            log_id="log_001", material_id="mat_001", version="v1.0",
            metrics={}, feature_stats={},
            label_mapping={"cat": "0", "dog": "1"},
            training_set_ids=[]
        )
        current_labels = ["cat", "dog", "bird", "fish"]

        abnormalities = self.detector.detect_all(log, None, current_labels)
        self.assertEqual(len(abnormalities), 1)
        self.assertEqual(abnormalities[0].abnormal_type, AbnormalType.LABEL_MISSING)
        self.assertEqual(abnormalities[0].details["missing_count"], 2)
        self.assertIn("bird", abnormalities[0].details["missing_labels"])
        self.assertIn("fish", abnormalities[0].details["missing_labels"])

    def test_no_abnormalities(self):
        old_log = TrainingLog(
            log_id="log_old", material_id="mat_001", version="v1.0",
            metrics={"accuracy": 0.95}, feature_stats={},
            label_mapping={"cat": "0", "dog": "1"},
            training_set_ids=["s1", "s2"]
        )
        new_log = TrainingLog(
            log_id="log_new", material_id="mat_001", version="v1.0",
            metrics={"accuracy": 0.95}, feature_stats={},
            label_mapping={"cat": "0", "dog": "1"},
            training_set_ids=["s1", "s2"]
        )
        current_labels = ["cat", "dog"]

        abnormalities = self.detector.detect_all(new_log, old_log, current_labels)
        self.assertEqual(len(abnormalities), 0)


class TestVersionComparator(unittest.TestCase):
    def setUp(self):
        self.comparator = VersionComparator()

    def test_compare_metrics(self):
        old_log = TrainingLog(
            log_id="log_old", material_id="mat_001", version="v1.0",
            metrics={"accuracy": 0.95, "precision": 0.92},
            feature_stats={}, label_mapping={}, training_set_ids=[]
        )
        new_log = TrainingLog(
            log_id="log_new", material_id="mat_001", version="v1.1",
            metrics={"accuracy": 0.96, "recall": 0.90},
            feature_stats={}, label_mapping={}, training_set_ids=[]
        )

        result = self.comparator.compare(new_log, old_log)
        self.assertTrue(result["has_changes"])
        self.assertIn("precision", result["changes"]["metrics"]["removed"])
        self.assertIn("recall", result["changes"]["metrics"]["added"])
        self.assertEqual(result["changes"]["metrics"]["changed"]["accuracy"]["old"], 0.95)
        self.assertEqual(result["changes"]["metrics"]["changed"]["accuracy"]["new"], 0.96)

    def test_compare_label_mapping(self):
        old_log = TrainingLog(
            log_id="log_old", material_id="mat_001", version="v1.0",
            metrics={}, feature_stats={},
            label_mapping={"cat": "0", "dog": "1", "bird": "2"},
            training_set_ids=[]
        )
        new_log = TrainingLog(
            log_id="log_new", material_id="mat_001", version="v1.1",
            metrics={}, feature_stats={},
            label_mapping={"cat": "0", "dog": "2", "fish": "3"},
            training_set_ids=[]
        )

        result = self.comparator.compare(new_log, old_log)
        self.assertTrue(result["has_changes"])
        self.assertIn("bird", result["changes"]["label_mapping"]["removed"])
        self.assertIn("fish", result["changes"]["label_mapping"]["added"])
        self.assertEqual(result["changes"]["label_mapping"]["remapped"]["dog"]["old"], "1")
        self.assertEqual(result["changes"]["label_mapping"]["remapped"]["dog"]["new"], "2")

    def test_compare_training_sets(self):
        old_log = TrainingLog(
            log_id="log_old", material_id="mat_001", version="v1.0",
            metrics={}, feature_stats={}, label_mapping={},
            training_set_ids=["s1", "s2", "s3"]
        )
        new_log = TrainingLog(
            log_id="log_new", material_id="mat_001", version="v1.1",
            metrics={}, feature_stats={}, label_mapping={},
            training_set_ids=["s1", "s4", "s5"]
        )

        result = self.comparator.compare(new_log, old_log)
        self.assertTrue(result["has_changes"])
        self.assertEqual(result["changes"]["training_set"]["added_count"], 2)
        self.assertEqual(result["changes"]["training_set"]["removed_count"], 2)

    def test_no_changes(self):
        log1 = TrainingLog(
            log_id="log_1", material_id="mat_001", version="v1.0",
            metrics={"accuracy": 0.95}, feature_stats={"f1": 0.5},
            label_mapping={"cat": "0"}, training_set_ids=["s1"]
        )
        log2 = TrainingLog(
            log_id="log_2", material_id="mat_001", version="v1.0",
            metrics={"accuracy": 0.95}, feature_stats={"f1": 0.5},
            label_mapping={"cat": "0"}, training_set_ids=["s1"]
        )

        result = self.comparator.compare(log2, log1)
        self.assertFalse(result["has_changes"])

    def test_format_changes_for_display(self):
        old_log = TrainingLog(
            log_id="log_old", material_id="mat_001", version="v1.0",
            metrics={"accuracy": 0.95}, feature_stats={}, label_mapping={},
            training_set_ids=[]
        )
        new_log = TrainingLog(
            log_id="log_new", material_id="mat_001", version="v1.1",
            metrics={"accuracy": 0.96, "precision": 0.92},
            feature_stats={}, label_mapping={}, training_set_ids=[]
        )

        result = self.comparator.compare(new_log, old_log)
        display = self.comparator.format_changes_for_display(result)
        self.assertIn("指标新增 1 项", display)
        self.assertIn("指标值变动 1 项", display)
        self.assertIn("precision", display)
        self.assertIn("accuracy", display)


class TestThresholdRollbackService(unittest.TestCase):
    def setUp(self):
        self.service = ThresholdRollbackService()
        self.service.upload_material("mat_001", "测试材料", "v1.0")
        self.configs = [
            ThresholdConfig(metric_name="accuracy", threshold=0.9, min_coverage=0.8),
            ThresholdConfig(metric_name="precision", threshold=0.85, min_coverage=0.8),
        ]

    def _upload_test_log(self, log_id="log_001", version="v1.0", metrics=None):
        if metrics is None:
            metrics = {"accuracy": 0.95, "precision": 0.92}
        return self.service.upload_training_log(
            log_id=log_id,
            material_id="mat_001",
            version=version,
            metrics=metrics,
            feature_stats={"total_samples": 1000, "valid_samples": 950},
            label_mapping={"cat": "0", "dog": "1"},
            training_set_ids=["s1", "s2", "s3", "s4", "s5"],
        )

    def test_upload_training_log_with_version_conflict(self):
        self._upload_test_log("log_001", "v1.0")
        result = self._upload_test_log(
            "log_002", "v1.1",
            metrics={"accuracy": 0.96, "recall": 0.90}
        )
        self.assertTrue(result["version_conflict"])
        self.assertIsNotNone(result["comparison_result"])
        self.assertIn("指标新增 1 项", result["message"])
        self.assertIn("指标删除 1 项", result["message"])

    def test_idempotent_check_prevents_duplicate(self):
        self._upload_test_log("log_001", "v1.0")
        record = self.service.execute_rollback("mat_001", self.configs)
        self.assertEqual(record.status, RollbackStatus.SUCCESS)

        with self.assertRaises(ThresholdRollbackException) as context:
            self.service.execute_rollback("mat_001", self.configs)

        self.assertEqual(context.exception.friendly_error.error_code, "IDEMPOTENT_001")
        self.assertIn("之前已经成功完成过", context.exception.friendly_error.message)
        self.assertIn("强制重新计算", context.exception.friendly_error.suggestion)

    def test_force_recalculate_with_historical_marking(self):
        self._upload_test_log("log_001", "v1.0")
        record1 = self.service.execute_rollback("mat_001", self.configs)
        self.assertEqual(record1.status, RollbackStatus.SUCCESS)

        self.service.upload_training_log(
            log_id="log_002",
            material_id="mat_001",
            version="v1.1",
            metrics={"accuracy": 0.95, "precision": 0.92},
            feature_stats={"total_samples": 1000, "valid_samples": 950},
            label_mapping={"cat": "0", "dog": "1"},
            training_set_ids=["s6", "s7", "s8", "s9", "s10"],
        )
        record2 = self.service.execute_rollback(
            "mat_001", self.configs,
            force_recalculate=True,
        )

        self.assertEqual(record2.status, RollbackStatus.SUCCESS)
        self.assertEqual(record2.previous_record_id, record1.record_id)
        self.assertIsNotNone(record2.version_changes)
        self.assertTrue(record2.version_changes["has_changes"])
        self.assertIn("训练日志版本变更提醒", record2.human_message)
        self.assertIn("训练集新增 5 个样本", record2.human_message)

        old_record = self.service.storage._rollback_records[record1.record_id]
        self.assertTrue(old_record.is_historical)

    def test_detect_abnormal_metric_change(self):
        self._upload_test_log("log_001", "v1.0")
        self.service.execute_rollback("mat_001", self.configs, force_recalculate=True)

        self._upload_test_log(
            "log_002", "v1.1",
            metrics={"accuracy": 0.80, "precision": 0.92}
        )

        record = self.service.execute_rollback("mat_001", self.configs)
        self.assertEqual(record.status, RollbackStatus.ABNORMAL)
        self.assertEqual(len(record.abnormalities), 1)
        self.assertEqual(record.abnormalities[0].abnormal_type, AbnormalType.METRIC_CHANGED)
        self.assertIn("需人工确认", record.human_message)
        self.assertIn("🔄 指标口径变化", record.human_message)
        self.assertIn("accuracy", record.human_message)

    def test_detect_abnormal_data_leakage(self):
        self.service.upload_training_log(
            log_id="log_001",
            material_id="mat_001",
            version="v1.0",
            metrics={"accuracy": 0.95, "precision": 0.92},
            feature_stats={"total_samples": 1000, "valid_samples": 950},
            label_mapping={"cat": "0", "dog": "1"},
            training_set_ids=["s1", "s2", "g1", "g2", "g3"],
        )

        grayscale_ids = {"g1", "g2", "g3", "g4", "g5"}
        record = self.service.execute_rollback(
            "mat_001", self.configs, grayscale_set_ids=grayscale_ids
        )

        self.assertEqual(record.status, RollbackStatus.ABNORMAL)
        self.assertEqual(len(record.abnormalities), 1)
        self.assertEqual(record.abnormalities[0].abnormal_type, AbnormalType.DATA_LEAKAGE)
        self.assertIn("⚠️  训练集泄漏", record.human_message)
        self.assertIn("3 个样本同时出现在", record.human_message)
        self.assertIn("60.0%", record.human_message)

    def test_detect_abnormal_label_missing(self):
        self._upload_test_log("log_001", "v1.0")

        current_labels = ["cat", "dog", "bird", "fish"]
        record = self.service.execute_rollback(
            "mat_001", self.configs, current_labels=current_labels
        )

        self.assertEqual(record.status, RollbackStatus.ABNORMAL)
        self.assertEqual(len(record.abnormalities), 1)
        self.assertEqual(record.abnormalities[0].abnormal_type, AbnormalType.LABEL_MISSING)
        self.assertIn("🏷️  标签漏映射", record.human_message)
        self.assertIn("bird", record.human_message)
        self.assertIn("fish", record.human_message)

    def test_confirm_and_continue_after_abnormal(self):
        self._upload_test_log("log_001", "v1.0")

        current_labels = ["cat", "dog", "bird"]
        record = self.service.execute_rollback(
            "mat_001", self.configs, current_labels=current_labels
        )
        self.assertEqual(record.status, RollbackStatus.ABNORMAL)

        with self.assertRaises(ValueError):
            self.service.confirm_and_continue(record.record_id)

        confirmed = self.service.confirm_and_continue(
            record.record_id, approve_label_missing=True
        )
        self.assertEqual(confirmed.status, RollbackStatus.SUCCESS)
        self.assertIn("✅ 阈值灰度回滚执行成功", confirmed.human_message)

    def test_ignore_abnormal_flags(self):
        self._upload_test_log("log_001", "v1.0")

        current_labels = ["cat", "dog", "bird"]
        record = self.service.execute_rollback(
            "mat_001", self.configs,
            current_labels=current_labels,
            ignore_label_missing=True
        )

        self.assertEqual(record.status, RollbackStatus.SUCCESS)
        self.assertEqual(len(record.abnormalities), 1)

    def test_rollback_triggered_when_threshold_not_met(self):
        self.service.upload_training_log(
            log_id="log_001",
            material_id="mat_001",
            version="v1.0",
            metrics={"accuracy": 0.85, "precision": 0.80},
            feature_stats={"total_samples": 1000, "valid_samples": 950},
            label_mapping={"cat": "0", "dog": "1"},
            training_set_ids=["s1", "s2", "s3"],
        )

        configs = [
            ThresholdConfig(metric_name="accuracy", threshold=0.9, min_coverage=0.8),
        ]
        record = self.service.execute_rollback("mat_001", configs)

        self.assertEqual(record.status, RollbackStatus.FAILED)
        self.assertIn("❌ 阈值灰度回滚执行完成", record.human_message)
        self.assertIn("（已回滚）", record.human_message)
        self.assertTrue(record.grayscale_result["rollback_applied"]["accuracy"])

    def test_invalid_threshold_config(self):
        configs = [
            ThresholdConfig(metric_name="accuracy", threshold=1.5, min_coverage=0.8),
        ]

        with self.assertRaises(ThresholdRollbackException) as context:
            self.service.execute_rollback("mat_001", configs)

        self.assertEqual(context.exception.friendly_error.error_code, "VALIDATION_001")
        self.assertIn("1.5", context.exception.friendly_error.message)

    def test_get_version_change_reminder(self):
        self._upload_test_log("log_001", "v1.0")
        self._upload_test_log(
            "log_002", "v1.1",
            metrics={"accuracy": 0.96, "precision": 0.93, "recall": 0.90}
        )

        reminder = self.service.get_version_change_reminder("mat_001")
        self.assertIsNotNone(reminder)
        self.assertIn("指标新增 1 项", reminder)
        self.assertIn("指标值变动 2 项", reminder)

    def test_same_content_log_skipped(self):
        result1 = self._upload_test_log("log_001", "v1.0")
        result2 = self._upload_test_log("log_002", "v1.0")

        self.assertIn("已跳过重复上传", result2["message"])
        self.assertEqual(result2["existing_log_id"], "log_001")

        logs = self.service.storage.get_all_logs("mat_001")
        self.assertEqual(len(logs), 1)


class TestIntegration(unittest.TestCase):
    def test_full_workflow_with_abnormal(self):
        service = ThresholdRollbackService()

        service.upload_material("mat_001", "用户画像模型", "v2.0")

        service.upload_training_log(
            log_id="log_v1",
            material_id="mat_001",
            version="v1.0",
            metrics={"accuracy": 0.95, "precision": 0.92},
            feature_stats={"total_samples": 10000, "valid_samples": 9800},
            label_mapping={"高价值": "0", "中价值": "1", "低价值": "2"},
            training_set_ids=[f"train_{i}" for i in range(100)],
        )

        configs = [
            ThresholdConfig(metric_name="accuracy", threshold=0.9, min_coverage=0.9),
            ThresholdConfig(metric_name="precision", threshold=0.88, min_coverage=0.9),
        ]

        record1 = service.execute_rollback("mat_001", configs)
        self.assertEqual(record1.status, RollbackStatus.SUCCESS)
        self.assertIn("✅ 阈值灰度回滚执行成功", record1.human_message)

        with self.assertRaises(ThresholdRollbackException) as ctx:
            service.execute_rollback("mat_001", configs)
        self.assertEqual(ctx.exception.friendly_error.error_code, "IDEMPOTENT_001")

        upload_result = service.upload_training_log(
            log_id="log_v2",
            material_id="mat_001",
            version="v2.0",
            metrics={"accuracy": 0.82, "precision": 0.90, "recall": 0.88},
            feature_stats={"total_samples": 10000, "valid_samples": 9800},
            label_mapping={"高价值": "0", "中价值": "1", "低价值": "2", "未知": "3"},
            training_set_ids=[f"train_{i}" for i in range(50, 150)],
        )
        self.assertTrue(upload_result["version_conflict"])
        self.assertIn("指标新增 1 项", upload_result["message"])

        grayscale_ids = {f"train_{i}" for i in range(120, 140)} | {f"gray_{i}" for i in range(20)}
        current_labels = ["高价值", "中价值", "低价值", "未知", "流失"]

        record2 = service.execute_rollback(
            "mat_001", configs,
            grayscale_set_ids=grayscale_ids,
            current_labels=current_labels,
            force_recalculate=True,
        )

        self.assertEqual(record2.status, RollbackStatus.ABNORMAL)
        self.assertEqual(len(record2.abnormalities), 3)

        types = {a.abnormal_type for a in record2.abnormalities}
        self.assertEqual(types, {
            AbnormalType.METRIC_CHANGED,
            AbnormalType.DATA_LEAKAGE,
            AbnormalType.LABEL_MISSING,
        })

        self.assertIn("🔄 指标口径变化", record2.human_message)
        self.assertIn("⚠️  训练集泄漏", record2.human_message)
        self.assertIn("🏷️  标签漏映射", record2.human_message)
        self.assertIn("流失", record2.human_message)
        self.assertIn("训练日志版本变更提醒", record2.human_message)

        record3 = service.confirm_and_continue(
            record2.record_id,
            approve_metric_change=True,
            approve_data_leakage=True,
            approve_label_missing=True,
        )

        self.assertEqual(record3.status, RollbackStatus.FAILED)
        self.assertIn("❌ 阈值灰度回滚执行完成", record3.human_message)
        self.assertIn("（已回滚）", record3.human_message)

        old_record = service.storage._rollback_records[record1.record_id]
        self.assertTrue(old_record.is_historical)

        reminder = service.get_version_change_reminder("mat_001")
        self.assertIsNotNone(reminder)
        self.assertIn("版本变化汇总", reminder)


if __name__ == "__main__":
    unittest.main()
