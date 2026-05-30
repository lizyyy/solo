"""概率建模模块。

基于历史数据进行旅客爽约率预测，使用统计分布建模超售风险。
主要功能：
- 旅客级爽约率预测（考虑个人历史、舱位、会员等级等）
- 航班级整体爽约率估计
- 超售概率分布计算（二项分布、Beta分布）
- 置信区间估计
- 支持人工覆盖参数
"""
from __future__ import annotations

import logging
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, field

import numpy as np
from scipy import stats

from .models import (
    FlightOrder, NoShowHistory, FlightInfo, Passenger,
    CabinClass, OptimizationRequest
)

logger = logging.getLogger(__name__)


@dataclass
class NoShowPrediction:
    """爽约率预测结果。"""
    passenger_level: Dict[str, float] = field(default_factory=dict)
    cabin_level: Dict[CabinClass, float] = field(default_factory=dict)
    overall_rate: float = 0.0
    confidence_interval: Tuple[float, float] = (0.0, 0.0)
    sample_size: Dict[CabinClass, int] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    model_params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OverbookingDistribution:
    """超售概率分布。"""
    cabin: CabinClass
    overbooking_level: int
    boarding_probabilities: Dict[int, float]
    expected_denied_boardings: float
    denied_probability: float
    p_exact: float
    cdf_less_equal: Dict[int, float]


class ProbabilityModel:
    """概率模型 - 爽约率预测与超售分布计算。"""

    def __init__(self, alpha_prior: float = 1.0, beta_prior: float = 10.0):
        """
        初始化概率模型。

        Args:
            alpha_prior: Beta分布先验参数 alpha（默认对应约9%的基础爽约率）
            beta_prior: Beta分布先验参数 beta
        """
        self.alpha_prior = alpha_prior
        self.beta_prior = beta_prior
        self._feature_weights = {
            "tier": {"platinum": 0.3, "gold": 0.5, "silver": 0.7, "basic": 1.0},
            "cabin_multiplier": {
                CabinClass.FIRST: 0.6,
                CabinClass.BUSINESS: 0.7,
                CabinClass.PREMIUM_ECONOMY: 0.85,
                CabinClass.ECONOMY: 1.0
            },
            "booking_days_weight": 0.001
        }

    def _estimate_prior_parameters(
        self,
        no_show_histories: List[NoShowHistory],
        cabin: Optional[CabinClass] = None
    ) -> Tuple[float, float]:
        """基于历史数据估计Beta分布的先验参数。

        使用矩匹配法估计 Beta(alpha, beta) 的参数。
        """
        if not no_show_histories:
            return self.alpha_prior, self.beta_prior

        records = no_show_histories
        if cabin:
            records = [h for h in no_show_histories if hasattr(h, "cabin_class") and h.cabin_class == cabin]

        if len(records) < 5:
            logger.info(f"历史样本不足 ({len(records)} 条)，使用默认先验参数")
            return self.alpha_prior, self.beta_prior

        no_show_flags = [1 if h.was_no_show else 0 for h in records]
        mean_rate = np.mean(no_show_flags)
        var_rate = np.var(no_show_flags, ddof=1) if len(no_show_flags) > 1 else 0.01

        if mean_rate <= 0 or mean_rate >= 1:
            mean_rate = max(0.01, min(0.99, mean_rate))

        if var_rate <= 0:
            var_rate = mean_rate * (1 - mean_rate) / 2

        common_factor = mean_rate * (1 - mean_rate) / var_rate - 1
        alpha = mean_rate * common_factor
        beta = (1 - mean_rate) * common_factor

        alpha = max(0.1, alpha)
        beta = max(0.1, beta)

        return alpha, beta

    def predict_passenger_no_show(
        self,
        passenger: Passenger,
        order: Optional[FlightOrder] = None,
        base_rate: float = 0.09
    ) -> float:
        """预测单个旅客的爽约概率。

        考虑因素：
        - 旅客历史爽约率
        - 会员等级（越高等级爽约率越低）
        - 舱位等级（头等舱商务舱爽约率低）
        - 预订提前天数
        """
        if passenger.historical_flight_count > 0:
            personal_rate = passenger.historical_no_show_count / passenger.historical_flight_count
            weight = min(passenger.historical_flight_count / 20, 1.0)
            adjusted_rate = weight * personal_rate + (1 - weight) * base_rate
        else:
            adjusted_rate = base_rate

        tier = passenger.tier.lower()
        tier_multiplier = self._feature_weights["tier"].get(tier, 1.0)
        adjusted_rate *= tier_multiplier

        if order:
            cabin_multiplier = self._feature_weights["cabin_multiplier"].get(
                order.cabin_class, 1.0
            )
            adjusted_rate *= cabin_multiplier

            if hasattr(order, "booking_date") and hasattr(order, "flight_date"):
                days_before = (order.flight_date - order.booking_date).days
                if days_before > 0:
                    days_factor = 1 + self._feature_weights["booking_days_weight"] * (days_before - 30)
                    adjusted_rate *= max(0.5, min(2.0, days_factor))

        return max(0.005, min(0.9, adjusted_rate))

    def predict_no_show_rates(
        self,
        flight_orders: List[FlightOrder],
        no_show_histories: List[NoShowHistory],
        passengers: Optional[List[Passenger]] = None,
        manual_override: Optional[Dict[str, float]] = None,
        flight_info: Optional[FlightInfo] = None
    ) -> NoShowPrediction:
        """预测航班各舱位的爽约率。

        Args:
            flight_orders: 当前航班订单列表
            no_show_histories: 历史爽约记录
            passengers: 旅客信息列表
            manual_override: 人工覆盖的爽约率 {舱位代码: 爽约率}
            flight_info: 航班信息

        Returns:
            NoShowPrediction 包含各舱位和整体的爽约率预测
        """
        logger.info("开始计算爽约率预测...")
        prediction = NoShowPrediction()

        passenger_map = {p.passenger_id: p for p in (passengers or [])}
        alpha0, beta0 = self._estimate_prior_parameters(no_show_histories)

        cabin_orders: Dict[CabinClass, List[FlightOrder]] = {}
        for order in flight_orders:
            if order.cabin_class not in cabin_orders:
                cabin_orders[order.cabin_class] = []
            cabin_orders[order.cabin_class].append(order)

        for cabin in [CabinClass.FIRST, CabinClass.BUSINESS,
                      CabinClass.PREMIUM_ECONOMY, CabinClass.ECONOMY]:
            orders = cabin_orders.get(cabin, [])
            prediction.sample_size[cabin] = len(orders)

            if not orders:
                cabin_histories = [h for h in no_show_histories
                                  if hasattr(h, "cabin_class") and h.cabin_class == cabin]
                if cabin_histories:
                    rate = sum(1 for h in cabin_histories if h.was_no_show) / len(cabin_histories)
                else:
                    rate = 0.09 * self._feature_weights["cabin_multiplier"].get(cabin, 1.0)
                prediction.cabin_level[cabin] = rate
                continue

            cabin_histories = no_show_histories
            alpha_cabin, beta_cabin = self._estimate_prior_parameters(cabin_histories, cabin)

            if passengers:
                passenger_rates = []
                for order in orders:
                    passenger = None
                    if order.passenger_id:
                        passenger = passenger_map.get(order.passenger_id)
                    if passenger is None:
                        for p in (passengers or []):
                            if p.name == order.passenger_name:
                                passenger = p
                                break

                    base_rate = alpha_cabin / (alpha_cabin + beta_cabin)
                    if passenger:
                        rate = self.predict_passenger_no_show(passenger, order, base_rate)
                    else:
                        rate = base_rate
                    passenger_rates.append(rate)
                    prediction.passenger_level[order.order_id] = rate

                mean_rate = np.mean(passenger_rates)
            else:
                cabin_no_shows = sum(1 for h in cabin_histories if h.was_no_show)
                total_cabin = len(cabin_histories) if cabin_histories else 100
                alpha_post = alpha_cabin + cabin_no_shows
                beta_post = beta_cabin + (total_cabin - cabin_no_shows)
                mean_rate = alpha_post / (alpha_post + beta_post)
                for order in orders:
                    prediction.passenger_level[order.order_id] = mean_rate

            prediction.cabin_level[cabin] = float(mean_rate)

        if flight_orders:
            total_orders = len(flight_orders)
            weighted_sum = sum(
                prediction.cabin_level[cabin] * len(cabin_orders.get(cabin, []))
                for cabin in prediction.cabin_level
            )
            prediction.overall_rate = weighted_sum / total_orders if total_orders > 0 else 0.09

            total_no_shows = sum(1 for h in no_show_histories if h.was_no_show)
            total_histories = len(no_show_histories) if no_show_histories else 1
            alpha_post = alpha0 + total_no_shows
            beta_post = beta0 + (total_histories - total_no_shows)
            prediction.confidence_interval = (
                float(stats.beta.ppf(0.025, alpha_post, beta_post)),
                float(stats.beta.ppf(0.975, alpha_post, beta_post))
            )
            prediction.model_params = {
                "beta_alpha": float(alpha_post),
                "beta_beta": float(beta_post),
                "historical_no_show_count": total_no_shows,
                "historical_total": total_histories
            }

        if manual_override:
            for cabin_str, new_rate in manual_override.items():
                try:
                    cabin = CabinClass(cabin_str)
                    old_rate = prediction.cabin_level.get(cabin, 0.0)
                    prediction.cabin_level[cabin] = new_rate
                    prediction.warnings.append(
                        f"【人工覆盖】{cabin.name}舱爽约率从 {old_rate:.1%} 调整为 {new_rate:.1%}"
                    )
                    logger.info(f"人工覆盖 {cabin} 舱爽约率: {old_rate:.1%} → {new_rate:.1%}")
                except ValueError:
                    prediction.warnings.append(f"人工覆盖参数中的舱位 '{cabin_str}' 无效")

        if prediction.overall_rate < 0.02:
            prediction.warnings.append(
                f"⚠️ 整体爽约率预测为 {prediction.overall_rate:.1%}，异常偏低，建议人工复核"
            )
        elif prediction.overall_rate > 0.3:
            prediction.warnings.append(
                f"⚠️ 整体爽约率预测为 {prediction.overall_rate:.1%}，异常偏高，建议人工复核"
            )

        logger.info(f"整体爽约率预测: {prediction.overall_rate:.1%} "
                   f"(95%置信区间: {prediction.confidence_interval[0]:.1%} - "
                   f"{prediction.confidence_interval[1]:.1%})")

        return prediction

    def calculate_overbooking_distribution(
        self,
        cabin: CabinClass,
        booked_seats: int,
        capacity: int,
        overbooking: int,
        no_show_rate: float
    ) -> OverbookingDistribution:
        """计算给定超售水平下的登机人数概率分布。

        使用二项分布模型：每位旅客登机概率 = 1 - 爽约率

        Args:
            cabin: 舱位等级
            booked_seats: 已预订座位数（含超售）
            capacity: 舱位实际容量
            overbooking: 超售数量
            no_show_rate: 爽约率

        Returns:
            OverbookingDistribution 包含完整的概率分布信息
        """
        show_up_rate = 1 - no_show_rate
        total_tickets = booked_seats + overbooking

        boarding_probs: Dict[int, float] = {}
        cdf_less_equal: Dict[int, float] = {}

        for k in range(total_tickets + 1):
            prob = stats.binom.pmf(k, total_tickets, show_up_rate)
            boarding_probs[k] = float(prob)

        cum_prob = 0.0
        for k in range(total_tickets + 1):
            cum_prob += boarding_probs[k]
            cdf_less_equal[k] = float(cum_prob)

        denied_boarding = max(0, k - capacity)
        expected_denied = sum(
            max(0, k - capacity) * boarding_probs[k]
            for k in range(total_tickets + 1)
        )

        denied_prob = sum(
            boarding_probs[k]
            for k in range(capacity + 1, total_tickets + 1)
        )

        p_exact_denied = sum(
            boarding_probs[k]
            for k in range(total_tickets, total_tickets + 1)
            if k > capacity
        )

        return OverbookingDistribution(
            cabin=cabin,
            overbooking_level=overbooking,
            boarding_probabilities=boarding_probs,
            expected_denied_boardings=float(expected_denied),
            denied_probability=float(denied_prob),
            p_exact=float(p_exact_denied),
            cdf_less_equal=cdf_less_equal
        )

    def calculate_overbooking_risk_metrics(
        self,
        distribution: OverbookingDistribution,
        capacity: int,
        fare_amount: float,
        compensation_per_pax: float
    ) -> Dict[str, float]:
        """计算超售风险指标。

        Args:
            distribution: 超售分布
            capacity: 舱位容量
            fare_amount: 单座票价收入
            compensation_per_pax: 人均补偿成本

        Returns:
            风险指标字典
        """
        prob = distribution.denied_probability
        expected_denied = distribution.expected_denied_boardings
        overbooking = distribution.overbooking_level

        cabin_multiplier = 0.3 if distribution.cabin == CabinClass.FIRST else 0.15
        marginal_revenue = overbooking * fare_amount * (1 - cabin_multiplier)
        expected_compensation = expected_denied * compensation_per_pax
        expected_net = marginal_revenue - expected_compensation

        var_95 = 0.0
        threshold = 0.95
        cum_prob = 0.0
        for k in sorted(distribution.boarding_probabilities.keys()):
            cum_prob += distribution.boarding_probabilities[k]
            if cum_prob >= threshold:
                var_95 = max(0, k - capacity) * compensation_per_pax
                break

        cvar_95 = 0.0
        tail_prob = 0.0
        for k in range(capacity + 1, max(distribution.boarding_probabilities.keys()) + 1):
            if k in distribution.boarding_probabilities and distribution.cdf_less_equal.get(k-1, 0) >= 0.95:
                cvar_95 += max(0, k - capacity) * compensation_per_pax * distribution.boarding_probabilities[k]
                tail_prob += distribution.boarding_probabilities[k]
        if tail_prob > 0:
            cvar_95 /= tail_prob

        return {
            "denied_probability": prob,
            "expected_denied_boardings": expected_denied,
            "marginal_revenue": float(marginal_revenue),
            "expected_compensation_cost": float(expected_compensation),
            "expected_net_profit": float(expected_net),
            "var_95": float(var_95),
            "cvar_95": float(cvar_95),
            "revenue_risk_ratio": float(marginal_revenue / expected_compensation) if expected_compensation > 0 else float("inf")
        }

    def simulate_multiple_scenarios(
        self,
        cabin: CabinClass,
        booked_seats: int,
        capacity: int,
        max_overbooking: int,
        base_no_show_rate: float,
        no_show_std: float = 0.03,
        n_scenarios: int = 5
    ) -> List[Dict[str, Any]]:
        """模拟多种情景下的超售结果。

        Args:
            cabin: 舱位
            booked_seats: 已预订座位
            capacity: 容量
            max_overbooking: 最大超售数
            base_no_show_rate: 基础爽约率
            no_show_std: 爽约率标准差
            n_scenarios: 情景数量

        Returns:
            多情景模拟结果列表
        """
        scenarios = []

        rate_scenarios = [
            ("保守", max(0.01, base_no_show_rate - no_show_std)),
            ("基准", base_no_show_rate),
            ("乐观", min(0.5, base_no_show_rate + no_show_std)),
        ]

        if n_scenarios >= 4:
            rate_scenarios.append(("非常保守", max(0.005, base_no_show_rate - 2 * no_show_std)))
        if n_scenarios >= 5:
            rate_scenarios.append(("非常乐观", min(0.6, base_no_show_rate + 2 * no_show_std)))

        for scenario_name, no_show_rate in rate_scenarios:
            for overbooking in range(0, max_overbooking + 1, max(1, max_overbooking // 3)):
                dist = self.calculate_overbooking_distribution(
                    cabin, booked_seats, capacity, overbooking, no_show_rate
                )
                scenarios.append({
                    "scenario": scenario_name,
                    "no_show_rate": no_show_rate,
                    "overbooking": overbooking,
                    "denied_probability": dist.denied_probability,
                    "expected_denied": dist.expected_denied_boardings,
                })

        return scenarios
