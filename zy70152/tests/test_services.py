"""
测试核心服务
"""

import unittest
from unittest.mock import patch, MagicMock

from tenant_quota_service.models import (
    PlanVersion, QuotaBucket, QuotaType,
    TransactionStatus, ChangeReason
)
from tenant_quota_service.storage import QuotaStorage
from tenant_quota_service.services import QuotaService


class TestQuotaService(unittest.TestCase):
    """测试限额服务"""
    
    def setUp(self):
        self.storage = QuotaStorage()
        self.service = QuotaService(self.storage)
        
        self.basic_plan = PlanVersion(
            plan_id="basic",
            version=1,
            name="基础版",
            quotas={
                QuotaType.REQUESTS: 1000,
                QuotaType.STORAGE: 10 * 1024 * 1024,
                QuotaType.MEMBERS: 10
            }
        )
        self.pro_plan = PlanVersion(
            plan_id="pro",
            version=1,
            name="专业版",
            quotas={
                QuotaType.REQUESTS: 5000,
                QuotaType.STORAGE: 50 * 1024 * 1024,
                QuotaType.MEMBERS: 50
            }
        )
        self.enterprise_plan = PlanVersion(
            plan_id="enterprise",
            version=1,
            name="企业版",
            quotas={
                QuotaType.REQUESTS: 20000,
                QuotaType.STORAGE: 200 * 1024 * 1024,
                QuotaType.MEMBERS: 200
            }
        )
        
        self.storage.save_plan(self.basic_plan)
        self.storage.save_plan(self.pro_plan)
        self.storage.save_plan(self.enterprise_plan)
        
        self.tenant_id = "tenant_001"
        self.bucket = QuotaBucket(
            tenant_id=self.tenant_id,
            plan_version=self.basic_plan,
            quotas=self.basic_plan.quotas.copy(),
            used={QuotaType.REQUESTS: 500}
        )
        self.storage.save_bucket(self.bucket)
    
    # ========== 测试套餐升级 ==========
    
    def test_upgrade_plan_success(self):
        """测试成功升级套餐"""
        request_id = "req_upgrade_001"
        result = self.service.upgrade_plan(
            tenant_id=self.tenant_id,
            new_plan_id="pro",
            new_plan_version=1,
            request_id=request_id,
            operator_id="operator_001",
            notes="用户自助升级"
        )
        
        self.assertTrue(result.success)
        self.assertIsNotNone(result.transaction_id)
        
        bucket = self.storage.get_tenant_bucket(self.tenant_id)
        self.assertEqual(bucket.plan_version.plan_id, "pro")
        self.assertEqual(bucket.get_effective_quota(QuotaType.REQUESTS), 5000)
        self.assertEqual(bucket.get_usage(QuotaType.REQUESTS), 500)
        
        tx = self.storage.get_transaction(result.transaction_id)
        self.assertEqual(tx.status, TransactionStatus.COMPLETED)
        self.assertEqual(tx.reason, ChangeReason.UPGRADE)
        self.assertEqual(tx.operator_id, "operator_001")
        
        self.assertEqual(len(tx.changes), 3)
    
    def test_upgrade_plan_duplicate_request(self):
        """测试重复请求（幂等性）"""
        request_id = "req_duplicate_001"
        
        result1 = self.service.upgrade_plan(
            tenant_id=self.tenant_id,
            new_plan_id="pro",
            new_plan_version=1,
            request_id=request_id
        )
        self.assertTrue(result1.success)
        tx_id1 = result1.transaction_id
        
        result2 = self.service.upgrade_plan(
            tenant_id=self.tenant_id,
            new_plan_id="pro",
            new_plan_version=1,
            request_id=request_id
        )
        self.assertTrue(result2.success)
        self.assertEqual(result2.transaction_id, tx_id1)
        self.assertIn("重复请求", result2.message)
    
    def test_upgrade_plan_missing_tenant(self):
        """测试升级不存在的租户"""
        result = self.service.upgrade_plan(
            tenant_id="nonexistent",
            new_plan_id="pro",
            new_plan_version=1
        )
        
        self.assertFalse(result.success)
        self.assertIn("不存在", result.message)
    
    def test_upgrade_plan_invalid_plan(self):
        """测试升级到不存在的套餐"""
        result = self.service.upgrade_plan(
            tenant_id=self.tenant_id,
            new_plan_id="nonexistent",
            new_plan_version=999
        )
        
        self.assertFalse(result.success)
        self.assertIn("验证失败", result.message)
    
    # ========== 测试降级缓冲 ==========
    
    def test_downgrade_with_buffer(self):
        """测试降级时添加缓冲"""
        self.bucket.used[QuotaType.REQUESTS] = 3000
        self.bucket.plan_version = self.pro_plan
        self.bucket.quotas = self.pro_plan.quotas.copy()
        self.storage.save_bucket(self.bucket)
        
        result = self.service.upgrade_plan(
            tenant_id=self.tenant_id,
            new_plan_id="basic",
            new_plan_version=1
        )
        
        self.assertTrue(result.success)
        
        bucket = self.storage.get_tenant_bucket(self.tenant_id)
        self.assertEqual(bucket.quotas[QuotaType.REQUESTS], 1000)
        self.assertEqual(bucket.buffer_quotas[QuotaType.REQUESTS], 2000)
        self.assertEqual(bucket.get_effective_quota(QuotaType.REQUESTS), 3000)
        
        tx = self.storage.get_transaction(result.transaction_id)
        self.assertEqual(tx.reason, ChangeReason.DOWNGRADE)
        
        buffer_changes = [
            c for c in tx.changes.values() 
            if c.reason == "降级缓冲"
        ]
        self.assertEqual(len(buffer_changes), 1)
        self.assertEqual(buffer_changes[0].change_amount, 2000)
    
    def test_downgrade_safe_no_buffer(self):
        """测试安全降级（不需要缓冲）"""
        self.bucket.used[QuotaType.REQUESTS] = 500
        self.bucket.plan_version = self.pro_plan
        self.bucket.quotas = self.pro_plan.quotas.copy()
        self.storage.save_bucket(self.bucket)
        
        result = self.service.upgrade_plan(
            tenant_id=self.tenant_id,
            new_plan_id="basic",
            new_plan_version=1
        )
        
        self.assertTrue(result.success)
        
        bucket = self.storage.get_tenant_bucket(self.tenant_id)
        self.assertEqual(bucket.buffer_quotas.get(QuotaType.REQUESTS, 0), 0)
    
    # ========== 测试人工调整 ==========
    
    def test_manual_adjustment_success(self):
        """测试成功人工调整"""
        result = self.service.manual_adjustment(
            tenant_id=self.tenant_id,
            quota_type="requests",
            new_value=3000,
            operator_id="admin_001",
            reason="活动临时配额"
        )
        
        self.assertTrue(result.success)
        
        bucket = self.storage.get_tenant_bucket(self.tenant_id)
        self.assertEqual(bucket.manual_overrides[QuotaType.REQUESTS], 3000)
        self.assertEqual(bucket.get_effective_quota(QuotaType.REQUESTS), 3000)
        
        tx = self.storage.get_transaction(result.transaction_id)
        self.assertEqual(tx.reason, ChangeReason.MANUAL_ADJUSTMENT)
        self.assertEqual(tx.operator_id, "admin_001")
        self.assertIn("活动临时配额", tx.notes)
    
    def test_manual_adjustment_invalid_params(self):
        """测试人工调整参数无效"""
        result = self.service.manual_adjustment(
            tenant_id="",
            quota_type="requests",
            new_value=3000,
            operator_id=""
        )
        
        self.assertFalse(result.success)
        self.assertIn("验证失败", result.message)
    
    def test_clear_manual_override(self):
        """测试清除人工覆盖"""
        self.service.manual_adjustment(
            tenant_id=self.tenant_id,
            quota_type="requests",
            new_value=3000,
            operator_id="admin_001"
        )
        
        bucket = self.storage.get_tenant_bucket(self.tenant_id)
        self.assertIn(QuotaType.REQUESTS, bucket.manual_overrides)
        
        result = self.service.clear_manual_override(
            tenant_id=self.tenant_id,
            quota_type="requests",
            operator_id="admin_001"
        )
        
        self.assertTrue(result.success)
        
        bucket = self.storage.get_tenant_bucket(self.tenant_id)
        self.assertNotIn(QuotaType.REQUESTS, bucket.manual_overrides)
        self.assertEqual(bucket.get_effective_quota(QuotaType.REQUESTS), 1000)
    
    # ========== 测试超限拦截 ==========
    
    def test_consume_quota_success(self):
        """测试成功消费限额"""
        result = self.service.consume_quota(
            tenant_id=self.tenant_id,
            quota_type="requests",
            amount=100
        )
        
        self.assertTrue(result.success)
        self.assertEqual(result.data["used"], 600)
        self.assertEqual(result.data["remaining"], 400)
    
    def test_consume_quota_insufficient(self):
        """测试限额不足"""
        result = self.service.consume_quota(
            tenant_id=self.tenant_id,
            quota_type="requests",
            amount=2000
        )
        
        self.assertFalse(result.success)
        self.assertIn("限额不足", result.message)
        self.assertFalse(result.data["is_overflow"])
    
    def test_consume_quota_already_overflow(self):
        """测试已超限状态"""
        self.bucket.used[QuotaType.REQUESTS] = 1500
        self.storage.save_bucket(self.bucket)
        
        result = self.service.consume_quota(
            tenant_id=self.tenant_id,
            quota_type="requests",
            amount=1
        )
        
        self.assertFalse(result.success)
        self.assertIn("已超限", result.message)
        self.assertTrue(result.data["is_overflow"])
    
    def test_consume_quota_warning(self):
        """测试剩余额度不足10%时的警告"""
        self.bucket.used[QuotaType.REQUESTS] = 950
        self.storage.save_bucket(self.bucket)
        
        result = self.service.consume_quota(
            tenant_id=self.tenant_id,
            quota_type="requests",
            amount=1
        )
        
        self.assertTrue(result.success)
        self.assertTrue(result.data["warning"])
        self.assertIn("剩余额度不足10%", result.message)
    
    # ========== 测试限额查询 ==========
    
    def test_check_quota(self):
        """测试查询限额状态"""
        result = self.service.check_quota(
            tenant_id=self.tenant_id,
            quota_type="requests"
        )
        
        self.assertTrue(result.success)
        self.assertEqual(result.data["total"], 1000)
        self.assertEqual(result.data["base_quota"], 1000)
        self.assertEqual(result.data["buffer_quota"], 0)
        self.assertEqual(result.data["used"], 500)
        self.assertEqual(result.data["remaining"], 500)
        self.assertFalse(result.data["is_overflow"])
    
    def test_check_quota_with_override(self):
        """测试查询有人工覆盖的限额"""
        self.service.manual_adjustment(
            tenant_id=self.tenant_id,
            quota_type="requests",
            new_value=2000,
            operator_id="admin_001"
        )
        
        result = self.service.check_quota(
            tenant_id=self.tenant_id,
            quota_type="requests"
        )
        
        self.assertEqual(result.data["total"], 2000)
        self.assertEqual(result.data["manual_override"], 2000)
    
    def test_check_quota_invalid_type(self):
        """测试查询无效限额类型"""
        result = self.service.check_quota(
            tenant_id=self.tenant_id,
            quota_type="invalid"
        )
        
        self.assertFalse(result.success)
        self.assertIn("无效的限额类型", result.message)
    
    # ========== 测试租户报表 ==========
    
    def test_get_tenant_report(self):
        """测试获取租户报表"""
        self.service.manual_adjustment(
            tenant_id=self.tenant_id,
            quota_type="requests",
            new_value=2000,
            operator_id="admin_001"
        )
        
        result = self.service.get_tenant_report(
            tenant_id=self.tenant_id,
            transaction_limit=10
        )
        
        self.assertTrue(result.success)
        self.assertIn("tenant_id", result.data)
        self.assertIn("quotas", result.data)
        self.assertIn("recent_transactions", result.data)
        
        self.assertEqual(result.data["tenant_id"], self.tenant_id)
        self.assertGreater(len(result.data["recent_transactions"]), 0)
        
        quota_data = result.data["quotas"]["requests"]
        self.assertIn("total", quota_data)
        self.assertIn("used", quota_data)
        self.assertIn("remaining", quota_data)
        self.assertIn("is_overflow", quota_data)
    
    def test_export_tenant_report(self):
        """测试导出租户报表"""
        self.service.manual_adjustment(
            tenant_id=self.tenant_id,
            quota_type="requests",
            new_value=2000,
            operator_id="admin_001"
        )
        
        result = self.service.export_tenant_report(
            tenant_id=self.tenant_id,
            transaction_limit=100
        )
        
        self.assertTrue(result.success)
        
        transactions = result.data["recent_transactions"]
        self.assertGreater(len(transactions), 0)
        
        first_tx = transactions[0]
        self.assertIn("transaction_id", first_tx)
        self.assertIn("status", first_tx)
        self.assertIn("reason", first_tx)
        self.assertIn("changes", first_tx)
        
        changes = first_tx["changes"]
        self.assertGreater(len(changes), 0)
        self.assertIn("quota_type", changes[0])
        self.assertIn("old_value", changes[0])
        self.assertIn("new_value", changes[0])
        self.assertIn("change_amount", changes[0])


if __name__ == "__main__":
    unittest.main()
