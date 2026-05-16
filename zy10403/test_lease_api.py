#!/usr/bin/env python3
import unittest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, LeaseStatus, AuditLog
from schemas import LeaseCreate, LeaseUpdate, LeaseRelease, LeaseManualCorrect, LeaseQueryParams
from services import (
    create_lease, get_lease, query_leases, renew_lease,
    release_lease, manual_correct_lease, recalculate_statuses,
    get_occupancy_report, get_audit_logs, is_lease_expired
)
import os

TEST_DB = "test_preview_lease.db"


class TestLeaseAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.path.exists(TEST_DB):
            os.remove(TEST_DB)
        cls.engine = create_engine(f"sqlite:///{TEST_DB}", connect_args={"check_same_thread": False})
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.Session()
        for table in reversed(Base.metadata.sorted_tables):
            self.db.execute(table.delete())
        self.db.commit()

    def tearDown(self):
        self.db.close()

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(TEST_DB):
            os.remove(TEST_DB)

    def test_1_create_lease_normal_flow(self):
        print("\n=== 测试1: 正常创建租约流程 ===")
        lease_data = LeaseCreate(
            branch_name="feature/test1",
            env_id="test-env-01",
            assignee="tester01",
            lease_start=datetime.now(),
            lease_end=datetime.now() + timedelta(days=7),
            renew_reason="测试功能开发",
            request_id="test-req-001"
        )
        result = create_lease(self.db, lease_data)
        self.assertFalse(result["is_idempotent"])
        self.assertEqual(result["lease"].env_id, "test-env-01")
        print(f"✅ 创建租约成功: ID={result['lease'].id}")

    def test_2_idempotent_request(self):
        print("\n=== 测试2: 重复请求幂等性 ===")
        lease_data = LeaseCreate(
            branch_name="feature/test2",
            env_id="test-env-02",
            assignee="tester02",
            lease_start=datetime.now(),
            lease_end=datetime.now() + timedelta(days=7),
            request_id="test-req-002"
        )
        result1 = create_lease(self.db, lease_data)
        result2 = create_lease(self.db, lease_data)
        self.assertTrue(result2["is_idempotent"])
        self.assertEqual(result1["lease"].id, result2["lease"].id)
        print("✅ 幂等请求验证通过，重复请求返回相同租约")

    def test_3_lease_conflict_detection(self):
        print("\n=== 测试3: 租约冲突检测 ===")
        lease1 = LeaseCreate(
            branch_name="feature/test3a",
            env_id="test-env-03",
            assignee="tester03",
            lease_start=datetime.now(),
            lease_end=datetime.now() + timedelta(days=7),
            request_id="test-req-003a"
        )
        create_lease(self.db, lease1)

        lease2 = LeaseCreate(
            branch_name="feature/test3b",
            env_id="test-env-03",
            assignee="tester03",
            lease_start=datetime.now() + timedelta(days=3),
            lease_end=datetime.now() + timedelta(days=10),
            request_id="test-req-003b"
        )
        with self.assertRaises(ValueError) as ctx:
            create_lease(self.db, lease2)
        self.assertIn("已被占用", str(ctx.exception))
        print(f"✅ 冲突检测正常: {ctx.exception}")

    def test_4_dirty_data_invalid_time(self):
        print("\n=== 测试4: 脏数据处理 - 无效时间 ===")
        lease_data = LeaseCreate(
            branch_name="feature/test4",
            env_id="test-env-04",
            assignee="tester04",
            lease_start=datetime.now() + timedelta(days=7),
            lease_end=datetime.now(),
            request_id="test-req-004"
        )
        with self.assertRaises(ValueError) as ctx:
            create_lease(self.db, lease_data)
        self.assertIn("结束时间必须晚于开始时间", str(ctx.exception))
        print(f"✅ 无效时间检测正常: {ctx.exception}")

    def test_5_lease_expired_check(self):
        print("\n=== 测试5: 租约过期判断 ===")
        lease_data = LeaseCreate(
            branch_name="feature/test5",
            env_id="test-env-05",
            assignee="tester05",
            lease_start=datetime.now() - timedelta(days=10),
            lease_end=datetime.now() - timedelta(days=1),
            request_id="test-req-005"
        )
        result = create_lease(self.db, lease_data)
        lease = get_lease(self.db, result["lease"].id)
        self.assertEqual(lease.status, LeaseStatus.EXPIRED)
        print(f"✅ 过期租约自动标记: status={lease.status}")

    def test_6_renew_lease(self):
        print("\n=== 测试6: 续租租约 ===")
        lease_data = LeaseCreate(
            branch_name="feature/test6",
            env_id="test-env-06",
            assignee="tester06",
            lease_start=datetime.now(),
            lease_end=datetime.now() + timedelta(days=1),
            request_id="test-req-006"
        )
        result = create_lease(self.db, lease_data)
        original_end = result["lease"].lease_end

        update_data = LeaseUpdate(
            lease_end=datetime.now() + timedelta(days=14),
            renew_reason="延长测试时间"
        )
        renewed = renew_lease(self.db, result["lease"].id, update_data)
        self.assertGreater(renewed.lease_end, original_end)
        print(f"✅ 续租成功: 原结束时间={original_end}, 新结束时间={renewed.lease_end}")

    def test_7_release_lease(self):
        print("\n=== 测试7: 释放租约 ===")
        lease_data = LeaseCreate(
            branch_name="feature/test7",
            env_id="test-env-07",
            assignee="tester07",
            lease_start=datetime.now(),
            lease_end=datetime.now() + timedelta(days=7),
            request_id="test-req-007"
        )
        result = create_lease(self.db, lease_data)

        release_data = LeaseRelease(
            released_by="tester07",
            release_reason="测试完成",
            force=False
        )
        released = release_lease(self.db, result["lease"].id, release_data)
        self.assertEqual(released.status, LeaseStatus.RELEASED)
        print(f"✅ 释放租约成功: status={released.status}")

    def test_8_force_release_lease(self):
        print("\n=== 测试8: 强制释放租约 ===")
        lease_data = LeaseCreate(
            branch_name="feature/test8",
            env_id="test-env-08",
            assignee="tester08",
            lease_start=datetime.now(),
            lease_end=datetime.now() + timedelta(days=7),
            request_id="test-req-008"
        )
        result = create_lease(self.db, lease_data)

        release_data = LeaseRelease(
            released_by="admin",
            release_reason="管理员强制回收",
            force=True
        )
        released = release_lease(self.db, result["lease"].id, release_data)
        self.assertEqual(released.status, LeaseStatus.RELEASED)
        print(f"✅ 强制释放成功: status={released.status}")

    def test_9_manual_correction(self):
        print("\n=== 测试9: 人工修正租约 ===")
        lease_data = LeaseCreate(
            branch_name="feature/test9",
            env_id="test-env-09",
            assignee="tester09",
            lease_start=datetime.now(),
            lease_end=datetime.now() + timedelta(days=7),
            request_id="test-req-009"
        )
        result = create_lease(self.db, lease_data)

        correct_data = LeaseManualCorrect(
            assignee="new_owner",
            env_id="test-env-09-new",
            operator="admin",
            reason="修正环境分配错误"
        )
        corrected = manual_correct_lease(self.db, result["lease"].id, correct_data)
        self.assertEqual(corrected.assignee, "new_owner")
        self.assertEqual(corrected.env_id, "test-env-09-new")
        print(f"✅ 人工修正成功: assignee={corrected.assignee}, env_id={corrected.env_id}")

    def test_10_recalculate_after_correction(self):
        print("\n=== 测试10: 人工修正后重新计算状态 ===")
        lease_data = LeaseCreate(
            branch_name="feature/test10",
            env_id="test-env-10",
            assignee="tester10",
            lease_start=datetime.now(),
            lease_end=datetime.now() + timedelta(days=7),
            request_id="test-req-010"
        )
        result = create_lease(self.db, lease_data)

        correct_data = LeaseManualCorrect(
            lease_end=datetime.now() - timedelta(days=1),
            operator="admin",
            reason="修正为已过期"
        )
        manual_correct_lease(self.db, result["lease"].id, correct_data)

        recalc_result = recalculate_statuses(self.db, "admin")
        self.assertGreaterEqual(recalc_result["marked_expired"], 1)

        lease = get_lease(self.db, result["lease"].id)
        self.assertEqual(lease.status, LeaseStatus.EXPIRED)
        print(f"✅ 重新计算状态成功: 标记过期={recalc_result['marked_expired']}, 最终状态={lease.status}")

    def test_11_occupancy_report(self):
        print("\n=== 测试11: 占用报表 ===")
        for i in range(3):
            lease_data = LeaseCreate(
                branch_name=f"feature/test-report-{i}",
                env_id=f"report-env-{i}",
                assignee=f"reporter-{i}",
                lease_start=datetime.now(),
                lease_end=datetime.now() + timedelta(days=7),
                request_id=f"report-req-{i}"
            )
            create_lease(self.db, lease_data)

        report = get_occupancy_report(self.db)
        self.assertIn("by_environment", report)
        self.assertIn("by_assignee", report)
        self.assertGreater(report["total_environments"], 0)
        print(f"✅ 报表生成成功: 环境数={report['total_environments']}, 活跃租约={report['total_active_leases']}")

    def test_12_audit_logs(self):
        print("\n=== 测试12: 审计日志 ===")
        lease_data = LeaseCreate(
            branch_name="feature/test12",
            env_id="test-env-12",
            assignee="tester12",
            lease_start=datetime.now(),
            lease_end=datetime.now() + timedelta(days=7),
            request_id="test-req-012"
        )
        create_lease(self.db, lease_data)

        logs = get_audit_logs(self.db, limit=10)
        self.assertGreater(len(logs), 0)
        self.assertEqual(logs[0].operation.value, "create")
        self.assertTrue(logs[0].success)
        print(f"✅ 审计日志记录成功: 日志数={len(logs)}, 最新操作={logs[0].operation}")

    def test_13_query_filters(self):
        print("\n=== 测试13: 查询过滤器 ===")
        lease_data1 = LeaseCreate(
            branch_name="feature/filter-test",
            env_id="filter-env-01",
            assignee="user-a",
            lease_start=datetime.now(),
            lease_end=datetime.now() + timedelta(days=7),
            request_id="filter-req-001"
        )
        lease_data2 = LeaseCreate(
            branch_name="bugfix/filter-test",
            env_id="filter-env-02",
            assignee="user-b",
            lease_start=datetime.now(),
            lease_end=datetime.now() + timedelta(days=7),
            request_id="filter-req-002"
        )
        create_lease(self.db, lease_data1)
        create_lease(self.db, lease_data2)

        params = LeaseQueryParams(assignee="user-a")
        results = query_leases(self.db, params)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].assignee, "user-a")
        print(f"✅ 按占用人查询成功: 结果数={len(results)}")

        params = LeaseQueryParams(branch_name="feature")
        results = query_leases(self.db, params)
        self.assertEqual(len(results), 1)
        print(f"✅ 按分支名模糊查询成功: 结果数={len(results)}")


def run_self_check():
    print("\n" + "=" * 60)
    print("🚀 预览环境租约API - 自检程序")
    print("=" * 60)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestLeaseAPI)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 60)
    print("📊 测试总结")
    print("=" * 60)
    print(f"运行测试数: {result.testsRun}")
    print(f"成功: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败: {len(result.failures)}")
    print(f"错误: {len(result.errors)}")
    print(f"测试结果: {'✅ 通过' if result.wasSuccessful() else '❌ 失败'}")
    print("=" * 60)


if __name__ == "__main__":
    run_self_check()
