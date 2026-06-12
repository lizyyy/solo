#!/usr/bin/env python3
import unittest
import os
import shutil
from datetime import datetime

from models import InspectionStatus, ChangeType
from storage import InspectionStorage
from service import InspectionService


class TestInspectionSystem(unittest.TestCase):
    def setUp(self):
        self.test_data_dir = "test_data"
        if os.path.exists(self.test_data_dir):
            shutil.rmtree(self.test_data_dir)
        self.storage = InspectionStorage(data_dir=self.test_data_dir)
        self.service = InspectionService(storage=self.storage)

    def tearDown(self):
        if os.path.exists(self.test_data_dir):
            shutil.rmtree(self.test_data_dir)

    def test_1_import_deduplication(self):
        print("\n=== 测试1: 导入去重 - 重复导入不翻倍 ===")
        complaints = [
            {
                "complaint_id": "C001",
                "intersection": "中山路与人民路交叉口",
                "description": "树池破损",
                "reported_at": datetime.now().isoformat()
            }
        ]

        created1, skipped1 = self.service.import_complaints(complaints, "test_user", batch_id="B001")
        self.assertEqual(len(created1), 1)
        self.assertEqual(len(skipped1), 0)
        self.assertEqual(created1[0].import_batch, "B001")
        print(f"  第一次导入(B001): 创建 {len(created1)} 条, 批次: {created1[0].import_batch}")

        created2, skipped2 = self.service.import_complaints(complaints, "test_user", batch_id="B002")
        self.assertEqual(len(created2), 0)
        self.assertEqual(len(skipped2), 1)
        self.assertEqual(skipped2[0][0], "C001")
        print(f"  第二次导入(B002): 创建 {len(created2)} 条, 跳过 {len(skipped2)} 条")

        all_insp = self.service.get_all_inspections()
        self.assertEqual(len(all_insp), 1)
        print(f"  最终记录数: {len(all_insp)} (未翻倍)")

        insp = self.service.get_inspection("C001")
        self.assertEqual(insp.import_batch, "B001")
        reimport_records = [h for h in insp.history if h.change_type == ChangeType.REIMPORT_SKIPPED]
        self.assertEqual(len(reimport_records), 1)
        self.assertIn("B001", reimport_records[0].remark)
        self.assertIn("B002", reimport_records[0].remark)
        print(f"  重复导入追踪: {reimport_records[0].remark}")
        print("  ✓ 导入去重 + 批次追踪测试通过")

    def test_2_three_step_workflow(self):
        print("\n=== 测试2: 三步工作流 ===")
        complaints = [
            {
                "complaint_id": "C002",
                "intersection": "长江路与黄河路交叉口",
                "description": "树池边缘破损",
                "reported_at": datetime.now().isoformat()
            }
        ]
        self.service.import_complaints(complaints, "system")

        insp = self.service.get_inspection("C002")
        self.assertEqual(insp.status, InspectionStatus.PENDING)
        print(f"  第1步后 - 状态: {insp.status.value}")

        self.service.add_photo("C002", "photos/C002_1.jpg", datetime.now(), "xiaojiang", "树池破损约30cm")
        insp = self.service.get_inspection("C002")
        self.assertEqual(insp.status, InspectionStatus.PHOTO_REVIEWED)
        print(f"  第2步后 - 状态: {insp.status.value}")

        self.service.update_suggestion("C002", "建议更换树池边缘石", "xiaojiang")
        insp = self.service.get_inspection("C002")
        self.assertEqual(insp.status, InspectionStatus.SUGGESTION_UPDATED)
        print(f"  第3步后 - 状态: {insp.status.value}")
        print("  ✓ 三步工作流测试通过")

    def test_3_ramp_score_unchanged_triggers_review(self):
        print("\n=== 测试3: 坡道补录评分未变化触发复核 ===")
        complaints = [
            {
                "complaint_id": "C003",
                "intersection": "解放路与和平路交叉口",
                "description": "树池及坡道问题",
                "reported_at": datetime.now().isoformat()
            }
        ]
        self.service.import_complaints(complaints, "system")

        self.service.update_score("C003", 7.5, "xiaojiang")
        self.service.add_ramp_supplement("C003", "路口西南角坡道", "坡道表面磨损", 7.5, "xiaojiang")

        insp = self.service.get_inspection("C003")
        self.assertEqual(insp.status, InspectionStatus.NEEDS_REVIEW)
        self.assertTrue(insp.has_ramp_score_unchanged())
        print(f"  坡道补录后评分未变化，状态: {insp.status.value}")

        self.service.review_by_traffic_assistant("C003", "traffic_01", "确认评分合理")
        insp = self.service.get_inspection("C003")
        self.assertEqual(insp.status, InspectionStatus.REVIEWED)
        print(f"  交通协管复核后状态: {insp.status.value}")
        print("  ✓ 坡道评分未变化触发复核测试通过")

    def test_4_rollback_ramp_restores_status_and_score(self):
        print("\n=== 测试4: [核心修复] 回滚坡道补录后状态和评分必须恢复 ===")
        complaints = [
            {
                "complaint_id": "C004",
                "intersection": "解放路与建设路交叉口",
                "description": "树池及坡道问题",
                "reported_at": datetime.now().isoformat()
            }
        ]
        self.service.import_complaints(complaints, "system")

        self.service.add_photo("C004", "photos/C004_1.jpg", datetime.now(), "xiaojiang", "树池破损约40cm")
        self.service.update_suggestion("C004", "建议修复树池边缘", "xiaojiang")
        self.service.update_score("C004", 7.0, "xiaojiang")

        insp_before_ramp = self.service.get_inspection("C004")
        status_before_ramp = insp_before_ramp.status
        score_before_ramp = insp_before_ramp.score
        print(f"  坡道补录前: 状态={status_before_ramp.value}, 评分={score_before_ramp}")

        self.service.add_ramp_supplement("C004", "路口西侧坡道", "坡道表面磨损", 7.0, "xiaojiang")

        insp_after_ramp = self.service.get_inspection("C004")
        self.assertEqual(insp_after_ramp.status, InspectionStatus.NEEDS_REVIEW)
        self.assertEqual(len(insp_after_ramp.ramp_supplements), 1)
        print(f"  坡道补录后: 状态={insp_after_ramp.status.value}, 评分={insp_after_ramp.score}, 坡道补录数={len(insp_after_ramp.ramp_supplements)}")

        ramp_changes = [h for h in insp_after_ramp.history if h.change_type == ChangeType.RAMP_SUPPLEMENTED]
        self.assertEqual(len(ramp_changes), 1)
        change_to_rollback = ramp_changes[0].change_id
        print(f"  准备回滚 change_id: {change_to_rollback}")

        self.service.rollback("C004", change_to_rollback, "admin")

        insp_after_rollback = self.service.get_inspection("C004")
        print(f"  回滚后: 状态={insp_after_rollback.status.value}, 评分={insp_after_rollback.score}, 坡道补录数={len(insp_after_rollback.ramp_supplements)}")

        self.assertEqual(len(insp_after_rollback.ramp_supplements), 0, "回滚后坡道补录数量应为0")
        self.assertEqual(insp_after_rollback.status, status_before_ramp, f"回滚后状态应恢复为 {status_before_ramp.value}，而不是停留在 {insp_after_rollback.status.value}")
        self.assertEqual(insp_after_rollback.score, score_before_ramp, f"回滚后评分应恢复为 {score_before_ramp}")
        self.assertFalse(insp_after_rollback.has_ramp_score_unchanged(), "回滚后不应再有坡道评分未变化标记")

        rollback_records = [h for h in insp_after_rollback.history if h.change_type == ChangeType.ROLLED_BACK]
        self.assertEqual(len(rollback_records), 1)
        self.assertIn(status_before_ramp.value, rollback_records[0].remark)
        print(f"  回滚记录备注: {rollback_records[0].remark}")

        needs_review = self.service.get_needs_review_list()
        self.assertEqual(len(needs_review), 0, "回滚后不应出现在待复核列表")
        print(f"  待复核列表: {len(needs_review)} 条 (正确，回滚后不应待复核)")
        print("  ✓ 回滚坡道补录后状态和评分恢复测试通过")

    def test_5_remark_history_tracking(self):
        print("\n=== 测试5: 备注修改历史追踪 ===")
        complaints = [
            {
                "complaint_id": "C005",
                "intersection": "建国路与文化路交叉口",
                "description": "树池破损",
                "reported_at": datetime.now().isoformat()
            }
        ]
        self.service.import_complaints(complaints, "system")

        self.service.update_remark("C005", "初查：树池破损约30cm", "xiaojiang")
        self.service.update_remark("C005", "复查：树池破损约50cm，比初查更严重", "xiaojiang")

        history = self.service.get_history_diff("C005")
        remark_changes = [h for h in history if h["change_type"] == "remark_updated"]

        self.assertEqual(len(remark_changes), 2)
        self.assertEqual(remark_changes[0]["old"], None)
        self.assertEqual(remark_changes[0]["new"], "初查：树池破损约30cm")
        self.assertEqual(remark_changes[1]["old"], "初查：树池破损约30cm")
        self.assertEqual(remark_changes[1]["new"], "复查：树池破损约50cm，比初查更严重")

        for i, chg in enumerate(remark_changes, 1):
            print(f"    第{i}次: {chg['old']} → {chg['new']}")
        print("  ✓ 备注历史追踪测试通过")

    def test_6_rollback_remark(self):
        print("\n=== 测试6: 回滚备注 ===")
        complaints = [
            {
                "complaint_id": "C006",
                "intersection": "人民路与建设路交叉口",
                "description": "树池破损",
                "reported_at": datetime.now().isoformat()
            }
        ]
        self.service.import_complaints(complaints, "system")

        self.service.update_remark("C006", "原始备注", "xiaojiang")
        self.service.update_remark("C006", "修改后的备注", "xiaojiang")

        history = self.service.get_history_diff("C006")
        remark_updates = [h for h in history if h["change_type"] == "remark_updated"]
        self.service.rollback("C006", remark_updates[-1]["change_id"], "admin")

        insp = self.service.get_inspection("C006")
        self.assertEqual(insp.remark, "原始备注")
        print(f"  回滚后备注恢复: {insp.remark}")
        print("  ✓ 回滚备注测试通过")

    def test_7_reimport_tracking_with_modifications(self):
        print("\n=== 测试7: [核心修复] 重复导入追踪 - 改了什么、谁改的、影响了哪条结果 ===")
        complaints = [
            {
                "complaint_id": "C007",
                "intersection": "幸福路与平安街交叉口",
                "description": "树池破损严重",
                "reported_at": datetime.now().isoformat()
            }
        ]

        self.service.import_complaints(complaints, "batch_loader", batch_id="B001")
        print("  第1次导入(B001): 完成")

        self.service.add_photo("C007", "photos/C007_1.jpg", datetime.now(), "xiaojiang", "树池破损约40cm，边缘石脱落")
        self.service.update_remark("C007", "初查备注", "xiaojiang")
        self.service.update_score("C007", 7.5, "xiaojiang")
        print("  小姜补看照片、写备注、打评分")

        created2, skipped2 = self.service.import_complaints(complaints, "batch_loader", batch_id="B002")
        self.assertEqual(len(created2), 0)
        self.assertEqual(len(skipped2), 1)
        print(f"  第2次导入(B002): 跳过 {len(skipped2)} 条")

        insp = self.service.get_inspection("C007")
        self.assertEqual(insp.import_batch, "B001")
        reimport_records = [h for h in insp.history if h.change_type == ChangeType.REIMPORT_SKIPPED]
        self.assertEqual(len(reimport_records), 1)

        reimport_info = reimport_records[0]
        self.assertIn("B001", reimport_info.remark)
        self.assertIn("B002", reimport_info.remark)
        print(f"  重复导入追踪信息: {reimport_info.remark}")

        new_value = reimport_info.new_value
        self.assertIsInstance(new_value, dict)
        self.assertEqual(new_value["complaint_id"], "C007")
        self.assertGreater(new_value["changes_since_import"], 0)
        self.assertIn("xiaojiang", new_value["who_changed"])
        self.assertEqual(new_value["current_status"], "photo_reviewed")
        self.assertEqual(new_value["current_score"], 7.5)
        print(f"  重复导入详情: 变更数={new_value['changes_since_import']}, 谁改了={new_value['who_changed']}, 当前状态={new_value['current_status']}, 当前评分={new_value['current_score']}")

        self.assertEqual(reimport_info.import_batch, "B002")
        print(f"  本次重传批次: {reimport_info.import_batch}, 历史批次: {insp.import_batch}")

        print("  ✓ 重复导入追踪测试通过")

    def test_8_trace_from_complaint(self):
        print("\n=== 测试8: [核心修复] 从投诉编号反查完整审计轨迹 ===")
        complaints = [
            {
                "complaint_id": "C008",
                "intersection": "中心大道与广场路交叉口",
                "description": "树池破损，存在安全隐患",
                "reported_at": datetime.now().isoformat()
            }
        ]
        self.service.import_complaints(complaints, "system", batch_id="B001")

        self.service.add_photo("C008", "photos/C008_main.jpg", datetime.now(), "xiaojiang", "树池破损约40cm，可见内部土壤裸露")
        self.service.update_remark("C008", "初查：树池破损约30cm", "xiaojiang")
        self.service.update_score("C008", 7.0, "xiaojiang")

        trace = self.service.trace_from_complaint("C008")
        self.assertIsNotNone(trace)

        self.assertEqual(trace["complaint_id"], "C008")
        self.assertEqual(trace["intersection"], "中心大道与广场路交叉口")
        self.assertEqual(trace["current_status"], "photo_reviewed")
        self.assertEqual(trace["current_score"], 7.0)
        self.assertEqual(trace["current_remark"], "初查：树池破损约30cm")
        self.assertEqual(trace["import_batch"], "B001")
        print(f"  投诉编号: {trace['complaint_id']}")
        print(f"  路口: {trace['intersection']}")
        print(f"  当前状态: {trace['current_status']}, 评分: {trace['current_score']}, 备注: {trace['current_remark']}")
        print(f"  导入批次: {trace['import_batch']}")

        self.assertEqual(len(trace["photo_remarks"]), 1)
        self.assertEqual(trace["photo_remarks"][0]["remark"], "树池破损约40cm，可见内部土壤裸露")
        print(f"  照片关键备注: {trace['photo_remarks'][0]['remark']}")

        self.assertGreater(len(trace["timeline"]), 0)
        timeline_types = [e["change_type"] for e in trace["timeline"]]
        self.assertIn("created", timeline_types)
        self.assertIn("photo_added", timeline_types)
        self.assertIn("remark_updated", timeline_types)
        self.assertIn("score_updated", timeline_types)
        print(f"  时间线条目数: {len(trace['timeline'])}")
        for entry in trace["timeline"]:
            print(f"    {entry['change_type']} by {entry['by']}: {entry['detail']}")

        print("  ✓ 反查审计轨迹测试通过")

    def test_9_full_e2e_with_ramp_rollback_and_reimport(self):
        print("\n=== 测试9: 完整端到端场景 (含坡道回滚+重复导入+反查) ===")
        print("  场景: 导入 → 补看照片 → 评分 → 坡道补录(评分不变) → 回滚坡道 → 重复导入 → 反查")

        complaints = [
            {
                "complaint_id": "C009",
                "intersection": "光明路与正义街交叉口",
                "description": "树池破损严重，坡道有隐患",
                "reported_at": datetime.now().isoformat()
            }
        ]

        created, _ = self.service.import_complaints(complaints, "system", batch_id="B001")
        self.assertEqual(len(created), 1)
        print("  ✓ 第1步: 导入完成 (批次 B001)")

        self.service.add_photo("C009", "photos/C009_main.jpg", datetime.now(), "xiaojiang", "树池破损约40cm，可见内部土壤裸露")
        insp = self.service.get_inspection("C009")
        self.assertEqual(insp.status, InspectionStatus.PHOTO_REVIEWED)
        print("  ✓ 第2步: 补看路口照片 (含关键备注)")

        self.service.update_suggestion("C009", "建议修复树池边缘", "xiaojiang")
        self.service.update_score("C009", 7.0, "xiaojiang")
        print("  ✓ 第3步: 整改建议+评分完成")

        status_before_ramp = self.service.get_inspection("C009").status
        score_before_ramp = self.service.get_inspection("C009").score

        self.service.add_ramp_supplement("C009", "路口东北侧坡道", "坡道边缘轻微破损", 7.0, "xiaojiang")
        insp = self.service.get_inspection("C009")
        self.assertEqual(insp.status, InspectionStatus.NEEDS_REVIEW)
        self.assertTrue(insp.has_ramp_score_unchanged())
        print(f"  ✓ 坡道补录后: 状态={insp.status.value} (需复核), 坡道数={len(insp.ramp_supplements)}")

        ramp_changes = [h for h in insp.history if h.change_type == ChangeType.RAMP_SUPPLEMENTED]
        self.service.rollback("C009", ramp_changes[0].change_id, "admin")
        insp = self.service.get_inspection("C009")
        self.assertEqual(len(insp.ramp_supplements), 0)
        self.assertEqual(insp.status, status_before_ramp, f"回滚后状态应恢复为 {status_before_ramp.value}")
        self.assertEqual(insp.score, score_before_ramp, f"回滚后评分应恢复为 {score_before_ramp}")
        print(f"  ✓ 回滚坡道: 状态恢复为 {insp.status.value}, 评分恢复为 {insp.score}, 坡道数={len(insp.ramp_supplements)}")

        self.assertEqual(len(self.service.get_needs_review_list()), 0)
        print("  ✓ 回滚后不在待复核列表")

        created2, skipped2 = self.service.import_complaints(complaints, "batch_loader", batch_id="B002")
        self.assertEqual(len(created2), 0)
        self.assertEqual(len(skipped2), 1)
        reimport_info = [h for h in self.service.get_inspection("C009").history if h.change_type == ChangeType.REIMPORT_SKIPPED]
        self.assertEqual(len(reimport_info), 1)
        self.assertIn("B001", reimport_info[0].remark)
        self.assertIn("B002", reimport_info[0].remark)
        print(f"  ✓ 重复导入(B002)追踪: {reimport_info[0].remark}")

        trace = self.service.trace_from_complaint("C009")
        self.assertIsNotNone(trace)
        self.assertEqual(trace["import_batch"], "B001")
        self.assertEqual(len(trace["photo_remarks"]), 1)
        self.assertEqual(trace["photo_remarks"][0]["remark"], "树池破损约40cm，可见内部土壤裸露")
        self.assertEqual(len(trace["ramp_supplements"]), 0)
        self.assertFalse(trace["has_ramp_score_unchanged"])

        timeline_types = [e["change_type"] for e in trace["timeline"]]
        self.assertIn("ramp_supplemented", timeline_types)
        self.assertIn("rolled_back", timeline_types)
        self.assertIn("reimport_skipped", timeline_types)

        ramp_entry = [e for e in trace["timeline"] if e["change_type"] == "ramp_supplemented"][0]
        self.assertEqual(ramp_entry["old_status"], status_before_ramp.value)
        self.assertEqual(ramp_entry["new_status"], "needs_review")
        self.assertEqual(ramp_entry["old_score"], score_before_ramp)
        self.assertEqual(ramp_entry["new_score"], 7.0)
        print(f"  ✓ 反查审计轨迹: 时间线包含坡道补录(old_status={ramp_entry['old_status']}→needs_review)和回滚")

        print("\n  ✓ 完整端到端场景测试通过")


if __name__ == "__main__":
    print("=" * 60)
    print("城市树池破损巡检系统 - 测试套件 (修复版)")
    print("=" * 60)
    unittest.main(verbosity=0)
