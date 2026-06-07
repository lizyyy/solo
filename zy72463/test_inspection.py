#!/usr/bin/env python3
import unittest
import os
import shutil
from datetime import datetime

from models import InspectionStatus
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
        print("\n=== 测试1: 导入去重 - 重复导入不翻倍")
        complaints = [
            {
                "complaint_id": "C001",
                "intersection": "中山路与人民路交叉口",
                "description": "树池破损",
                "reported_at": datetime.now().isoformat()
            }
        ]

        created1, skipped1 = self.service.import_complaints(complaints, "test_user")
        self.assertEqual(len(created1), 1)
        self.assertEqual(len(skipped1), 0)
        print(f"  第一次导入: 创建 {len(created1)} 条")

        created2, skipped2 = self.service.import_complaints(complaints, "test_user")
        self.assertEqual(len(created2), 0)
        self.assertEqual(len(skipped2), 1)
        self.assertEqual(skipped2[0], "C001")
        print(f"  第二次导入: 创建 {len(created2)} 条, 跳过 {len(skipped2)} 条")

        all_insp = self.service.get_all_inspections()
        self.assertEqual(len(all_insp), 1)
        print(f"  最终记录数: {len(all_insp)} (正确，未翻倍)")
        print("  ✓ 导入去重测试通过")

    def test_2_three_step_workflow(self):
        print("\n=== 测试2: 三步工作流")
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
        print(f"  第1步后 - 状态: {insp.status.value} (pending)")

        self.service.add_photo(
            "C002",
            "photos/C002_1.jpg",
            datetime.now(),
            "xiaojiang",
            "树池破损约30cm"
        )
        insp = self.service.get_inspection("C002")
        self.assertEqual(insp.status, InspectionStatus.PHOTO_REVIEWED)
        self.assertEqual(len(insp.photos), 1)
        print(f"  第2步后 - 状态: {insp.status.value} (photo_reviewed), 照片数: {len(insp.photos)}")

        self.service.update_suggestion(
            "C002",
            "建议更换树池边缘石",
            "xiaojiang"
        )
        insp = self.service.get_inspection("C002")
        self.assertEqual(insp.status, InspectionStatus.SUGGESTION_UPDATED)
        self.assertIsNotNone(insp.suggestion)
        print(f"  第3步后 - 状态: {insp.status.value} (suggestion_updated)")
        print("  ✓ 三步工作流测试通过")

    def test_3_ramp_score_unchanged_triggers_review(self):
        print("\n=== 测试3: 坡道补录评分未变化触发复核")
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
        insp = self.service.get_inspection("C003")
        print(f"  设置初始评分: {insp.score}")

        self.service.add_ramp_supplement(
            "C003",
            "路口西南角坡道",
            "坡道表面磨损",
            7.5,
            "xiaojiang"
        )
        insp = self.service.get_inspection("C003")
        self.assertEqual(insp.status, InspectionStatus.NEEDS_REVIEW)
        self.assertTrue(insp.has_ramp_score_unchanged())
        print(f"  坡道补录后评分仍为 7.5，状态变为: {insp.status.value} (needs_review)")

        needs_review = self.service.get_needs_review_list()
        self.assertEqual(len(needs_review), 1)
        self.assertEqual(needs_review[0].complaint_id, "C003")
        print(f"  待复核列表中有 {len(needs_review)} 条记录")

        self.service.review_by_traffic_assistant(
            "C003",
            "traffic_01",
            "确认评分合理",
            adjusted_score=None
        )
        insp = self.service.get_inspection("C003")
        self.assertEqual(insp.status, InspectionStatus.REVIEWED)
        print(f"  交通协管复核后状态: {insp.status.value} (reviewed)")
        print("  ✓ 坡道评分未变化触发复核测试通过")

    def test_4_remark_history_tracking(self):
        print("\n=== 测试4: 备注修改历史追踪")
        complaints = [
            {
                "complaint_id": "C004",
                "intersection": "建国路与文化路交叉口",
                "description": "树池破损",
                "reported_at": datetime.now().isoformat()
            }
        ]
        self.service.import_complaints(complaints, "system")

        self.service.update_remark("C004", "初查：树池破损约30cm", "xiaojiang")
        self.service.update_remark("C004", "复查：树池破损约50cm，比初查更严重", "xiaojiang")

        history = self.service.get_history_diff("C004")
        remark_changes = [h for h in history if h["change_type"] == "remark_updated"]

        self.assertEqual(len(remark_changes), 2)
        self.assertEqual(remark_changes[0]["old"], None)
        self.assertEqual(remark_changes[0]["new"], "初查：树池破损约30cm")
        self.assertEqual(remark_changes[1]["old"], "初查：树池破损约30cm")
        self.assertEqual(remark_changes[1]["new"], "复查：树池破损约50cm，比初查更严重")

        print(f"  备注变更次数: {len(remark_changes)}")
        for i, chg in enumerate(remark_changes, 1):
            print(f"    第{i}次: {chg['old']} → {chg['new']}")

        print("  ✓ 备注历史追踪测试通过")

    def test_5_rollback_mechanism(self):
        print("\n=== 测试5: 回滚机制")
        complaints = [
            {
                "complaint_id": "C005",
                "intersection": "人民路与建设路交叉口",
                "description": "树池破损",
                "reported_at": datetime.now().isoformat()
            }
        ]
        self.service.import_complaints(complaints, "system")

        self.service.update_remark("C005", "原始备注", "xiaojiang")
        self.service.update_remark("C005", "修改后的备注", "xiaojiang")

        insp = self.service.get_inspection("C005")
        self.assertEqual(insp.remark, "修改后的备注")
        print(f"  修改后备注: {insp.remark}")

        history = self.service.get_history_diff("C005")
        remark_updates = [h for h in history if h["change_type"] == "remark_updated"]
        change_to_rollback = remark_updates[-1]["change_id"]

        self.service.rollback("C005", change_to_rollback, "admin")

        insp = self.service.get_inspection("C005")
        self.assertEqual(insp.remark, "原始备注")
        print(f"  回滚后备注: {insp.remark}")

        history_after = self.service.get_history_diff("C005")
        rollback_records = [h for h in history_after if h["change_type"] == "rolled_back"]
        self.assertEqual(len(rollback_records), 1)
        print(f"  回滚记录已保存，回滚记录数: {len(rollback_records)}")
        print("  ✓ 回滚机制测试通过")

    def test_6_replay_commands(self):
        print("\n=== 测试6: 可重放命令生成")
        complaints = [
            {
                "complaint_id": "C006",
                "intersection": "幸福路与平安街交叉口",
                "description": "树池破损严重",
                "reported_at": datetime.now().isoformat()
            }
        ]
        self.service.import_complaints(complaints, "system")
        self.service.add_photo("C006", "photos/C006_1.jpg", datetime.now(), "xiaojiang", "测试照片")
        self.service.update_remark("C006", "测试备注", "xiaojiang")
        self.service.update_score("C006", 8.0, "xiaojiang")

        commands = self.service.get_replay_commands("C006")
        self.assertGreater(len(commands), 0)
        print(f"  生成可重放命令数: {len(commands)}")
        for i, cmd in enumerate(commands, 1):
            print(f"    {i}. python cli.py {cmd}")

        self.assertTrue(any("import-complaints" in cmd for cmd in commands))
        self.assertTrue(any("add-photo" in cmd for cmd in commands))
        self.assertTrue(any("update-remark" in cmd for cmd in commands))
        self.assertTrue(any("update-score" in cmd for cmd in commands))
        print("  ✓ 可重放命令测试通过")

    def test_7_full_scenario_end_to_end(self):
        print("\n=== 测试7: 完整端到端场景（含坡道评分未变化）")
        print("  场景: 居民投诉导入 → 小姜补看照片 → 坡道补录评分未变化 → 交通协管复核")

        complaints = [
            {
                "complaint_id": "C007",
                "intersection": "中心大道与广场路交叉口",
                "description": "树池破损，存在安全隐患",
                "reported_at": datetime.now().isoformat()
            }
        ]

        created, _ = self.service.import_complaints(complaints, "system")
        self.assertEqual(len(created), 1)
        print("  ✓ 第1步: 居民投诉导入完成")

        self.service.add_photo(
            "C007",
            "photos/C007_main.jpg",
            datetime.now(),
            "xiaojiang",
            "树池破损约40cm，可见内部土壤裸露"
        )
        insp = self.service.get_inspection("C007")
        self.assertEqual(len(insp.photos), 1)
        self.assertEqual(insp.status, InspectionStatus.PHOTO_REVIEWED)
        print("  ✓ 第2步: 街道规划员小姜补看路口照片完成")

        self.service.update_score("C007", 7.0, "xiaojiang")

        self.service.add_ramp_supplement(
            "C007",
            "路口东北侧无障碍坡道",
            "坡道边缘有轻微破损",
            7.0,
            "xiaojiang"
        )
        insp = self.service.get_inspection("C007")
        self.assertEqual(insp.status, InspectionStatus.NEEDS_REVIEW)
        self.assertTrue(insp.has_ramp_score_unchanged())
        print("  ✓ 坡道补录后评分未变化，自动标记为需复核")

        self.service.update_suggestion(
            "C007",
            "建议修复树池边缘，清理周边步道砖",
            "xiaojiang"
        )
        print("  ✓ 第3步: 整改建议更新完成")

        needs_review = self.service.get_needs_review_list()
        self.assertEqual(len(needs_review), 1)
        self.assertEqual(needs_review[0].complaint_id, "C007")

        self.service.review_by_traffic_assistant(
            "C007",
            "traffic_assistant_01",
            "经现场复核，坡道确实不影响通行，评分合理",
            adjusted_score=None
        )
        insp = self.service.get_inspection("C007")
        self.assertEqual(insp.status, InspectionStatus.REVIEWED)
        print("  ✓ 交通协管复核完成")

        history = self.service.get_history_diff("C007")
        print(f"\n  历史记录数: {len(history)}")

        commands = self.service.get_replay_commands("C007")
        print(f"  可重放命令数: {len(commands)}")

        print("\n  ✓ 完整端到端场景测试通过")


if __name__ == "__main__":
    print("=" * 60)
    print("城市树池破损巡检系统 - 测试套件")
    print("=" * 60)
    unittest.main(verbosity=0)
