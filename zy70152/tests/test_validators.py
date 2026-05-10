"""
测试验证器
"""

import unittest

from tenant_quota_service.models import (
    PlanVersion, QuotaBucket, QuotaType
)
from tenant_quota_service.validators import (
    QuotaValidator, ValidationResult, ValidationError
)


class TestQuotaValidator(unittest.TestCase):
    """测试限额验证器"""
    
    def setUp(self):
        self.validator = QuotaValidator()
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
        self.inactive_plan = PlanVersion(
            plan_id="enterprise",
            version=1,
            name="企业版",
            quotas={QuotaType.REQUESTS: 10000},
            is_active=False
        )
    
    # ========== 测试套餐升级验证 ==========
    
    def test_validate_plan_upgrade_valid(self):
        """测试有效的套餐升级"""
        result = self.validator.validate_plan_upgrade(
            tenant_id="tenant_001",
            old_plan=self.basic_plan,
            new_plan=self.pro_plan
        )
        
        self.assertTrue(result.is_valid)
        self.assertEqual(len(result.errors), 0)
    
    def test_validate_plan_upgrade_missing_tenant_id(self):
        """测试缺少租户ID"""
        result = self.validator.validate_plan_upgrade(
            tenant_id="",
            old_plan=self.basic_plan,
            new_plan=self.pro_plan
        )
        
        self.assertFalse(result.is_valid)
        self.assertEqual(len(result.errors), 1)
        self.assertEqual(result.errors[0].code, "missing_tenant_id")
    
    def test_validate_plan_upgrade_missing_old_plan(self):
        """测试缺少旧套餐"""
        result = self.validator.validate_plan_upgrade(
            tenant_id="tenant_001",
            old_plan=None,
            new_plan=self.pro_plan
        )
        
        self.assertFalse(result.is_valid)
        self.assertIn("missing_old_plan", [e.code for e in result.errors])
    
    def test_validate_plan_upgrade_missing_new_plan(self):
        """测试缺少新套餐"""
        result = self.validator.validate_plan_upgrade(
            tenant_id="tenant_001",
            old_plan=self.basic_plan,
            new_plan=None
        )
        
        self.assertFalse(result.is_valid)
        self.assertIn("missing_new_plan", [e.code for e in result.errors])
    
    def test_validate_plan_upgrade_same_plan(self):
        """测试新旧套餐相同"""
        result = self.validator.validate_plan_upgrade(
            tenant_id="tenant_001",
            old_plan=self.basic_plan,
            new_plan=self.basic_plan
        )
        
        self.assertFalse(result.is_valid)
        self.assertIn("same_plan", [e.code for e in result.errors])
    
    def test_validate_plan_upgrade_inactive_plan(self):
        """测试新套餐未激活"""
        result = self.validator.validate_plan_upgrade(
            tenant_id="tenant_001",
            old_plan=self.basic_plan,
            new_plan=self.inactive_plan
        )
        
        self.assertFalse(result.is_valid)
        self.assertIn("inactive_plan", [e.code for e in result.errors])
    
    # ========== 测试限额值验证 ==========
    
    def test_validate_quota_values_valid(self):
        """测试有效的限额值"""
        result = self.validator.validate_quota_values({
            "requests": 1000,
            "storage": 10 * 1024 * 1024,
            "members": 10
        })
        
        self.assertTrue(result.is_valid)
    
    def test_validate_quota_values_invalid_type(self):
        """测试无效的限额类型"""
        result = self.validator.validate_quota_values({
            "invalid_type": 1000
        })
        
        self.assertFalse(result.is_valid)
        self.assertIn("invalid_quota_type", [e.code for e in result.errors])
    
    def test_validate_quota_values_negative(self):
        """测试负数值"""
        result = self.validator.validate_quota_values({
            "requests": -100
        })
        
        self.assertFalse(result.is_valid)
        self.assertIn("invalid_quota_value", [e.code for e in result.errors])
    
    def test_validate_quota_values_non_integer(self):
        """测试非整数值"""
        result = self.validator.validate_quota_values({
            "requests": 1000.5
        })
        
        self.assertFalse(result.is_valid)
        self.assertIn("invalid_quota_value", [e.code for e in result.errors])
    
    # ========== 测试人工调整验证 ==========
    
    def test_validate_manual_adjustment_valid(self):
        """测试有效的人工调整"""
        result = self.validator.validate_manual_adjustment(
            tenant_id="tenant_001",
            quota_type="requests",
            new_value=2000,
            operator_id="operator_001"
        )
        
        self.assertTrue(result.is_valid)
    
    def test_validate_manual_adjustment_missing_tenant_id(self):
        """测试缺少租户ID"""
        result = self.validator.validate_manual_adjustment(
            tenant_id="",
            quota_type="requests",
            new_value=2000,
            operator_id="operator_001"
        )
        
        self.assertFalse(result.is_valid)
        self.assertIn("missing_tenant_id", [e.code for e in result.errors])
    
    def test_validate_manual_adjustment_missing_quota_type(self):
        """测试缺少限额类型"""
        result = self.validator.validate_manual_adjustment(
            tenant_id="tenant_001",
            quota_type="",
            new_value=2000,
            operator_id="operator_001"
        )
        
        self.assertFalse(result.is_valid)
        self.assertIn("missing_quota_type", [e.code for e in result.errors])
    
    def test_validate_manual_adjustment_invalid_quota_type(self):
        """测试无效的限额类型"""
        result = self.validator.validate_manual_adjustment(
            tenant_id="tenant_001",
            quota_type="invalid",
            new_value=2000,
            operator_id="operator_001"
        )
        
        self.assertFalse(result.is_valid)
        self.assertIn("invalid_quota_type", [e.code for e in result.errors])
    
    def test_validate_manual_adjustment_missing_new_value(self):
        """测试缺少新限额值"""
        result = self.validator.validate_manual_adjustment(
            tenant_id="tenant_001",
            quota_type="requests",
            new_value=None,
            operator_id="operator_001"
        )
        
        self.assertFalse(result.is_valid)
        self.assertIn("missing_new_value", [e.code for e in result.errors])
    
    def test_validate_manual_adjustment_negative_value(self):
        """测试负的限额值"""
        result = self.validator.validate_manual_adjustment(
            tenant_id="tenant_001",
            quota_type="requests",
            new_value=-100,
            operator_id="operator_001"
        )
        
        self.assertFalse(result.is_valid)
        self.assertIn("invalid_new_value", [e.code for e in result.errors])
    
    def test_validate_manual_adjustment_missing_operator(self):
        """测试缺少操作人"""
        result = self.validator.validate_manual_adjustment(
            tenant_id="tenant_001",
            quota_type="requests",
            new_value=2000,
            operator_id=""
        )
        
        self.assertFalse(result.is_valid)
        self.assertIn("missing_operator_id", [e.code for e in result.errors])
    
    # ========== 测试重复请求检查 ==========
    
    def test_check_duplicate_request_no_request_id(self):
        """测试没有request_id"""
        is_duplicate, tx_id = self.validator.check_duplicate_request(None, None)
        
        self.assertFalse(is_duplicate)
        self.assertIsNone(tx_id)
    
    def test_check_duplicate_request_no_existing(self):
        """测试没有现有事务"""
        is_duplicate, tx_id = self.validator.check_duplicate_request("req_001", None)
        
        self.assertFalse(is_duplicate)
        self.assertIsNone(tx_id)
    
    def test_check_duplicate_request_with_existing(self):
        """测试有现有事务"""
        class MockTransaction:
            transaction_id = "tx_001"
        
        is_duplicate, tx_id = self.validator.check_duplicate_request("req_001", MockTransaction())
        
        self.assertTrue(is_duplicate)
        self.assertEqual(tx_id, "tx_001")
    
    # ========== 测试降级安全检查 ==========
    
    def test_check_downgrade_safety_safe(self):
        """测试安全降级"""
        bucket = QuotaBucket(
            tenant_id="tenant_001",
            plan_version=self.pro_plan,
            quotas=self.pro_plan.quotas.copy(),
            used={QuotaType.REQUESTS: 500}
        )
        
        is_safe, unsafe_types = self.validator.check_downgrade_safety(
            bucket, self.basic_plan
        )
        
        self.assertTrue(is_safe)
        self.assertEqual(len(unsafe_types), 0)
    
    def test_check_downgrade_safety_unsafe(self):
        """测试不安全降级（已使用量超过新套餐限额）"""
        bucket = QuotaBucket(
            tenant_id="tenant_001",
            plan_version=self.pro_plan,
            quotas=self.pro_plan.quotas.copy(),
            used={
                QuotaType.REQUESTS: 2000,
                QuotaType.MEMBERS: 20
            }
        )
        
        is_safe, unsafe_types = self.validator.check_downgrade_safety(
            bucket, self.basic_plan
        )
        
        self.assertFalse(is_safe)
        self.assertIn(QuotaType.REQUESTS, unsafe_types)
        self.assertIn(QuotaType.MEMBERS, unsafe_types)
    
    def test_check_downgrade_safety_equal(self):
        """测试使用量等于新套餐限额"""
        bucket = QuotaBucket(
            tenant_id="tenant_001",
            plan_version=self.pro_plan,
            quotas=self.pro_plan.quotas.copy(),
            used={QuotaType.REQUESTS: 1000}
        )
        
        is_safe, unsafe_types = self.validator.check_downgrade_safety(
            bucket, self.basic_plan
        )
        
        self.assertTrue(is_safe)
        self.assertEqual(len(unsafe_types), 0)


if __name__ == "__main__":
    unittest.main()
