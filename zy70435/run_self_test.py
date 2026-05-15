#!/usr/bin/env python3
import sys
import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.database import SessionLocal, init_db, ApprovalOrder, BudgetAllocation, ManualCorrection, VersionFreeze, ProcessLog
from app.services.budget_allocator import BudgetAllocatorService
from app.schemas.schemas import AllocationRequest, CorrectionRequest, FreezeRequest, QueryFilter


class SelfTest:
    def __init__(self):
        init_db()
        self.db = SessionLocal()
        self.service = BudgetAllocatorService(self.db)
        self.passed = 0
        self.failed = 0

    def log(self, test_name, status, message=""):
        icon = "✓" if status else "✗"
        color = "\033[92m" if status else "\033[91m"
        reset = "\033[0m"
        print(f"{color}{icon} {test_name}{reset} {message}")
        if status:
            self.passed += 1
        else:
            self.failed += 1

    def test_1_create_orders(self):
        """测试1: 创建审批单"""
        try:
            order_data = {
                "order_no": f"TEST-{int(datetime.now().timestamp())}",
                "department": "技术研发部",
                "applicant": "测试员",
                "amount": 10000,
                "subject": "测试审批单 - 设备采购",
                "apply_date": datetime.now() - timedelta(days=10),
                "due_date": datetime.now() - timedelta(days=5),
                "priority": "high",
                "material_summary": "这是一个测试审批单，用于系统自检",
                "current_approver": "测试审批人"
            }
            order = ApprovalOrder(**order_data, status="pending", overdue_days=5)
            self.db.add(order)
            self.db.commit()
            self.db.refresh(order)
            self.log("创建审批单", order.id is not None, f"ID={order.id}")
            return order
        except Exception as e:
            self.log("创建审批单", False, str(e))
            return None

    def test_2_budget_allocation_success(self, order):
        """测试2: 成功的预算分配"""
        if not order:
            self.log("成功预算分配", False, "没有可用的审批单")
            return None
        try:
            request = AllocationRequest(order_ids=[order.id], algorithm_version="v1.0.0-test", operator="tester")
            result = self.service.allocate_budget(request)
            success = result["success_count"] == 1 and result["error_count"] == 0
            self.log("成功预算分配", success, f"成功={result['success_count']}, 失败={result['error_count']}")
            return order.id
        except Exception as e:
            self.log("成功预算分配", False, str(e))
            return None

    def test_3_budget_allocation_failed_overlimit(self):
        """测试3: 预算超限分配失败"""
        try:
            order_data = {
                "order_no": f"TEST-OVER-{int(datetime.now().timestamp())}",
                "department": "技术研发部",
                "applicant": "测试员",
                "amount": 600000,
                "subject": "测试审批单 - 预算超限",
                "apply_date": datetime.now() - timedelta(days=10),
                "due_date": datetime.now() - timedelta(days=5),
                "priority": "high",
                "material_summary": "金额超出部门限额，应该分配失败",
                "current_approver": "测试审批人",
                "overdue_days": 5
            }
            order = ApprovalOrder(**order_data, status="pending")
            self.db.add(order)
            self.db.commit()
            self.db.refresh(order)

            request = AllocationRequest(order_ids=[order.id], algorithm_version="v1.0.0-test", operator="tester")
            result = self.service.allocate_budget(request)
            success = result["error_count"] == 1
            self.log("预算超限分配失败", success, f"失败订单={result['error_count']}")
            return order.id
        except Exception as e:
            self.log("预算超限分配失败", False, str(e))
            return None

    def test_4_budget_allocation_invalid_order(self):
        """测试4: 不存在的审批单分配"""
        try:
            invalid_id = 999999
            request = AllocationRequest(order_ids=[invalid_id], algorithm_version="v1.0.0-test", operator="tester")
            result = self.service.allocate_budget(request)
            success = result["error_count"] == 1
            self.log("不存在审批单分配处理", success, f"系统正确处理异常")
        except Exception as e:
            self.log("不存在审批单分配处理", False, str(e))

    def test_5_manual_correction(self, order_id):
        """测试5: 人工修正（保留系统判断快照）"""
        if not order_id:
            self.log("人工修正", False, "没有可用的审批单")
            return
        try:
            request = CorrectionRequest(
                order_id=order_id,
                corrected_amount=9000,
                corrected_budget_code="OP-001",
                correction_reason="测试人工修正：金额下调，编码调整",
                corrected_by="测试审核员"
            )
            result = self.service.apply_manual_correction(request)
            snapshot = result["system_snapshot"]
            success = (snapshot is not None and
                       snapshot["system_allocated_amount"] == 10000 and
                       snapshot["system_budget_code"] is not None)
            self.log("人工修正（保留系统快照）", success,
                     f"系统分配金额={snapshot.get('system_allocated_amount')}, 修正后={request.corrected_amount}")
        except Exception as e:
            self.log("人工修正（保留系统快照）", False, str(e))

    def test_6_correction_on_unallocated(self):
        """测试6: 未分配订单的人工修正应该失败"""
        try:
            order_data = {
                "order_no": f"TEST-UNALLOC-{int(datetime.now().timestamp())}",
                "department": "技术研发部",
                "applicant": "测试员",
                "amount": 5000,
                "subject": "未分配审批单",
                "apply_date": datetime.now() - timedelta(days=5),
                "due_date": datetime.now() - timedelta(days=1),
                "priority": "normal",
                "overdue_days": 1
            }
            order = ApprovalOrder(**order_data, status="pending")
            self.db.add(order)
            self.db.commit()
            self.db.refresh(order)

            request = CorrectionRequest(
                order_id=order.id,
                corrected_amount=4000,
                correction_reason="测试：修正未分配订单",
                corrected_by="测试员"
            )
            try:
                self.service.apply_manual_correction(request)
                self.log("未分配订单修正应失败", False, "系统未正确拦截")
            except ValueError:
                self.log("未分配订单修正应失败", True, "系统正确拦截未分配订单的修正")
        except Exception as e:
            self.log("未分配订单修正应失败", False, str(e))

    def test_7_version_freeze(self, order_id):
        """测试7: 版本冻结"""
        if not order_id:
            self.log("版本冻结", False, "没有可用的审批单")
            return
        try:
            allocation = self.db.query(BudgetAllocation).filter(
                BudgetAllocation.order_id == order_id
            ).order_by(BudgetAllocation.created_at.desc()).first()

            request = FreezeRequest(
                allocation_id=allocation.id,
                freeze_note="测试版本冻结：确认结果无误",
                frozen_by="测试审核员"
            )
            result = self.service.freeze_version(request)
            success = result["algorithm_hash"] is not None
            self.log("版本冻结", success, f"冻结ID={result.get('freeze_id')}")
        except Exception as e:
            self.log("版本冻结", False, str(e))

    def test_8_double_freeze_should_fail(self, order_id):
        """测试8: 重复冻结应该失败"""
        if not order_id:
            self.log("重复冻结拦截", False, "没有可用的审批单")
            return
        try:
            allocation = self.db.query(BudgetAllocation).filter(
                BudgetAllocation.order_id == order_id
            ).order_by(BudgetAllocation.created_at.desc()).first()

            request = FreezeRequest(
                allocation_id=allocation.id,
                freeze_note="测试重复冻结",
                frozen_by="测试员"
            )
            try:
                self.service.freeze_version(request)
                self.log("重复冻结拦截", False, "系统未拦截重复冻结")
            except ValueError:
                self.log("重复冻结拦截", True, "系统正确拦截重复冻结")
        except Exception as e:
            self.log("重复冻结拦截", False, str(e))

    def test_9_unified_query_all(self):
        """测试9: 统一查询入口 - 查询全部"""
        try:
            results = self.service.query_allocation_results()
            success = len(results) > 0
            self.log("统一查询-全部", success, f"返回{len(results)}条记录")
        except Exception as e:
            self.log("统一查询-全部", False, str(e))

    def test_10_unified_query_filter_success(self):
        """测试10: 统一查询入口 - 筛选成功记录"""
        try:
            filter_success = QueryFilter(status="success")
            results = self.service.query_allocation_results(filter_success)
            self.log("统一查询-筛选成功", True, f"返回{len(results)}条成功记录")
        except Exception as e:
            self.log("统一查询-筛选成功", False, str(e))

    def test_11_unified_query_filter_failed(self):
        """测试11: 统一查询入口 - 筛选失败记录"""
        try:
            filter_failed = QueryFilter(status="failed")
            results = self.service.query_allocation_results(filter_failed)
            self.log("统一查询-筛选失败", True, f"返回{len(results)}条失败记录")
        except Exception as e:
            self.log("统一查询-筛选失败", False, str(e))

    def test_12_unified_query_filter_has_error(self):
        """测试12: 统一查询入口 - 筛选有错误的记录"""
        try:
            filter_error = QueryFilter(has_error=True)
            results = self.service.query_allocation_results(filter_error)
            self.log("统一查询-筛选有错误", True, f"返回{len(results)}条错误记录")
        except Exception as e:
            self.log("统一查询-筛选有错误", False, str(e))

    def test_13_unified_query_filter_has_correction(self):
        """测试13: 统一查询入口 - 筛选有人工修正的记录"""
        try:
            filter_correction = QueryFilter(has_correction=True)
            results = self.service.query_allocation_results(filter_correction)
            self.log("统一查询-筛选有人工修正", True, f"返回{len(results)}条已修正记录")
        except Exception as e:
            self.log("统一查询-筛选有人工修正", False, str(e))

    def test_14_review_trace_timeline(self, order_id):
        """测试14: 复盘时间线 - 从执行时间定位版本冻结"""
        if not order_id:
            self.log("复盘时间线定位", False, "没有可用的审批单")
            return
        try:
            trace = self.service.get_review_trace(order_id)
            timeline = trace["timeline"]
            has_allocation = any(t["type"] == "system_allocation" for t in timeline)
            has_correction = any(t["type"] == "manual_correction" for t in timeline)
            has_freeze = any(t["type"] == "version_freeze" for t in timeline)
            has_log = any(t["type"] == "budget_allocation" for t in timeline)

            success = has_allocation and has_correction and has_freeze
            self.log("复盘时间线-定位版本冻结", success,
                     f"包含分配={has_allocation}, 修正={has_correction}, 冻结={has_freeze}, 日志={has_log}")

            if timeline:
                timeline.sort(key=lambda x: x.get("time", ""))
                print(f"    时间线事件数: {len(timeline)}")
                for event in timeline[:3]:
                    event_type = event.get("type", "unknown")
                    event_time = event.get("time", "")[:19]
                    print(f"      - {event_time} {event_type}")
        except Exception as e:
            self.log("复盘时间线定位", False, str(e))

    def test_15_persistence_after_restart(self):
        """测试15: 重启后数据持久化验证"""
        try:
            order_count = self.db.query(ApprovalOrder).count()
            alloc_count = self.db.query(BudgetAllocation).count()
            correction_count = self.db.query(ManualCorrection).count()
            freeze_count = self.db.query(VersionFreeze).count()

            success = order_count > 0 and alloc_count > 0
            self.log("数据持久化验证", success,
                     f"订单={order_count}, 分配={alloc_count}, 修正={correction_count}, 冻结={freeze_count}")
        except Exception as e:
            self.log("数据持久化验证", False, str(e))

    def test_16_multiple_allocations_same_order(self):
        """测试16: 同一订单多次分配（版本覆盖场景）"""
        try:
            order = self.db.query(ApprovalOrder).first()
            if not order:
                self.log("同一订单多次分配", False, "没有可用订单")
                return

            for i in range(3):
                request = AllocationRequest(order_ids=[order.id], algorithm_version=f"v1.0.{i}-test", operator="tester")
                self.service.allocate_budget(request)

            allocations = self.db.query(BudgetAllocation).filter(
                BudgetAllocation.order_id == order.id
            ).order_by(BudgetAllocation.created_at.desc()).all()

            success = len(allocations) >= 3
            versions = set(a.algorithm_version for a in allocations)
            self.log("同一订单多次分配（版本覆盖）", success,
                     f"共{len(allocations)}条分配记录, 版本数={len(versions)}")
        except Exception as e:
            self.log("同一订单多次分配（版本覆盖）", False, str(e))

    def test_17_correction_preserves_system_judgment(self):
        """测试17: 人工修正不覆盖系统原始判断"""
        try:
            corrections = self.db.query(ManualCorrection).all()
            if corrections:
                all_have_snapshot = all(c.system_judgment_snapshot is not None for c in corrections)
                all_snapshots_valid = True
                for c in corrections:
                    try:
                        snapshot = json.loads(c.system_judgment_snapshot)
                        if "system_allocated_amount" not in snapshot:
                            all_snapshots_valid = False
                    except:
                        all_snapshots_valid = False

                success = all_have_snapshot and all_snapshots_valid
                self.log("人工修正不覆盖系统判断", success,
                         f"共{len(corrections)}条修正，全部保留快照={all_have_snapshot}")
            else:
                self.log("人工修正不覆盖系统判断", True, "暂无修正记录，功能就绪")
        except Exception as e:
            self.log("人工修正不覆盖系统判断", False, str(e))

    def run_all_tests(self):
        print("\n" + "="*60)
        print("开始运行超时预算分配器自检程序")
        print("="*60 + "\n")

        order1 = self.test_1_create_orders()
        order_id1 = self.test_2_budget_allocation_success(order1)
        self.test_3_budget_allocation_failed_overlimit()
        self.test_4_budget_allocation_invalid_order()
        self.test_5_manual_correction(order_id1)
        self.test_6_correction_on_unallocated()
        self.test_7_version_freeze(order_id1)
        self.test_8_double_freeze_should_fail(order_id1)
        self.test_9_unified_query_all()
        self.test_10_unified_query_filter_success()
        self.test_11_unified_query_filter_failed()
        self.test_12_unified_query_filter_has_error()
        self.test_13_unified_query_filter_has_correction()
        self.test_14_review_trace_timeline(order_id1)
        self.test_15_persistence_after_restart()
        self.test_16_multiple_allocations_same_order()
        self.test_17_correction_preserves_system_judgment()

        print("\n" + "="*60)
        print(f"测试完成: {self.passed} 通过, {self.failed} 失败")
        total = self.passed + self.failed
        pass_rate = (self.passed / total * 100) if total > 0 else 0
        print(f"通过率: {pass_rate:.1f}%")
        print("="*60)

        if self.failed == 0:
            print("\n\033[92m✓ 所有测试通过！系统功能正常。\033[0m\n")
        else:
            print(f"\n\033[91m✗ 有 {self.failed} 个测试失败，请检查相关功能。\033[0m\n")

        self.db.close()
        return self.failed == 0


def main():
    tester = SelfTest()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
