#!/usr/bin/env python3
"""核心功能测试 - 验证关键场景

测试内容：
1. 状态机正确性 - 验证状态流转规则
2. 安全检测 - 离线设备、版本回退、失败重复计数
3. 报告一致性 - 终端/JSON/Markdown三者数据一致
4. 回滚机制 - 失败设备自动回滚
5. 历史管理 - 保存和复盘
"""

import sys
import json
import unittest
from datetime import datetime

sys.path.insert(0, "/Users/lzy/pro/solo/workspaces/zy71379")

from iot_firmware_panel import (
    # Models
    Device, DeviceStatus, GrayscaleState, BatchState, ConfirmReason,
    # State Machine
    GrayscaleStateMachine, BatchStateMachine, StateTransitionError,
    # Batch Control
    SecurityChecker, BatchController,
    # Rollback
    RollbackEngine, LogAggregator,
    # Reports
    ReportExporter,
    # History
    HistoryManager,
    # Main
    GrayscalePanel,
)

import tempfile
import shutil


class TestStateMachine(unittest.TestCase):
    """测试状态机"""

    def setUp(self):
        self.device = Device(
            original_device_id="TEST-001",
            original_firmware_version="1.0.0",
            original_batch="test",
            original_online_status=DeviceStatus.ONLINE
        )

    def test_normal_flow(self):
        """测试正常流转: PENDING → ROLLING → SUCCESS"""
        self.assertEqual(self.device.processed_current_state, GrayscaleState.PENDING)

        GrayscaleStateMachine.transition(self.device, GrayscaleState.ROLLING)
        self.assertEqual(self.device.processed_current_state, GrayscaleState.ROLLING)

        GrayscaleStateMachine.transition(self.device, GrayscaleState.SUCCESS, reason="升级成功")
        self.assertEqual(self.device.processed_current_state, GrayscaleState.SUCCESS)
        self.assertIn("升级成功", self.device.processed_upgrade_log or "")

    def test_failure_flow(self):
        """测试失败流转: PENDING → ROLLING → FAILED → ROLLBACK → ROLLED_BACK"""
        GrayscaleStateMachine.transition(self.device, GrayscaleState.ROLLING)
        GrayscaleStateMachine.transition(self.device, GrayscaleState.FAILED, reason="升级失败")

        self.assertEqual(self.device.processed_failure_count, 1)
        self.assertIsNotNone(self.device.processed_last_failure_time)

        GrayscaleStateMachine.transition(self.device, GrayscaleState.ROLLBACK)
        GrayscaleStateMachine.transition(self.device, GrayscaleState.ROLLED_BACK, reason="回滚成功")

        self.assertEqual(self.device.processed_current_state, GrayscaleState.ROLLED_BACK)

    def test_invalid_transition(self):
        """测试不允许的状态转换"""
        with self.assertRaises(StateTransitionError):
            GrayscaleStateMachine.transition(self.device, GrayscaleState.SUCCESS)

        with self.assertRaises(StateTransitionError):
            GrayscaleStateMachine.transition(self.device, GrayscaleState.FAILED)

    def test_pending_confirm_flow(self):
        """测试待确认流程"""
        reasons = [ConfirmReason.OFFLINE_DEVICE]
        GrayscaleStateMachine.mark_pending_confirm(self.device, reasons)

        self.assertEqual(self.device.processed_current_state, GrayscaleState.PENDING_CONFIRM)
        self.assertEqual(self.device.processed_confirm_reasons, reasons)
        self.assertTrue(self.device.needs_confirm())

        GrayscaleStateMachine.confirm_and_proceed(self.device, confirmed=True)
        self.assertEqual(self.device.processed_current_state, GrayscaleState.PENDING)
        self.assertEqual(self.device.processed_confirm_reasons, [])
        self.assertFalse(self.device.needs_confirm())

    def test_failure_count_increment(self):
        """测试失败计数正确累加"""
        GrayscaleStateMachine.transition(self.device, GrayscaleState.ROLLING)
        for i in range(3):
            GrayscaleStateMachine.transition(self.device, GrayscaleState.FAILED, reason=f"失败{i+1}")
            if i < 2:
                GrayscaleStateMachine.transition(self.device, GrayscaleState.ROLLING)

        self.assertEqual(self.device.processed_failure_count, 3)


class TestSecurityChecker(unittest.TestCase):
    """测试安全检测"""

    def test_offline_device_detection(self):
        """测试离线设备检测"""
        device = Device(
            original_device_id="OFFLINE-001",
            original_firmware_version="1.0.0",
            original_batch="test",
            original_online_status=DeviceStatus.OFFLINE
        )

        result = SecurityChecker.check_device(device, "2.0.0")
        self.assertTrue(result.needs_confirm)
        self.assertIn(ConfirmReason.OFFLINE_DEVICE, result.reasons)

    def test_version_downgrade_detection(self):
        """测试版本回退检测"""
        device = Device(
            original_device_id="DOWNGRADE-001",
            original_firmware_version="2.0.0",
            original_batch="test",
            original_online_status=DeviceStatus.ONLINE
        )

        result = SecurityChecker.check_device(device, "1.0.0")
        self.assertTrue(result.needs_confirm)
        self.assertIn(ConfirmReason.VERSION_DOWNGRADE, result.reasons)

    def test_too_many_failures_detection(self):
        """测试失败重复计数检测"""
        device = Device(
            original_device_id="FAIL-001",
            original_firmware_version="1.0.0",
            original_batch="test",
            original_online_status=DeviceStatus.ONLINE,
            processed_failure_count=3
        )

        result = SecurityChecker.check_device(device, "2.0.0")
        self.assertTrue(result.needs_confirm)
        self.assertIn(ConfirmReason.TOO_MANY_FAILURES, result.reasons)

    def test_clean_device_passes(self):
        """测试正常设备通过检测"""
        device = Device(
            original_device_id="OK-001",
            original_firmware_version="1.0.0",
            original_batch="test",
            original_online_status=DeviceStatus.ONLINE
        )

        result = SecurityChecker.check_device(device, "2.0.0")
        self.assertFalse(result.needs_confirm)
        self.assertEqual(len(result.reasons), 0)

    def test_multiple_reasons(self):
        """测试多个原因同时触发"""
        device = Device(
            original_device_id="MULTI-001",
            original_firmware_version="2.0.0",
            original_batch="test",
            original_online_status=DeviceStatus.OFFLINE,
            processed_failure_count=5
        )

        result = SecurityChecker.check_device(device, "1.0.0")
        self.assertTrue(result.needs_confirm)
        self.assertEqual(len(result.reasons), 3)
        self.assertIn(ConfirmReason.OFFLINE_DEVICE, result.reasons)
        self.assertIn(ConfirmReason.VERSION_DOWNGRADE, result.reasons)
        self.assertIn(ConfirmReason.TOO_MANY_FAILURES, result.reasons)


class TestReportConsistency(unittest.TestCase):
    """测试报告一致性 - 终端/JSON/Markdown三者数据一致"""

    def setUp(self):
        self.panel = GrayscalePanel()
        devices = GrayscalePanel.create_sample_devices()
        self.result = self.panel.run_full_workflow(
            devices=devices,
            target_version="2.0.0",
            task_id="TEST-CONSISTENCY",
            task_name="一致性测试任务",
            save_history=False
        )

    def test_statistics_consistency(self):
        """测试统计数据在三种格式中一致"""
        reports = self.result["reports"]

        json_data = json.loads(reports["json"])
        stats_json = json_data["summary"]["statistics"]
        success_rate_json = json_data["summary"]["success_rate"]

        terminal_text = reports["terminal"]
        md_text = reports["markdown"]

        self.assertIn(f"成功: {stats_json['success']}", terminal_text)
        self.assertIn(f"失败: {stats_json['failed']}", terminal_text)
        self.assertIn(f"待确认: {stats_json['pending_confirm']}", terminal_text)
        self.assertIn(f"{success_rate_json:.1f}%", terminal_text)

        self.assertIn(f"**成功**: {stats_json['success']}", md_text)
        self.assertIn(f"**失败**: {stats_json['failed']}", md_text)
        self.assertIn(f"**待确认**: {stats_json['pending_confirm']}", md_text)
        self.assertIn(f"{success_rate_json:.1f}%", md_text)

    def test_conclusion_consistency(self):
        """测试结论在三种格式中一致"""
        reports = self.result["reports"]
        json_data = json.loads(reports["json"])
        conclusion_msg = json_data["conclusion"]["message"]
        conclusion_level = json_data["conclusion"]["level"]

        self.assertIn(conclusion_msg, reports["terminal"])
        self.assertIn(conclusion_level.upper(), reports["terminal"])

        self.assertIn(conclusion_msg, reports["markdown"])
        self.assertIn(conclusion_level.upper(), reports["markdown"])

    def test_device_data_consistency(self):
        """测试设备数据在三种格式中一致"""
        reports = self.result["reports"]
        json_data = json.loads(reports["json"])

        for batch_data in json_data["batches"]:
            batch_id = batch_data["original"]["batch_id"]
            self.assertIn(batch_id, reports["terminal"])
            self.assertIn(batch_id, reports["markdown"])

            for dev_data in batch_data["devices"]:
                dev_id = dev_data["original"]["device_id"]
                self.assertIn(dev_id, reports["terminal"])
                self.assertIn(dev_id, reports["markdown"])

    def test_unified_data_source(self):
        """测试三种格式使用同一数据源"""
        task = self.result["task"]
        rollback_engine = self.result["rollback_engine"]
        decision_logs = self.result["decision_logs"]

        unified = ReportExporter.build_unified_data(task, rollback_engine, decision_logs)

        json_from_unified = ReportExporter.export_json(unified)
        terminal_from_unified = ReportExporter.export_terminal(unified)
        md_from_unified = ReportExporter.export_markdown(unified)

        json_data = json.loads(json_from_unified)
        self.assertIn("statistics", json_data["summary"])
        self.assertIn("conclusion", json_data)

        stats = json_data["summary"]["statistics"]
        self.assertIn(f"成功: {stats['success']}", terminal_from_unified)
        self.assertIn(f"**成功**: {stats['success']}", md_from_unified)

        self.assertEqual(json_data["conclusion"]["message"],
                         json.loads(self.result["reports"]["json"])["conclusion"]["message"])
        self.assertEqual(json_data["summary"]["statistics"],
                         json.loads(self.result["reports"]["json"])["summary"]["statistics"])


class TestRollbackEngine(unittest.TestCase):
    """测试回滚引擎"""

    def setUp(self):
        self.rollback_engine = RollbackEngine()
        self.device = Device(
            original_device_id="RB-TEST-001",
            original_firmware_version="1.0.0",
            original_batch="test",
            original_online_status=DeviceStatus.ONLINE,
            processed_target_version="2.0.0"
        )
        GrayscaleStateMachine.transition(self.device, GrayscaleState.ROLLING)
        GrayscaleStateMachine.transition(self.device, GrayscaleState.FAILED, reason="测试失败")

    def test_rollback_success(self):
        """测试成功回滚"""
        def mock_rollback(dev):
            return True, "回滚成功"

        device, record, log = self.rollback_engine.rollback_device(
            self.device, mock_rollback, reason="测试回滚"
        )

        self.assertEqual(device.processed_current_state, GrayscaleState.ROLLED_BACK)
        self.assertTrue(record.processed_rollback_success)
        self.assertEqual(len(self.rollback_engine.rollback_records), 1)

    def test_rollback_failure(self):
        """测试回滚失败"""
        def mock_rollback(dev):
            return False, "回滚失败"

        device, record, log = self.rollback_engine.rollback_device(
            self.device, mock_rollback, reason="测试回滚失败"
        )

        self.assertEqual(device.processed_current_state, GrayscaleState.ROLLBACK_FAILED)
        self.assertFalse(record.processed_rollback_success)

    def test_rollback_record_created(self):
        """测试回滚记录创建"""
        def mock_rollback(dev):
            return True, "回滚成功"

        device, record, log = self.rollback_engine.rollback_device(
            self.device, mock_rollback, reason="测试"
        )

        self.assertEqual(record.original_device_id, "RB-TEST-001")
        self.assertEqual(record.original_from_version, "2.0.0")
        self.assertEqual(record.original_to_version, "1.0.0")
        self.assertEqual(record.original_reason, "测试")
        self.assertIsNotNone(record.meta_id)

    def test_log_aggregation(self):
        """测试日志聚合"""
        device = Device(
            original_device_id="LOG-TEST-001",
            original_firmware_version="1.0.0",
            original_batch="test",
            original_online_status=DeviceStatus.ONLINE,
            original_failure_log="原始失败日志"
        )
        GrayscaleStateMachine.transition(device, GrayscaleState.ROLLING)
        GrayscaleStateMachine.transition(device, GrayscaleState.FAILED, reason="连接超时")
        GrayscaleStateMachine.transition(device, GrayscaleState.ROLLBACK)
        GrayscaleStateMachine.transition(device, GrayscaleState.ROLLED_BACK, reason="回滚成功")

        agg = LogAggregator.aggregate_device_logs(device)
        self.assertEqual(agg.device_id, "LOG-TEST-001")
        self.assertEqual(agg.failure_count, 1)
        self.assertGreater(len(agg.failure_logs), 0)
        self.assertGreater(len(agg.rollback_logs), 0)


class TestHistoryManager(unittest.TestCase):
    """测试历史管理和复盘"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.panel = GrayscalePanel(history_dir=self.temp_dir)
        self.history_manager = self.panel.history_manager

        devices = GrayscalePanel.create_sample_devices()
        self.result = self.panel.run_full_workflow(
            devices=devices,
            target_version="2.0.0",
            task_id="HISTORY-TEST",
            task_name="历史测试任务",
            save_history=True,
            tags=["测试", "自动化"]
        )
        self.task_id = "HISTORY-TEST"

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def test_save_and_load(self):
        """测试保存和加载快照"""
        data = self.history_manager.load_snapshot(self.task_id)
        self.assertIsNotNone(data)
        self.assertEqual(data["summary"]["task_id"], self.task_id)
        self.assertEqual(data["summary"]["task_name"], "历史测试任务")

    def test_list_history(self):
        """测试查询历史记录"""
        history = self.history_manager.list_history()
        self.assertGreaterEqual(len(history), 1)

        task_ids = [h.task_id for h in history]
        self.assertIn(self.task_id, task_ids)

    def test_replay(self):
        """测试复盘 - 重新生成报告"""
        terminal = self.history_manager.replay(self.task_id, format_type="terminal")
        self.assertIsNotNone(terminal)
        self.assertIn(self.task_id, terminal)
        self.assertIn("历史测试任务", terminal)

        md = self.history_manager.replay(self.task_id, format_type="markdown")
        self.assertIsNotNone(md)
        self.assertIn(self.task_id, md)

        json_str = self.history_manager.replay(self.task_id, format_type="json")
        self.assertIsNotNone(json_str)
        data = json.loads(json_str)
        self.assertEqual(data["summary"]["task_id"], self.task_id)

    def test_explain(self):
        """测试解释功能"""
        explanation = self.history_manager.explain(self.task_id)
        self.assertIsNotNone(explanation)
        self.assertIn("决策复盘", explanation)
        self.assertIn("历史测试任务", explanation)

    def test_tags_and_notes(self):
        """测试标签和备注"""
        self.history_manager.add_tags(self.task_id, ["新增标签"])
        self.history_manager.update_notes(self.task_id, "测试备注")

        history = self.history_manager.list_history()
        record = [h for h in history if h.task_id == self.task_id][0]
        self.assertIn("新增标签", record.tags)
        self.assertIn("测试", record.tags)
        self.assertEqual(record.notes, "测试备注")

    def test_filter_history(self):
        """测试过滤历史记录"""
        all_history = self.history_manager.list_history()
        filtered = self.history_manager.list_history(tags=["测试"])
        self.assertEqual(len(filtered), len(all_history))

        filtered2 = self.history_manager.list_history(tags=["不存在的标签"])
        self.assertEqual(len(filtered2), 0)


class TestEndToEnd(unittest.TestCase):
    """端到端测试 - 完整工作流"""

    def test_full_workflow_with_confirm(self):
        """测试完整工作流，包含人工确认"""
        panel = GrayscalePanel(auto_rollback=True)
        devices = GrayscalePanel.create_sample_devices()

        result = panel.run_full_workflow(
            devices=devices,
            target_version="2.0.0",
            task_id="E2E-TEST",
            task_name="端到端测试",
            save_history=False
        )

        self.assertIsNotNone(result["task"])
        self.assertIn("terminal", result["reports"])
        self.assertIn("json", result["reports"])
        self.assertIn("markdown", result["reports"])

        task = result["task"]
        total = len(task.get_all_devices())
        accounted = (
            task.processed_total_success +
            task.processed_total_failed +
            task.processed_total_pending +
            task.processed_total_rollback +
            task.processed_total_pending_confirm
        )
        self.assertEqual(total, accounted, "设备数统计不匹配")

    def test_original_vs_processed_fields(self):
        """测试原始信息和处理结果字段区分"""
        devices = GrayscalePanel.create_sample_devices()
        panel = GrayscalePanel()

        result = panel.run_full_workflow(
            devices=devices,
            target_version="2.0.0",
            task_id="FIELD-TEST",
            task_name="字段区分测试",
            save_history=False
        )

        json_data = json.loads(result["reports"]["json"])

        for batch in json_data["batches"]:
            self.assertIn("original", batch)
            self.assertIn("processed", batch)
            self.assertIn("meta", batch)

            for device in batch["devices"]:
                self.assertIn("original", device)
                self.assertIn("processed", device)
                self.assertIn("meta", device)

                self.assertIn("device_id", device["original"])
                self.assertIn("firmware_version", device["original"])
                self.assertIn("online_status", device["original"])

                self.assertIn("current_state", device["processed"])
                self.assertIn("target_version", device["processed"])
                self.assertIn("failure_count", device["processed"])

                self.assertNotEqual(
                    device["original"]["firmware_version"],
                    device["processed"]["target_version"],
                    "原始版本和目标版本不应相同（对于正常升级设备）"
                )


if __name__ == "__main__":
    unittest.main(verbosity=2)
