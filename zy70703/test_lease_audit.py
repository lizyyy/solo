#!/usr/bin/env python3
"""预览环境租约审计 - 单元测试"""

import unittest
from datetime import datetime, timedelta
from env_audit.models import (
    LeaseManager, Environment, Lease, LeaseStatus, EnvironmentStatus
)


class TestLeaseModel(unittest.TestCase):
    """测试租约模型"""

    def test_lease_creation(self):
        lease = Lease(
            lease_id="test-001",
            env_id="env-01",
            branch_name="feature/test",
            assignee="zhangsan",
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=8),
            reason="测试"
        )
        self.assertEqual(lease.env_id, "env-01")
        self.assertEqual(lease.assignee, "zhangsan")
        self.assertEqual(lease.status, LeaseStatus.ACTIVE)

    def test_lease_is_expired(self):
        lease = Lease(
            lease_id="test-001",
            env_id="env-01",
            branch_name="feature/test",
            assignee="zhangsan",
            start_time=datetime.now() - timedelta(hours=10),
            end_time=datetime.now() - timedelta(hours=2),
            reason="测试"
        )
        self.assertTrue(lease.is_expired())

    def test_lease_not_expired(self):
        lease = Lease(
            lease_id="test-001",
            env_id="env-01",
            branch_name="feature/test",
            assignee="zhangsan",
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=8),
            reason="测试"
        )
        self.assertFalse(lease.is_expired())

    def test_lease_remaining_time(self):
        lease = Lease(
            lease_id="test-001",
            env_id="env-01",
            branch_name="feature/test",
            assignee="zhangsan",
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=8),
            reason="测试"
        )
        remaining = lease.remaining_time()
        self.assertIsNotNone(remaining)
        self.assertGreater(remaining.total_seconds(), 0)


class TestEnvironmentModel(unittest.TestCase):
    """测试环境模型"""

    def test_environment_creation(self):
        env = Environment(env_id="env-01", name="预览环境01")
        self.assertEqual(env.env_id, "env-01")
        self.assertEqual(env.status, EnvironmentStatus.AVAILABLE)
        self.assertIsNone(env.current_lease)

    def test_environment_available(self):
        env = Environment(env_id="env-01", name="预览环境01")
        self.assertTrue(env.is_available())

    def test_environment_can_renew(self):
        env = Environment(env_id="env-01", name="预览环境01")
        lease = Lease(
            lease_id="test-001",
            env_id="env-01",
            branch_name="feature/test",
            assignee="zhangsan",
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=8),
            reason="测试"
        )
        env.current_lease = lease
        env.status = EnvironmentStatus.OCCUPIED
        self.assertTrue(env.can_renew("zhangsan"))
        self.assertFalse(env.can_renew("lisi"))

    def test_environment_has_conflict(self):
        env = Environment(env_id="env-01", name="预览环境01")
        self.assertFalse(env.has_conflict())

        lease = Lease(
            lease_id="test-001",
            env_id="env-01",
            branch_name="feature/a",
            assignee="zhangsan",
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=8),
            reason="测试"
        )
        env.current_lease = lease
        env.status = EnvironmentStatus.OCCUPIED

        self.assertTrue(env.has_conflict("feature/b"))


class TestLeaseManager(unittest.TestCase):
    """测试租约管理器"""

    def setUp(self):
        self.manager = LeaseManager()
        self.manager.add_environment(Environment(env_id="env-01", name="预览环境01"))
        self.manager.add_environment(Environment(env_id="env-02", name="预览环境02"))
        self.manager.add_environment(Environment(env_id="env-03", name="预览环境03"))

    def test_create_lease_success(self):
        result = self.manager.create_lease(
            "env-01", "feature/test", "zhangsan", 8, "测试租用"
        )
        self.assertTrue(result['success'])
        self.assertIsNotNone(result['lease'])
        self.assertEqual(result['lease'].assignee, "zhangsan")
        self.assertEqual(self.manager.environments['env-01'].status, EnvironmentStatus.OCCUPIED)

    def test_create_lease_conflict(self):
        self.manager.create_lease("env-01", "feature/a", "zhangsan", 8, "A测试")
        result = self.manager.create_lease("env-01", "feature/b", "lisi", 8, "B测试")
        self.assertFalse(result['success'])
        self.assertIn('conflict', result)
        self.assertEqual(result['conflict']['current_assignee'], "zhangsan")

    def test_create_lease_not_found(self):
        result = self.manager.create_lease(
            "env-999", "feature/test", "zhangsan", 8, "测试租用"
        )
        self.assertFalse(result['success'])
        self.assertIn('not found', result['error'])

    def test_renew_lease_success(self):
        self.manager.create_lease("env-01", "feature/test", "zhangsan", 8, "测试租用")
        old_end_time = self.manager.environments['env-01'].current_lease.end_time

        result = self.manager.renew_lease("env-01", "zhangsan", 4, "续租测试")
        self.assertTrue(result['success'])
        self.assertGreater(result['lease'].end_time, old_end_time)

    def test_renew_lease_wrong_assignee(self):
        self.manager.create_lease("env-01", "feature/test", "zhangsan", 8, "测试租用")
        result = self.manager.renew_lease("env-01", "lisi", 4, "我想续租")
        self.assertFalse(result['success'])
        self.assertIn('conflict', result['error'])

    def test_release_lease_success(self):
        self.manager.create_lease("env-01", "feature/test", "zhangsan", 8, "测试租用")
        result = self.manager.release_lease("env-01", "zhangsan", "测试完成")
        self.assertTrue(result['success'])
        self.assertIsNone(self.manager.environments['env-01'].current_lease)
        self.assertEqual(self.manager.environments['env-01'].status, EnvironmentStatus.AVAILABLE)

    def test_release_lease_wrong_assignee(self):
        self.manager.create_lease("env-01", "feature/test", "zhangsan", 8, "测试租用")
        result = self.manager.release_lease("env-01", "lisi", "我要释放")
        self.assertFalse(result['success'])

    def test_force_release_lease(self):
        self.manager.create_lease("env-01", "feature/test", "zhangsan", 8, "测试租用")
        result = self.manager.release_lease("env-01", None, "管理员强制释放", force=True)
        self.assertTrue(result['success'])
        self.assertTrue(result['force_released'])

    def test_release_already_available(self):
        result = self.manager.release_lease("env-01")
        self.assertTrue(result['success'])
        self.assertIn('available', result['message'])

    def test_idempotent_lease_creation(self):
        request_id = "unique-request-123"
        result1 = self.manager.create_lease(
            "env-01", "feature/test", "zhangsan", 8, "测试", request_id
        )
        self.assertTrue(result1['success'])
        self.assertFalse(result1.get('idempotent', False))

        result2 = self.manager.create_lease(
            "env-01", "feature/test", "zhangsan", 8, "测试", request_id
        )
        self.assertTrue(result2['success'])
        self.assertTrue(result2['idempotent'])

    def test_idempotent_renew(self):
        self.manager.create_lease("env-01", "feature/test", "zhangsan", 8, "测试")
        request_id = "renew-request-456"

        result1 = self.manager.renew_lease("env-01", "zhangsan", 4, "续租", request_id)
        self.assertTrue(result1['success'])
        self.assertFalse(result1.get('idempotent', False))

        result2 = self.manager.renew_lease("env-01", "zhangsan", 4, "续租", request_id)
        self.assertTrue(result2['success'])
        self.assertTrue(result2['idempotent'])

    def test_check_expired_leases(self):
        result = self.manager.create_lease(
            "env-01", "feature/expired", "zhangsan", 8, "测试过期"
        )
        result['lease'].end_time = datetime.now() - timedelta(hours=1)

        result = self.manager.create_lease(
            "env-02", "feature/active", "lisi", 8, "正常租约"
        )

        expired = self.manager.check_expired_leases()
        self.assertEqual(len(expired), 1)
        self.assertEqual(expired[0].env_id, "env-01")
        self.assertEqual(self.manager.environments['env-01'].status, EnvironmentStatus.AVAILABLE)
        self.assertEqual(self.manager.environments['env-02'].status, EnvironmentStatus.OCCUPIED)

    def test_get_occupancy_report(self):
        self.manager.create_lease("env-01", "feature/a", "zhangsan", 8, "测试A")
        self.manager.create_lease("env-02", "feature/b", "lisi", 8, "测试B")

        report = self.manager.get_occupancy_report()
        self.assertEqual(report['summary']['total'], 3)
        self.assertEqual(report['summary']['occupied'], 2)
        self.assertEqual(report['summary']['available'], 1)
        self.assertEqual(len(report['environments']), 3)

    def test_get_lease_history(self):
        self.manager.create_lease("env-01", "feature/a", "zhangsan", 8, "测试A")
        self.manager.release_lease("env-01", "zhangsan", "完成A")
        self.manager.create_lease("env-01", "feature/b", "lisi", 8, "测试B")

        history = self.manager.get_lease_history("env-01")
        self.assertGreaterEqual(len(history), 2)

        all_history = self.manager.get_lease_history()
        self.assertGreaterEqual(len(all_history), 2)

    def test_empty_history(self):
        history = self.manager.get_lease_history()
        self.assertEqual(len(history), 0)

    def test_maintenance_status(self):
        self.manager.environments['env-01'].status = EnvironmentStatus.MAINTENANCE
        result = self.manager.create_lease(
            "env-01", "feature/test", "zhangsan", 8, "测试"
        )
        self.assertFalse(result['success'])
        self.assertIn('maintenance', result['error'])

    def test_renew_no_active_lease(self):
        result = self.manager.renew_lease("env-01", "zhangsan", 4, "续租")
        self.assertFalse(result['success'])
        self.assertIn('no active lease', result['error'])


class TestEdgeCases(unittest.TestCase):
    """边界情况测试"""

    def test_zero_duration_lease_rejected(self):
        """测试零时长租约被拒绝"""
        manager = LeaseManager()
        manager.add_environment(Environment(env_id="env-01", name="预览环境01"))
        result = manager.create_lease("env-01", "feature/test", "zhangsan", 0, "0小时租约")
        self.assertFalse(result['success'])
        self.assertTrue(result['validation_error'])
        self.assertIn('大于0', result['error'])

    def test_negative_duration_lease_rejected(self):
        """测试负时长租约被拒绝"""
        manager = LeaseManager()
        manager.add_environment(Environment(env_id="env-01", name="预览环境01"))
        result = manager.create_lease("env-01", "feature/test", "zhangsan", -1, "负时长")
        self.assertFalse(result['success'])
        self.assertTrue(result['validation_error'])
        self.assertIn('大于0', result['error'])

    def test_empty_branch_name_rejected(self):
        """测试空分支名被拒绝"""
        manager = LeaseManager()
        manager.add_environment(Environment(env_id="env-01", name="预览环境01"))
        result = manager.create_lease("env-01", "", "zhangsan", 8, "测试")
        self.assertFalse(result['success'])
        self.assertTrue(result['validation_error'])
        self.assertIn('不能为空', result['error'])

    def test_empty_assignee_rejected(self):
        """测试空占用人被拒绝"""
        manager = LeaseManager()
        manager.add_environment(Environment(env_id="env-01", name="预览环境01"))
        result = manager.create_lease("env-01", "feature/test", "   ", 8, "测试")
        self.assertFalse(result['success'])
        self.assertTrue(result['validation_error'])
        self.assertIn('不能为空', result['error'])

    def test_empty_reason_rejected(self):
        """测试空理由被拒绝"""
        manager = LeaseManager()
        manager.add_environment(Environment(env_id="env-01", name="预览环境01"))
        result = manager.create_lease("env-01", "feature/test", "zhangsan", 8, "")
        self.assertFalse(result['success'])
        self.assertTrue(result['validation_error'])
        self.assertIn('不能为空', result['error'])

    def test_renew_with_negative_duration_rejected(self):
        """测试续租时负时长被拒绝"""
        manager = LeaseManager()
        manager.add_environment(Environment(env_id="env-01", name="预览环境01"))
        manager.create_lease("env-01", "feature/test", "zhangsan", 8, "测试")
        result = manager.renew_lease("env-01", "zhangsan", -2, "续租")
        self.assertFalse(result['success'])
        self.assertTrue(result['validation_error'])

    def test_renew_with_empty_reason_rejected(self):
        """测试续租时空理由被拒绝"""
        manager = LeaseManager()
        manager.add_environment(Environment(env_id="env-01", name="预览环境01"))
        manager.create_lease("env-01", "feature/test", "zhangsan", 8, "测试")
        result = manager.renew_lease("env-01", "zhangsan", 4, "   ")
        self.assertFalse(result['success'])
        self.assertTrue(result['validation_error'])

    def test_large_duration_lease(self):
        manager = LeaseManager()
        manager.add_environment(Environment(env_id="env-01", name="预览环境01"))
        result = manager.create_lease("env-01", "feature/test", "zhangsan", 8760, "一年租约")
        self.assertTrue(result['success'])
        remaining = result['lease'].remaining_time()
        self.assertIsNotNone(remaining)
        self.assertGreater(remaining.days, 300)

    def test_lease_with_special_characters(self):
        manager = LeaseManager()
        manager.add_environment(Environment(env_id="env-01", name="预览环境01"))
        result = manager.create_lease(
            "env-01",
            "feature/测试分支-中文!@#$%^&*()",
            "用户-中文",
            8,
            "理由-中文!@#$%^&*()"
        )
        self.assertTrue(result['success'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
