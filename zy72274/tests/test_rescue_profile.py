import unittest
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
from models import *
from boundary_rules import BoundaryRuleEngine, BoundaryRuleCode, LengthMismatchDecision
from services import ImportService, HistoryService, DisplayService, WorkflowService


class TestBoundaryRules(unittest.TestCase):
    """边界规则单元测试"""

    def test_rule_001_route_length_not_recalculated(self):
        """RULE_001: 补录路线未重新计算长度"""
        result = BoundaryRuleEngine.check_route_length({
            "has_recalculated_length": False,
            "route_length": 45.2,
            "historical_route_length": None
        })

        self.assertEqual(result.rule_code, BoundaryRuleCode.ROUTE_LENGTH_NOT_RECALCULATED)
        self.assertFalse(result.passed)
        self.assertEqual(result.decision, LengthMismatchDecision.PENDING_REVIEW)
        self.assertTrue(result.can_rollback)

    def test_rule_001_route_length_diff_over_5_percent(self):
        """RULE_001: 路线长度差异超过5%"""
        result = BoundaryRuleEngine.check_route_length({
            "has_recalculated_length": True,
            "route_length": 110.0,
            "historical_route_length": 100.0
        })

        self.assertFalse(result.passed)
        self.assertAlmostEqual(result.evidence["diff_percentage"], 10.0, places=1)

    def test_rule_001_route_length_diff_within_5_percent(self):
        """RULE_001: 路线长度差异在5%以内"""
        result = BoundaryRuleEngine.check_route_length({
            "has_recalculated_length": True,
            "route_length": 103.0,
            "historical_route_length": 100.0
        })

        self.assertTrue(result.passed)
        self.assertAlmostEqual(result.evidence["diff_percentage"], 3.0, places=1)

    def test_rule_002_duplicate_import(self):
        """RULE_002: 重复导入检测"""
        result = BoundaryRuleEngine.check_duplicate_import("INSP-001", exists=True)

        self.assertEqual(result.rule_code, BoundaryRuleCode.DUPLICATE_PHOTO_IMPORT)
        self.assertFalse(result.passed)
        self.assertFalse(result.can_rollback)

    def test_rule_003_remark_change(self):
        """RULE_003: 备注修改检测"""
        result = BoundaryRuleEngine.check_remark_change(
            "layer_remark",
            "原备注内容",
            "修改后的备注内容"
        )

        self.assertTrue(result.passed)
        self.assertTrue(result.can_rollback)
        self.assertEqual(result.evidence["old_value"], "原备注内容")
        self.assertEqual(result.evidence["new_value"], "修改后的备注内容")

    def test_rule_004_workflow_skip_step(self):
        """RULE_004: 跳过工作流步骤检测"""
        steps = ["photo_import", "cad_layer_review", "export_screenshot"]

        result = BoundaryRuleEngine.check_workflow_step(
            "photo_import", "export_screenshot", steps
        )

        self.assertFalse(result.passed)
        self.assertEqual(result.decision, LengthMismatchDecision.PENDING_REVIEW)

    def test_rule_004_workflow_normal_advance(self):
        """RULE_004: 正常推进工作流步骤"""
        steps = ["photo_import", "cad_layer_review", "export_screenshot"]

        result = BoundaryRuleEngine.check_workflow_step(
            "photo_import", "cad_layer_review", steps
        )

        self.assertTrue(result.passed)

    def test_rule_005_export_without_review(self):
        """RULE_005: 未复核导出检测"""
        result = BoundaryRuleEngine.check_export_allowed(
            needs_review=True,
            length_mismatch=False
        )

        self.assertEqual(result.rule_code, BoundaryRuleCode.EXPORT_WITHOUT_REVIEW)
        self.assertFalse(result.passed)


class TestImportService(unittest.TestCase):
    """导入服务单元测试"""

    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)
        cls._test_counter = 0

    def setUp(self):
        TestImportService._test_counter += 1
        self.db = self.Session()

    def tearDown(self):
        self.db.close()

    def test_import_new_photos(self):
        """导入新照片，创建剖面记录"""
        service = ImportService(self.db)

        records = [
            {
                "photo_number": "INSP-TEST-001",
                "floor": "B1F",
                "route_length": 50.0,
                "has_recalculated_length": True
            }
        ]

        batch, results = service.import_photos(records, "test.xlsx", "测试员")

        self.assertEqual(batch.new_count, 1)
        self.assertEqual(batch.duplicate_count, 0)
        self.assertEqual(batch.total_count, 1)

        summary = service.get_import_summary(batch.batch_id)
        self.assertEqual(summary["rescue_profile_count"], 1)

    def test_import_duplicate_photos_no_double_count(self):
        """重复导入不翻倍，不计入数量"""
        service = ImportService(self.db)

        records = [
            {
                "photo_number": "INSP-TEST-002",
                "floor": "B1F",
                "route_length": 50.0,
                "has_recalculated_length": True
            }
        ]

        batch1, _ = service.import_photos(records, "test1.xlsx", "测试员")
        batch2, _ = service.import_photos(records, "test2.xlsx", "测试员")

        self.assertEqual(batch1.new_count, 1)
        self.assertEqual(batch2.new_count, 0)
        self.assertEqual(batch2.duplicate_count, 1)

        summary1 = service.get_import_summary(batch1.batch_id)
        summary2 = service.get_import_summary(batch2.batch_id)

        self.assertEqual(summary1["rescue_profile_count"], 1)
        self.assertEqual(summary2["rescue_profile_count"], 0)

    def test_import_route_length_mismatch(self):
        """导入未重算长度的路线，标记待复核"""
        service = ImportService(self.db)

        records = [
            {
                "photo_number": "INSP-TEST-003",
                "floor": "B1F",
                "route_length": 50.0,
                "has_recalculated_length": False
            }
        ]

        batch, results = service.import_photos(records, "test.xlsx", "测试员")

        summary = service.get_import_summary(batch.batch_id)
        self.assertEqual(summary["needs_review"], 1)
        self.assertEqual(summary["length_mismatch"], 1)

    def test_raw_data_preserved(self):
        """原始数据不清洗，完整保留"""
        service = ImportService(self.db)

        raw_data = {
            "photo_number": "INSP-TEST-004",
            "floor": "B1F",
            "route_length": 50.0,
            "has_recalculated_length": True,
            "extra_field": "许工手写备注：此处有变更",
            "another_field": "原始数据，不要洗"
        }

        batch, _ = service.import_photos([raw_data], "test.xlsx", "测试员")

        photo = self.db.query(InspectionPhoto).filter(
            InspectionPhoto.photo_number == "INSP-TEST-004"
        ).first()

        self.assertIn("许工手写备注", photo.raw_data)
        self.assertIn("不要洗", photo.raw_data)


class TestHistoryService(unittest.TestCase):
    """历史服务单元测试"""
    _test_counter = 0

    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        TestHistoryService._test_counter += 1
        self.db = self.Session()
        self._setup_test_data()

    def tearDown(self):
        self.db.close()

    def _setup_test_data(self):
        self.photo = InspectionPhoto(
            photo_number=f"INSP-HIST-{TestHistoryService._test_counter:03d}",
            floor="B1F",
            route_length=50.0,
            has_recalculated_length=True,
            raw_data="{}",
            import_batch_id="BATCH-TEST"
        )
        self.db.add(self.photo)
        self.db.flush()

        self.layer = CADLayer(
            photo_id=self.photo.id,
            layer_name="WALL-B1F-001【防火墙】",
            layer_name_clean="WALL-B1F-001",
            layer_remark="原备注",
            layer_material="混凝土",
            layer_thickness=0.3,
            has_remark=True,
            reviewed_by="许工"
        )
        self.db.add(self.layer)
        self.db.commit()

    def test_update_remark_records_history(self):
        """修改备注自动记录历史"""
        service = HistoryService(self.db)

        new_remark = "修改后的备注：此处为新增防火墙，原图纸漏标"
        layer, results = service.update_cad_layer_remark(
            layer_id=self.layer.id,
            new_remark=new_remark,
            new_layer_name=None,
            changed_by="许工",
            change_reason="现场复核后补充"
        )

        history = service.get_photo_history(self.photo.id)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["field_name"], "layer_remark")
        self.assertEqual(history[0]["old_value"], "原备注")
        self.assertEqual(history[0]["new_value"], new_remark)
        self.assertTrue(history[0]["rollback_possible"])

    def test_compare_history_shows_diff(self):
        """对比历史记录，显示改前改后差别"""
        service = HistoryService(self.db)

        new_remark = "修改后的备注"
        layer, _ = service.update_cad_layer_remark(
            layer_id=self.layer.id,
            new_remark=new_remark,
            new_layer_name=None,
            changed_by="许工",
            change_reason="测试"
        )

        history_list = service.get_photo_history(self.photo.id)
        history_id = history_list[0]["history_id"]

        diff = service.compare_history(history_id)
        self.assertEqual(diff["field_name"], "layer_remark")
        self.assertEqual(diff["before"]["value"], "原备注")
        self.assertEqual(diff["after"]["value"], "修改后的备注")
        self.assertIn("- 原备注", diff["diff"])
        self.assertIn("+ 修改后的备注", diff["diff"])

    def test_rollback_remark_change(self):
        """回滚备注修改"""
        service = HistoryService(self.db)

        new_remark = "错误的备注修改"
        layer, _ = service.update_cad_layer_remark(
            layer_id=self.layer.id,
            new_remark=new_remark,
            new_layer_name=None,
            changed_by="测试员",
            change_reason="测试回滚"
        )

        history_list = service.get_photo_history(self.photo.id)
        history_id = history_list[0]["history_id"]

        rollback_record = service.rollback(history_id, "管理员")

        self.db.refresh(self.layer)
        self.assertEqual(self.layer.layer_remark, "原备注")
        self.assertTrue(history_list[0]["rollback_possible"])

        new_history = service.get_photo_history(self.photo.id)
        self.assertEqual(len(new_history), 2)
        self.assertEqual(new_history[0]["rollback_from_id"], history_id)

    def test_update_layer_name_preserves_full_name(self):
        """修改图层名完整保留，不清洗"""
        service = HistoryService(self.db)

        new_name = "WALL-B1F-001【防火墙+耐火极限3h+许工复核2026.06.01】"
        layer, results = service.update_cad_layer_remark(
            layer_id=self.layer.id,
            new_remark=None,
            new_layer_name=new_name,
            changed_by="许工",
            change_reason="补充图层备注"
        )

        self.assertEqual(layer.layer_name, new_name)
        self.assertIn("【", layer.layer_name)
        self.assertIn("许工复核", layer.layer_name)


class TestDisplayService(unittest.TestCase):
    """展示服务单元测试"""
    _test_counter = 0

    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        TestDisplayService._test_counter += 1
        self.db = self.Session()
        self._setup_test_data()

    def tearDown(self):
        self.db.close()

    def _setup_test_data(self):
        self.photo = InspectionPhoto(
            photo_number=f"INSP-DISP-{TestDisplayService._test_counter:03d}",
            floor="B1F",
            location_x=100.5,
            location_y=200.3,
            location_z=-5.0,
            route_length=50.0,
            has_recalculated_length=True,
            raw_data="{}",
            import_batch_id="BATCH-TEST"
        )
        self.db.add(self.photo)
        self.db.flush()

        self.layer = CADLayer(
            photo_id=self.photo.id,
            layer_name="WALL-B1F-001【防火墙+耐火极限3h】",
            layer_name_clean="WALL-B1F-001",
            layer_remark="许工备注：此处为防火墙",
            layer_material="混凝土",
            layer_thickness=0.3,
            has_remark=True
        )
        self.db.add(self.layer)

        self.profile = RescueProfile(
            photo_id=self.photo.id,
            profile_type="2d",
            floor_section="B1F",
            status="reviewed",
            length_mismatch=False,
            needs_review=False,
            workflow_step="photo_import"
        )
        self.db.add(self.profile)
        self.db.commit()

    def test_3d_view_has_source_refs(self):
        """3D视图数据点携带溯源引用"""
        service = DisplayService(self.db)
        view_data = service.get_3d_view_data(self.profile.id)

        self.assertEqual(view_data["mode"], "3d")
        self.assertGreater(len(view_data["data_points"]), 0)

        for point in view_data["data_points"]:
            self.assertIn("_source_refs", point)
            self.assertIn("photo_number", point["_source_refs"])
            self.assertIn("cad_layers", point["_source_refs"])

    def test_trace_to_source_returns_photo_and_layer(self):
        """点击数据点追溯到巡检照片编号和CAD图层名"""
        service = DisplayService(self.db)
        source = service.trace_to_source(self.profile.id, point_index=0)

        self.assertEqual(source["photo_number"], self.photo.photo_number)
        self.assertEqual(len(source["cad_layers"]), 1)
        self.assertEqual(source["cad_layers"][0]["layer_name"], "WALL-B1F-001【防火墙+耐火极限3h】")
        self.assertEqual(source["cad_layers"][0]["layer_remark"], "许工备注：此处为防火墙")

    def test_chart_view_has_source_refs(self):
        """图表数据携带溯源引用"""
        service = DisplayService(self.db)
        chart_data = service.get_chart_view_data(self.profile.id)

        self.assertEqual(chart_data["mode"], "chart")
        for series in chart_data["series"]:
            self.assertIn("_source_refs", series)

    def test_length_mismatch_shows_warning(self):
        """存在长度不匹配时显示警告"""
        self.profile.length_mismatch = True
        self.db.commit()

        service = DisplayService(self.db)
        view_data = service.get_3d_view_data(self.profile.id)

        self.assertIn("warnings", view_data)
        self.assertEqual(len(view_data["warnings"]), 1)
        self.assertEqual(view_data["warnings"][0]["type"], "length_mismatch")

    def test_length_issue_in_source_refs(self):
        """未重算长度时，溯源引用中显示问题"""
        self.photo.has_recalculated_length = False
        self.db.commit()

        service = DisplayService(self.db)
        source = service.trace_to_source(self.profile.id, point_index=0)

        self.assertIsNotNone(source["length_issue"])
        self.assertTrue(source["length_issue"]["has_issue"])
        self.assertIn("未重新计算长度", source["length_issue"]["message"])


class TestWorkflowService(unittest.TestCase):
    """工作流服务单元测试"""
    _test_counter = 0

    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        TestWorkflowService._test_counter += 1
        self.db = self.Session()
        self._setup_test_data()

    def tearDown(self):
        self.db.close()

    def _setup_test_data(self):
        self.photo = InspectionPhoto(
            photo_number=f"INSP-WF-{TestWorkflowService._test_counter:03d}",
            floor="B1F",
            route_length=50.0,
            has_recalculated_length=True,
            raw_data="{}",
            import_batch_id="BATCH-TEST"
        )
        self.db.add(self.photo)
        self.db.flush()

        self.profile = RescueProfile(
            photo_id=self.photo.id,
            profile_type="2d",
            floor_section="B1F",
            status="pending",
            length_mismatch=False,
            needs_review=False,
            workflow_step="photo_import"
        )
        self.db.add(self.profile)
        self.db.commit()

    def test_workflow_three_steps(self):
        """三步工作流正常推进"""
        service = WorkflowService(self.db)

        status = service.get_workflow_status(self.profile.id)
        self.assertEqual(status["current_step"], "photo_import")
        self.assertTrue(status["can_advance"])

        cad_data = {
            "layers": [
                {
                    "layer_name": "WALL-B1F-001【防火墙+耐火极限3h】",
                    "layer_remark": "许工补录：此处为新增防火墙",
                    "layer_material": "混凝土",
                    "layer_thickness": 0.3
                }
            ]
        }

        profile, _ = service.advance_step(self.profile.id, "许工", cad_data=cad_data)
        self.assertEqual(profile.workflow_step, "cad_layer_review")

        profile, _ = service.advance_step(self.profile.id, "操作员", screenshot_path="/tmp/shot.png")
        self.assertEqual(profile.workflow_step, "export_screenshot")
        self.assertEqual(profile.status, "reviewed")

    def test_workflow_cannot_skip_step(self):
        """不能跳过工作流步骤 - 直接检查边界规则"""
        from boundary_rules import BoundaryRuleEngine

        steps = ["photo_import", "cad_layer_review", "export_screenshot"]
        result = BoundaryRuleEngine.check_workflow_step(
            "photo_import", "export_screenshot", steps
        )

        self.assertFalse(result.passed)
        self.assertEqual(result.rule_code, BoundaryRuleCode.WORKFLOW_SKIP_STEP)

    def test_length_mismatch_blocks_workflow(self):
        """存在长度不匹配时，阻止推进到导出步骤"""
        self.profile.length_mismatch = True
        self.profile.needs_review = True
        self.profile.workflow_step = "cad_layer_review"
        self.db.commit()

        service = WorkflowService(self.db)

        status = service.get_workflow_status(self.profile.id)
        self.assertFalse(status["can_advance"])
        self.assertIsNotNone(status["blocked_reason"])

        profile, results = service.advance_step(self.profile.id, "操作员", screenshot_path="/tmp/shot.png")
        self.assertEqual(profile.workflow_step, "cad_layer_review")
        self.assertFalse(all(r.passed for r in results))
        self.assertTrue(any(not r.passed for r in results))

    def test_length_mismatch_leaves_for_customer_review(self):
        """长度不匹配别急着归正常，留给客户复核"""
        self.photo.has_recalculated_length = False
        self.profile.length_mismatch = True
        self.profile.needs_review = True
        self.db.commit()

        service = WorkflowService(self.db)

        profile, results = service.resolve_length_mismatch(
            profile_id=self.profile.id,
            new_length=52.0,
            resolved_by="许工",
            recalculated=True
        )

        self.assertFalse(profile.length_mismatch)
        self.assertFalse(profile.needs_review)
        self.assertEqual(profile.status, "normal")

        history = self.db.query(ChangeHistory).filter(
            ChangeHistory.photo_id == self.photo.id
        ).first()
        self.assertIsNotNone(history)
        self.assertEqual(history.field_name, "route_length")

    def test_customer_review_accepted_with_mismatch(self):
        """客户复核通过但仍有长度不匹配，状态为 abnormal"""
        self.profile.length_mismatch = True
        self.profile.needs_review = True
        self.db.commit()

        service = WorkflowService(self.db)

        profile = service.complete_customer_review(
            profile_id=self.profile.id,
            reviewed_by="客户代表",
            review_result="accepted",
            remarks="同意按现有长度处理"
        )

        self.assertEqual(profile.status, "abnormal")
        self.assertFalse(profile.needs_review)
        self.assertTrue(profile.length_mismatch)

    def test_complete_workflow_with_length_mismatch(self):
        """完整工作流演示：碰到长度问题留待客户复核"""
        service = WorkflowService(self.db)

        photo_data = {
            "photo_number": "INSP-WF-DEMO-001",
            "floor": "B1F",
            "route_length": 45.2,
            "has_recalculated_length": False
        }

        cad_layers = [
            {
                "layer_name": "WALL-B1F-001【防火墙+耐火极限3h】",
                "layer_remark": "许工补录备注",
                "layer_material": "混凝土",
                "layer_thickness": 0.3
            }
        ]

        result = service.run_complete_workflow(
            photo_data=photo_data,
            cad_layers_data=cad_layers,
            operator="许工"
        )

        self.assertTrue(result["needs_customer_review"])

        actions = [log for log in result["workflow_log"] if "action" in log]
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0]["action"], "length_mismatch_detected")
        self.assertIn("留待客户复核", actions[0]["message"])

        self.assertEqual(result["final_status"]["current_step"], "cad_layer_review")
        self.assertTrue(result["final_status"]["length_mismatch"])
        self.assertTrue(result["final_status"]["needs_review"])
        self.assertFalse(result["final_status"]["can_advance"])


if __name__ == "__main__":
    unittest.main()
