"""策略比较模块 - 比较不同营养液管理策略的成本和风险"""
from typing import Dict, List, Optional, Tuple
from datetime import date
import math

from .models import (
    SimulationResult, SimulationSummary, StrategyComparison,
    DataBundle, Reservoir, Crop, CropStageInfo, Recipe
)
from .simulator import Simulator, SimulationStrategy


class StrategyComparator:
    """策略比较器"""
    
    NUTRIENT_COST_PER_ML = 0.05
    WATER_COST_PER_LITER = 0.002
    ACID_BASE_COST_PER_ML = 0.02
    
    def __init__(self, data_bundle: DataBundle):
        self.data = data_bundle
    
    def compare_strategies(
        self,
        reservoir_id: str,
        days: int = 7,
        start_date: Optional[date] = None,
        crop_id: Optional[str] = None,
        crop_stage: Optional[str] = None,
        recipe_id: Optional[str] = None
    ) -> Dict[str, StrategyComparison]:
        """
        比较不同策略
        
        Returns:
            包含两种策略比较结果的字典
        """
        strategies = [
            (SimulationStrategy.STABLE_EC, "稳 EC 策略", "优先保持 EC 稳定，必要时排液换液"),
            (SimulationStrategy.SAVE_NUTRIENT, "省营养液策略", "优先保留营养液，通过补水稀释高 EC"),
        ]
        
        results = {}
        
        for strategy_id, name, description in strategies:
            simulator = Simulator(self.data, strategy=strategy_id)
            sim_result = simulator.simulate_reservoir(
                reservoir_id=reservoir_id,
                days=days,
                start_date=start_date,
                crop_id=crop_id,
                crop_stage=crop_stage,
                recipe_id=recipe_id
            )
            
            comparison = self._create_comparison(
                strategy_id, name, description, sim_result
            )
            results[strategy_id] = comparison
        
        return results
    
    def _create_comparison(
        self,
        strategy_id: str,
        name: str,
        description: str,
        sim_result: SimulationResult
    ) -> StrategyComparison:
        """创建策略比较对象"""
        summary = sim_result.summary
        
        total_water = summary.total_water_added_liters
        total_nutrient = summary.total_a_added_ml + summary.total_b_added_ml
        total_acid_base = summary.total_acid_added_ml + summary.total_base_added_ml
        
        estimated_cost = self._calculate_cost(
            total_water, total_nutrient, total_acid_base, summary.total_drained_liters
        )
        
        risk_score, risk_factors = self._calculate_risk(
            strategy_id, sim_result
        )
        
        benefits, risks = self._get_benefits_and_risks(
            strategy_id, sim_result, risk_factors
        )
        
        return StrategyComparison(
            strategy_name=name,
            description=description,
            total_water_liters=round(total_water, 2),
            total_nutrient_ml=round(total_nutrient, 1),
            total_acid_base_ml=round(total_acid_base, 1),
            full_changes=summary.full_changes_required,
            estimated_cost=round(estimated_cost, 2),
            risk_score=round(risk_score, 2),
            risk_factors=risk_factors,
            key_benefits=benefits,
            key_risks=risks
        )
    
    def _calculate_cost(
        self,
        water_liters: float,
        nutrient_ml: float,
        acid_base_ml: float,
        drained_liters: float
    ) -> float:
        """计算估算成本"""
        water_cost = water_liters * self.WATER_COST_PER_LITER
        nutrient_cost = nutrient_ml * self.NUTRIENT_COST_PER_ML
        acid_base_cost = acid_base_ml * self.ACID_BASE_COST_PER_ML
        
        drained_nutrient_loss = drained_liters * 0.5 * self.NUTRIENT_COST_PER_ML
        
        return water_cost + nutrient_cost + acid_base_cost + drained_nutrient_loss
    
    def _calculate_risk(
        self,
        strategy_id: str,
        sim_result: SimulationResult
    ) -> Tuple[float, List[str]]:
        """
        计算风险评分（0-10，越低越安全）
        返回 (风险评分, 风险因素列表)
        """
        summary = sim_result.summary
        risk_score = 0.0
        risk_factors: List[str] = []
        
        ec_out_of_range_pct = summary.ec_out_of_range_days / sim_result.total_days if sim_result.total_days > 0 else 0
        ph_out_of_range_pct = summary.ph_out_of_range_days / sim_result.total_days if sim_result.total_days > 0 else 0
        
        if ec_out_of_range_pct > 0.3:
            risk_score += 2.0
            risk_factors.append(f"EC 超出范围天数占比 {ec_out_of_range_pct*100:.0f}%")
        
        if ph_out_of_range_pct > 0.3:
            risk_score += 1.5
            risk_factors.append(f"pH 超出范围天数占比 {ph_out_of_range_pct*100:.0f}%")
        
        if summary.full_changes_required > 0:
            risk_score += 1.0 * summary.full_changes_required
            risk_factors.append(f"需要 {summary.full_changes_required} 次换液操作")
        
        if strategy_id == SimulationStrategy.SAVE_NUTRIENT:
            risk_score += 1.0
            risk_factors.append("省营养液策略可能导致 EC 长期偏高")
        
        for action in sim_result.daily_actions:
            for warning in action.warnings:
                if "库存" in warning:
                    risk_score += 0.5
                    if "库存不足" not in risk_factors:
                        risk_factors.append("存在库存不足风险")
        
        for warning in sim_result.warnings:
            if "无法" in warning or "需要" in warning:
                risk_score += 1.0
                if "操作复杂度" not in risk_factors:
                    risk_factors.append("操作复杂度较高")
        
        risk_score = min(risk_score, 10.0)
        
        return risk_score, risk_factors
    
    def _get_benefits_and_risks(
        self,
        strategy_id: str,
        sim_result: SimulationResult,
        risk_factors: List[str]
    ) -> Tuple[List[str], List[str]]:
        """获取策略的优势和风险"""
        summary = sim_result.summary
        
        benefits: List[str] = []
        risks: List[str] = []
        
        if strategy_id == SimulationStrategy.STABLE_EC:
            benefits.append("EC 稳定性更好，作物生长环境更一致")
            benefits.append("减少盐类积累风险")
            benefits.append("pH 调整需求可能更少")
            
            if summary.full_changes_required > 0:
                risks.append(f"需要 {summary.full_changes_required} 次换液，操作较繁琐")
            
            total_nutrient = summary.total_a_added_ml + summary.total_b_added_ml
            if total_nutrient > 100:
                risks.append(f"营养液消耗较多（约 {total_nutrient:.0f} mL）")
        
        elif strategy_id == SimulationStrategy.SAVE_NUTRIENT:
            benefits.append("营养液消耗更少，更经济")
            benefits.append("排液量少，更环保")
            
            if summary.ec_out_of_range_days > 0:
                risks.append(f"有 {summary.ec_out_of_range_days} 天 EC 可能超出目标范围")
            
            total_water = summary.total_water_added_liters
            if total_water > 20:
                risks.append(f"补水较多（约 {total_water:.1f} L）")
        
        for factor in risk_factors:
            if factor not in risks:
                risks.append(factor)
        
        return benefits, risks
    
    def get_comparison_summary(
        self,
        comparisons: Dict[str, StrategyComparison]
    ) -> Dict:
        """获取比较摘要"""
        if not comparisons:
            return {}
        
        stable = comparisons.get(SimulationStrategy.STABLE_EC)
        save = comparisons.get(SimulationStrategy.SAVE_NUTRIENT)
        
        summary = {
            "strategies": list(comparisons.keys()),
            "cost_comparison": {},
            "risk_comparison": {},
            "recommendation": None
        }
        
        if stable and save:
            cost_diff = save.estimated_cost - stable.estimated_cost
            risk_diff = save.risk_score - stable.risk_score
            
            summary["cost_comparison"] = {
                "stable_ec_cost": stable.estimated_cost,
                "save_nutrient_cost": save.estimated_cost,
                "savings": abs(cost_diff),
                "cheaper": "save_nutrient" if cost_diff < 0 else "stable_ec"
            }
            
            summary["risk_comparison"] = {
                "stable_ec_risk": stable.risk_score,
                "save_nutrient_risk": save.risk_score,
                "risk_difference": risk_diff,
                "safer": "stable_ec" if risk_diff > 0 else "save_nutrient"
            }
            
            if save.estimated_cost < stable.estimated_cost and save.risk_score < stable.risk_score + 1:
                summary["recommendation"] = "省营养液策略在成本和风险间取得较好平衡"
            elif stable.risk_score < save.risk_score - 1:
                summary["recommendation"] = "稳 EC 策略风险显著更低，建议优先考虑"
            else:
                summary["recommendation"] = "两种策略各有优劣，请根据实际情况选择"
        
        return summary
