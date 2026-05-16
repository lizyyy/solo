import unittest
import json
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Supplier, BusinessTag
from database import init_db
from service import QuotaCircuitBreakerService


class TestQuotaCircuitBreaker(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        self.db = Session()
        self.service = QuotaCircuitBreakerService(self.db)
        
        self.supplier = self.service.create_supplier("短信服务商", "SMS_PROVIDER", "测试短信服务商")
        self.high_priority_tag = self.service.create_business_tag("验证码", "VERIFY_CODE", 1, "高优先级验证码短信")
        self.medium_priority_tag = self.service.create_business_tag("营销短信", "MARKETING", 4, "中优先级营销短信")
        self.low_priority_tag = self.service.create_business_tag("通知", "NOTIFICATION", 6, "低优先级通知")
        
        now = datetime.utcnow()
        self.window = self.service.create_quota_window(
            supplier_id=self.supplier.id,
            window_type="DAILY",
            total_quota=100,
            start_time=now - timedelta(hours=1),
            end_time=now + timedelta(days=1)
        )

    def tearDown(self):
        self.db.close()

    def test_normal_flow_success(self):
        print("\n=== 测试正常流程 - 成功消耗额度")
        result = self.service.consume_quota(
            supplier_code="SMS_PROVIDER",
            business_tag_code="VERIFY_CODE",
            amount=10,
            request_id="req_001",
            raw_input=json.dumps({"phone": "13800138000", "content": "验证码：123456"})
        )
        print(f"消耗结果: {result}")
        self.assertTrue(result["success"])
        self.assertEqual(result["conclusion"], "SUCCESS")
        
        window = self.service.get_current_quota_window(self.supplier.id)
        print(f"当前已用额度: {window.used_quota}")
        self.assertEqual(window.used_quota, 10)
        print("✓ 正常流程测试通过")

    def test_normal_flow_circuit_breaker_warning(self):
        print("\n=== 测试熔断 - 警告阈值下低优先级请求被拒绝")
        self.window.used_quota = 85
        self.db.commit()
        
        result = self.service.consume_quota(
            supplier_code="SMS_PROVIDER",
            business_tag_code="NOTIFICATION",
            amount=5,
            request_id="req_002"
        )
        print(f"消耗结果: {result}")
        self.assertFalse(result["success"])
        self.assertTrue(result["rejected"])
        self.assertIn("Warning threshold", result["reason"])
        print("✓ 警告阈值熔断测试通过")

    def test_normal_flow_circuit_breaker_open(self):
        print("\n=== 测试熔断 - 熔断阈值下中低优先级请求被拒绝")
        self.window.used_quota = 96
        self.db.commit()
        
        result = self.service.consume_quota(
            supplier_code="SMS_PROVIDER",
            business_tag_code="MARKETING",
            amount=5,
            request_id="req_003"
        )
        print(f"消耗结果: {result}")
        self.assertFalse(result["success"])
        self.assertTrue(result["rejected"])
        self.assertIn("Circuit breaker threshold", result["reason"])
        
        events = self.service.get_circuit_breaker_events(self.supplier.id)
        print(f"熔断事件数: {len(events)}")
        self.assertGreater(len(events), 0)
        print("✓ 熔断阈值测试通过")

    def test_normal_flow_high_priority_always_allowed(self):
        print("\n=== 测试熔断 - 高优先级请求即使在熔断状态也能通过")
        self.window.used_quota = 96
        self.db.commit()
        
        result = self.service.consume_quota(
            supplier_code="SMS_PROVIDER",
            business_tag_code="VERIFY_CODE",
            amount=3,
            request_id="req_004"
        )
        print(f"消耗结果: {result}")
        self.assertTrue(result["success"])
        self.assertEqual(result["conclusion"], "SUCCESS")
        print("✓ 高优先级优先通过测试通过")

    def test_dirty_data_supplier_not_found(self):
        print("\n=== 测试脏数据 - 供应商不存在")
        result = self.service.consume_quota(
            supplier_code="NON_EXISTENT",
            business_tag_code="VERIFY_CODE",
            amount=10,
            request_id="req_dirty_001"
        )
        print(f"结果: {result}")
        self.assertFalse(result["success"])
        self.assertEqual(result["conclusion"], "SUPPLIER_NOT_FOUND")
        print("✓ 供应商不存在测试通过")

    def test_dirty_data_tag_not_found(self):
        print("\n=== 测试脏数据 - 业务标签不存在")
        result = self.service.consume_quota(
            supplier_code="SMS_PROVIDER",
            business_tag_code="NON_EXISTENT",
            amount=10,
            request_id="req_dirty_002"
        )
        print(f"结果: {result}")
        self.assertFalse(result["success"])
        self.assertEqual(result["conclusion"], "TAG_NOT_FOUND")
        print("✓ 业务标签不存在测试通过")

    def test_dirty_data_insufficient_quota(self):
        print("\n=== 测试脏数据 - 额度不足")
        self.window.used_quota = 95
        self.db.commit()
        
        result = self.service.consume_quota(
            supplier_code="SMS_PROVIDER",
            business_tag_code="VERIFY_CODE",
            amount=10,
            request_id="req_dirty_003"
        )
        print(f"结果: {result}")
        self.assertFalse(result["success"])
        self.assertEqual(result["conclusion"], "INSUFFICIENT_QUOTA")
        print("✓ 额度不足测试通过")

    def test_duplicate_request(self):
        print("\n=== 测试重复请求 - 幂等性")
        result1 = self.service.consume_quota(
            supplier_code="SMS_PROVIDER",
            business_tag_code="VERIFY_CODE",
            amount=10,
            request_id="req_dup_001"
        )
        print(f"第一次请求结果: {result1}")
        self.assertTrue(result1["success"])
        
        result2 = self.service.consume_quota(
            supplier_code="SMS_PROVIDER",
            business_tag_code="VERIFY_CODE",
            amount=10,
            request_id="req_dup_001"
        )
        print(f"第二次请求结果: {result2}")
        self.assertTrue(result2["success"])
        self.assertTrue(result2["duplicate"])
        self.assertEqual(result1["usage_id"], result2["usage_id"])
        
        window = self.service.get_current_quota_window(self.supplier.id)
        print(f"最终已用额度: {window.used_quota}")
        self.assertEqual(window.used_quota, 10)
        print("✓ 重复请求幂等性测试通过")

    def test_manual_correction(self):
        print("\n=== 测试人工修正")
        self.window.used_quota = 50
        self.db.commit()
        
        result = self.service.manual_correct_quota(
            quota_window_id=self.window.id,
            new_used_quota=30,
            reason="对账发现多扣了20条",
            operator="admin"
        )
        print(f"修正结果: {result}")
        self.assertTrue(result["success"])
        self.assertEqual(result["old_used_quota"], 50)
        self.assertEqual(result["new_used_quota"], 30)
        
        window = self.service.get_current_quota_window(self.supplier.id)
        print(f"修正后已用额度: {window.used_quota}")
        self.assertEqual(window.used_quota, 30)
        print("✓ 人工修正测试通过")

    def test_recalculate_after_manual_correction(self):
        print("\n=== 测试人工修正后重新计算")
        for i in range(5):
            self.service.consume_quota(
                supplier_code="SMS_PROVIDER",
                business_tag_code="VERIFY_CODE",
                amount=10,
                request_id=f"req_recalc_{i}"
            )
        
        window = self.service.get_current_quota_window(self.supplier.id)
        print(f"正常消耗后已用额度: {window.used_quota}")
        self.assertEqual(window.used_quota, 50)
        
        self.service.manual_correct_quota(
            quota_window_id=self.window.id,
            new_used_quota=100,
            reason="测试人工修正",
            operator="admin"
        )
        window = self.service.get_current_quota_window(self.supplier.id)
        print(f"人工修正后已用额度: {window.used_quota}")
        self.assertEqual(window.used_quota, 100)
        
        result = self.service.recalculate_quota_usage(self.window.id)
        print(f"重新计算结果: {result}")
        self.assertTrue(result["success"])
        self.assertEqual(result["recalculated_used_quota"], 50)
        
        window = self.service.get_current_quota_window(self.supplier.id)
        print(f"重新计算后已用额度: {window.used_quota}")
        self.assertEqual(window.used_quota, 50)
        print("✓ 人工修正后重新计算测试通过")

    def test_export_report(self):
        print("\n=== 测试导出报告")
        for i in range(3):
            self.service.consume_quota(
                supplier_code="SMS_PROVIDER",
                business_tag_code="VERIFY_CODE",
                amount=5,
                request_id=f"req_report_{i}"
            )
        
        report = self.service.export_quota_report(supplier_id=self.supplier.id)
        print(f"报告生成成功，包含 {len(report['quota_windows'])} 个窗口数据")
        self.assertIsNotNone(report)
        self.assertIn("supplier", report)
        self.assertIn("quota_windows", report)
        self.assertIn("circuit_breaker_events", report)
        print("✓ 报告导出测试通过")

    def test_failure_path_preserves_data(self):
        print("\n=== 测试失败路径保留原始数据")
        self.window.used_quota = 90
        self.db.commit()
        
        raw_input_data = json.dumps({"phone": "13800138000", "content": "测试通知", "type": "notification"})
        result = self.service.consume_quota(
            supplier_code="SMS_PROVIDER",
            business_tag_code="NOTIFICATION",
            amount=5,
            request_id="req_fail_001",
            raw_input=raw_input_data
        )
        print(f"拒绝结果: {result}")
        self.assertFalse(result["success"])
        
        history = self.service.get_quota_usage_history(supplier_id=self.supplier.id)
        failed_usage = next((u for u in history if u.request_id == "req_fail_001"), None)
        self.assertIsNotNone(failed_usage)
        print(f"保留的原始输入: {failed_usage.raw_input}")
        self.assertEqual(failed_usage.raw_input, raw_input_data)
        print(f"保留的处理规则: {failed_usage.processing_rule[:100]}...")
        self.assertIsNotNone(failed_usage.processing_rule)
        print(f"保留的结论: {failed_usage.conclusion}")
        self.assertEqual(failed_usage.status, "REJECTED")
        print("✓ 失败路径数据保留测试通过")


def run_tests():
    print("=" * 60)
    print("第三方额度熔断API 测试套件")
    print("=" * 60)
    
    unittest.main(verbosity=2, exit=False)
    
    print("\n" + "=" * 60)
    print("所有测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
