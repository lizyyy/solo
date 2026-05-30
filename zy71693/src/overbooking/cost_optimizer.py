"""成本优化模块。

基于概率模型的输出，计算不同超售水平下的期望成本和收益，
找到净利润最大化的最优超售策略。

主要功能：
- 补偿成本计算（分舱位、分时间段）
- 超售边际收入计算
- 期望净利润计算
- 最优超售水平搜索
- 约束条件处理（最大超售比例、风险阈值等）
"""
from __future__ import annotations

import logging
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime

import numpy as np

from .models import (
    FlightOrder, FlightInfo, CompensateRule, CabinClass,
    OptimizationRequest, OptimizationResult
)
from .probability_model import (
    ProbabilityModel, NoShowPrediction, OverbookingDistribution
)

logger = logging.getLogger(__name__)


@dataclass
class CostCalculationResult:
    """成本计算结果。"""
    overbooking: int
    expected_revenue: float
    expected_compensation: float
    expected_net_profit: float
    denied_boarding_prob: float
    expected_denied_count: float
    risk_level: str
    metrics: Dict[str, float] = field(default_factory=dict)


@dataclass
class CabinOptimizationResult:
    """单舱位优化结果。"""
    cabin: CabinClass
    capacity: int
    booked_seats: int
    avg_fare: float
    no_show_rate: float
    optimal_overbooking: int
    max_allowed_overbooking: int
    cost_results: List[CostCalculationResult] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class CostOptimizer:
    """成本优化器 - 搜索最优超售策略。"""

    def __init__(self, max_overbooking_ratio: float = 0.15, risk_threshold: float = 0.05):
        """
        初始化优化器。

        Args:
            max_overbooking_ratio: 最大超售比例（相对于舱位容量）
            risk_threshold: 可接受的最大超售概率阈值
        """
        self.max_overbooking_ratio = max_overbooking_ratio
        self.risk_threshold = risk_threshold
        self.prob_model = ProbabilityModel()

    def _get_compensation_amount(
        self,
        rules: List[CompensateRule],
        cabin: CabinClass,
        hours_before_flight: float = 0.0
    ) -> float:
        """根据规则计算补偿金额。

        考虑起飞前时间和舱位等级。
        """
        applicable_rules = [r for r in rules if r.cabin_class == cabin]
        if not applicable_rules:
            default_comp = {
                CabinClass.FIRST: 3000.0,
                CabinClass.BUSINESS: 2000.0,
                CabinClass.PREMIUM_ECONOMY: 1000.0,
                CabinClass.ECONOMY: 500.0,
            }
            return default_comp.get(cabin, 500.0)

        applicable_rules.sort(key=lambda r: r.threshold_hours)
        for rule in applicable_rules:
            if hours_before_flight <= rule.threshold_hours:
                return rule.compensation_amount + rule.voucher_amount * 0.5

        last_rule = applicable_rules[-1]
        return last_rule.compensation_amount + last_rule.voucher_amount * 0.5

    def _calculate_average_fare(
        self,
        orders: List[FlightOrder],
        cabin: CabinClass
    ) -> float:
        """计算指定舱位的平均票价。"""
        cabin_orders = [o for o in orders if o.cabin_class == cabin]
        if not cabin_orders:
            default_fares = {
                CabinClass.FIRST: 5000.0,
                CabinClass.BUSINESS: 3000.0,
                CabinClass.PREMIUM_ECONOMY: 1800.0,
                CabinClass.ECONOMY: 800.0,
            }
            return default_fares.get(cabin, 800.0)
        return float(np.mean([o.fare_amount for o in cabin_orders]))

    def _determine_risk_level(self, denied_prob: float, expected_denied: float) -> str:
        """根据概率和期望人数确定风险等级。"""
        if denied_prob <= 0.02 and expected_denied < 0.1:
            return "low"
        elif denied_prob <= 0.08 and expected_denied < 0.5:
            return "medium"
        else:
            return "high"

    def _evaluate_overbooking_level(
        self,
        cabin: CabinClass,
        booked_seats: int,
        capacity: int,
        overbooking: int,
        no_show_rate: float,
        avg_fare: float,
        compensation_per_pax: float,
        hours_before_flight: float
    ) -> CostCalculationResult:
        """评估单个超售水平的成本收益。"""
        distribution = self.prob_model.calculate_overbooking_distribution(
            cabin=cabin,
            booked_seats=booked_seats,
            capacity=capacity,
            overbooking=overbooking,
            no_show_rate=no_show_rate
        )

        effective_comp = self._get_compensation_amount(
            [], cabin, hours_before_flight
        ) if compensation_per_pax <= 0 else compensation_per_pax

        metrics = self.prob_model.calculate_overbooking_risk_metrics(
            distribution=distribution,
            capacity=capacity,
            fare_amount=avg_fare,
            compensation_per_pax=effective_comp
        )

        show_up_rate = 1 - no_show_rate
        total_tickets = booked_seats + overbooking

        base_revenue = booked_seats * avg_fare * show_up_rate
        extra_revenue = overbooking * avg_fare * show_up_rate
        expected_revenue = base_revenue + extra_revenue

        expected_compensation = distribution.expected_denied_boardings * effective_comp

        expected_net = expected_revenue - expected_compensation

        risk_level = self._determine_risk_level(
            distribution.denied_probability,
            distribution.expected_denied_boardings
        )

        return CostCalculationResult(
            overbooking=overbooking,
            expected_revenue=float(expected_revenue),
            expected_compensation=float(expected_compensation),
            expected_net_profit=float(expected_net),
            denied_boarding_prob=float(distribution.denied_probability),
            expected_denied_count=float(distribution.expected_denied_boardings),
            risk_level=risk_level,
            metrics=metrics
        )

    def optimize_cabin(
        self,
        cabin: CabinClass,
        flight_orders: List[FlightOrder],
        flight_info: FlightInfo,
        no_show_prediction: NoShowPrediction,
        compensation_rules: List[CompensateRule],
        hours_before_flight: Optional[float] = None,
        manual_max_overbooking: Optional[int] = None,
        manual_risk_threshold: Optional[float] = None
    ) -> CabinOptimizationResult:
        """优化单个舱位的超售水平。"""
        logger.info(f"开始优化 {cabin.name} 舱超售策略...")

        capacity = flight_info.capacity.get(cabin, 0)
        if capacity <= 0:
            return CabinOptimizationResult(
                cabin=cabin,
                capacity=0,
                booked_seats=0,
                avg_fare=0,
                no_show_rate=no_show_prediction.cabin_level.get(cabin, 0.09),
                optimal_overbooking=0,
                max_allowed_overbooking=0,
                warnings=[f"{cabin.name}舱容量为0，跳过优化"]
            )

        cabin_orders = [o for o in flight_orders if o.cabin_class == cabin]
        booked_seats = len(cabin_orders)
        avg_fare = self._calculate_average_fare(flight_orders, cabin)
        no_show_rate = no_show_prediction.cabin_level.get(cabin, 0.09)

        if hours_before_flight is None:
            now = datetime.now()
            hours_before_flight = (flight_info.scheduled_departure - now).total_seconds() / 3600
            hours_before_flight = max(0, hours_before_flight)

        compensation_per_pax = self._get_compensation_amount(
            compensation_rules, cabin, hours_before_flight
        )

        max_ratio_overbooking = int(capacity * self.max_overbooking_ratio)
        max_demand_overbooking = max(0, capacity - booked_seats + int(capacity * 0.1))
        max_allowed = min(max_ratio_overbooking, max_demand_overbooking)

        if manual_max_overbooking is not None:
            max_allowed = min(max_allowed, manual_max_overbooking)
            logger.info(f"人工设置最大超售数: {manual_max_overbooking}")

        risk_threshold = manual_risk_threshold or self.risk_threshold

        result = CabinOptimizationResult(
            cabin=cabin,
            capacity=capacity,
            booked_seats=booked_seats,
            avg_fare=avg_fare,
            no_show_rate=no_show_rate,
            optimal_overbooking=0,
            max_allowed_overbooking=max_allowed
        )

        if max_allowed <= 0:
            result.warnings.append(
                f"{cabin.name}舱最大允许超售数为0，已售 {booked_seats}/{capacity} 座"
            )
            zero_eval = self._evaluate_overbooking_level(
                cabin, booked_seats, capacity, 0, no_show_rate,
                avg_fare, compensation_per_pax, hours_before_flight
            )
            result.cost_results.append(zero_eval)
            return result

        best_profit = -float("inf")
        best_overbooking = 0

        for overbooking in range(0, max_allowed + 1):
            eval_result = self._evaluate_overbooking_level(
                cabin=cabin,
                booked_seats=booked_seats,
                capacity=capacity,
                overbooking=overbooking,
                no_show_rate=no_show_rate,
                avg_fare=avg_fare,
                compensation_per_pax=compensation_per_pax,
                hours_before_flight=hours_before_flight
            )
            result.cost_results.append(eval_result)

            if eval_result.denied_boarding_prob > risk_threshold:
                if overbooking > 0:
                    result.warnings.append(
                        f"超售 {overbooking} 张时，超售概率 {eval_result.denied_boarding_prob:.1%} "
                        f"超过风险阈值 {risk_threshold:.1%}"
                    )
                continue

            if eval_result.expected_net_profit > best_profit:
                best_profit = eval_result.expected_net_profit
                best_overbooking = overbooking

        result.optimal_overbooking = best_overbooking

        if best_overbooking == 0 and max_allowed > 0:
            result.warnings.append(
                f"所有超售水平的风险都超过阈值 {risk_threshold:.1%}，建议不超售或调整风险阈值"
            )

        logger.info(f"{cabin.name}舱优化完成: 最优超售 {best_overbooking} 张, "
                   f"期望净利润 ¥{best_profit:,.2f}")

        return result

    def optimize_flight(
        self,
        request: OptimizationRequest,
        flight_info: FlightInfo,
        flight_orders: List[FlightOrder],
        no_show_prediction: NoShowPrediction,
        compensation_rules: List[CompensateRule],
        anomalies: Optional[List[Dict[str, Any]]] = None,
        hours_before_flight: Optional[float] = None
    ) -> OptimizationResult:
        """优化整个航班的超售策略。

        支持人工覆盖参数。
        """
        logger.info(f"开始优化航班 {flight_info.flight_no} "
                   f"({flight_info.flight_date}) 的超售策略...")

        override_params = request.override_params or {}
        manual_no_show_rates = override_params.get("no_show_rates")
        manual_max_overbooking = override_params.get("max_overbooking")
        manual_risk_threshold = override_params.get("risk_threshold")

        cabin_results: Dict[CabinClass, CabinOptimizationResult] = {}
        total_revenue = 0.0
        total_compensation = 0.0
        total_net_profit = 0.0

        optimal_overbooking: Dict[CabinClass, int] = {}
        expected_no_show_rate: Dict[CabinClass, float] = {}

        all_warnings: List[str] = []
        scenarios: List[Dict[str, Any]] = []

        for cabin in [CabinClass.FIRST, CabinClass.BUSINESS,
                      CabinClass.PREMIUM_ECONOMY, CabinClass.ECONOMY]:
            if cabin not in flight_info.capacity:
                continue

            cabin_no_show_rate = expected_no_show_rate[cabin] = no_show_prediction.cabin_level.get(cabin, 0.09)

            cabin_result = self.optimize_cabin(
                cabin=cabin,
                flight_orders=flight_orders,
                flight_info=flight_info,
                no_show_prediction=no_show_prediction,
                compensation_rules=compensation_rules,
                hours_before_flight=hours_before_flight,
                manual_max_overbooking=manual_max_overbooking.get(cabin.value) if manual_max_overbooking else None,
                manual_risk_threshold=manual_risk_threshold
            )

            cabin_results[cabin] = cabin_result
            optimal_overbooking[cabin] = cabin_result.optimal_overbooking
            all_warnings.extend(cabin_result.warnings)

            if cabin_result.cost_results:
                optimal_eval = None
                for cr in cabin_result.cost_results:
                    if cr.overbooking == cabin_result.optimal_overbooking:
                        optimal_eval = cr
                        break
                if optimal_eval:
                    total_revenue += optimal_eval.expected_revenue
                    total_compensation += optimal_eval.expected_compensation
                    total_net_profit += optimal_eval.expected_net_profit

            cabin_scenarios = self.prob_model.simulate_multiple_scenarios(
                cabin=cabin,
                booked_seats=cabin_result.booked_seats,
                capacity=cabin_result.capacity,
                max_overbooking=cabin_result.max_allowed_overbooking,
                base_no_show_rate=cabin_no_show_rate,
                n_scenarios=5
            )
            for sc in cabin_scenarios:
                sc["cabin"] = cabin.value
                sc["cabin_name"] = cabin.name
            scenarios.extend(cabin_scenarios)

        max_risk = "low"
        max_prob = 0
        for cabin, result in cabin_results.items():
            for cr in result.cost_results:
                if cr.overbooking == result.optimal_overbooking:
                    if cr.denied_boarding_prob > max_prob:
                        max_prob = cr.denied_boarding_prob
                        max_risk = cr.risk_level

        risk_explanation = self._explain_risk(
            max_risk, max_prob, optimal_overbooking, flight_info.capacity
        )

        all_warnings.extend(no_show_prediction.warnings)

        if request.manual_override:
            all_warnings.append("⚠️ 本次优化使用了人工覆盖参数，请仔细复核结果")

        result = OptimizationResult(
            result_id=f"result_{request.request_id}",
            request_id=request.request_id,
            flight_no=flight_info.flight_no,
            flight_date=flight_info.flight_date,
            optimal_overbooking=optimal_overbooking,
            expected_no_show_rate=expected_no_show_rate,
            expected_revenue=total_revenue,
            expected_compensation_cost=total_compensation,
            expected_net_profit=total_net_profit,
            risk_level=max_risk,
            risk_explanation=risk_explanation,
            scenarios=scenarios,
            anomalies=anomalies or [],
            warnings=all_warnings
        )

        logger.info(f"航班 {flight_info.flight_no} 优化完成: "
                   f"期望净利润 ¥{total_net_profit:,.2f}, 风险等级: {max_risk.upper()}")

        return result

    def _explain_risk(
        self,
        risk_level: str,
        max_prob: float,
        overbooking: Dict[CabinClass, int],
        capacity: Dict[CabinClass, int]
    ) -> str:
        """生成人话风险解释。"""
        total_overbooking = sum(overbooking.values())
        total_capacity = sum(capacity.values())

        if risk_level == "low":
            expl = (
                f"✅ 风险低：当前超售方案总体可控，最高超售概率仅为 {max_prob:.1%}。"
                f"建议超售 {total_overbooking} 张（占总容量 {total_overbooking/total_capacity:.1%}），"
                f"即使出现最坏情况，也只有少数旅客可能需要安排改签。"
            )
        elif risk_level == "medium":
            expl = (
                f"⚠️ 中等风险：最高超售概率为 {max_prob:.1%}，"
                f"建议超售 {total_overbooking} 张（占总容量 {total_overbooking/total_capacity:.1%}）。"
                f"请在航班起飞前48小时密切关注订座变动，准备好候补旅客名单，"
                f"提前联系可能需要改签的高舱位旅客。"
            )
        else:
            expl = (
                f"🔴 高风险：最高超售概率达到 {max_prob:.1%}，"
                f"建议超售 {total_overbooking} 张（占总容量 {total_overbooking/total_capacity:.1%}）。"
                f"请立即准备：1) 联系高价值旅客寻求自愿改签；2) 准备好充足的补偿预算；"
                f"3) 协调后续航班空位。如无把握，建议降低超售数量。"
            )

        cabin_details = []
        for cabin, ob in overbooking.items():
            if ob > 0:
                cap = capacity.get(cabin, 0)
                rate = ob / cap * 100 if cap > 0 else 0
                cabin_details.append(f"{cabin.name}舱超售{ob}张({rate:.1f}%)")
        if cabin_details:
            expl += " 各舱位：" + "，".join(cabin_details) + "。"

        return expl

    def calculate_scenario_comparison(
        self,
        optimization_result: OptimizationResult,
        flight_info: FlightInfo,
        flight_orders: List[FlightOrder],
        no_show_prediction: NoShowPrediction,
        compensation_rules: List[CompensateRule]
    ) -> List[Dict[str, Any]]:
        """生成多情景对比数据，用于报告展示。"""
        comparison = []

        scenarios = [
            ("不超售", {c: 0 for c in optimization_result.optimal_overbooking.keys()}),
            ("保守方案", {c: int(v * 0.5) for c, v in optimization_result.optimal_overbooking.items()}),
            ("推荐方案", optimization_result.optimal_overbooking.copy()),
            ("激进方案", {c: int(v * 1.5) for c, v in optimization_result.optimal_overbooking.items()}),
        ]

        for scenario_name, overbooking_plan in scenarios:
            total_rev = 0
            total_comp = 0
            total_net = 0
            max_prob = 0

            for cabin, overbooking in overbooking_plan.items():
                if cabin not in flight_info.capacity:
                    continue

                cabin_orders = [o for o in flight_orders if o.cabin_class == cabin]
                booked_seats = len(cabin_orders)
                capacity = flight_info.capacity.get(cabin, 0)
                avg_fare = self._calculate_average_fare(flight_orders, cabin)
                no_show_rate = no_show_prediction.cabin_level.get(cabin, 0.09)

                hours_before = (flight_info.scheduled_departure - datetime.now()).total_seconds() / 3600
                hours_before = max(0, hours_before)
                comp_per_pax = self._get_compensation_amount(compensation_rules, cabin, hours_before)

                eval_result = self._evaluate_overbooking_level(
                    cabin, booked_seats, capacity, overbooking,
                    no_show_rate, avg_fare, comp_per_pax, hours_before
                )

                total_rev += eval_result.expected_revenue
                total_comp += eval_result.expected_compensation
                total_net += eval_result.expected_net_profit
                max_prob = max(max_prob, eval_result.denied_boarding_prob)

            comparison.append({
                "scenario": scenario_name,
                "overbooking_plan": {c.value: v for c, v in overbooking_plan.items()},
                "total_overbooking": sum(overbooking_plan.values()),
                "expected_revenue": round(total_rev, 2),
                "expected_compensation": round(total_comp, 2),
                "expected_net_profit": round(total_net, 2),
                "max_denied_probability": round(max_prob, 4),
                "vs_recommended_delta": round(
                    total_net - optimization_result.expected_net_profit, 2
                )
            })

        return comparison
