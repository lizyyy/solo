import unittest
import os
import shutil
from drill_service.storage import Storage
from drill_service.services import DrillService, TrafficService
from drill_service.models import RegionStatus, DrillPlanStatus


class TestDrillService(unittest.TestCase):
    
    def setUp(self):
        self.test_dir = "./test_data"
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
        self.storage = Storage(self.test_dir)
        self.traffic_service = TrafficService(self.storage)
        self.drill_service = DrillService(self.storage)
        
        self.regions = self.traffic_service.initialize_regions(["beijing", "shanghai"])
    
    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
    
    def test_region_initialization(self):
        regions = self.traffic_service.list_regions()
        self.assertEqual(len(regions), 2)
        
        beijing = self.traffic_service.get_region("beijing")
        shanghai = self.traffic_service.get_region("shanghai")
        
        self.assertEqual(beijing.status, RegionStatus.ACTIVE)
        self.assertEqual(beijing.traffic_weight, 100)
        self.assertFalse(beijing.is_read_only)
        
        self.assertEqual(shanghai.status, RegionStatus.STANDBY)
        self.assertEqual(shanghai.traffic_weight, 0)
        self.assertFalse(shanghai.is_read_only)
    
    def test_create_plan(self):
        plan = self.drill_service.create_plan(
            name="切换演练",
            source_region="beijing",
            target_region="shanghai",
            operator="admin",
        )
        
        self.assertEqual(plan.source_region, "beijing")
        self.assertEqual(plan.target_region, "shanghai")
        self.assertEqual(plan.status, DrillPlanStatus.DRAFT)
        self.assertEqual(plan.current_step, 0)
        self.assertEqual(plan.total_steps, 6)
    
    def test_create_plan_with_invalid_region(self):
        with self.assertRaises(ValueError) as ctx:
            self.drill_service.create_plan(
                name="测试",
                source_region="invalid",
                target_region="shanghai",
                operator="admin",
            )
        self.assertIn("不存在", str(ctx.exception))
    
    def test_full_drill_flow_with_rollback(self):
        plan = self.drill_service.create_plan(
            name="完整切换演练",
            source_region="beijing",
            target_region="shanghai",
            operator="admin",
        )
        
        plan = self.drill_service.start_drill(plan.plan_id, "admin")
        self.assertEqual(plan.status, DrillPlanStatus.IN_PROGRESS)
        self.assertEqual(plan.current_step, 1)
        
        plan = self.drill_service.advance_to_traffic_warmup(plan.plan_id, "admin")
        self.assertEqual(plan.current_step, 2)
        
        plan, switch_info = self.drill_service.execute_traffic_warmup(
            plan.plan_id, "admin", warmup_percent=20
        )
        self.assertEqual(plan.status, DrillPlanStatus.SWITCHING)
        self.assertEqual(plan.current_step, 3)
        
        traffic = self.drill_service.get_current_traffic()
        self.assertEqual(traffic["beijing"], 80)
        self.assertEqual(traffic["shanghai"], 20)
        
        self.traffic_service.set_region_readonly("beijing", True)
        ok, msg = self.drill_service.validate_readonly(plan.plan_id, "admin")
        self.assertTrue(ok)
        
        plan, switch_info = self.drill_service.execute_full_switch(plan.plan_id, "admin")
        self.assertEqual(plan.status, DrillPlanStatus.SWITCHED)
        self.assertEqual(plan.current_step, 5)
        
        traffic = self.drill_service.get_current_traffic()
        self.assertEqual(traffic["beijing"], 0)
        self.assertEqual(traffic["shanghai"], 100)
        
        beijing = self.traffic_service.get_region("beijing")
        self.assertTrue(beijing.is_read_only)
        
        plan = self.drill_service.request_rollback(plan.plan_id, "admin", "演练结束")
        self.assertEqual(plan.status, DrillPlanStatus.ROLLBACK_PENDING)
        
        plan, switch_info = self.drill_service.execute_rollback(plan.plan_id, "admin")
        self.assertEqual(plan.status, DrillPlanStatus.ROLLBACKING)
        
        traffic = self.drill_service.get_current_traffic()
        self.assertEqual(traffic["beijing"], 100)
        self.assertEqual(traffic["shanghai"], 0)
        
        beijing = self.traffic_service.get_region("beijing")
        self.assertFalse(beijing.is_read_only)
        
        plan = self.drill_service.confirm_rollback(plan.plan_id, "admin")
        self.assertEqual(plan.status, DrillPlanStatus.COMPLETED)
    
    def test_step_sequence_validation(self):
        plan = self.drill_service.create_plan(
            name="顺序测试",
            source_region="beijing",
            target_region="shanghai",
            operator="admin",
        )
        
        plan = self.drill_service.start_drill(plan.plan_id, "admin")
        
        with self.assertRaises(ValueError) as ctx:
            self.drill_service.execute_traffic_warmup(plan.plan_id, "admin")
        self.assertIn("步骤顺序错误", str(ctx.exception))
    
    def test_traffic_weights_validation(self):
        with self.assertRaises(ValueError) as ctx:
            self.traffic_service.switch_traffic(
                plan_id="test",
                step_index=1,
                target_weights={"beijing": 60, "shanghai": 50},
                operator="admin",
            )
        self.assertIn("必须为100", str(ctx.exception))
    
    def test_readonly_validation(self):
        plan = self.drill_service.create_plan(
            name="只读测试",
            source_region="beijing",
            target_region="shanghai",
            operator="admin",
        )
        
        plan = self.drill_service.start_drill(plan.plan_id, "admin")
        plan = self.drill_service.advance_to_traffic_warmup(plan.plan_id, "admin")
        plan, _ = self.drill_service.execute_traffic_warmup(plan.plan_id, "admin")
        
        ok, msg = self.drill_service.validate_readonly(plan.plan_id, "admin")
        self.assertFalse(ok)
        self.assertIn("未设置为只读", msg)
        
        self.traffic_service.set_region_readonly("beijing", True)
        ok, msg = self.drill_service.validate_readonly(plan.plan_id, "admin")
        self.assertTrue(ok)
    
    def test_history_recording(self):
        plan = self.drill_service.create_plan(
            name="历史记录测试",
            source_region="beijing",
            target_region="shanghai",
            operator="admin",
        )
        
        history = self.drill_service.get_plan_history(plan.plan_id)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["operation_type"], "create_plan")
        self.assertEqual(history[0]["operator"], "admin")
    
    def test_supplement_and_withdraw(self):
        plan = self.drill_service.create_plan(
            name="补录撤回测试",
            source_region="beijing",
            target_region="shanghai",
            operator="admin",
        )
        
        self.drill_service.supplement_info(plan.plan_id, "admin", "额外信息")
        
        history = self.drill_service.get_plan_history(plan.plan_id)
        supplements = [h for h in history if h["operation_type"] == "supplement"]
        self.assertEqual(len(supplements), 1)
        
        supplement_history = supplements[0]
        self.drill_service.withdraw_operation(
            plan.plan_id,
            supplement_history["history_id"],
            "admin",
            "信息有误",
        )
        
        updated_history = self.drill_service.get_plan_history(plan.plan_id)
        updated_supplement = next(
            h for h in updated_history if h["history_id"] == supplement_history["history_id"]
        )
        self.assertTrue(updated_supplement["is_withdrawn"])
        
        withdraw_ops = [h for h in updated_history if h["operation_type"] == "withdraw"]
        self.assertEqual(len(withdraw_ops), 1)
    
    def test_report_generation(self):
        plan = self.drill_service.create_plan(
            name="报告测试",
            source_region="beijing",
            target_region="shanghai",
            operator="admin",
        )
        plan = self.drill_service.start_drill(plan.plan_id, "admin")
        
        report = self.drill_service.generate_report(plan.plan_id)
        
        self.assertEqual(report.plan_id, plan.plan_id)
        self.assertEqual(report.source_region, "beijing")
        self.assertEqual(report.target_region, "shanghai")
        self.assertEqual(len(report.steps), 6)
        self.assertIsNotNone(report.conclusion)
        self.assertTrue(len(report.recommendations) > 0)
    
    def test_cancel_drill(self):
        plan = self.drill_service.create_plan(
            name="取消测试",
            source_region="beijing",
            target_region="shanghai",
            operator="admin",
        )
        plan = self.drill_service.start_drill(plan.plan_id, "admin")
        
        plan = self.drill_service.cancel_drill(plan.plan_id, "admin", "紧急取消")
        self.assertEqual(plan.status, DrillPlanStatus.CANCELLED)
        
        history = self.drill_service.get_plan_history(plan.plan_id)
        cancel_ops = [h for h in history if h["operation_type"] == "cancel_drill"]
        self.assertEqual(len(cancel_ops), 1)


if __name__ == "__main__":
    unittest.main()
