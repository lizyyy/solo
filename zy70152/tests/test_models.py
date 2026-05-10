"""
测试数据模型
"""

import unittest
from datetime import datetime

from tenant_quota_service.models import (
    PlanVersion, QuotaBucket, QuotaChange, UpgradeTransaction,
    QuotaType, TransactionStatus, ChangeReason, TenantReport
)


class TestPlanVersion(unittest.TestCase):
    """测试套餐版本模型"""
    
    def setUp(self):
        self.plan = PlanVersion(
            plan_id="basic",
            version=1,
            name="基础版",
            quotas={
                QuotaType.REQUESTS: 1000,
                QuotaType.STORAGE: 10 * 1024 * 1024,
                QuotaType.MEMBERS: 10
            }
        )
    
    def test_get_quota(self):
        """测试获取限额"""
        self.assertEqual(self.plan.get_quota(QuotaType.REQUESTS), 1000)
        self.assertEqual(self.plan.get_quota(QuotaType.STORAGE), 10 * 1024 * 1024)
        self.assertEqual(self.plan.get_quota(QuotaType.MEMBERS), 10)
    
    def test_default_active(self):
        """测试默认激活状态"""
        self.assertTrue(self.plan.is_active)


class TestQuotaBucket(unittest.TestCase):
    """测试限额桶模型"""
    
    def setUp(self):
        self.plan = PlanVersion(
            plan_id="basic",
            version=1,
            name="基础版",
            quotas={
                QuotaType.REQUESTS: 1000,
                QuotaType.STORAGE: 10 * 1024 * 1024,
                QuotaType.MEMBERS: 10
            }
        )
        
        self.bucket = QuotaBucket(
            tenant_id="tenant_001",
            plan_version=self.plan,
            quotas=self.plan.quotas.copy(),
            used={QuotaType.REQUESTS: 500}
        )
    
    def test_get_effective_quota_without_override(self):
        """测试无人工覆盖时的有效限额"""
        self.assertEqual(self.bucket.get_effective_quota(QuotaType.REQUESTS), 1000)
    
    def test_get_effective_quota_with_override(self):
        """测试有人工覆盖时的有效限额"""
        self.bucket.manual_overrides[QuotaType.REQUESTS] = 2000
        self.assertEqual(self.bucket.get_effective_quota(QuotaType.REQUESTS), 2000)
    
    def test_get_effective_quota_with_buffer(self):
        """测试有缓冲时的有效限额"""
        self.bucket.buffer_quotas[QuotaType.REQUESTS] = 500
        self.assertEqual(self.bucket.get_effective_quota(QuotaType.REQUESTS), 1500)
    
    def test_get_usage(self):
        """测试获取使用量"""
        self.assertEqual(self.bucket.get_usage(QuotaType.REQUESTS), 500)
        self.assertEqual(self.bucket.get_usage(QuotaType.MEMBERS), 0)
    
    def test_get_remaining(self):
        """测试获取剩余额度"""
        self.assertEqual(self.bucket.get_remaining(QuotaType.REQUESTS), 500)
        self.assertEqual(self.bucket.get_remaining(QuotaType.MEMBERS), 10)
    
    def test_is_overflow_false(self):
        """测试未超限"""
        self.assertFalse(self.bucket.is_overflow(QuotaType.REQUESTS))
    
    def test_is_overflow_true(self):
        """测试已超限"""
        self.bucket.used[QuotaType.REQUESTS] = 1500
        self.assertTrue(self.bucket.is_overflow(QuotaType.REQUESTS))


class TestUpgradeTransaction(unittest.TestCase):
    """测试升级事务模型"""
    
    def setUp(self):
        self.old_plan = PlanVersion(
            plan_id="basic",
            version=1,
            name="基础版",
            quotas={QuotaType.REQUESTS: 1000}
        )
        self.new_plan = PlanVersion(
            plan_id="pro",
            version=1,
            name="专业版",
            quotas={QuotaType.REQUESTS: 5000}
        )
        
        self.transaction = UpgradeTransaction(
            tenant_id="tenant_001",
            old_plan_version=self.old_plan,
            new_plan_version=self.new_plan,
            reason=ChangeReason.UPGRADE
        )
    
    def test_initial_status(self):
        """测试初始状态"""
        self.assertEqual(self.transaction.status, TransactionStatus.PENDING)
    
    def test_add_change(self):
        """测试添加变更明细"""
        change = QuotaChange(
            quota_type=QuotaType.REQUESTS,
            old_value=1000,
            new_value=5000,
            change_amount=4000,
            reason="升级"
        )
        
        self.transaction.add_change(change)
        
        self.assertEqual(len(self.transaction.changes), 1)
        self.assertEqual(change.transaction_id, self.transaction.transaction_id)
    
    def test_mark_completed(self):
        """测试标记完成"""
        self.transaction.mark_completed()
        
        self.assertEqual(self.transaction.status, TransactionStatus.COMPLETED)
        self.assertIsNotNone(self.transaction.completed_at)
    
    def test_mark_failed(self):
        """测试标记失败"""
        error_msg = "测试失败"
        self.transaction.mark_failed(error_msg)
        
        self.assertEqual(self.transaction.status, TransactionStatus.FAILED)
        self.assertEqual(self.transaction.error_message, error_msg)


class TestTenantReport(unittest.TestCase):
    """测试租户报表模型"""
    
    def setUp(self):
        self.plan = PlanVersion(
            plan_id="basic",
            version=1,
            name="基础版",
            quotas={
                QuotaType.REQUESTS: 1000,
                QuotaType.STORAGE: 10 * 1024 * 1024,
                QuotaType.MEMBERS: 10
            }
        )
        
        self.bucket = QuotaBucket(
            tenant_id="tenant_001",
            plan_version=self.plan,
            quotas=self.plan.quotas.copy(),
            used={QuotaType.REQUESTS: 500}
        )
        
        self.transaction = UpgradeTransaction(
            tenant_id="tenant_001",
            old_plan_version=self.plan,
            new_plan_version=self.plan,
            reason=ChangeReason.MANUAL_ADJUSTMENT
        )
        self.transaction.mark_completed()
    
    def test_to_dict(self):
        """测试转换为字典"""
        report = TenantReport(
            tenant_id="tenant_001",
            current_plan=self.plan,
            current_bucket=self.bucket,
            recent_transactions=[self.transaction]
        )
        
        report_dict = report.to_dict()
        
        self.assertEqual(report_dict["tenant_id"], "tenant_001")
        self.assertEqual(report_dict["current_plan"], "基础版")
        self.assertEqual(report_dict["plan_version"], 1)
        self.assertIn("quotas", report_dict)
        self.assertIn("recent_transactions", report_dict)
        self.assertIn("generated_at", report_dict)
        
        self.assertIn("requests", report_dict["quotas"])
        self.assertEqual(report_dict["quotas"]["requests"]["used"], 500)
        self.assertEqual(report_dict["quotas"]["requests"]["total"], 1000)


if __name__ == "__main__":
    unittest.main()
