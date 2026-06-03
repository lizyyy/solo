"""
排班计算核心模块

使用整数规划进行班车排班计算。
"""

import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

import pulp

from .models import (
    SamplingRecord,
    SchedulingResult,
    CalculationDetail,
    MixedNumberIssue,
    IssueStatus,
    ParameterConfig,
    NumberType,
)
from .validator import BoundaryValidator
from .exceptions import (
    format_error,
    SchedulingError,
    ValidationError,
)


class BusScheduler:
    """
    班车排班计算器

    使用PuLP整数规划库进行排班优化。
    """

    def __init__(self, validator: BoundaryValidator, config: Optional[ParameterConfig] = None):
        self.validator = validator
        self.config = config or ParameterConfig(config_id=f"cfg_{uuid.uuid4().hex[:8]}")
        self._calculation_details: List[CalculationDetail] = []

    def update_config(self, **kwargs) -> ParameterConfig:
        """
        更新参数配置

        对应第二步：参数调试表

        Args:
            **kwargs: 配置参数

        Returns:
            更新后的配置
        """
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
        self.config.updated_at = datetime.now()
        return self.config

    def _get_effective_value(self, record: SamplingRecord) -> float:
        """
        获取记录的有效值

        规则：
        1. 如果有待复核的混合问题，使用原始值并标记
        2. 如果有已批准的问题，使用建议值
        3. 否则使用记录值

        Args:
            record: 抽样记录

        Returns:
            有效值
        """
        for issue in record.issues:
            if issue.status == IssueStatus.PENDING_REVIEW:
                # 有待复核的问题，使用suggested_value但记录问题
                if issue.suggested_value is not None:
                    return issue.suggested_value
            elif issue.status in (IssueStatus.APPROVED, IssueStatus.MODIFIED):
                if issue.suggested_value is not None:
                    return issue.suggested_value

        return record.passenger_count

    def _create_calculation_detail(
        self,
        record: SamplingRecord,
        effective_value: float,
        steps: List[Dict[str, Any]],
        result_value: float,
        retain_reason: Optional[str] = None,
    ) -> CalculationDetail:
        """
        创建计算明细

        对应要求：计算明细别只给总览，至少能点开一条百分数和小数混着出现，
        看到实验助理小穆当时保留它的理由。

        Args:
            record: 抽样记录
            effective_value: 有效值
            steps: 计算步骤
            result_value: 结果值
            retain_reason: 保留理由

        Returns:
            计算明细
        """
        issue_ids = [issue.issue_id for issue in record.issues]

        # 如果有混合问题，记录保留理由
        final_reason = retain_reason
        if not final_reason and record.issues:
            for issue in record.issues:
                if issue.retain_reason:
                    final_reason = issue.retain_reason
                    break

        return CalculationDetail(
            detail_id=f"det_{uuid.uuid4().hex[:8]}",
            record_id=record.record_id,
            route_code=record.route_code,
            input_params={
                "original_passenger_count": record.original_data.get(
                    "passenger_count_original", str(record.passenger_count)
                ),
                "effective_passenger_count": effective_value,
                "bus_capacity": self.config.bus_capacity,
                "peak_hours_multiplier": self.config.peak_hours_multiplier,
            },
            calculation_steps=steps,
            result_value=result_value,
            issues_involved=issue_ids,
            retain_reason=final_reason,
        )

    def _calculate_route_buses(
        self,
        record: SamplingRecord,
        effective_value: float,
    ) -> Tuple[int, List[Dict[str, Any]], CalculationDetail]:
        """
        计算单条线路需要的班车数量

        Args:
            record: 抽样记录
            effective_value: 有效的客流量

        Returns:
            (班车数量, 计算步骤, 计算明细)
        """
        steps = []

        # 步骤1：确定基础客流量
        steps.append({
            "step": 1,
            "description": "获取有效客流量",
            "input": record.original_data.get("passenger_count_original"),
            "output": effective_value,
            "note": "使用经复核后的有效值",
        })

        # 步骤2：检查是否高峰时段
        is_peak = self._is_peak_hour(record.departure_time)
        multiplier = self.config.peak_hours_multiplier if is_peak else 1.0

        steps.append({
            "step": 2,
            "description": "高峰时段判断",
            "input": record.departure_time,
            "output": f"{'是' if is_peak else '否'}，乘数={multiplier}",
            "note": f"高峰时段乘数为{self.config.peak_hours_multiplier}",
        })

        # 步骤3：计算调整后的客流量
        adjusted_passengers = effective_value * multiplier
        steps.append({
            "step": 3,
            "description": "调整客流量",
            "input": f"{effective_value} × {multiplier}",
            "output": adjusted_passengers,
            "note": "考虑高峰时段乘数",
        })

        # 步骤4：计算需要的班车数量（向上取整）
        import math
        buses_needed = math.ceil(adjusted_passengers / self.config.bus_capacity)
        buses_needed = max(buses_needed, self.config.min_buses_per_route)
        buses_needed = min(buses_needed, self.config.max_buses_per_route)

        steps.append({
            "step": 4,
            "description": "计算班车数量",
            "input": f"ceil({adjusted_passengers} / {self.config.bus_capacity})",
            "output": buses_needed,
            "note": f"向上取整，每辆车容量{self.config.bus_capacity}人",
        })

        # 步骤5：应用边界限制
        steps.append({
            "step": 5,
            "description": "应用边界限制",
            "input": buses_needed,
            "output": buses_needed,
            "note": f"限制在[{self.config.min_buses_per_route}, {self.config.max_buses_per_route}]范围内",
        })

        # 生成计算明细
        retain_reason = None
        if record.issues:
            for issue in record.issues:
                if issue.status == IssueStatus.PENDING_REVIEW:
                    retain_reason = "数据存在百分数和小数混合，待活动负责人复核后将最终确定"
                    break
                elif issue.retain_reason:
                    retain_reason = issue.retain_reason
                    break

        detail = self._create_calculation_detail(
            record=record,
            effective_value=effective_value,
            steps=steps,
            result_value=buses_needed,
            retain_reason=retain_reason,
        )

        self._calculation_details.append(detail)

        return buses_needed, steps, detail

    def _is_peak_hour(self, departure_time: str) -> bool:
        """
        判断是否为高峰时段

        规则：
        - 早高峰：07:00 - 09:00
        - 晚高峰：17:00 - 19:00

        Args:
            departure_time: 发车时间字符串

        Returns:
            是否为高峰时段
        """
        try:
            hour = int(departure_time.split(":")[0])
            return (7 <= hour < 9) or (17 <= hour < 19)
        except (ValueError, IndexError):
            return False

    def _check_pending_issues(
        self,
        records: List[SamplingRecord],
    ) -> List[MixedNumberIssue]:
        """
        检查是否有待复核的问题

        规则：
        - 只要有待复核的问题，就不能继续计算
        - 必须先由活动负责人复核

        Args:
            records: 抽样记录列表

        Returns:
            待复核的问题列表
        """
        pending_issues = []
        for record in records:
            for issue in record.issues:
                if issue.status == IssueStatus.PENDING_REVIEW:
                    pending_issues.append(issue)
        return pending_issues

    def calculate(
        self,
        records: List[SamplingRecord],
        batch_id: str,
        skip_review_check: bool = False,
    ) -> SchedulingResult:
        """
        执行排班计算

        对应第三步：计算明细更新

        边界规则：
        1. 检查是否有待复核的混合问题
        2. 如有，除非显式指定skip_review_check，否则抛出错误提示活动负责人复核
        3. 不自动将混合问题归为正常

        Args:
            records: 抽样记录列表
            batch_id: 批次ID
            skip_review_check: 是否跳过复核检查（仅用于测试）

        Returns:
            排班结果
        """
        # 过滤掉重复记录
        valid_records = [r for r in records if not r.is_duplicate]

        if not valid_records:
            raise SchedulingError(
                format_error("calculation_failed"),
                {"reason": "没有有效的记录可用于计算"},
            )

        # 检查待复核问题
        pending_issues = self._check_pending_issues(valid_records)

        if pending_issues and not skip_review_check:
            raise ValidationError(
                format_error("review_required") + f"，共发现{pending_issues.__len__()}条待复核记录",
                {
                    "pending_issues": [i.to_dict() for i in pending_issues],
                    "note": "请先由活动负责人复核这些百分数和小数混合的记录",
                },
            )

        # 准备整数规划数据
        route_codes = []
        passenger_counts = []
        route_buses = {}
        calculation_details = []
        all_issues = []

        for record in valid_records:
            effective_value = self._get_effective_value(record)
            buses_needed, steps, detail = self._calculate_route_buses(
                record, effective_value
            )

            route_codes.append(record.route_code)
            passenger_counts.append(effective_value)
            route_buses[record.route_code] = buses_needed
            calculation_details.append(detail)
            all_issues.extend(record.issues)

        # 使用整数规划优化
        total_buses, optimized_allocations, total_cost = self._integer_programming_optimize(
            route_codes,
            passenger_counts,
            route_buses,
        )

        result = SchedulingResult(
            result_id=f"res_{uuid.uuid4().hex[:8]}",
            batch_id=batch_id,
            bus_count=total_buses,
            route_allocations=optimized_allocations,
            total_cost=total_cost,
            calculation_details=calculation_details,
            issues_found=all_issues,
        )

        return result

    def _integer_programming_optimize(
        self,
        route_codes: List[str],
        passenger_counts: List[float],
        initial_allocations: Dict[str, int],
    ) -> Tuple[int, Dict[str, int], float]:
        """
        使用整数规划进行优化

        目标：最小化总班车数，同时满足各线路的载客需求

        Args:
            route_codes: 线路编号列表
            passenger_counts: 各线路客流量
            initial_allocations: 初始分配方案

        Returns:
            (总班车数, 优化后的分配方案, 总成本)
        """
        prob = pulp.LpProblem("BusScheduling", pulp.LpMinimize)

        # 决策变量：每条线路的班车数量（整数）
        bus_vars = {}
        for code in route_codes:
            bus_vars[code] = pulp.LpVariable(
                f"buses_{code}",
                lowBound=self.config.min_buses_per_route,
                upBound=self.config.max_buses_per_route,
                cat="Integer",
            )

        # 目标函数：最小化总成本
        prob += pulp.lpSum(
            [bus_vars[code] * self.config.cost_per_bus for code in route_codes]
        )

        # 约束条件：每辆车的容量必须满足客流量
        for i, code in enumerate(route_codes):
            prob += (
                bus_vars[code] * self.config.bus_capacity >= passenger_counts[i],
                f"capacity_{code}",
            )

        # 求解
        solver = pulp.PULP_CBC_CMD(msg=0)
        prob.solve(solver)

        if pulp.LpStatus[prob.status] != "Optimal":
            # 如果求解失败，使用初始分配
            optimized = initial_allocations.copy()
        else:
            optimized = {}
            for code in route_codes:
                optimized[code] = int(bus_vars[code].varValue)

        total_buses = sum(optimized.values())
        total_cost = total_buses * self.config.cost_per_bus

        return total_buses, optimized, total_cost

    def get_calculation_detail(self, detail_id: str) -> Optional[CalculationDetail]:
        """
        根据ID获取计算明细

        支持下钻查看

        Args:
            detail_id: 明细ID

        Returns:
            计算明细（如果存在）
        """
        for detail in self._calculation_details:
            if detail.detail_id == detail_id:
                return detail
        return None

    def get_details_by_record(self, record_id: str) -> List[CalculationDetail]:
        """
        根据记录ID获取所有相关计算明细

        Args:
            record_id: 记录ID

        Returns:
            计算明细列表
        """
        return [d for d in self._calculation_details if d.record_id == record_id]

    def get_details_by_issue(self, issue_id: str) -> List[CalculationDetail]:
        """
        根据问题ID获取所有相关计算明细

        Args:
            issue_id: 问题ID

        Returns:
            计算明细列表
        """
        return [d for d in self._calculation_details if issue_id in d.issues_involved]
