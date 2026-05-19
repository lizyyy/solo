import unittest
import os
from datetime import datetime
from database import init_db, get_session
from models import Base, Patient, Escort, InspectionTask, TaskStatus
from service import ClinicService


class TestClinicService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "clinic_service.db")
        if os.path.exists(db_path):
            os.remove(db_path)
        init_db()

    def setUp(self):
        self.service = ClinicService()

    def tearDown(self):
        self.service.close()

    def test_create_patient_idempotent(self):
        """测试患者创建的幂等性"""
        result1 = self.service.create_patient("TEST_P001", "测试患者1", 30, "男")
        self.assertTrue(result1.success)
        self.assertEqual(result1.message, "患者创建成功")

        result2 = self.service.create_patient("TEST_P001", "测试患者1", 30, "男")
        self.assertTrue(result2.success)
        self.assertEqual(result2.message, "患者已存在，返回已有数据")
        self.assertIn("幂等处理", result2.reason)

    def test_create_escort_idempotent(self):
        """测试陪检员创建的幂等性"""
        result1 = self.service.create_escort("TEST_E001", "测试陪检1", "13800000001")
        self.assertTrue(result1.success)
        self.assertEqual(result1.message, "陪检员创建成功")

        result2 = self.service.create_escort("TEST_E001", "测试陪检1", "13800000001")
        self.assertTrue(result2.success)
        self.assertEqual(result2.message, "陪检员已存在，返回已有数据")
        self.assertIn("幂等处理", result2.reason)

    def test_create_task_idempotent(self):
        """测试任务创建的幂等性"""
        self.service.create_patient("TEST_P002", "测试患者2")
        self.service.create_escort("TEST_E002", "测试陪检2")

        result1 = self.service.create_task("TEST_T001", "TEST_P002", "心电图", "心电图室", "normal")
        self.assertTrue(result1.success)
        self.assertEqual(result1.message, "任务创建成功")

        result2 = self.service.create_task("TEST_T001", "TEST_P002", "心电图", "心电图室", "normal")
        self.assertTrue(result2.success)
        self.assertEqual(result2.message, "任务已存在，返回已有数据")
        self.assertIn("幂等处理", result2.reason)

    def test_task_workflow(self):
        """测试完整任务流程：创建->派单->接单->开始->完成"""
        self.service.create_patient("TEST_P003", "测试患者3")
        self.service.create_escort("TEST_E003", "测试陪检3")

        result = self.service.create_task("TEST_T002", "TEST_P003", "CT检查", "影像科", "normal")
        self.assertTrue(result.success)
        self.assertEqual(result.data["status"], TaskStatus.PENDING.value)

        result = self.service.assign_task("TEST_T002", escort_id="TEST_E003", operator_id="OP001")
        self.assertTrue(result.success)

        task = self.service.session.query(InspectionTask).filter_by(task_id="TEST_T002").first()
        self.assertEqual(task.status, TaskStatus.ASSIGNED.value)

        result = self.service.accept_task("TEST_T002", "TEST_E003")
        self.assertTrue(result.success)

        result = self.service.start_task("TEST_T002", "TEST_E003")
        self.assertTrue(result.success)

        result = self.service.complete_task("TEST_T002", "TEST_E003", 1500)
        self.assertTrue(result.success)

        task = self.service.session.query(InspectionTask).filter_by(task_id="TEST_T002").first()
        self.assertEqual(task.status, TaskStatus.COMPLETED.value)

    def test_cancel_task_with_reassignment(self):
        """测试取消任务触发补位机制"""
        self.service.create_patient("TEST_P004", "测试患者4")
        self.service.create_patient("TEST_P005", "测试患者5")
        self.service.create_escort("TEST_E004", "测试陪检4", max_tasks=1)

        self.service.create_task("TEST_T003", "TEST_P004", "B超", "B超室", "normal")
        self.service.create_task("TEST_T004", "TEST_P005", "X线", "放射科", "normal")

        result = self.service.assign_task("TEST_T003")
        self.assertTrue(result.success)

        result = self.service.assign_task("TEST_T004")
        self.assertFalse(result.success, "陪检员已满，应该无法派单")

        result = self.service.cancel_task("TEST_T003", "患者取消", "OP001")
        self.assertTrue(result.success)

        task3 = self.service.session.query(InspectionTask).filter_by(task_id="TEST_T003").first()
        self.assertEqual(task3.status, TaskStatus.CANCELLED.value)

    def test_transfer_task(self):
        """测试任务转派"""
        self.service.create_patient("TEST_P006", "测试患者6")
        self.service.create_escort("TEST_E005", "测试陪检5")
        self.service.create_escort("TEST_E006", "测试陪检6")

        self.service.create_task("TEST_T005", "TEST_P006", "MRI检查", "影像科", "normal")
        self.service.assign_task("TEST_T005", "TEST_E005")

        task = self.service.session.query(InspectionTask).filter_by(task_id="TEST_T005").first()
        from_escort = self.service.session.query(Escort).filter_by(escort_id="TEST_E005").first()
        self.assertEqual(task.assigned_escort_id, from_escort.id)
        self.assertEqual(from_escort.current_task_count, 1)

        result = self.service.transfer_task("TEST_T005", "TEST_E005", "TEST_E006", "TEST_E005临时有事")
        self.assertTrue(result.success)

        task = self.service.session.query(InspectionTask).filter_by(task_id="TEST_T005").first()
        to_escort = self.service.session.query(Escort).filter_by(escort_id="TEST_E006").first()
        self.assertEqual(task.assigned_escort_id, to_escort.id)

        from_escort = self.service.session.query(Escort).filter_by(escort_id="TEST_E005").first()
        self.assertEqual(from_escort.current_task_count, 0)
        self.assertEqual(to_escort.current_task_count, 1)

    def test_task_history_recording(self):
        """测试历史记录功能"""
        self.service.create_patient("TEST_P007", "测试患者7")
        self.service.create_escort("TEST_E007", "测试陪检7")

        self.service.create_task("TEST_T006", "TEST_P007", "化验", "检验科", "normal")
        self.service.assign_task("TEST_T006", operator_id="OP001")

        result = self.service.get_task_history("TEST_T006")
        self.assertTrue(result.success)
        self.assertGreater(len(result.data["history"]), 0)

        actions = [h["action"] for h in result.data["history"]]
        self.assertIn("CREATE", actions)
        self.assertIn("ASSIGN", actions)

    def test_invalid_operations(self):
        """测试无效操作的拦截"""
        result = self.service.create_task("TEST_T_INVALID", "NON_EXISTENT", "检查", "地点")
        self.assertFalse(result.success)
        self.assertIn("患者不存在", result.message)

        result = self.service.assign_task("NON_EXISTENT_TASK")
        self.assertFalse(result.success)
        self.assertIn("任务不存在", result.message)

        result = self.service.accept_task("NON_EXISTENT_TASK", "E001")
        self.assertFalse(result.success)
        self.assertIn("任务不存在", result.message)

    def test_daily_statistics(self):
        """测试每日统计功能"""
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        result = self.service.get_daily_report(today_str)
        self.assertTrue(result.success)

    def test_list_tasks(self):
        """测试任务列表功能"""
        result = self.service.list_tasks()
        self.assertTrue(result.success)
        self.assertIn("count", result.data)
        self.assertIn("tasks", result.data)


if __name__ == "__main__":
    unittest.main(verbosity=2)
