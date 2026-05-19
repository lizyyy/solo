#!/usr/bin/env python3
import unittest
import os
import tempfile
from datetime import datetime, timedelta

from database import SessionLocal, init_db, Base, engine, HazardStatus
from services import HazardManagementService
from exporter import DataExporter
from utils import generate_request_key, mask_phone, mask_id, mask_sensitive_data


class TestDataMasking(unittest.TestCase):
    def test_mask_phone(self):
        self.assertEqual(mask_phone("13800138001"), "138****8001")
        self.assertEqual(mask_phone("12345"), "1***5")
        self.assertEqual(mask_phone(""), "")
        self.assertIsNone(mask_phone(None))

    def test_mask_id(self):
        self.assertEqual(len(mask_id("SA001")), len("SA001"))
        self.assertIn("*", mask_id("SA001"))
        self.assertEqual(len(mask_id("ADMIN001")), len("ADMIN001"))
        self.assertIn("*", mask_id("ADMIN001"))
        self.assertEqual(mask_id(""), "")
        self.assertIsNone(mask_id(None))

    def test_mask_sensitive_data(self):
        data = {
            "hazard_no": "H001",
            "rectifier_phone": "13800138001",
            "registered_by_id": "SA001",
            "rectifier_id": "R001"
        }
        masked = mask_sensitive_data(data)
        self.assertEqual(masked["rectifier_phone"], "138****8001")
        self.assertIn("*", masked["registered_by_id"])
        self.assertEqual(len(masked["registered_by_id"]), len("SA001"))
        self.assertEqual(masked["hazard_no"], "H001")


class TestIdempotency(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.service = HazardManagementService(self.db)

    def tearDown(self):
        self.db.close()

    def test_generate_request_key(self):
        key1 = generate_request_key("register", "SA001", "H001")
        key2 = generate_request_key("register", "SA001", "H001")
        key3 = generate_request_key("register", "SA001", "H002")
        self.assertEqual(key1, key2)
        self.assertNotEqual(key1, key3)

    def test_idempotent_register(self):
        hazard_no = f"TEST_IDEMPOTENT_{int(datetime.now().timestamp())}"

        result1 = self.service.register_hazard(
            hazard_no=hazard_no,
            title="测试幂等隐患",
            description="描述",
            location="位置",
            level="一般",
            operator_id="SA001",
            request_id="REQ001"
        )
        self.assertTrue(result1["success"])

        result2 = self.service.register_hazard(
            hazard_no=hazard_no,
            title="测试幂等隐患",
            description="描述",
            location="位置",
            level="一般",
            operator_id="SA001",
            request_id="REQ001"
        )
        self.assertTrue(result2["success"])
        self.assertEqual(result1["data"]["hazard_no"], result2["data"]["hazard_no"])


class TestHazardLifecycle(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.service = HazardManagementService(self.db)
        self.hazard_no = f"TEST_LIFECYCLE_{int(datetime.now().timestamp())}"

    def tearDown(self):
        self.db.close()

    def test_full_lifecycle(self):
        print("\n=== 测试完整生命周期 ===")

        print(f"\n1. 登记隐患: {self.hazard_no}")
        result = self.service.register_hazard(
            hazard_no=self.hazard_no,
            title="测试消防通道堵塞",
            description="A栋1楼消防通道被杂物占用",
            location="A栋1楼",
            level="严重",
            operator_id="SA001"
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["status"], HazardStatus.REGISTERED.value)
        print(f"   ✓ 登记成功, 状态: {result['data']['status']}")

        print(f"\n2. 派发隐患")
        result = self.service.assign_hazard(
            hazard_no=self.hazard_no,
            rectifier_id="R001",
            deadline=datetime.utcnow() + timedelta(days=3),
            operator_id="SA001"
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["status"], HazardStatus.ASSIGNED.value)
        self.assertIsNotNone(result["data"]["rectifier_phone"])
        print(f"   ✓ 派发成功, 整改人: {result['data']['rectifier_name']}")
        print(f"   ✓ 手机号脱敏: {result['data']['rectifier_phone']}")

        print(f"\n3. 整改隐患")
        result = self.service.rectify_hazard(
            hazard_no=self.hazard_no,
            rectification_desc="已清理通道杂物，恢复畅通",
            operator_id="R001"
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["status"], HazardStatus.RECTIFIED.value)
        print(f"   ✓ 整改成功")

        print(f"\n4. 复查隐患")
        result = self.service.recheck_hazard(
            hazard_no=self.hazard_no,
            recheck_result=True,
            recheck_opinion="现场确认整改符合要求",
            operator_id="SA001"
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["status"], HazardStatus.RECHECKED.value)
        print(f"   ✓ 复查通过")

        print(f"\n5. 归档隐患")
        result = self.service.archive_hazard(
            hazard_no=self.hazard_no,
            operator_id="SA001"
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["status"], HazardStatus.ARCHIVED.value)
        print(f"   ✓ 归档完成，隐患闭环")

        print(f"\n6. 验证操作日志")
        logs_result = self.service.get_operation_logs(hazard_no=self.hazard_no)
        self.assertTrue(logs_result["success"])
        self.assertGreaterEqual(logs_result["data"]["total"], 5)
        print(f"   ✓ 操作日志记录完整, 共 {logs_result['data']['total']} 条")

        print(f"\n7. 验证敏感字段脱敏")
        hazard_result = self.service.get_hazard(self.hazard_no)
        hazard_data = hazard_result["data"]
        self.assertIn("*", hazard_data["rectifier_phone"])
        self.assertIn("*", hazard_data["registered_by_id"])
        print(f"   ✓ 敏感字段已脱敏: 手机号={hazard_data['rectifier_phone']}")

    def test_statistics(self):
        print("\n=== 测试统计功能 ===")
        result = self.service.get_statistics()
        self.assertTrue(result["success"])
        self.assertIn("total", result["data"])
        self.assertIn("closed", result["data"])
        self.assertIn("closure_rate", result["data"])
        print(f"   ✓ 总隐患数: {result['data']['total']}")
        print(f"   ✓ 闭环率: {result['data']['closure_rate']}%")


class TestDataExport(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.exporter = DataExporter(self.db)
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        self.db.close()
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_export_excel(self):
        print("\n=== 测试Excel导出 ===")
        output_file = os.path.join(self.temp_dir, "test_export.xlsx")
        result = self.exporter.export_hazards_to_excel(output_file)
        self.assertTrue(result["success"])
        self.assertTrue(os.path.exists(output_file))
        self.assertGreater(os.path.getsize(output_file), 0)
        print(f"   ✓ Excel导出成功: {output_file}")

    def test_export_json(self):
        print("\n=== 测试JSON导出 ===")
        output_file = os.path.join(self.temp_dir, "test_export.json")
        result = self.exporter.export_hazards_to_json(output_file)
        self.assertTrue(result["success"])
        self.assertTrue(os.path.exists(output_file))
        self.assertGreater(os.path.getsize(output_file), 0)
        print(f"   ✓ JSON导出成功: {output_file}")


class TestErrorHandling(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.service = HazardManagementService(self.db)

    def tearDown(self):
        self.db.close()

    def test_duplicate_hazard_no(self):
        print("\n=== 测试错误处理 ===")
        hazard_no = f"TEST_DUPLICATE_{int(datetime.now().timestamp())}"

        self.service.register_hazard(
            hazard_no=hazard_no,
            title="重复测试",
            description="描述",
            location="位置",
            level="一般",
            operator_id="SA001",
            request_id="REQ1"
        )

        with self.assertRaises(Exception) as context:
            self.service.register_hazard(
                hazard_no=hazard_no,
                title="重复测试2",
                description="描述2",
                location="位置2",
                level="严重",
                operator_id="SA001",
                request_id="REQ2"
            )
        print("   ✓ 重复隐患编号正确处理")

    def test_permission_denied(self):
        hazard_no = f"TEST_PERMISSION_{int(datetime.now().timestamp())}"
        self.service.register_hazard(
            hazard_no=hazard_no,
            title="权限测试",
            description="描述",
            location="位置",
            level="一般",
            operator_id="SA001"
        )

        with self.assertRaises(Exception) as context:
            self.service.assign_hazard(
                hazard_no=hazard_no,
                rectifier_id="R001",
                deadline=datetime.utcnow(),
                operator_id="R001"
            )
        print("   ✓ 权限不足正确处理")

    def test_invalid_state_transition(self):
        hazard_no = f"TEST_STATE_{int(datetime.now().timestamp())}"
        self.service.register_hazard(
            hazard_no=hazard_no,
            title="状态测试",
            description="描述",
            location="位置",
            level="一般",
            operator_id="SA001"
        )

        with self.assertRaises(Exception) as context:
            self.service.rectify_hazard(
                hazard_no=hazard_no,
                rectification_desc="未派发就整改",
                operator_id="R001"
            )
        print("   ✓ 无效状态转换正确处理")

    def test_nonexistent_hazard(self):
        with self.assertRaises(Exception) as context:
            self.service.get_hazard("NONEXISTENT_12345")
        self.assertIn("不存在", str(context.exception))
        print("   ✓ 不存在的隐患正确处理")


class TestPersistence(unittest.TestCase):
    def test_data_persistence(self):
        print("\n=== 测试数据持久化 ===")
        hazard_no = f"TEST_PERSIST_{int(datetime.now().timestamp())}"

        db1 = SessionLocal()
        service1 = HazardManagementService(db1)
        service1.register_hazard(
            hazard_no=hazard_no,
            title="持久化测试",
            description="测试重启后数据是否存在",
            location="测试地点",
            level="一般",
            operator_id="SA001"
        )
        db1.close()
        print("   ✓ 数据已写入数据库")

        db2 = SessionLocal()
        service2 = HazardManagementService(db2)
        result = service2.get_hazard(hazard_no)
        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["hazard_no"], hazard_no)
        self.assertEqual(result["data"]["title"], "持久化测试")
        db2.close()
        print("   ✓ 数据持久化验证成功")


def run_tests():
    init_db()

    test_cases = [
        TestDataMasking,
        TestIdempotency,
        TestHazardLifecycle,
        TestDataExport,
        TestErrorHandling,
        TestPersistence,
    ]

    all_results = []
    for test_class in test_cases:
        suite = unittest.TestLoader().loadTestsFromTestCase(test_class)
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        all_results.append((test_class.__name__, result))

    print("\n" + "="*60)
    print("测试汇总:")
    print("="*60)
    total_tests = 0
    total_failures = 0
    total_errors = 0

    for name, result in all_results:
        tests_run = result.testsRun
        failures = len(result.failures)
        errors = len(result.errors)
        status = "✓ 通过" if failures + errors == 0 else "✗ 失败"
        print(f"{name}: {status} ({tests_run} 个测试, {failures} 个失败, {errors} 个错误)")
        total_tests += tests_run
        total_failures += failures
        total_errors += errors

    print("="*60)
    print(f"总计: {total_tests} 个测试, {total_failures} 个失败, {total_errors} 个错误")
    print("="*60)

    return total_failures + total_errors == 0


if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
