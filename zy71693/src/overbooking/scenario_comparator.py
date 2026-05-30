"""情景对比与风险解释模块。

生成多维度的情景对比分析，并用通俗易懂的语言解释风险和收益。
让业务同事能够直观理解不同超售策略的影响。
"""
from __future__ import annotations

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from .models import (
    CabinClass, OptimizationResult, FlightInfo,
    FlightOrder, CompensateRule
)
from .probability_model import NoShowPrediction
from .cost_optimizer import CostOptimizer, CabinOptimizationResult

logger = logging.getLogger(__name__)


class ScenarioComparator:
    """情景对比分析器。"""

    def __init__(self):
        self.optimizer = CostOptimizer()
        self.scenario_definitions = [
            {
                "id": "no_overbooking",
                "name": "不超售",
                "description": "严格按照舱位容量售票，不超售任何座位",
                "overbooking_multiplier": 0.0,
                "icon": "🛡️"
            },
            {
                "id": "conservative",
                "name": "保守方案",
                "description": "低风险策略，超售量为最优值的50%",
                "overbooking_multiplier": 0.5,
                "icon": "⚠️"
            },
            {
                "id": "recommended",
                "name": "推荐方案",
                "description": "收益与风险平衡的最优策略",
                "overbooking_multiplier": 1.0,
                "icon": "✅"
            },
            {
                "id": "aggressive",
                "name": "激进方案",
                "description": "高风险高收益，超售量为最优值的150%",
                "overbooking_multiplier": 1.5,
                "icon": "🔥"
            },
            {
                "id": "very_aggressive",
                "name": "非常激进",
                "description": "最大化收益，超售量为最优值的200%",
                "overbooking_multiplier": 2.0,
                "icon": "💥"
            }
        ]

    def generate_comparison(
        self,
        optimization_result: OptimizationResult,
        flight_info: FlightInfo,
        flight_orders: List[FlightOrder],
        no_show_prediction: NoShowPrediction,
        compensation_rules: List[CompensateRule]
    ) -> List[Dict[str, Any]]:
        """生成完整的情景对比数据。"""
        logger.info("生成情景对比分析...")

        comparison = self.optimizer.calculate_scenario_comparison(
            optimization_result, flight_info, flight_orders,
            no_show_prediction, compensation_rules
        )

        for item in comparison:
            scenario_name = item["scenario"]
            scenario_def = next(
                (s for s in self.scenario_definitions if s["name"] == scenario_name),
                None
            )
            if scenario_def:
                item["icon"] = scenario_def["icon"]
                item["description"] = scenario_def["description"]
                item["scenario_id"] = scenario_def["id"]

            item["recommendation"] = self._generate_scenario_recommendation(item)

        return comparison

    def _generate_scenario_recommendation(self, scenario_data: Dict[str, Any]) -> str:
        """为每个情景生成人话建议。"""
        name = scenario_data["scenario"]
        delta = scenario_data["vs_recommended_delta"]
        prob = scenario_data["max_denied_probability"]

        if name == "推荐方案":
            return "此方案在收益和风险之间取得最佳平衡，建议采纳。"

        if delta > 1000 and prob < 0.05:
            return f"此方案可比推荐方案多赚 ¥{delta:,.0f}，但需承担更高超售风险。"
        elif delta < -1000:
            return f"此方案比推荐方案少赚 ¥{abs(delta):,.0f}，风险相对较低。"

        if prob < 0.01:
            return "此方案超售风险极低，几乎不会出现旅客拒载情况。"
        elif prob < 0.05:
            return "此方案风险可控，平均20个航班才可能出现1次超售。"
        elif prob < 0.15:
            return "此方案有一定超售风险，约7个航班可能出现1次，需做好准备。"
        else:
            return f"此方案超售概率达 {prob:.1%}，风险较高，需谨慎使用。"

    def compare_cabin_strategies(
        self,
        cabin_results: Dict[CabinClass, CabinOptimizationResult],
        flight_info: FlightInfo
    ) -> Dict[str, Any]:
        """对比各舱位的优化策略。"""
        cabin_comparison = {}

        for cabin, result in cabin_results.items():
            if result.capacity <= 0:
                continue

            optimal_eval = None
            for cr in result.cost_results:
                if cr.overbooking == result.optimal_overbooking:
                    optimal_eval = cr
                    break

            cabin_comparison[cabin.value] = {
                "cabin_name": cabin.name,
                "capacity": result.capacity,
                "booked_seats": result.booked_seats,
                "load_factor": round(result.booked_seats / result.capacity * 100, 1) if result.capacity > 0 else 0,
                "avg_fare": round(result.avg_fare, 2),
                "no_show_rate": round(result.no_show_rate * 100, 2),
                "optimal_overbooking": result.optimal_overbooking,
                "overbooking_ratio": round(result.optimal_overbooking / result.capacity * 100, 2) if result.capacity > 0 else 0,
                "expected_revenue": round(optimal_eval.expected_revenue, 2) if optimal_eval else 0,
                "expected_compensation": round(optimal_eval.expected_compensation, 2) if optimal_eval else 0,
                "expected_net_profit": round(optimal_eval.expected_net_profit, 2) if optimal_eval else 0,
                "denied_probability": round(optimal_eval.denied_boarding_prob * 100, 2) if optimal_eval else 0,
                "risk_level": optimal_eval.risk_level if optimal_eval else "unknown"
            }

        return cabin_comparison


class RiskExplainer:
    """风险解释器 - 用通俗易懂的人话解释技术指标。"""

    def __init__(self):
        self.risk_level_colors = {
            "low": "🟢",
            "medium": "🟡",
            "high": "🔴"
        }

    def explain_risk_level(self, risk_level: str) -> Dict[str, Any]:
        """解释风险等级的含义。"""
        explanations = {
            "low": {
                "emoji": "🟢",
                "short": "低风险",
                "summary": "超售风险可控，运营压力小",
                "detailed": (
                    "当前方案超售概率极低（通常<3%），即使出现超售，"
                    "需要安排改签的旅客也非常有限。"
                    "可以按日常流程处理，无需特殊准备。"
                ),
                "action_items": [
                    "按常规超售流程处理",
                    "起飞前24小时关注旅客值机情况",
                    "准备好常规补偿方案"
                ],
                "business_impact": "对旅客满意度和品牌形象影响极小"
            },
            "medium": {
                "emoji": "🟡",
                "short": "中等风险",
                "summary": "存在一定超售可能，需提前准备",
                "detailed": (
                    "当前方案有一定概率出现超售（通常3%-15%），"
                    "平均每7-30个航班可能遇到一次。"
                    "需要提前做好准备工作，避免现场混乱。"
                ),
                "action_items": [
                    "起飞前48小时锁定超售座位",
                    "提前联系高价值旅客询问出行计划",
                    "准备好候补旅客名单和改签方案",
                    "确保补偿预算到位"
                ],
                "business_impact": "如处理得当，对旅客满意度影响有限"
            },
            "high": {
                "emoji": "🔴",
                "short": "高风险",
                "summary": "超售概率较高，需密切监控并准备应急预案",
                "detailed": (
                    "当前方案超售概率较高（通常>15%），"
                    "很可能需要安排多名旅客改签。"
                    "必须提前做好充分准备，并考虑是否降低超售水平。"
                ),
                "action_items": [
                    "立即启动高风险超售预案",
                    "提前2-3天开始联系旅客寻求自愿改签",
                    "协调后续3个航班的预留座位",
                    "准备充足的现金和代金券补偿",
                    "安排资深员工负责现场处理",
                    "考虑是否降低超售数量"
                ],
                "business_impact": "处理不当可能导致旅客投诉和品牌声誉损失"
            }
        }
        return explanations.get(risk_level, explanations["medium"])

    def explain_metrics(
        self,
        optimization_result: OptimizationResult
    ) -> List[Dict[str, Any]]:
        """用通俗语言解释关键指标。"""
        metrics = []

        total_overbooking = sum(optimization_result.optimal_overbooking.values())
        total_capacity = 0
        if hasattr(optimization_result, "flight_info"):
            total_capacity = sum(optimization_result.flight_info.capacity.values())

        metrics.append({
            "name": "建议超售总数",
            "value": total_overbooking,
            "unit": "张",
            "explanation": (
                f"系统建议总共超售 {total_overbooking} 张机票。"
                f"这是基于历史爽约率、票价水平和补偿成本综合计算的最优值。"
            )
        })

        metrics.append({
            "name": "期望额外收入",
            "value": round(total_overbooking * 800, 0),
            "unit": "元",
            "explanation": (
                f"如果按平均票价计算，超售 {total_overbooking} 张预计可增加收入约 ¥{total_overbooking * 800:,.0f}。"
                f"这部分是'空座损失'——如果不超售，这些座位很可能因为旅客爽约而空飞。"
            )
        })

        metrics.append({
            "name": "期望补偿成本",
            "value": round(optimization_result.expected_compensation_cost, 0),
            "unit": "元",
            "explanation": (
                f"预计需要支付补偿 ¥{optimization_result.expected_compensation_cost:,.0f}。"
                f"这是统计期望值——大多数航班可能不需要补偿，少数航班可能需要支付较高补偿。"
            )
        })

        metrics.append({
            "name": "期望净利润",
            "value": round(optimization_result.expected_net_profit, 0),
            "unit": "元",
            "explanation": (
                f"扣除期望补偿后，预计可增加净利润 ¥{optimization_result.expected_net_profit:,.0f}。"
                f"这是超售策略的预期净收益。"
            )
        })

        avg_no_show = sum(optimization_result.expected_no_show_rate.values()) / len(optimization_result.expected_no_show_rate) if optimization_result.expected_no_show_rate else 0
        metrics.append({
            "name": "预期爽约率",
            "value": round(avg_no_show * 100, 1),
            "unit": "%",
            "explanation": (
                f"根据历史数据，预计约 {avg_no_show*100:.1f}% 的购票旅客最终不会登机。"
                f"这部分'消失'的旅客是我们可以超售的理论基础。"
            )
        })

        return metrics

    def generate_summary(
        self,
        optimization_result: OptimizationResult,
        scenario_comparison: List[Dict[str, Any]],
        anomalies_summary: Dict[str, Any]
    ) -> Dict[str, Any]:
        """生成完整的人话总结报告。"""
        risk_info = self.explain_risk_level(optimization_result.risk_level)
        metrics = self.explain_metrics(optimization_result)

        recommended_profit = optimization_result.expected_net_profit
        no_overbooking_profit = next(
            (s["expected_net_profit"] for s in scenario_comparison if s["scenario"] == "不超售"),
            0
        )
        profit_delta = recommended_profit - no_overbooking_profit

        total_anomalies = anomalies_summary.get("total", 0)
        error_anomalies = anomalies_summary.get("by_severity", {}).get("error", 0)

        if error_anomalies > 0:
            anomaly_warning = (
                f"⚠️ 检测到 {error_anomalies} 个严重异常，"
                f"建议处理后再执行优化结果"
            )
        elif total_anomalies > 0:
            anomaly_warning = (
                f"ℹ️ 检测到 {total_anomalies} 个需要关注的异常，"
                f"请人工复核后确认是否采纳"
            )
        else:
            anomaly_warning = "✅ 未检测到异常数据，结果可信度高"

        return {
            "headline": (
                f"{risk_info['emoji']} 航班 {optimization_result.flight_no} "
                f"超售优化建议：风险{risk_info['short']}，"
                f"预计增收 ¥{profit_delta:,.0f}"
            ),
            "risk_summary": risk_info,
            "key_metrics": metrics,
            "core_recommendation": optimization_result.risk_explanation,
            "scenario_comparison": scenario_comparison,
            "anomaly_warning": anomaly_warning,
            "action_items": risk_info["action_items"],
            "decision_guide": self._generate_decision_guide(
                optimization_result, profit_delta, error_anomalies
            ),
            "warnings": optimization_result.warnings
        }

    def _generate_decision_guide(
        self,
        result: OptimizationResult,
        profit_delta: float,
        error_anomalies: int
    ) -> str:
        """生成决策指导建议。"""
        if error_anomalies > 0:
            return (
                "❌ 【不建议立即执行】检测到严重数据异常，"
                "请先修正数据问题后重新生成优化方案。"
            )

        if result.risk_level == "high":
            if profit_delta > 5000:
                return (
                    "⚖️ 【谨慎决策】虽然预计可增收 ¥{:,.0f}，但风险较高。"
                    "建议：1) 确认近期出行需求是否旺盛；"
                    "2) 准备好充足的补偿预算；"
                    "3) 可考虑降低20%-30%的超售量。"
                ).format(profit_delta)
            else:
                return (
                    "⚠️ 【建议保守】增收 ¥{:,.0f} 不足以覆盖高风险。"
                    "建议降低超售水平或采用保守方案。"
                ).format(profit_delta)

        if result.risk_level == "medium":
            return (
                "✅ 【可执行，需准备】建议采纳推荐方案，"
                "同时按中等风险预案做好准备工作。"
                "预计增收 ¥{:,.0f}，风险可控。"
            ).format(profit_delta)

        return (
            "✅ 【建议执行】推荐方案风险低、收益明确，"
            "预计增收 ¥{:,.0f}，可按常规流程执行。"
        ).format(profit_delta)
