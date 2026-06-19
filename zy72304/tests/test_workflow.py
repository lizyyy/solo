"""
工作流程测试

测试三步流程：导入→参数调试→计算明细更新
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bus_scheduling.validator import BoundaryValidator
from bus_scheduling.importer import SamplingImporter
from bus_scheduling.scheduler import BusScheduler
from bus_scheduling.workflow import SchedulingWorkflow
from bus_scheduling.models import WorkflowStep, IssueStatus
from bus_scheduling.exceptions import WorkflowError, ValidationError


class TestWorkflow:
    """工作流程测试类"""

    def setup_method(self):
        self.validator = BoundaryValidator()
        self.importer = SamplingImporter(self.validator)
        self.scheduler = BusScheduler(self.validator)
        self.workflow = SchedulingWorkflow(
            self.validator, self.importer, self.scheduler
        )
        self.test_data_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "test_data"
        )

    def test_full_workflow_with_mixed_numbers(self):
        """测试包含混合数的完整工作流程"""
        file_path = os.path.join(self.test_data_dir, "sampling_list_mixed.csv")

        # 第一步：导入
        print("=== 第一步：导入抽样名单 ===")
        result1 = self.workflow.step1_import_sampling_list(
            file_path, "实验助理小穆"
        )
        assert self.workflow.current_step == WorkflowStep.STEP2_PARAM_DEBUG
        assert result1["has_mixed_numbers"] is True
        assert result1["pending_review_count"] == 8
        print(f"✓ 导入完成，发现 {result1['pending_review_count']} 条待复核混合问题")

        # 第二步：参数调试
        print("\n=== 第二步：参数调试 ===")
        result2 = self.workflow.step2_review_parameters(
            reviewer="活动负责人",
            config_updates={"bus_capacity": 50, "cost_per_bus": 600.0},
        )
        assert result2["can_proceed"] is False
        assert result2["pending_count"] == 8
        print(f"✓ 参数调试完成，还有 {result2['pending_count']} 条待复核")

        # 复核所有问题
        print("\n=== 复核所有混合问题 ===")
        pending_issues = self.workflow.get_pending_issues()
        for i, issue in enumerate(pending_issues):
            if i % 2 == 0:
                # 一半通过，保留原值
                result = self.workflow.review_issue(
                    issue_id=issue["issue_id"],
                    approved=True,
                    reviewer="活动负责人",
                    retain_reason=f"线路{i+1}数据正常，保留原值",
                )
                assert result["status"] == IssueStatus.APPROVED.value
            else:
                # 一半修改为小数
                result = self.workflow.review_issue(
                    issue_id=issue["issue_id"],
                    approved=False,
                    reviewer="活动负责人",
                    retain_reason=f"线路{i+1}统一改为小数格式",
                    modified_value=float(issue["original_value"].replace("%", "")) if "%" in issue["original_value"] else float(issue["original_value"]),
                )
                assert result["status"] == IssueStatus.MODIFIED.value
        print(f"✓ 所有问题已复核")

        # 再次检查参数调试状态
        result2b = self.workflow.step2_review_parameters(reviewer="活动负责人")
        assert result2b["can_proceed"] is True
        assert self.workflow.current_step == WorkflowStep.STEP3_CALC_UPDATE

        # 第三步：计算
        print("\n=== 第三步：计算明细更新 ===")
        result3 = self.workflow.step3_calculate(operator="实验助理小穆")
        assert self.workflow.current_step == WorkflowStep.COMPLETED
        assert result3["total_buses"] > 0
        assert result3["calculation_details_count"] > 0
        print(f"✓ 计算完成，共需要 {result3['total_buses']} 辆车，总成本 {result3['total_cost']}")

        # 测试下钻功能
        print("\n=== 测试下钻功能 ===")
        first_detail = result3["drilldown_available"][0]
        drilldown = self.workflow.drilldown_detail(first_detail["detail_id"])
        assert "detail" in drilldown
        assert "record" in drilldown
        assert "related_issues" in drilldown
        assert "navigation" in drilldown
        if drilldown["retain_reason"]:
            print(f"✓ 下钻成功，保留理由：{drilldown['retain_reason']}")
        else:
            print(f"✓ 下钻成功")

        print("\n✓ 完整工作流程测试通过！")

    def test_update_remark_and_history(self):
        """测试修改备注和历史记录"""
        file_path = os.path.join(self.test_data_dir, "sampling_list_mixed.csv")

        # 第一步：导入
        self.workflow.step1_import_sampling_list(file_path, "实验助理小穆")

        # 获取第一条记录
        record = self.workflow.records[0]
        old_remark = record.remark

        # 修改备注
        result = self.workflow.update_remark(
            record_id=record.record_id,
            new_remark="这是修改后的备注",
            operator="实验助理小穆",
            reason="补充线路说明",
        )

        assert result["old_value"] == old_remark
        assert result["new_value"] == "这是修改后的备注"

        # 查看历史记录
        history = self.workflow.get_record_history(record.record_id)
        assert len(history) >= 2  # 至少有导入和修改备注两条记录

        # 找到备注修改的历史
        remark_history = [h for h in history if h["field_name"] == "remark"]
        assert len(remark_history) == 1
        assert remark_history[0]["old_value"] == str(old_remark)
        assert remark_history[0]["new_value"] == "这是修改后的备注"

        print("✓ 修改备注和历史记录测试通过！")

    def test_rollback_issue(self):
        """测试回滚问题处理结果"""
        file_path = os.path.join(self.test_data_dir, "sampling_list_mixed.csv")

        # 第一步：导入
        self.workflow.step1_import_sampling_list(file_path, "实验助理小穆")

        # 复核一个问题
        issue = self.workflow.issues[0]
        self.workflow.review_issue(
            issue_id=issue.issue_id,
            approved=True,
            reviewer="活动负责人",
            retain_reason="测试通过",
        )
        assert issue.status == IssueStatus.APPROVED

        # 回滚
        result = self.workflow.rollback_issue(
            issue_id=issue.issue_id,
            operator="活动负责人",
            reason="复核有误，需要重新确认",
        )
        assert result["status"] == IssueStatus.PENDING_REVIEW.value

        # 检查历史记录
        history = self.workflow.get_record_history(issue.record_id)
        # 检查是否有回滚相关的历史记录（包含状态从APPROVED变回PENDING_REVIEW）
        rollback_history = [
            h for h in history 
            if h.get("field_name", "").startswith("issue_status:")
            and "pending_review" in str(h.get("new_value", "")).lower()
        ]
        assert len(rollback_history) >= 1

        print("✓ 回滚问题测试通过！")

    def test_navigate_from_chart(self):
        """测试从图表跳转功能"""
        file_path = os.path.join(self.test_data_dir, "sampling_list_mixed.csv")

        # 第一步：导入
        self.workflow.step1_import_sampling_list(file_path, "实验助理小穆")

        # 模拟从3D/图表点击
        issue = self.workflow.issues[0]
        navigation = self.workflow.navigate_from_chart(issue.issue_id)

        assert "issue" in navigation
        assert "record" in navigation
        assert "navigation_options" in navigation
        assert len(navigation["navigation_options"]) == 3

        # 检查跳转选项
        options = navigation["navigation_options"]
        assert any("返回抽样名单" in opt["name"] for opt in options)
        assert any("返回参数调试表" in opt["name"] for opt in options)
        assert any("查看计算明细" in opt["name"] for opt in options)

        print("✓ 从图表跳转功能测试通过！")

    def test_workflow_step_skipping(self):
        """测试跳过步骤的错误提示"""
        file_path = os.path.join(self.test_data_dir, "sampling_list_mixed.csv")

        # 尝试直接进行第二步（应该失败）
        try:
            self.workflow.step2_review_parameters()
            assert False, "应该抛出WorkflowError"
        except WorkflowError as e:
            assert "请先完成上一步骤再继续" in str(e)
            print(f"✓ 正确阻止跳过步骤：{e.message}")

        # 先完成第一步
        self.workflow.step1_import_sampling_list(file_path, "实验助理小穆")

        # 尝试直接进行第三步（应该失败）
        try:
            self.workflow.step3_calculate()
            assert False, "应该抛出WorkflowError"
        except WorkflowError as e:
            assert "请先完成上一步骤再继续" in str(e)
            print(f"✓ 正确阻止跳过步骤：{e.message}")

        print("✓ 工作流步骤校验测试通过！")

    def test_calculate_with_pending_issues(self):
        """测试有待复核问题时计算的错误提示"""
        file_path = os.path.join(self.test_data_dir, "sampling_list_mixed.csv")

        # 第一步：导入
        self.workflow.step1_import_sampling_list(file_path, "实验助理小穆")

        # 第二步：参数调试（有待复核问题，不会推进到第三步）
        self.workflow.step2_review_parameters(reviewer="活动负责人")

        # 手动设置到第三步，模拟用户尝试绕过流程直接计算的情况
        from bus_scheduling.models import WorkflowStep
        self.workflow._current_step = WorkflowStep.STEP3_CALC_UPDATE

        # 尝试在有待复核问题的情况下计算（应该失败）
        try:
            self.workflow.step3_calculate()
            assert False, "应该抛出ValidationError"
        except ValidationError as e:
            assert "该数据需要活动负责人复核后才能继续" in str(e)
            print(f"✓ 正确阻止计算：{e.message}")

        # 使用skip_review_check参数跳过检查（仅测试用）
        result = self.workflow.step3_calculate(skip_review_check=True)
        assert result["total_buses"] > 0
        print("✓ 待复核问题校验测试通过！")

    def test_get_boundary_rules(self):
        """测试获取边界规则"""
        rules = self.workflow.get_boundary_rules()
        assert "规则说明" in rules
        assert "百分数格式" in rules
        assert "小数格式" in rules
        assert "混合判定" in rules
        assert "混合处理" in rules

        print("✓ 获取边界规则测试通过！")

    def test_pure_decimal_full_workflow(self):
        """测试纯小数名单完整流程（无待复核，一路算完）"""
        file_path = os.path.join(
            self.test_data_dir, "sampling_list_decimal_only.csv"
        )

        # 第一步：导入
        r1 = self.workflow.step1_import_sampling_list(file_path, "实验助理小穆")
        assert r1["batch_type"] == "纯小数"
        assert r1["pending_review_count"] == 0
        assert r1["can_skip_review"] is True
        assert "纯小数格式" in r1["note"]
        print(f"  导入: 批次类型={r1['batch_type']}, 待复核={r1['pending_review_count']}")

        # 检查所有 issue 状态都是 approved
        for rec in self.workflow.records:
            for iss in rec.issues:
                assert iss.status.value == "approved"
                assert "纯小数格式" in (iss.retain_reason or "")
        print("  所有记录状态: approved ✓")

        # 第二步：参数调试
        r2 = self.workflow.step2_review_parameters(reviewer="活动负责人")
        assert r2["batch_type"] == "纯小数"
        assert r2["pending_count"] == 0
        assert r2["can_proceed"] is True
        print(f"  参数调试: 待复核={r2['pending_count']}, can_proceed={r2['can_proceed']}")

        # 第三步：计算（无需复核，直接算）
        r3 = self.workflow.step3_calculate(operator="实验助理小穆")
        assert r3["total_buses"] > 0
        assert r3["calculation_details_count"] == 4
        print(f"  计算: 总车辆={r3['total_buses']}, 明细={r3['calculation_details_count']}")

        # 下钻查看明细
        first_detail = r3["drilldown_available"][0]
        detail = self.workflow.drilldown_detail(first_detail["detail_id"])
        assert detail["retain_reason"] is not None
        assert "纯小数" in detail["retain_reason"]
        assert len(detail["detail"]["calculation_steps"]) == 5
        print(f"  下钻: 保留理由='{detail['retain_reason']}', 步骤数=5 ✓")

        print("✓ 纯小数名单完整流程测试通过（一路算完无阻断）！")

    def test_pure_percentage_full_workflow(self):
        """测试纯百分数名单完整流程（无待复核，一路算完）"""
        file_path = os.path.join(
            self.test_data_dir, "sampling_list_percentage_only.csv"
        )

        # 第一步：导入
        r1 = self.workflow.step1_import_sampling_list(file_path, "实验助理小穆")
        assert r1["batch_type"] == "纯百分数"
        assert r1["pending_review_count"] == 0
        assert r1["can_skip_review"] is True
        assert "纯百分数格式" in r1["note"]
        print(f"  导入: 批次类型={r1['batch_type']}, 待复核={r1['pending_review_count']}")

        # 检查所有 issue 状态都是 approved
        for rec in self.workflow.records:
            for iss in rec.issues:
                assert iss.status.value == "approved"
                assert "纯百分数格式" in (iss.retain_reason or "")
        print("  所有记录状态: approved ✓")

        # 第二步：参数调试
        r2 = self.workflow.step2_review_parameters(reviewer="活动负责人")
        assert r2["batch_type"] == "纯百分数"
        assert r2["pending_count"] == 0
        assert r2["can_proceed"] is True
        print(f"  参数调试: 待复核={r2['pending_count']}, can_proceed={r2['can_proceed']}")

        # 第三步：计算（无需复核，直接算）
        r3 = self.workflow.step3_calculate(operator="实验助理小穆")
        assert r3["total_buses"] > 0
        assert r3["calculation_details_count"] == 4
        print(f"  计算: 总车辆={r3['total_buses']}, 明细={r3['calculation_details_count']}")

        # 下钻查看明细
        first_detail = r3["drilldown_available"][0]
        detail = self.workflow.drilldown_detail(first_detail["detail_id"])
        assert detail["retain_reason"] is not None
        assert "纯百分数" in detail["retain_reason"]
        assert len(detail["detail"]["calculation_steps"]) == 5
        print(f"  下钻: 保留理由='{detail['retain_reason']}', 步骤数=5 ✓")

        print("✓ 纯百分数名单完整流程测试通过（一路算完无阻断）！")

    def test_mixed_workflow_retain_original_values(self):
        """测试混合名单保留原始值、复核理由、回滚记录（不放松复核）"""
        file_path = os.path.join(self.test_data_dir, "sampling_list_mixed.csv")

        # 第一步：导入（8条待复核）
        r1 = self.workflow.step1_import_sampling_list(file_path, "实验助理小穆")
        assert r1["batch_type"] == "混合"
        assert r1["pending_review_count"] == 8
        assert r1["can_skip_review"] is False
        print(f"  导入: 批次类型={r1['batch_type']}, 待复核={r1['pending_review_count']}")

        # 验证原始值保留（不被归一化）
        pct_records = [r for r in self.workflow.records if any(
            i.detected_type.value == "percentage" for i in r.issues
        )]
        dec_records = [r for r in self.workflow.records if any(
            i.detected_type.value == "decimal" for i in r.issues
        )]
        assert len(pct_records) == 4
        assert len(dec_records) == 4
        print(f"  百分数记录数={len(pct_records)}, 小数记录数={len(dec_records)} ✓")

        # 验证待复核状态（全部 PENDING_REVIEW）
        for rec in self.workflow.records:
            for iss in rec.issues:
                assert iss.status.value == "pending_review"
                assert iss.retain_reason is None  # 理由为空，等复核填
        print("  所有记录状态: pending_review ✓")

        # 尝试直接计算（必须失败！）
        from bus_scheduling.models import WorkflowStep
        self.workflow._current_step = WorkflowStep.STEP3_CALC_UPDATE
        caught_error = False
        try:
            self.workflow.step3_calculate()
        except Exception:
            caught_error = True
        assert caught_error, "混合名单有待复核问题时必须被阻断！"
        print("  直接计算被阻断 ✓")

        # 重新设置到第二步
        self.workflow._current_step = WorkflowStep.STEP2_PARAM_DEBUG
        self.workflow.step2_review_parameters(reviewer="活动负责人")

        # 复核第一条为 APPROVED
        pending = self.workflow.get_pending_issues()
        first_issue = pending[0]
        r = self.workflow.review_issue(
            issue_id=first_issue["issue_id"],
            approved=True,
            reviewer="活动负责人",
            retain_reason="线路1：活动负责人确认数据无误，保留原值",
        )
        assert r["status"] == "approved"
        assert "线路1：活动负责人确认数据无误" in r["retain_reason"]
        print(f"  复核第1条: {r['old_value']} → approved, 理由已记录 ✓")

        # 复核第二条为 MODIFIED（修改原值，需approved=False + modified_value）
        second_issue = pending[1]
        r = self.workflow.review_issue(
            issue_id=second_issue["issue_id"],
            approved=False,  # 不通过原始值
            reviewer="活动负责人",
            modified_value=second_issue["suggested_value"] * 1.1,  # 加10%调整为新值
            retain_reason="线路2：客流量偏高，加10%预留",
        )
        assert r["status"] == "modified"
        assert r["new_value"] != r["old_value"]
        print(f"  复核第2条: {r['old_value']} → modified→{r['new_value']}, 理由已记录 ✓")

        # 复核第三条为 REJECTED（approved=False + 无modified_value → 拒绝参与计算）
        third_issue = pending[2]
        r = self.workflow.review_issue(
            issue_id=third_issue["issue_id"],
            approved=False,  # 不通过且不提供新值
            reviewer="活动负责人",
            retain_reason="线路3：数据异常，不参与本轮计算",
        )
        assert r["status"] == "rejected"
        print(f"  复核第3条: {r['old_value']} → rejected ✓")

        # 其余全部 APPROVED
        for issue in pending[3:]:
            self.workflow.review_issue(
                issue_id=issue["issue_id"],
                approved=True,
                reviewer="活动负责人",
                retain_reason=f"{issue['original_value']} 由负责人确认通过",
            )
        print(f"  剩余 {len(pending)-3} 条全部复核通过 ✓")

        # 测试回滚：把第3条（REJECTED）回滚
        rb = self.workflow.rollback_issue(
            issue_id=third_issue["issue_id"],
            operator="活动负责人",
            reason="数据重新核对后需要再审议",
        )
        assert rb["status"] == "pending_review"
        # 检查回滚后有历史记录
        new_pending = self.workflow.get_pending_issues()
        assert len(new_pending) == 1  # 只有回滚的这1条
        print(f"  回滚第3条后: 待复核数={len(new_pending)} ✓")

        # 再次复核第3条（改回来 APPROVED）
        self.workflow.review_issue(
            issue_id=third_issue["issue_id"],
            approved=True,
            reviewer="活动负责人",
            retain_reason="线路3：经重新核实，数据可用",
        )

        # 历史记录检查：有导入、查看、复核、修改、回滚等多次记录
        first_rec_id = self.workflow.records[0].record_id
        history = self.workflow.get_record_history(first_rec_id)
        assert len(history) >= 3  # 至少导入 + 2次查看
        print(f"  变更历史数={len(history)}（含导入、查看、复核） ✓")

        print("✓ 混合名单测试通过（原始值保留、复核/修改/拒绝/回滚记录完整，不放松阻断）！")

    def test_rejected_record_excluded_from_scheduling(self):
        """核心回归：负责人拒绝的混合记录必须从排班、下钻、报告、导出中完全排除"""
        file_path = os.path.join(self.test_data_dir, "sampling_list_mixed.csv")

        # 第一步：导入混合名单（8条）
        r1 = self.workflow.step1_import_sampling_list(file_path, "实验助理小穆")
        assert r1["batch_type"] == "混合"
        assert r1["pending_review_count"] == 8
        print(f"  导入: {r1['batch_type']}, 待复核={r1['pending_review_count']}")

        # 第二步：参数调试
        self.workflow.step2_review_parameters(reviewer="活动负责人")

        # 选择 R002 这条小数记录作为拒绝对象（客流120，成本高）
        pending = self.workflow.get_pending_issues()
        reject_target = None
        for iss in pending:
            rec = next(
                (r for r in self.workflow.records if r.record_id == iss["record_id"]),
                None,
            )
            if rec and rec.route_code == "R002":
                reject_target = iss
                break
        assert reject_target is not None, "未找到R002记录"
        reject_original = reject_target["original_value"]
        reject_issue_id = reject_target["issue_id"]
        reject_record_id = reject_target["record_id"]
        reject_route_code = next(
            r.route_code for r in self.workflow.records
            if r.record_id == reject_record_id
        )
        print(f"  拒绝目标: 线路{reject_route_code} (原值={reject_original})")

        # 拒绝 R002
        self.workflow.review_issue(
            issue_id=reject_issue_id,
            approved=False,
            reviewer="活动负责人",
            retain_reason="R002：客流量数据异常，不参与本轮排班",
        )

        # 其余 7 条全部批准通过
        for issue in pending:
            if issue["issue_id"] == reject_issue_id:
                continue
            self.workflow.review_issue(
                issue_id=issue["issue_id"],
                approved=True,
                reviewer="活动负责人",
                retain_reason=f"负责人确认通过：{issue['original_value']}",
            )
        print(f"  复核完成: 1条已拒绝, 7条已通过")

        # 再次参数调试 → 推进到第三步
        self.workflow.step2_review_parameters(reviewer="活动负责人")

        # ---- 关键：第一次计算（验证拒绝被排除） ----
        r3_first = self.workflow.step3_calculate(operator="实验助理小穆")
        print(f"  第一次计算: 总车辆={r3_first['total_buses']}, "
              f"总成本={r3_first['total_cost']}, "
              f"参与计算明细={r3_first['calculation_details_count']}")

        # 关键断言 1：被拒绝的线路不出现在 route_allocations
        assert reject_route_code not in r3_first["route_allocations"], (
            f"拒绝的线路 {reject_route_code} 不应出现在排班分配中！"
            f"实际分配: {r3_first['route_allocations']}"
        )

        # 关键断言 2：被拒绝的记录不出现在下钻可用列表
        drilldown_routes = [d["route_code"] for d in r3_first["drilldown_available"]]
        assert reject_route_code not in drilldown_routes, (
            f"拒绝的线路 {reject_route_code} 不应出现在下钻列表！"
            f"实际列表: {drilldown_routes}"
        )

        # 关键断言 3：拒绝记录出现在 excluded_summary + rejected_records
        assert r3_first["excluded_summary"]["rejected_count"] == 1
        assert r3_first["excluded_summary"]["valid_calculation_count"] == 7
        assert len(r3_first["rejected_records"]) == 1
        rejected_info = r3_first["rejected_records"][0]
        assert rejected_info["route_code"] == reject_route_code
        assert rejected_info["original_passenger_count"] == reject_original
        assert rejected_info["reviewer"] == "活动负责人"
        assert "客流量数据异常" in rejected_info["reject_reason"]
        assert rejected_info["status"] == "已拒绝，不参与计算"
        assert rejected_info["can_rollback"] is True
        print(f"  被拒绝的记录已闭环: {rejected_info['route_code']}="
              f"{rejected_info['original_passenger_count']}, "
              f"拒绝原因='{rejected_info['reject_reason']}' ✓")

        # 关键断言 4：计算明细总数为 7（而不是 8）
        assert r3_first["calculation_details_count"] == 7
        print(f"  计算明细数=7（8-1拒绝） ✓")

        # 关键断言 5：总成本不包含拒绝线路
        first_total_cost = r3_first["total_cost"]
        # 成本应是 7 条线路的车辆数 * 500（默认单车成本）
        expected_min_cost = 7 * 1 * 500  # 最少 7 辆车
        assert first_total_cost >= expected_min_cost
        print(f"  总成本: {first_total_cost} (不含被拒绝线路)")

        # ---- 关键：保存状态（刷新模拟） ----
        # 选择 R004 再拒绝一条，用于验证刷新/重算
        pending_after = self.workflow.get_pending_issues()  # 应为空
        assert len(pending_after) == 0

        # 从 records 中找到另一个问题来回滚模拟"改状态再重算"
        # 为了测试 recalculate：拒绝另一条 R004
        r004_issue = None
        for iss in self.workflow._issues:
            rec = next(
                (r for r in self.workflow.records if r.record_id == iss.record_id),
                None,
            )
            if rec and rec.route_code == "R004" and iss.status.value == "approved":
                r004_issue = iss
                break
        # 回滚 R004 → 再拒绝
        if r004_issue:
            self.workflow.rollback_issue(
                issue_id=r004_issue.issue_id,
                operator="活动负责人",
                reason="R004数据需要重新审议",
            )
            self.workflow.review_issue(
                issue_id=r004_issue.issue_id,
                approved=False,
                reviewer="活动负责人",
                retain_reason="R004：重新审议后决定排除",
            )
            print(f"  额外: R004 也被拒绝（用于测试刷新重算）")

        # ---- 刷新/重算 ----
        r3_recalc = self.workflow.recalculate(operator="实验助理小穆")
        print(f"  重算后: 总车辆={r3_recalc['total_buses']}, "
              f"总成本={r3_recalc['total_cost']}, "
              f"参与明细={r3_recalc['calculation_details_count']}, "
              f"拒绝数={r3_recalc['excluded_summary']['rejected_count']}")

        # 重算后拒绝数=2，明细数=6
        assert r3_recalc["excluded_summary"]["rejected_count"] == 2
        assert r3_recalc["calculation_details_count"] == 6
        assert "R002" not in r3_recalc["route_allocations"]
        assert "R004" not in r3_recalc["route_allocations"]
        assert r3_recalc["total_cost"] < first_total_cost  # 少了两条线，成本下降
        print(f"  重算后：拒绝数增加到2，成本下降 ✓")

        # ---- 下钻明细：确认只能看到参与排班的 6 条 ----
        drilldown_after = [d["route_code"] for d in r3_recalc["drilldown_available"]]
        assert "R002" not in drilldown_after
        assert "R004" not in drilldown_after
        assert len(drilldown_after) == 6
        # 随便点开一条参与的线路，保留理由能看到
        one_detail = r3_recalc["drilldown_available"][0]
        detail = self.workflow.drilldown_detail(one_detail["detail_id"])
        assert detail["retain_reason"] is not None
        assert len(detail["detail"]["calculation_steps"]) == 5
        print(f"  下钻: 线路{one_detail['route_code']}, "
              f"理由='{detail['retain_reason']}', 5步计算 ✓")

        # ---- 报告生成 ----
        report = self.workflow.generate_report()
        # 报告总览
        assert report["overview"]["valid_route_count"] == 6
        assert report["excluded_summary"]["rejected_count"] == 2
        # 报告的 route_details 不含被拒绝的
        report_routes = [d["route_code"] for d in report["route_details"]]
        assert "R002" not in report_routes
        assert "R004" not in report_routes
        assert len(report["route_details"]) == 6
        # 报告的 rejected_records 含两条拒绝，且理由/负责人/时间齐全
        assert len(report["rejected_records"]) == 2
        for rj in report["rejected_records"]:
            assert rj["status"] == "已拒绝，不参与计算"
            assert rj["reject_reason"] is not None
            assert rj["reviewer"] == "活动负责人"
        # 报告含历史
        assert len(report["history_summary"]) > 0
        print(f"  报告: {len(report['route_details'])}条排班明细, "
              f"{len(report['rejected_records'])}条拒绝明细, "
              f"历史记录可追溯 ✓")

        # ---- 导出 CSV & JSON ----
        csv_name, csv_bytes = self.workflow.export_result(fmt="csv")
        assert csv_name.endswith(".csv")
        csv_text = csv_bytes.decode("utf-8-sig")
        # CSV 中排班明细段不出现被拒线路
        assert "R002" not in csv_text.split("=== 排除清单")[0]
        assert "R004" not in csv_text.split("=== 排除清单")[0]
        # CSV 排除清单段出现被拒线路+理由
        assert "客流量数据异常" in csv_text
        assert "R002" in csv_text
        assert "R004" in csv_text
        # CSV 含总览数字
        assert str(report["overview"]["total_buses"]) in csv_text
        print(f"  CSV 导出: {csv_name}, 排班段无拒绝线路, 排除清单含拒绝原因 ✓")

        json_name, json_bytes = self.workflow.export_result(fmt="json")
        assert json_name.endswith(".json")
        import json
        json_data = json.loads(json_bytes.decode("utf-8"))
        assert json_data["overview"]["valid_route_count"] == 6
        assert json_data["excluded_summary"]["rejected_count"] == 2
        json_routes = [d["route_code"] for d in json_data["route_details"]]
        assert "R002" not in json_routes
        assert "R004" not in json_routes
        print(f"  JSON 导出: {json_name}, 结构一致 ✓")

        # ---- 历史记录：拒绝/回滚/再拒绝都能看到改前改后 ----
        r002_record = next(
            r for r in self.workflow.records if r.route_code == "R002"
        )
        history = self.workflow.get_record_history(r002_record.record_id)
        hist_fields = [h["field_name"] for h in history]
        assert "__import__" in hist_fields
        assert "__review__" in hist_fields
        # 拒绝那条的 issue:客流量 变更历史
        issue_change = [
            h for h in history if h["field_name"].startswith("issue:")
        ]
        assert len(issue_change) >= 1
        for ic in issue_change:
            assert "pending_review" in str(ic["old_value"]).lower() or \
                   "approved" in str(ic["old_value"]).lower()
            assert "rejected" in str(ic["new_value"]).lower() or \
                   "approved" in str(ic["new_value"]).lower()
        print(f"  历史追溯: R002 变更{len(history)}条, "
              f"含导入/查看/复核(含拒绝)，改前改后可见 ✓")

        print("✓ 拒绝记录闭环测试通过：排班/下钻/报告/导出/历史 全链路排除！")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("工作流程测试")
    print("="*60 + "\n")

    test = TestWorkflow()

    print("1. 测试完整工作流程（含混合数）...")
    test.setup_method()
    test.test_full_workflow_with_mixed_numbers()
    print()

    print("2. 测试修改备注和历史记录...")
    test.setup_method()
    test.test_update_remark_and_history()
    print()

    print("3. 测试回滚问题处理结果...")
    test.setup_method()
    test.test_rollback_issue()
    print()

    print("4. 测试从图表跳转功能...")
    test.setup_method()
    test.test_navigate_from_chart()
    print()

    print("5. 测试跳过步骤的错误提示...")
    test.setup_method()
    test.test_workflow_step_skipping()
    print()

    print("6. 测试有待复核问题时计算的错误提示...")
    test.setup_method()
    test.test_calculate_with_pending_issues()
    print()

    print("7. 测试获取边界规则...")
    test.setup_method()
    test.test_get_boundary_rules()
    print()

    print("8. 测试纯小数名单完整流程（无待复核，一路算完）...")
    test.setup_method()
    test.test_pure_decimal_full_workflow()
    print()

    print("9. 测试纯百分数名单完整流程（无待复核，一路算完）...")
    test.setup_method()
    test.test_pure_percentage_full_workflow()
    print()

    print("10. 测试混合名单：原始值保留+复核/修改/拒绝/回滚（不放松阻断）...")
    test.setup_method()
    test.test_mixed_workflow_retain_original_values()
    print()

    print("11. 测试拒绝记录闭环：排班/下钻/报告/导出/历史 全链路排除...")
    test.setup_method()
    test.test_rejected_record_excluded_from_scheduling()
    print()

    print("="*60)
    print("所有工作流程测试通过！")
    print("="*60 + "\n")
