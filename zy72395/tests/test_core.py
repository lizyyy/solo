import os
import sys
import shutil
import unittest
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cryo_tank_level import (
    CryoTankLevelSystem,
    ThreeStepWorkflow,
    VisualizationService,
    SafetyThreshold,
    WorkflowState,
    ReviewStatus,
    CryoTankError,
)
from cryo_tank_level.storage import JsonStorage


class TestCryoTankLevelSystem(unittest.TestCase):
    def setUp(self):
        self.test_data_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "test_data"
        )
        if os.path.exists(self.test_data_dir):
            shutil.rmtree(self.test_data_dir)
        storage = JsonStorage(data_dir=self.test_data_dir)
        self.system = CryoTankLevelSystem(storage)
        self.workflow = ThreeStepWorkflow(self.system)
        self.viz = VisualizationService(self.system)

        self.system.register_sensor("S-001", "A罐顶部", "A罐")
        self.threshold = SafetyThreshold(
            threshold_id="TH-A",
            tank_name="A罐",
            min_safe_level=20.0,
            max_safe_level=80.0,
            warning_low=15.0,
            warning_high=85.0,
        )
        self.system.storage.save_safety_threshold(self.threshold)

    def tearDown(self):
        if os.path.exists(self.test_data_dir):
            shutil.rmtree(self.test_data_dir)

    def test_1_import_inspection_notes_normal(self):
        batch = [
            {
                "sensor_id": "S-001",
                "level_reading": 45.2,
                "temperature": -180.5,
                "handwritten_note": "A罐液位正常，外观无异常",
                "recorded_at": datetime.now().isoformat(),
            }
        ]
        notes, records, mappings = self.system.import_inspection_notes(
            "BATCH-001", batch, imported_by="老唐"
        )
        self.assertEqual(len(notes), 1)
        self.assertEqual(len(records), 1)
        self.assertEqual(len(mappings), 0)
        self.assertEqual(notes[0].imported_by, "老唐")
        self.assertEqual(records[0].status, ReviewStatus.NORMAL)
        self.assertEqual(records[0].workflow_state, WorkflowState.STEP_1_NOTES_IMPORTED)
        print("✅ 测试通过：正常导入巡检备注")

    def test_2_duplicate_import_prevented(self):
        batch = [
            {
                "sensor_id": "S-001",
                "level_reading": 45.2,
                "temperature": -180.5,
                "handwritten_note": "测试重复导入",
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        self.system.import_inspection_notes("BATCH-002", batch)

        with self.assertRaises(CryoTankError) as ctx:
            self.system.import_inspection_notes("BATCH-002", batch)
        self.assertIn("已经导入过了", str(ctx.exception))
        self.assertEqual(ctx.exception.code, "DUPLICATE_IMPORT")
        print("✅ 测试通过：重复导入被阻止")

    def test_3_sensor_restart_id_change_detected(self):
        initial_batch = [
            {
                "sensor_id": "S-001",
                "level_reading": 45.0,
                "temperature": -180.0,
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        self.system.import_inspection_notes("BATCH-003", initial_batch)

        new_batch = [
            {
                "sensor_id": "S-001-NEW",
                "level_reading": 44.8,
                "temperature": -180.2,
                "handwritten_note": "传感器重启后新编号",
                "recorded_at": "2024-01-01T11:00:00",
            }
        ]
        notes, records, mappings = self.system.import_inspection_notes(
            "BATCH-004", new_batch
        )

        self.assertEqual(len(mappings), 1)
        self.assertEqual(mappings[0].old_sensor_id, "S-001")
        self.assertEqual(mappings[0].new_sensor_id, "S-001-NEW")
        self.assertEqual(mappings[0].review_status, ReviewStatus.PENDING_REVIEW)
        self.assertEqual(records[0].status, ReviewStatus.PENDING_REVIEW)
        print("✅ 测试通过：传感器重启编号变化被检测到并标记待复核")

    def test_4_sensor_mapping_review_approved(self):
        initial_batch = [
            {
                "sensor_id": "S-001",
                "level_reading": 45.0,
                "temperature": -180.0,
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        self.system.import_inspection_notes("BATCH-005", initial_batch)

        new_batch = [
            {
                "sensor_id": "S-001-RESTART",
                "level_reading": 44.9,
                "temperature": -180.1,
                "recorded_at": "2024-01-01T11:00:00",
            }
        ]
        notes, records, mappings = self.system.import_inspection_notes(
            "BATCH-006", new_batch
        )
        record_id = records[0].record_id

        result = self.system.review_sensor_mapping(
            "S-001", "S-001-RESTART", approved=True, reviewed_by="安全员张工"
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.review_status, ReviewStatus.REVIEWED)
        self.assertEqual(result.reviewed_by, "安全员张工")

        updated_record = self.system.storage.get_level_record(record_id)
        self.assertEqual(updated_record.status, ReviewStatus.NORMAL)

        old_sensor = self.system.storage.get_sensor("S-001")
        self.assertFalse(old_sensor.is_active)
        new_sensor = self.system.storage.get_sensor("S-001-RESTART")
        self.assertIsNotNone(new_sensor)
        self.assertEqual(new_sensor.physical_location, "A罐顶部")
        print("✅ 测试通过：安全员复核通过，传感器映射生效")

    def test_5_update_single_note_with_history(self):
        batch = [
            {
                "sensor_id": "S-001",
                "level_reading": 50.0,
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        notes, records, _ = self.system.import_inspection_notes("BATCH-007", batch)
        note_id = notes[0].note_id

        updated_note, history = self.system.update_single_note(
            note_id,
            {"level_reading": 55.0, "handwritten_note": "液位修正为55%"},
            changed_by="老唐",
            change_reason="手写记录看错了",
        )

        self.assertEqual(updated_note.level_reading, 55.0)
        self.assertGreaterEqual(len(history), 2)

        level_history = [h for h in history if h.field_name == "level_reading"]
        self.assertEqual(len(level_history), 1)
        self.assertEqual(level_history[0].old_value, 50.0)
        self.assertEqual(level_history[0].new_value, 55.0)
        self.assertEqual(level_history[0].change_reason, "手写记录看错了")
        print("✅ 测试通过：单条备注修改保留历史记录")

    def test_6_three_step_workflow(self):
        batch = [
            {
                "sensor_id": "S-001",
                "level_reading": 60.0,
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        notes, records, _ = self.system.import_inspection_notes("BATCH-008", batch)
        record_id = records[0].record_id

        self.assertEqual(
            self.workflow.get_workflow_state(record_id),
            WorkflowState.STEP_1_NOTES_IMPORTED,
        )

        self.workflow.step_2_review_threshold(
            record_id, threshold_verified=True, reviewed_by="老唐", review_notes="阈值核对无误"
        )
        self.assertEqual(
            self.workflow.get_workflow_state(record_id),
            WorkflowState.STEP_2_THRESHOLD_REVIEWED,
        )

        self.workflow.step_3_update_safety_reminder(
            record_id, safety_note="液位在安全范围内，继续观察", updated_by="老唐"
        )
        self.assertEqual(
            self.workflow.get_workflow_state(record_id),
            WorkflowState.STEP_3_SAFETY_UPDATED,
        )

        summary = self.workflow.get_workflow_summary(record_id)
        self.assertIn("安全提醒", summary["review_notes"])
        print("✅ 测试通过：三步工作流正常执行")

    def test_7_workflow_cannot_skip_step(self):
        batch = [
            {
                "sensor_id": "S-001",
                "level_reading": 60.0,
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        notes, records, _ = self.system.import_inspection_notes("BATCH-009", batch)
        record_id = records[0].record_id

        with self.assertRaises(CryoTankError) as ctx:
            self.workflow.step_3_update_safety_reminder(
                record_id, safety_note="直接跳第三步"
            )
        self.assertIn("请先完成", str(ctx.exception))
        self.assertEqual(ctx.exception.code, "WORKFLOW_NOT_READY")
        print("✅ 测试通过：工作流不允许跳步")

    def test_8_pending_review_cannot_modify(self):
        initial_batch = [
            {
                "sensor_id": "S-001",
                "level_reading": 45.0,
                "temperature": -180.0,
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        self.system.import_inspection_notes("BATCH-010", initial_batch)

        new_batch = [
            {
                "sensor_id": "S-001-RESTART2",
                "level_reading": 44.9,
                "temperature": -180.1,
                "recorded_at": "2024-01-01T11:00:00",
            }
        ]
        notes, records, mappings = self.system.import_inspection_notes(
            "BATCH-011", new_batch
        )
        note_id = notes[0].note_id

        with self.assertRaises(CryoTankError) as ctx:
            self.system.update_single_note(note_id, {"level_reading": 50.0})
        self.assertIn("等待安全员复核", str(ctx.exception))
        self.assertEqual(ctx.exception.code, "RECORD_UNDER_REVIEW")
        print("✅ 测试通过：待复核记录不能修改")

    def test_9_visualization_drilldown(self):
        batch = [
            {
                "sensor_id": "S-001",
                "level_reading": 45.2,
                "temperature": -180.5,
                "handwritten_note": "测试点选回溯",
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        notes, records, _ = self.system.import_inspection_notes("BATCH-012", batch)
        note_id = notes[0].note_id
        record_id = records[0].record_id

        chart_data = self.viz.generate_chart_data("A罐")
        self.assertGreaterEqual(len(chart_data["data_points"]), 1)
        self.assertEqual(chart_data["data_points"][0]["drilldown_target"]["type"], "note")

        drill_result = self.viz.drilldown("note", note_id)
        self.assertTrue(drill_result["found"])
        self.assertEqual(drill_result["source_type"], "手写巡检备注")
        self.assertEqual(drill_result["handwritten_content"], "测试点选回溯")
        self.assertIn("related_threshold", drill_result)

        sensor_result = self.viz.drilldown("sensor", "S-001")
        self.assertTrue(sensor_result["found"])
        self.assertEqual(sensor_result["source_type"], "传感器详情")

        view_3d = self.viz.generate_3d_view_data()
        self.assertIn("tanks", view_3d)
        self.assertGreaterEqual(len(view_3d["tanks"]), 1)
        print("✅ 测试通过：3D/图表点选回溯功能正常")

    def test_10_error_messages_human_readable(self):
        from cryo_tank_level.errors import error_message

        msg = error_message("INVALID_LEVEL_VALUE", value=150.0)
        self.assertIn("150.0", msg)
        self.assertIn("合理范围内", msg)
        self.assertNotIn("raw_level", msg)
        self.assertNotIn("field", msg)

        msg2 = error_message("DUPLICATE_IMPORT")
        self.assertIn("已经导入过了", msg2)
        self.assertNotIn("batch_hash", msg2)

        msg3 = error_message("MISSING_REQUIRED_FIELD", field_name="传感器编号")
        self.assertIn("传感器编号", msg3)
        self.assertNotIn("sensor_id", msg3)
        print("✅ 测试通过：错误提示说人话，不暴露内部字段名")

    def test_11_full_workflow_with_sensor_change(self):
        print("\n📋 测试完整场景：三步工作流中间碰到传感器重启编号变化")

        batch1 = [
            {
                "sensor_id": "S-001",
                "level_reading": 45.0,
                "temperature": -180.0,
                "handwritten_note": "正常巡检",
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        notes1, records1, _ = self.system.import_inspection_notes("BATCH-A", batch1)
        record_id = records1[0].record_id
        print("  ✅ 第一步：导入完成，状态=STEP_1")

        self.workflow.step_2_review_threshold(
            record_id, threshold_verified=True, reviewed_by="老唐"
        )
        print("  ✅ 第二步：阈值复核完成，状态=STEP_2")

        self.system.register_sensor("S-002", "A罐底部", "A罐")
        batch_s002 = [
            {
                "sensor_id": "S-002",
                "level_reading": 75.0,
                "temperature": -175.0,
                "handwritten_note": "S-002正常记录",
                "recorded_at": "2024-01-01T11:00:00",
            }
        ]
        self.system.import_inspection_notes("BATCH-PRE", batch_s002)
        print("  ✅ 先为S-002导入一条历史记录")

        batch2 = [
            {
                "sensor_id": "S-002-NEW",
                "level_reading": 74.8,
                "temperature": -175.1,
                "handwritten_note": "传感器S-002重启后变成了S-002-NEW",
                "recorded_at": "2024-01-01T12:00:00",
            }
        ]
        notes2, records2, mappings2 = self.system.import_inspection_notes(
            "BATCH-B", batch2
        )
        record2_id = records2[0].record_id
        self.assertEqual(len(mappings2), 1)
        self.assertEqual(mappings2[0].old_sensor_id, "S-002")
        self.assertEqual(mappings2[0].new_sensor_id, "S-002-NEW")
        self.assertEqual(records2[0].status, ReviewStatus.PENDING_REVIEW)
        print("  ✅ 检测到传感器编号变化，标记待复核，工作流暂停")

        with self.assertRaises(CryoTankError):
            self.workflow.step_2_review_threshold(
                record2_id, threshold_verified=True
            )
        print("  ✅ 待复核期间不能推进工作流（留给安全员）")

        self.system.review_sensor_mapping(
            "S-002", "S-002-NEW", approved=True, reviewed_by="安全员"
        )
        print("  ✅ 安全员复核通过")

        self.workflow.step_2_review_threshold(
            record2_id, threshold_verified=True, reviewed_by="老唐"
        )
        self.workflow.step_3_update_safety_reminder(
            record2_id, safety_note="液位正常"
        )
        final_state = self.workflow.get_workflow_state(record2_id)
        self.assertEqual(final_state, WorkflowState.STEP_3_SAFETY_UPDATED)
        print("  ✅ 复核后继续走完三步工作流")

        print("✅ 测试通过：完整场景——传感器重启后编号变化→留给安全员复核→复核后继续流程")

    def test_12_reimport_same_batch_updates_not_duplicates(self):
        print("\n📋 断点补实：同批次改液位后重新导入，数量不翻倍")

        batch1 = [
            {
                "sensor_id": "S-001",
                "level_reading": 45.0,
                "handwritten_note": "A罐液位正常",
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        notes1, recs1, _ = self.system.import_inspection_notes("BATCH-REIMPORT", batch1, imported_by="老唐")
        self.assertEqual(len(notes1), 1)
        self.assertEqual(len(recs1), 1)
        note_id = notes1[0].note_id
        record_id = recs1[0].record_id
        print("  ✅ 第一次导入: notes=1 records=1")

        batch2 = [
            {
                "sensor_id": "S-001",
                "level_reading": 46.0,
                "handwritten_note": "A罐液位正常(修正)",
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        notes2, recs2, _ = self.system.import_inspection_notes("BATCH-REIMPORT", batch2, imported_by="老唐")

        total_recs = len(self.system.storage.get_all_level_records())
        total_notes_data = self.system.storage._load("inspection_notes")
        self.assertEqual(total_recs, 1, f"records should still be 1, got {total_recs}")
        self.assertEqual(len(total_notes_data), 1, f"notes should still be 1, got {len(total_notes_data)}")
        print("  ✅ 重导入后: 库中 notes=1 records=1 — 没有翻倍!")

        updated_note = self.system.storage.get_inspection_note(note_id)
        self.assertEqual(updated_note.level_reading, 46.0)
        self.assertEqual(updated_note.handwritten_note, "A罐液位正常(修正)")

        updated_record = self.system.storage.get_level_record(record_id)
        self.assertEqual(updated_record.raw_level, 46.0)
        print("  ✅ 原记录已更新: level=46.0, 备注=修正后文本")

        note_history = self.system.storage.get_history_for_record(note_id)
        level_hist = [h for h in note_history if h.field_name == "level_reading"]
        self.assertGreaterEqual(len(level_hist), 1)
        self.assertEqual(level_hist[0].old_value, 45.0)
        self.assertEqual(level_hist[0].new_value, 46.0)
        self.assertIn("同批次重导入更新", level_hist[0].change_reason)
        self.assertEqual(level_hist[0].changed_by, "老唐")
        print("  ✅ 历史可见: 改前=45.0 改后=46.0 原因=同批次重导入更新 操作人=老唐")

        hw_hist = [h for h in note_history if h.field_name == "handwritten_note"]
        self.assertGreaterEqual(len(hw_hist), 1)
        self.assertEqual(hw_hist[0].old_value, "A罐液位正常")
        self.assertEqual(hw_hist[0].new_value, "A罐液位正常(修正)")
        print("  ✅ 备注历史: 改前文本='A罐液位正常' 改后文本='A罐液位正常(修正)'")

        with self.assertRaises(CryoTankError) as ctx:
            self.system.import_inspection_notes("BATCH-REIMPORT", batch2, imported_by="老唐")
        self.assertEqual(ctx.exception.code, "DUPLICATE_IMPORT")
        print("  ✅ 完全相同内容第三次导入: 正确拦截重复")

        print("✅ 测试通过：同批次重导入不翻倍 + 历史完整可查")

    def test_13_single_note_change_shows_before_after_reason(self):
        print("\n📋 老唐只改一条备注，桌面上摊着手写巡检备注要看改前改后和原因")

        batch = [
            {
                "sensor_id": "S-001",
                "level_reading": 50.0,
                "handwritten_note": "B罐液位偏低",
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        notes, _, _ = self.system.import_inspection_notes("BATCH-SINGLE", batch)
        note_id = notes[0].note_id

        updated, hist = self.system.update_single_note(
            note_id,
            {"handwritten_note": "B罐液位正常(重新核实)"},
            changed_by="老唐",
            change_reason="原备注写错，实际看过了",
        )

        self.assertEqual(len(hist), 1)
        h = hist[0]
        self.assertEqual(h.field_name, "handwritten_note")
        self.assertEqual(h.old_value, "B罐液位偏低")
        self.assertEqual(h.new_value, "B罐液位正常(重新核实)")
        self.assertEqual(h.change_reason, "原备注写错，实际看过了")
        self.assertEqual(h.changed_by, "老唐")
        print(f"  ✅ 改前文本='{h.old_value}' 改后文本='{h.new_value}' 为什么改='{h.change_reason}' 谁改的='{h.changed_by}'")

        all_history = self.system.storage.get_history_for_record(note_id)
        self.assertGreaterEqual(len(all_history), 1)
        print("  ✅ 从历史中可以查到改前文本、改后文本和为什么改")

        print("✅ 测试通过：单条备注修改留痕完整")

    def test_14_rollback_history_traceable(self):
        print("\n📋 回滚前后值、原因和处理人要从历史里查出来")

        batch = [
            {
                "sensor_id": "S-001",
                "level_reading": 55.0,
                "handwritten_note": "原始备注",
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        notes, records, _ = self.system.import_inspection_notes("BATCH-ROLLBACK", batch)
        note_id = notes[0].note_id
        record_id = records[0].record_id

        self.system.update_single_note(
            note_id,
            {"level_reading": 60.0},
            changed_by="老唐",
            change_reason="看错了数字",
        )

        rolled = self.system.rollback_record(
            record_id, reason="液位数据可疑需核实", rolled_back_by="老唐"
        )
        self.assertIsNotNone(rolled)

        history = self.system.storage.get_history_for_record(record_id)
        rollback_entries = [h for h in history if "rollback" in h.field_name]
        self.assertGreaterEqual(len(rollback_entries), 1)

        rb = rollback_entries[0]
        self.assertIsNotNone(rb.old_value)
        self.assertIsNotNone(rb.new_value)
        self.assertIn("液位数据可疑需核实", rb.change_reason)
        self.assertEqual(rb.changed_by, "老唐")
        print(f"  ✅ 回滚记录: 字段={rb.field_name} 回滚前={rb.old_value} 回滚后={rb.new_value}")
        print(f"     原因={rb.change_reason} 操作人={rb.changed_by}")

        print("✅ 测试通过：回滚前后值、原因、处理人可查")

    def test_15_e2e_first_import_then_reimport_then_single_edit_then_rollback(self):
        print("\n📋 完整端到端：第一次导入→改液位重导入→查数量/历史→老唐改备注→回滚")

        batch1 = [
            {
                "sensor_id": "S-001",
                "level_reading": 45.0,
                "handwritten_note": "A罐液位正常",
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        notes1, recs1, _ = self.system.import_inspection_notes("BATCH-E2E", batch1, imported_by="老唐")
        note_id = notes1[0].note_id
        record_id = recs1[0].record_id
        print("  ✅ Step1: 第一次导入 notes=1 records=1")

        batch2 = [
            {
                "sensor_id": "S-001",
                "level_reading": 46.0,
                "handwritten_note": "A罐液位正常(修正)",
                "recorded_at": "2024-01-01T10:00:00",
            }
        ]
        self.system.import_inspection_notes("BATCH-E2E", batch2, imported_by="老唐")
        total = len(self.system.storage.get_all_level_records())
        self.assertEqual(total, 1)
        print("  ✅ Step2: 改液位重导入 数量不翻倍(仍为1)")

        note_hist = self.system.storage.get_history_for_record(note_id)
        level_h = [h for h in note_hist if h.field_name == "level_reading"]
        self.assertGreaterEqual(len(level_h), 1)
        self.assertEqual(level_h[0].old_value, 45.0)
        self.assertEqual(level_h[0].new_value, 46.0)
        print("  ✅ Step3: 重导入历史 改前=45.0 改后=46.0 可查")

        self.system.update_single_note(
            note_id,
            {"handwritten_note": "A罐液位正常(老唐核实修正)"},
            changed_by="老唐",
            change_reason="原备注不够准确",
        )
        hw_h = [h for h in self.system.storage.get_history_for_record(note_id) if h.field_name == "handwritten_note"]
        latest_hw = hw_h[0] if hw_h else None
        self.assertIsNotNone(latest_hw)
        self.assertIn("老唐核实修正", str(latest_hw.new_value))
        self.assertEqual(latest_hw.change_reason, "原备注不够准确")
        print(f"  ✅ Step4: 老唐改备注 改前='{latest_hw.old_value}' 改后='{latest_hw.new_value}' 为什么改='{latest_hw.change_reason}'")

        self.system.rollback_record(record_id, reason="液位数据有疑问", rolled_back_by="老唐")
        rb_hist = [h for h in self.system.storage.get_history_for_record(record_id) if "rollback" in h.field_name]
        self.assertGreaterEqual(len(rb_hist), 1)
        self.assertEqual(rb_hist[0].changed_by, "老唐")
        self.assertIn("液位数据有疑问", rb_hist[0].change_reason)
        print(f"  ✅ Step5: 回滚 回滚前={rb_hist[0].old_value} 回滚后={rb_hist[0].new_value} 原因={rb_hist[0].change_reason} 操作人={rb_hist[0].changed_by}")

        print("✅ 测试通过：完整端到端流程验证")


if __name__ == "__main__":
    unittest.main(verbosity=2)
