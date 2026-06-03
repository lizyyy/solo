#!/usr/bin/env python3
"""完整工作流测试 - 轨道交通限界检查系统"""
import os
import sys
import json
import unittest
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

DB_PATH = project_root / "data" / "db" / "gauge_inspection.db"

def remove_db():
    if DB_PATH.exists():
        DB_PATH.unlink()

class TestCoordinateDetector(unittest.TestCase):
    def setUp(self):
        remove_db()
        from src.coord_detector import CoordinateDetector
        self.detector = CoordinateDetector

    def test_lonlat_detection(self):
        result = self.detector.detect("116.397128", "39.916527", "45.23")
        self.assertEqual(result.coord_type, "lonlat")
        self.assertFalse(result.is_mixed)
        self.assertGreater(result.confidence, 0.7)

    def test_meter_detection(self):
        result = self.detector.detect("32456.78", "4215678.90", "43.50")
        self.assertEqual(result.coord_type, "meter")
        self.assertFalse(result.is_mixed)
        self.assertGreater(result.confidence, 0.7)

    def test_mixed_detection_x_meter_y_lonlat(self):
        result = self.detector.detect("18750.25", "39.923456", "46.75")
        self.assertEqual(result.coord_type, "mixed_lonlat_meter")
        self.assertTrue(result.is_mixed)
        self.assertEqual(result.x_type, "meter_like")
        self.assertEqual(result.y_type, "lonlat_like")

    def test_mixed_detection_x_lonlat_y_meter(self):
        result = self.detector.detect("116.423456", "5234567.89", "44.00")
        self.assertEqual(result.coord_type, "mixed_lonlat_meter")
        self.assertTrue(result.is_mixed)
        self.assertEqual(result.x_type, "lonlat_like")
        self.assertEqual(result.y_type, "meter_like")

    def test_explain_detection(self):
        result = self.detector.detect("18750.25", "39.923456")
        explanation = self.detector.explain_detection(result)
        self.assertIn("坐标检测结果", explanation)
        self.assertIn("经纬度与米制坐标混合", explanation)
        self.assertIn("检测置信度", explanation)

class TestFullWorkflow(unittest.TestCase):
    def setUp(self):
        remove_db()
        from src.workflow import GaugeInspectionWorkflow
        self.wf = GaugeInspectionWorkflow()
        
        sample_dir = project_root / "data" / "samples"
        with open(sample_dir / "point_cloud_log_001.json", "r", encoding="utf-8") as f:
            self.point_cloud_data = json.load(f)
        with open(sample_dir / "safety_radius_table_001.json", "r", encoding="utf-8") as f:
            self.safety_radius_data = json.load(f)

    def test_step1_import_point_cloud_log(self):
        log, issues = self.wf.step1_import_point_cloud_log(
            "TEST-LOG-001",
            self.point_cloud_data,
            "test-user"
        )
        
        self.assertIsNotNone(log.id)
        self.assertEqual(log.log_no, "TEST-LOG-001")
        self.assertEqual(len(issues), 8)
        
        mixed_issues = [i for i in issues if i["issue"].is_mixed]
        self.assertEqual(len(mixed_issues), 3)
        
        for issue_data in issues:
            self.assertIsNotNone(issue_data["issue"].id)
            self.assertIsNotNone(issue_data["site_note"].id)
            self.assertEqual(issue_data["site_note"].coordinate_issue_id, issue_data["issue"].id)
            self.assertIn(issue_data["issue"].item_identifier, issue_data["site_note"].why_kept)
            self.assertGreater(len(issue_data["site_note"].why_kept), 10)
            self.assertGreater(len(issue_data["site_note"].next_action), 10)
            self.assertGreater(len(issue_data["site_note"].contact_person), 5)
            
            if issue_data["issue"].is_mixed:
                self.assertIn("坐标系统混合", issue_data["site_note"].why_kept)
                self.assertIn("安全半径表未补录", issue_data["site_note"].missing_materials)
                self.assertIn("阿景", issue_data["site_note"].contact_person)
                self.assertTrue(issue_data["issue"].reserved_for_inspection)

    def test_step2_review_safety_radius_table(self):
        self.wf.step1_import_point_cloud_log("TEST-LOG-002", self.point_cloud_data)
        
        table, updated = self.wf.step2_review_safety_radius_table(
            "TEST-SR-001",
            self.safety_radius_data,
            "ajing"
        )
        
        self.assertIsNotNone(table.id)
        self.assertEqual(table.table_no, "TEST-SR-001")
        self.assertEqual(len(updated), 8)
        
        for item_data in updated:
            issue = item_data["issue"]
            note = item_data["site_note"]
            
            self.assertEqual(issue.status, "ajing_reviewed")
            self.assertIsNotNone(issue.safety_radius_table_id)
            self.assertEqual(note.version, 2)
            
            if issue.is_mixed:
                self.assertIn("坐标转换", note.next_action)
                self.assertIn("阿景", note.next_action)
                self.assertIn("巡检组", note.contact_person)
            else:
                if note.missing_materials is None:
                    self.assertIn("可移交现场班组", note.next_action)

    def test_step3_finalize_for_site_team(self):
        self.wf.step1_import_point_cloud_log("TEST-LOG-003", self.point_cloud_data)
        self.wf.step2_review_safety_radius_table("TEST-SR-002", self.safety_radius_data)
        
        finalized = self.wf.step3_finalize_for_site_team("巡检组-老王")
        
        self.assertEqual(len(finalized), 8)
        
        action_required_count = 0
        ready_count = 0
        
        for item_data in finalized:
            issue = item_data["issue"]
            note = item_data["site_note"]
            
            if issue.is_mixed:
                self.assertTrue(item_data["action_required"])
                self.assertEqual(issue.status, "pending_final_inspection")
                self.assertIn("现场复核坐标系统一性", note.next_action)
                action_required_count += 1
            else:
                if issue.status == "ready_for_construction":
                    self.assertFalse(item_data["action_required"])
                    ready_count += 1
                else:
                    action_required_count += 1
        
        self.assertEqual(action_required_count, 3)
        self.assertEqual(ready_count, 5)

    def test_full_workflow_end_to_end(self):
        workflow_status = self.wf.get_workflow_status()
        self.assertEqual(len(workflow_status), 3)
        for step in workflow_status:
            self.assertEqual(step["status"], "pending")
        
        log, issues_step1 = self.wf.step1_import_point_cloud_log(
            "FULL-TEST-001",
            self.point_cloud_data
        )
        
        workflow_status = self.wf.get_workflow_status()
        self.assertEqual(workflow_status[0]["status"], "completed")
        self.assertEqual(workflow_status[1]["status"], "pending")
        self.assertEqual(workflow_status[2]["status"], "pending")
        
        table, issues_step2 = self.wf.step2_review_safety_radius_table(
            "FULL-SR-001",
            self.safety_radius_data
        )
        
        workflow_status = self.wf.get_workflow_status()
        self.assertEqual(workflow_status[0]["status"], "completed")
        self.assertEqual(workflow_status[1]["status"], "completed")
        self.assertEqual(workflow_status[2]["status"], "pending")
        
        finalized = self.wf.step3_finalize_for_site_team()
        
        workflow_status = self.wf.get_workflow_status()
        self.assertEqual(workflow_status[0]["status"], "completed")
        self.assertEqual(workflow_status[1]["status"], "completed")
        self.assertEqual(workflow_status[2]["status"], "completed")
        
        all_issues = self.wf.get_all_issues_with_notes()
        self.assertEqual(len(all_issues), 8)
        
        for item in all_issues:
            self.assertIsNotNone(item["issue"])
            self.assertIsNotNone(item["site_note"])
            self.assertGreaterEqual(item["site_note"].version, 2)
            
            if item["issue"].is_mixed:
                self.assertTrue(item["issue"].reserved_for_inspection)
                self.assertIn("巡检组", item["site_note"].contact_person)

    def test_step2_without_step1_should_fail(self):
        with self.assertRaises(ValueError) as context:
            self.wf.step2_review_safety_radius_table(
                "FAIL-TEST-001",
                self.safety_radius_data
            )
        self.assertIn("请先导入点云抽稀日志", str(context.exception))

    def test_site_note_content_for_mixed_coords(self):
        self.wf.step1_import_point_cloud_log("NOTE-TEST-001", self.point_cloud_data)
        
        issues = self.wf.get_all_issues_with_notes()
        mixed_issue = next(i for i in issues if i["issue"].item_identifier == "PC-004")
        
        self.assertIn("坐标系统混合", mixed_issue["site_note"].why_kept)
        self.assertIn("X轴", mixed_issue["site_note"].why_kept)
        self.assertIn("Y轴", mixed_issue["site_note"].why_kept)
        self.assertIn("安全半径表未补录", mixed_issue["site_note"].missing_materials)
        self.assertIn("先等展陈设计师阿景补录安全半径表", mixed_issue["site_note"].next_action)
        self.assertIn("阿景", mixed_issue["site_note"].contact_person)
        self.assertIn("巡检组", mixed_issue["site_note"].contact_person)

    def test_site_note_updates_after_step2(self):
        self.wf.step1_import_point_cloud_log("NOTE-TEST-002", self.point_cloud_data)
        
        issues_before = self.wf.get_all_issues_with_notes()
        note_before = next(i for i in issues_before if i["issue"].item_identifier == "PC-004")["site_note"]
        version_before = note_before.version
        
        self.wf.step2_review_safety_radius_table("NOTE-SR-002", self.safety_radius_data)
        
        issues_after = self.wf.get_all_issues_with_notes()
        note_after = next(i for i in issues_after if i["issue"].item_identifier == "PC-004")["site_note"]
        
        self.assertEqual(note_after.version, version_before + 1)
        self.assertNotEqual(note_before.next_action, note_after.next_action)
        self.assertIn("请巡检组先复核坐标系统一性", note_after.next_action)
        self.assertIn("别急着归正常", note_after.next_action)
        self.assertIn("坐标转换", note_after.next_action)
        self.assertIn("阿景", note_after.next_action)

    def test_mixed_coords_not_auto_normalized(self):
        self.wf.step1_import_point_cloud_log("NORMALIZE-TEST-001", self.point_cloud_data)
        self.wf.step2_review_safety_radius_table("NORMALIZE-SR-001", self.safety_radius_data)
        finalized = self.wf.step3_finalize_for_site_team()
        
        mixed_items = [i for i in finalized if i["issue"].is_mixed]
        for item in mixed_items:
            self.assertNotEqual(item["issue"].status, "ready_for_construction")
            self.assertTrue(item["issue"].reserved_for_inspection)
            self.assertTrue(item["action_required"])
            self.assertIn("现场复核坐标系统一性", item["site_note"].next_action)

if __name__ == "__main__":
    print("🚄 运行轨道交通限界检查系统完整测试...")
    print(f"测试数据库路径: {DB_PATH}")
    print()
    
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(TestCoordinateDetector))
    suite.addTests(loader.loadTestsFromTestCase(TestFullWorkflow))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print()
    print("="*60)
    if result.wasSuccessful():
        print("✅ 所有测试通过！系统功能完整可用。")
    else:
        print(f"❌ 测试失败: {len(result.failures)} 个失败, {len(result.errors)} 个错误")
    print("="*60)
    
    remove_db()
    
    sys.exit(0 if result.wasSuccessful() else 1)
