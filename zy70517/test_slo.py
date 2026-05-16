import os
import sys
import json
import tempfile
import shutil

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import ReleaseStatus, DecisionType
from slo_service import SLOBudgetService
from storage import JSONStorage


class SLOBudgetTests:
    def __init__(self):
        self.test_dir = tempfile.mkdtemp()
        self.storage = JSONStorage(data_dir=self.test_dir)
        self.service = SLOBudgetService(storage=self.storage)
        self.passed = 0
        self.failed = 0

    def cleanup(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def assert_equal(self, actual, expected, message=""):
        if actual == expected:
            self.passed += 1
            print(f"  ✓ PASS: {message}")
            return True
        else:
            self.failed += 1
            print(f"  ✗ FAIL: {message}")
            print(f"    Expected: {expected}")
            print(f"    Actual: {actual}")
            return False

    def assert_raises(self, exception_type, func, *args, **kwargs):
        try:
            func(*args, **kwargs)
            self.failed += 1
            print(f"  ✗ FAIL: Expected {exception_type.__name__} but no exception raised")
            return False
        except exception_type as e:
            self.passed += 1
            print(f"  ✓ PASS: Correctly raised {exception_type.__name__}: {e}")
            return True
        except Exception as e:
            self.failed += 1
            print(f"  ✗ FAIL: Expected {exception_type.__name__} but got {type(e).__name__}: {e}")
            return False

    def test_1_normal_flow(self):
        print("\n=== Test 1: 正常流程测试 ===")
        
        print("\n1.1 创建服务SLO")
        slo = self.service.create_service_slo(
            service_name="order-service",
            slo_name="availability",
            slo_target=0.999,
            description="订单服务可用性SLO"
        )
        self.assert_equal(slo.slo_target, 0.999, "创建服务SLO成功")

        print("\n1.2 初始化错误预算")
        budget = self.service.init_budget(
            service_name="order-service",
            slo_name="availability",
            total_budget=100.0
        )
        self.assert_equal(budget.remaining_budget, 100.0, "初始化预算成功")
        self.assert_equal(budget.consumed_budget, 0.0, "初始已消费预算为0")

        print("\n1.3 评估发布 - 预算充足")
        batch1 = self.service.evaluate_release(
            service_name="order-service",
            batch_name="v1.0.0-rc1",
            slo_name="availability",
            budget_consumption=30.0,
            requester="engineer_a",
            metrics_snapshot={"error_rate": 0.0005, "throughput": 1000}
        )
        self.assert_equal(batch1.status, ReleaseStatus.APPROVED, "预算充足时发布被批准")
        self.assert_equal(batch1.decision_type, DecisionType.ALLOW, "决策类型为ALLOW")

        print("\n1.4 验证预算已扣减")
        budget = self.service.query_budget("order-service", "availability")
        self.assert_equal(budget.remaining_budget, 70.0, "预算已正确扣减")

        print("\n1.5 评估发布 - 预算不足")
        batch2 = self.service.evaluate_release(
            service_name="order-service",
            batch_name="v1.0.0-rc2",
            slo_name="availability",
            budget_consumption=80.0,
            requester="engineer_b"
        )
        self.assert_equal(batch2.status, ReleaseStatus.PENDING, "预算不足时进入待审批")
        self.assert_equal(batch2.decision_type, DecisionType.REQUIRE_APPROVAL, "决策类型为REQUIRE_APPROVAL")

        print("\n1.6 批准豁免")
        approved = self.service.approve_exemption(batch2.id, "manager_a", override_budget=True)
        self.assert_equal(approved.status, ReleaseStatus.EXEMPTED, "豁免已批准")

        print("\n1.7 验证豁免扣减预算")
        budget = self.service.query_budget("order-service", "availability")
        self.assert_equal(budget.remaining_budget, -10.0, "豁免强制扣减后预算为负数")

        print("\n1.8 评估发布 - 预算耗尽")
        batch3 = self.service.evaluate_release(
            service_name="order-service",
            batch_name="v1.0.0-rc3",
            slo_name="availability",
            budget_consumption=10.0,
            requester="engineer_c"
        )
        self.assert_equal(batch3.status, ReleaseStatus.BLOCKED, "预算耗尽时发布被拦截")
        self.assert_equal(batch3.decision_type, DecisionType.BLOCK, "决策类型为BLOCK")

        print("\n1.9 标记发布完成")
        completed = self.service.complete_release(batch1.id)
        self.assert_equal(completed.status, ReleaseStatus.COMPLETED, "发布已标记完成")

        print("\n1.10 导出决策数据")
        export_data = self.service.export_decisions("order-service")
        self.assert_equal(export_data["summary_statistics"]["approved"], 1, "导出统计正确-已批准(含已完成)")
        self.assert_equal(export_data["summary_statistics"]["completed"], 1, "导出统计正确-已完成")
        self.assert_equal(export_data["summary_statistics"]["exempted"], 1, "导出统计正确-已豁免")
        self.assert_equal(export_data["summary_statistics"]["blocked"], 1, "导出统计正确-已拦截")

    def test_2_dirty_data(self):
        print("\n=== Test 2: 脏数据测试 ===")

        print("\n2.1 SLO target 无效值测试")
        self.assert_raises(
            ValueError,
            self.service.create_service_slo,
            service_name="payment-service",
            slo_name="latency",
            slo_target=1.5,
            description="无效SLO"
        )
        self.assert_raises(
            ValueError,
            self.service.create_service_slo,
            service_name="payment-service",
            slo_name="latency",
            slo_target=-0.1,
            description="无效SLO"
        )

        print("\n2.2 初始化预算 - 负值测试")
        self.service.create_service_slo("payment-service", "latency", 0.99, "延迟SLO")
        self.assert_raises(
            ValueError,
            self.service.init_budget,
            service_name="payment-service",
            slo_name="latency",
            total_budget=-50.0
        )

        print("\n2.3 初始化预算 - SLO不存在测试")
        self.assert_raises(
            ValueError,
            self.service.init_budget,
            service_name="unknown-service",
            slo_name="nonexistent",
            total_budget=100.0
        )

        print("\n2.4 重复初始化预算测试")
        self.service.init_budget("payment-service", "latency", 200.0)
        self.assert_raises(
            ValueError,
            self.service.init_budget,
            service_name="payment-service",
            slo_name="latency",
            total_budget=100.0
        )

        print("\n2.5 发布评估 - 负数预算消耗测试")
        self.assert_raises(
            ValueError,
            self.service.evaluate_release,
            service_name="payment-service",
            batch_name="v2.0.1-neg",
            slo_name="latency",
            budget_consumption=-10.0,
            requester="engineer_x"
        )

        print("\n2.6 发布评估 - 零值预算消耗测试")
        self.assert_raises(
            ValueError,
            self.service.evaluate_release,
            service_name="payment-service",
            batch_name="v2.0.1-zero",
            slo_name="latency",
            budget_consumption=0.0,
            requester="engineer_x"
        )

        print("\n2.7 审批非待审批状态的批次")
        batch = self.service.evaluate_release(
            service_name="payment-service",
            batch_name="v2.0.0",
            slo_name="latency",
            budget_consumption=50.0,
            requester="engineer_x"
        )
        self.assert_raises(
            ValueError,
            self.service.approve_exemption,
            batch_id=batch.id,
            approver="manager_x"
        )

        print("\n2.6 不存在的批次操作")
        self.assert_raises(
            ValueError,
            self.service.approve_exemption,
            batch_id="non-existent-id",
            approver="manager_x"
        )
        self.assert_raises(
            ValueError,
            self.service.manual_correction,
            batch_id="non-existent-id",
            corrector="admin",
            correction_note="修正测试"
        )

    def test_3_duplicate_requests(self):
        print("\n=== Test 3: 重复请求测试 ===")

        print("\n3.1 准备测试数据")
        self.service.create_service_slo("user-service", "error_rate", 0.995, "错误率SLO")
        self.service.init_budget("user-service", "error_rate", 500.0)

        print("\n3.2 多次相同请求，每次都创建新批次")
        batches = []
        for i in range(5):
            batch = self.service.evaluate_release(
                service_name="user-service",
                batch_name=f"v3.0.0-build-{i}",
                slo_name="error_rate",
                budget_consumption=10.0,
                requester="engineer_z"
            )
            batches.append(batch)

        unique_ids = len(set(b.id for b in batches))
        self.assert_equal(unique_ids, 5, "5次请求创建5个唯一批次")

        print("\n3.3 验证预算正确累加扣减")
        budget = self.service.query_budget("user-service", "error_rate")
        self.assert_equal(budget.remaining_budget, 450.0, "预算正确扣减50点(10*5)")

        print("\n3.4 重复豁免审批测试")
        batch_pending = self.service.evaluate_release(
            service_name="user-service",
            batch_name="v3.0.0-exempt",
            slo_name="error_rate",
            budget_consumption=500.0,
            requester="engineer_z"
        )
        self.service.approve_exemption(batch_pending.id, "manager_z")
        
        self.assert_raises(
            ValueError,
            self.service.approve_exemption,
            batch_id=batch_pending.id,
            approver="manager_z"
        )

    def test_4_manual_correction_recalc(self):
        print("\n=== Test 4: 人工修正后重新计算测试 ===")

        print("\n4.1 准备测试数据")
        self.service.create_service_slo("inventory-service", "availability", 0.9995, "库存服务SLO")
        self.service.init_budget("inventory-service", "availability", 1000.0)

        print("\n4.2 初始发布 - 错误预算扣减")
        batch = self.service.evaluate_release(
            service_name="inventory-service",
            batch_name="v4.0.0",
            slo_name="availability",
            budget_consumption=200.0,
            requester="engineer_y"
        )
        budget = self.service.query_budget("inventory-service", "availability")
        self.assert_equal(budget.remaining_budget, 800.0, "初始预算扣减后为800")

        print("\n4.3 人工修正 - 修改预算消费值并重新计算")
        corrected = self.service.manual_correction(
            batch_id=batch.id,
            corrector="admin_user",
            correction_note="修正预算消费值从200到100",
            new_budget_consumption=100.0,
            new_status=ReleaseStatus.APPROVED,
            recalculate_budget=True
        )
        self.assert_equal(corrected.is_manual_correction, True, "已标记人工修正")
        self.assert_equal(corrected.budget_consumption, 100.0, "预算消费值已修正")

        print("\n4.4 验证修正后预算重新计算")
        budget = self.service.query_budget("inventory-service", "availability")
        self.assert_equal(budget.remaining_budget, 900.0, "重新计算后预算为900(1000-100)")

        print("\n4.5 验证处理证据中包含修正记录")
        self.assert_equal(
            "manual_correction" in corrected.processing_evidence,
            True,
            "处理证据中包含人工修正记录"
        )

        print("\n4.6 人工修正 - 只修改状态不重新计算")
        batch2 = self.service.evaluate_release(
            service_name="inventory-service",
            batch_name="v4.0.1",
            slo_name="availability",
            budget_consumption=50.0,
            requester="engineer_y"
        )
        corrected2 = self.service.manual_correction(
            batch_id=batch2.id,
            corrector="admin_user",
            correction_note="仅标记为豁免，不修改预算",
            new_status=ReleaseStatus.EXEMPTED,
            recalculate_budget=False
        )
        self.assert_equal(corrected2.status, ReleaseStatus.EXEMPTED, "状态已修改为EXEMPTED")

        budget = self.service.query_budget("inventory-service", "availability")
        self.assert_equal(budget.remaining_budget, 850.0, "预算正常扣减")

    def test_5_exception_handling(self):
        print("\n=== Test 5: 异常处理测试 ===")

        print("\n5.1 准备测试数据")
        self.service.create_service_slo("notification-service", "success_rate", 0.99, "通知服务SLO")
        self.service.init_budget("notification-service", "success_rate", 300.0)

        print("\n5.2 创建批次并标记异常")
        batch = self.service.evaluate_release(
            service_name="notification-service",
            batch_name="v5.0.0",
            slo_name="success_rate",
            budget_consumption=30.0,
            requester="engineer_w"
        )
        
        failed = self.service.handle_exception(
            batch_id=batch.id,
            error_message="网络超时，无法获取指标数据",
            raw_input={"original_request": "POST /api/release"},
            processing_evidence={"retry_count": 3, "last_error": "Connection timed out"}
        )
        self.assert_equal(failed.status, ReleaseStatus.FAILED, "批次状态标记为FAILED")
        self.assert_equal("exception" in failed.processing_evidence, True, "处理证据中包含异常信息")

        print("\n5.3 导出数据时包含失败记录")
        export_data = self.service.export_decisions("notification-service")
        self.assert_equal(export_data["summary_statistics"]["failed"], 1, "导出统计中包含失败记录")

    def test_6_data_persistence(self):
        print("\n=== Test 6: 数据持久化测试 (模拟服务重启) ===")

        print("\n6.1 写入测试数据")
        self.service.create_service_slo("persist-service", "uptime", 0.9999, "持久化测试SLO")
        self.service.init_budget("persist-service", "uptime", 5000.0)
        self.service.evaluate_release(
            service_name="persist-service",
            batch_name="v6.0.0",
            slo_name="uptime",
            budget_consumption=100.0,
            requester="engineer_v"
        )

        print("\n6.2 模拟服务重启 - 创建新的Service实例")
        new_storage = JSONStorage(data_dir=self.test_dir)
        new_service = SLOBudgetService(storage=new_storage)

        print("\n6.3 验证预算数据在重启后仍然存在")
        budget = new_service.query_budget("persist-service", "uptime")
        self.assert_equal(budget.remaining_budget, 4900.0, "重启后预算数据正确")

        print("\n6.4 验证批次数据在重启后仍然存在")
        batches = new_service.query_batches("persist-service")
        self.assert_equal(len(batches), 1, "重启后批次数据存在")
        self.assert_equal(batches[0].batch_name, "v6.0.0", "批次名称正确")

        print("\n6.5 重启后可正常继续操作")
        batch2 = new_service.evaluate_release(
            service_name="persist-service",
            batch_name="v6.0.1",
            slo_name="uptime",
            budget_consumption=50.0,
            requester="engineer_v"
        )
        budget = new_service.query_budget("persist-service", "uptime")
        self.assert_equal(budget.remaining_budget, 4850.0, "重启后可正常扣减预算")

    def run_all_tests(self):
        print("=" * 60)
        print("SLO Budget API 测试套件")
        print("=" * 60)

        try:
            self.test_1_normal_flow()
            self.test_2_dirty_data()
            self.test_3_duplicate_requests()
            self.test_4_manual_correction_recalc()
            self.test_5_exception_handling()
            self.test_6_data_persistence()
        finally:
            self.cleanup()

        print("\n" + "=" * 60)
        print("测试总结:")
        print(f"  通过: {self.passed}")
        print(f"  失败: {self.failed}")
        print(f"  总计: {self.passed + self.failed}")
        if self.failed == 0:
            print("  状态: ✅ 所有测试通过!")
        else:
            print("  状态: ❌ 有测试失败!")
        print("=" * 60)

        return self.failed == 0


if __name__ == "__main__":
    tester = SLOBudgetTests()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
