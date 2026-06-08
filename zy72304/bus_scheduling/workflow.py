"""
工作流程模块

实现三步流程：
1. 第一步：抽样名单第一次导入
2. 第二步：实验助理小穆补看参数调试表
3. 第三步：计算明细更新

中间碰到百分数和小数混合时，别急着归正常，留给活动负责人复核。
"""

import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from .models import (
    SamplingRecord,
    SchedulingResult,
    MixedNumberIssue,
    WorkflowStep,
    ChangeHistory,
    IssueStatus,
    NumberType,
)
from .validator import BoundaryValidator
from .importer import SamplingImporter
from .scheduler import BusScheduler
from .exceptions import (
    format_error,
    WorkflowError,
    ValidationError,
)


class SchedulingWorkflow:
    """
    排班工作流程管理器

    严格按照三步流程执行：
    STEP1_IMPORT → STEP2_PARAM_DEBUG → STEP3_CALC_UPDATE → COMPLETED

    中间碰到百分数和小数混合时，不急着归正常，留给活动负责人复核。
    """

    def __init__(
        self,
        validator: BoundaryValidator,
        importer: SamplingImporter,
        scheduler: BusScheduler,
    ):
        self.validator = validator
        self.importer = importer
        self.scheduler = scheduler
        self._current_step: WorkflowStep = WorkflowStep.STEP1_IMPORT
        self._records: List[SamplingRecord] = []
        self._issues: List[MixedNumberIssue] = []
        self._result: Optional[SchedulingResult] = None
        self._current_batch_id: Optional[str] = None
        self._change_history: List[ChangeHistory] = []

    @property
    def current_step(self) -> WorkflowStep:
        return self._current_step

    @property
    def records(self) -> List[SamplingRecord]:
        return list(self._records)

    @property
    def issues(self) -> List[MixedNumberIssue]:
        return list(self._issues)

    @property
    def result(self) -> Optional[SchedulingResult]:
        return self._result

    def _check_step(self, required_step: WorkflowStep) -> None:
        """
        检查当前步骤是否正确

        边界规则：
        - 必须按顺序执行，不能跳过步骤
        - 错误提示要说人话

        Args:
            required_step: 需要的步骤
        """
        step_names = {
            WorkflowStep.STEP1_IMPORT: "第一步：导入抽样名单",
            WorkflowStep.STEP2_PARAM_DEBUG: "第二步：参数调试",
            WorkflowStep.STEP3_CALC_UPDATE: "第三步：计算明细更新",
            WorkflowStep.COMPLETED: "已完成",
        }

        if self._current_step != required_step:
            raise WorkflowError(
                format_error("workflow_step_skipped") +
                f"。当前在「{step_names[self._current_step]}」，"
                f"需要先完成「{step_names[required_step]}」。",
                {
                    "current_step": self._current_step.value,
                    "required_step": required_step.value,
                },
            )

    def step1_import_sampling_list(
        self,
        file_path: str,
        operator: str = "实验助理小穆",
    ) -> Dict[str, Any]:
        """
        第一步：抽样名单第一次导入

        边界规则：
        1. 检测百分数和小数混合情况
        2. 混合情况标记为待复核，不自动归一化
        3. 防止重复导入导致数量翻倍

        Args:
            file_path: 抽样名单文件路径
            operator: 操作人

        Returns:
            导入结果摘要
        """
        self._check_step(WorkflowStep.STEP1_IMPORT)

        records, issues, import_stat = self.importer.import_file(
            file_path, operator
        )

        self._records = records
        self._issues = issues
        self._current_batch_id = import_stat["batch_id"]
        self._current_step = WorkflowStep.STEP2_PARAM_DEBUG

        # 记录变更历史 - 导入操作
        for record in records:
            history = ChangeHistory(
                history_id=f"hist_{uuid.uuid4().hex[:8]}",
                record_id=record.record_id,
                field_name="__import__",
                old_value=None,
                new_value="导入成功",
                operator=operator,
                change_reason=f"从文件 {import_stat['source_file']} 导入",
            )
            self._change_history.append(history)

        pending_count = sum(
            1 for i in issues if i.status == IssueStatus.PENDING_REVIEW
        )
        batch_type = import_stat.get("batch_type", "未知")

        result_summary = {
            "step": "第一步：抽样名单导入",
            "status": "completed",
            "next_step": "第二步：参数调试",
            "import_stat": import_stat,
            "total_records": len(records),
            "total_issues": len(issues),
            "pending_review_count": pending_count,
            "has_mixed_numbers": import_stat.get("has_mixed_numbers", False),
            "batch_type": batch_type,
            "can_skip_review": (pending_count == 0),
            "warning": import_stat.get("warning"),
        }

        # 三种口径的提示各不同
        if batch_type == "混合":
            result_summary["note"] = (
                f"⚠️ 批次类型：{batch_type}。发现百分数和小数混合出现，"
                f"{pending_count}条记录已标记为待复核状态。"
                f"系统不会自动归一化，请活动负责人在参数调试阶段进行复核。"
            )
        elif batch_type == "纯小数":
            result_summary["note"] = (
                f"✅ 批次类型：{batch_type}。批次内均为纯小数格式，未检测到混用，"
                f"已自动通过所有记录，可以直接进入计算。"
            )
        elif batch_type == "纯百分数":
            result_summary["note"] = (
                f"✅ 批次类型：{batch_type}。批次内均为纯百分数格式，未检测到混用，"
                f"已自动通过所有记录，可以直接进入计算。"
            )
        else:
            result_summary["note"] = (
                f"ℹ️ 批次类型：{batch_type}。"
            )

        return result_summary

    def step2_review_parameters(
        self,
        reviewer: str = "活动负责人",
        config_updates: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        第二步：实验助理小穆补看参数调试表

        边界规则：
        1. 显示所有待复核的混合问题
        2. 可以修改参数配置
        3. 必须复核所有混合问题后才能进入下一步
        4. 记录所有变更历史

        Args:
            reviewer: 复核人
            config_updates: 参数配置更新

        Returns:
            参数调试结果摘要
        """
        self._check_step(WorkflowStep.STEP2_PARAM_DEBUG)

        # 更新参数配置
        if config_updates:
            self.scheduler.update_config(**config_updates)

        # 检查待复核问题
        pending_issues = [
            i for i in self._issues if i.status == IssueStatus.PENDING_REVIEW
        ]

        # 记录查看历史
        for record in self._records:
            history = ChangeHistory(
                history_id=f"hist_{uuid.uuid4().hex[:8]}",
                record_id=record.record_id,
                field_name="__review__",
                old_value=None,
                new_value="已查看",
                operator=reviewer,
                change_reason="实验助理小穆补看参数调试表",
            )
            self._change_history.append(history)

        # 判断批次类型
        batch_has_mixed = any(
            i.detected_type == NumberType.PERCENTAGE for i in self._issues
        ) and any(
            i.detected_type == NumberType.DECIMAL for i in self._issues
        )
        has_pct = any(i.detected_type == NumberType.PERCENTAGE for i in self._issues)
        has_dec = any(i.detected_type == NumberType.DECIMAL for i in self._issues)
        batch_type = (
            "混合" if batch_has_mixed
            else ("纯百分数" if has_pct else ("纯小数" if has_dec else "未知"))
        )

        result_summary = {
            "step": "第二步：参数调试",
            "status": "completed",
            "next_step": "第三步：计算明细更新",
            "batch_type": batch_type,
            "current_config": self.scheduler.config.to_dict(),
            "pending_issues": [i.to_dict() for i in pending_issues],
            "pending_count": len(pending_issues),
            "all_records": [r.to_dict() for r in self._records],
        }

        if pending_issues:
            result_summary["note"] = (
                f"⚠️ 批次类型：{batch_type}。还有{len(pending_issues)}条百分数和小数混合的记录待复核。"
                f"请活动负责人复核后，使用 review_issue() 方法处理，然后再进行第三步。"
            )
            result_summary["can_proceed"] = False
        else:
            result_summary["note"] = (
                f"✅ 批次类型：{batch_type}。无待复核记录，可直接进入计算。"
            )
            result_summary["can_proceed"] = True
            self._current_step = WorkflowStep.STEP3_CALC_UPDATE

        return result_summary

    def review_issue(
        self,
        issue_id: str,
        approved: bool,
        reviewer: str = "活动负责人",
        retain_reason: Optional[str] = None,
        modified_value: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        复核单个混合问题

        对应要求：中间碰到百分数和小数混合时，别急着归正常，留给活动负责人复核。

        Args:
            issue_id: 问题ID
            approved: 是否通过
            reviewer: 复核人
            retain_reason: 保留/修改理由
            modified_value: 修改后的值

        Returns:
            复核结果
        """
        issue = self._find_issue(issue_id)
        if not issue:
            raise ValidationError(
                format_error("record_not_found") + f"：问题ID {issue_id}",
                {"issue_id": issue_id},
            )

        old_status = issue.status.value
        old_value = str(issue.suggested_value if issue.suggested_value else issue.original_value)

        self.validator.review_issue(
            issue=issue,
            approved=approved,
            reviewer=reviewer,
            retain_reason=retain_reason,
            modified_value=modified_value,
        )

        # 记录变更历史
        history = ChangeHistory(
            history_id=f"hist_{uuid.uuid4().hex[:8]}",
            record_id=issue.record_id,
            field_name=f"issue:{issue.field_name}",
            old_value=f"{old_status}:{old_value}",
            new_value=f"{issue.status.value}:{issue.suggested_value}",
            operator=reviewer,
            change_reason=retain_reason or ("复核通过" if approved else "复核拒绝"),
        )
        self._change_history.append(history)

        # 更新对应记录中的问题状态
        for record in self._records:
            for idx, rec_issue in enumerate(record.issues):
                if rec_issue.issue_id == issue_id:
                    record.issues[idx] = issue
                    record.updated_at = datetime.now()
                    break

        return {
            "issue_id": issue_id,
            "status": issue.status.value,
            "reviewer": reviewer,
            "retain_reason": issue.retain_reason,
            "old_value": old_value,
            "new_value": issue.suggested_value,
        }

    def update_remark(
        self,
        record_id: str,
        new_remark: str,
        operator: str = "实验助理小穆",
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        修改记录备注

        对应要求：如果实验助理小穆只改了一条备注，历史里要能看出改前改后的差别。

        Args:
            record_id: 记录ID
            new_remark: 新备注
            operator: 操作人
            reason: 修改理由

        Returns:
            修改结果
        """
        record = self._find_record(record_id)
        if not record:
            raise ValidationError(
                format_error("record_not_found") + f"：记录ID {record_id}",
                {"record_id": record_id},
            )

        old_remark = record.remark
        record.remark = new_remark
        record.updated_at = datetime.now()

        # 记录变更历史
        history = ChangeHistory(
            history_id=f"hist_{uuid.uuid4().hex[:8]}",
            record_id=record_id,
            field_name="remark",
            old_value=old_remark,
            new_value=new_remark,
            operator=operator,
            change_reason=reason or "修改备注",
        )
        self._change_history.append(history)

        return {
            "record_id": record_id,
            "field": "remark",
            "old_value": old_remark,
            "new_value": new_remark,
            "operator": operator,
            "change_time": datetime.now().isoformat(),
        }

    def rollback_issue(
        self,
        issue_id: str,
        operator: str = "活动负责人",
        reason: str = "回滚复核结果",
    ) -> Dict[str, Any]:
        """
        回滚问题处理结果

        对应要求：边界规则要写在代码和README里，包括怎么回滚。

        Args:
            issue_id: 问题ID
            operator: 操作人
            reason: 回滚理由

        Returns:
            回滚结果
        """
        issue = self._find_issue(issue_id)
        if not issue:
            raise ValidationError(
                format_error("record_not_found") + f"：问题ID {issue_id}",
                {"issue_id": issue_id},
            )

        updated_issue, history = self.validator.rollback_issue(
            issue=issue,
            operator=operator,
            reason=reason,
        )

        self._change_history.append(history)

        # 更新对应记录中的问题状态
        for record in self._records:
            for idx, rec_issue in enumerate(record.issues):
                if rec_issue.issue_id == issue_id:
                    record.issues[idx] = updated_issue
                    record.updated_at = datetime.now()
                    break

        return {
            "issue_id": issue_id,
            "status": updated_issue.status.value,
            "operator": operator,
            "reason": reason,
            "history_id": history.history_id,
        }

    def step3_calculate(
        self,
        operator: str = "实验助理小穆",
        skip_review_check: bool = False,
    ) -> Dict[str, Any]:
        """
        第三步：计算明细更新

        对应要求：计算明细别只给总览，至少能点开一条百分数和小数混着出现，
        看到实验助理小穆当时保留它的理由。

        Args:
            operator: 操作人
            skip_review_check: 是否跳过复核检查（仅测试用）

        Returns:
            计算结果摘要
        """
        self._check_step(WorkflowStep.STEP3_CALC_UPDATE)

        # 再次检查待复核问题
        pending_issues = [
            i for i in self._issues if i.status == IssueStatus.PENDING_REVIEW
        ]

        if pending_issues and not skip_review_check:
            raise ValidationError(
                format_error("review_required") +
                f"，共发现{len(pending_issues)}条待复核记录。"
                f"请先由活动负责人复核后再计算。",
                {
                    "pending_issues": [i.to_dict() for i in pending_issues],
                },
            )

        result = self.scheduler.calculate(
            records=self._records,
            batch_id=self._current_batch_id or f"batch_{uuid.uuid4().hex[:8]}",
            skip_review_check=skip_review_check,
        )
        result.workflow_step = WorkflowStep.COMPLETED

        self._result = result
        self._current_step = WorkflowStep.COMPLETED

        # 记录变更历史
        for record in self._records:
            history = ChangeHistory(
                history_id=f"hist_{uuid.uuid4().hex[:8]}",
                record_id=record.record_id,
                field_name="__calculate__",
                old_value=None,
                new_value="计算完成",
                operator=operator,
                change_reason="执行排班计算",
            )
            self._change_history.append(history)

        # 准备下钻数据摘要
        drilldown_summary = []
        for detail in result.calculation_details:
            has_mixed_issue = bool(detail.issues_involved)
            drilldown_summary.append({
                "detail_id": detail.detail_id,
                "record_id": detail.record_id,
                "route_code": detail.route_code,
                "result_value": detail.result_value,
                "has_mixed_issue": has_mixed_issue,
                "retain_reason": detail.retain_reason,
                "issues": detail.issues_involved,
            })

        return {
            "step": "第三步：计算明细更新",
            "status": "completed",
            "workflow_completed": True,
            "result_id": result.result_id,
            "total_buses": result.bus_count,
            "total_cost": result.total_cost,
            "route_allocations": result.route_allocations,
            "calculation_details_count": len(result.calculation_details),
            "drilldown_available": drilldown_summary,
            "issues_count": len(result.issues_found),
        }

    def drilldown_detail(self, detail_id: str) -> Dict[str, Any]:
        """
        下钻查看计算明细

        对应要求：计算明细别只给总览，至少能点开一条百分数和小数混着出现，
        看到实验助理小穆当时保留它的理由。

        Args:
            detail_id: 明细ID

        Returns:
            详细的计算过程
        """
        detail = self.scheduler.get_calculation_detail(detail_id)
        if not detail:
            raise ValidationError(
                format_error("record_not_found") + f"：计算明细ID {detail_id}",
                {"detail_id": detail_id},
            )

        # 查找相关记录
        record = self._find_record(detail.record_id)
        related_issues = []
        for issue_id in detail.issues_involved:
            issue = self._find_issue(issue_id)
            if issue:
                related_issues.append(issue.to_dict())

        return {
            "detail": detail.to_dict(),
            "record": record.to_dict() if record else None,
            "related_issues": related_issues,
            "retain_reason": detail.retain_reason,
            "navigation": {
                "back_to_sampling_list": f"/sampling/{detail.record_id}",
                "back_to_param_debug": f"/params?record={detail.record_id}",
            },
        }

    def get_record_history(self, record_id: str) -> List[Dict[str, Any]]:
        """
        获取记录的变更历史

        对应要求：如果实验助理小穆只改了一条备注，历史里要能看出改前改后的差别。

        Args:
            record_id: 记录ID

        Returns:
            变更历史列表
        """
        history_list = [
            h for h in self._change_history if h.record_id == record_id
        ]
        return [h.to_dict() for h in history_list]

    def get_all_history(self) -> List[Dict[str, Any]]:
        """
        获取所有变更历史

        Returns:
            所有变更历史列表
        """
        return [h.to_dict() for h in self._change_history]

    def navigate_from_chart(
        self,
        issue_id: str,
    ) -> Dict[str, Any]:
        """
        从3D/图表展示点击跳转回抽样名单或参数调试表

        对应要求：如果选择3D或图表展示，先服务复核：点到一条百分数和小数混着出现时，
        要能回到抽样名单或参数调试表，不要只剩漂亮画面。

        Args:
            issue_id: 问题ID

        Returns:
            跳转信息和相关数据
        """
        issue = self._find_issue(issue_id)
        if not issue:
            raise ValidationError(
                format_error("record_not_found") + f"：问题ID {issue_id}",
                {"issue_id": issue_id},
            )

        record = self._find_record(issue.record_id)

        return {
            "issue": issue.to_dict(),
            "record": record.to_dict() if record else None,
            "navigation_options": [
                {
                    "name": "返回抽样名单",
                    "url": f"/sampling/list?highlight={issue.record_id}",
                    "description": "查看该记录在抽样名单中的完整信息",
                },
                {
                    "name": "返回参数调试表",
                    "url": f"/params/debug?record={issue.record_id}",
                    "description": "调整该记录的计算参数",
                },
                {
                    "name": "查看计算明细",
                    "url": f"/calculation/detail?record={issue.record_id}",
                    "description": "查看该记录的完整计算过程",
                },
            ],
        }

    def _find_issue(self, issue_id: str) -> Optional[MixedNumberIssue]:
        """根据ID查找问题"""
        for issue in self._issues:
            if issue.issue_id == issue_id:
                return issue
        return None

    def _find_record(self, record_id: str) -> Optional[SamplingRecord]:
        """根据ID查找记录"""
        for record in self._records:
            if record.record_id == record_id:
                return record
        return None

    def get_pending_issues(self) -> List[Dict[str, Any]]:
        """获取所有待复核的问题"""
        pending = [
            i for i in self._issues if i.status == IssueStatus.PENDING_REVIEW
        ]
        return [i.to_dict() for i in pending]

    def get_boundary_rules(self) -> Dict[str, Any]:
        """获取所有边界规则"""
        return self.validator.get_boundary_rules()
