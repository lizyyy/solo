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
        print(f"✓ 导入完成，发现 {result1['issues_found']} 条混合问题")

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

    print("="*60)
    print("所有工作流程测试通过！")
    print("="*60 + "\n")
