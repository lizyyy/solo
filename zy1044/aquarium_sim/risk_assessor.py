"""
风险评估和解释模块：评估水质风险并给出建议
"""
from typing import List, Dict, Any, Tuple
from .models import (
    WaterQuality, RiskAssessment, RiskLevel, Scenario,
    FishSize, FiltrationLevel
)


class RiskAssessor:
    """风险评估器"""

    # 氨氮风险阈值 (mg/L)
    AMMONIA_THRESHOLDS = {
        'safe': 0.05,
        'warning': 0.2,
        'danger': 0.5,
        'critical': 2.0
    }

    # 亚硝酸盐风险阈值 (mg/L)
    NITRITE_THRESHOLDS = {
        'safe': 0.02,
        'warning': 0.1,
        'danger': 0.3,
        'critical': 1.0
    }

    # 硝酸盐风险阈值 (mg/L)
    NITRATE_THRESHOLDS = {
        'safe': 20.0,
        'warning': 50.0,
        'danger': 80.0,
        'critical': 200.0
    }

    # pH 风险阈值
    PH_OPTIMAL_MIN = 6.5
    PH_OPTIMAL_MAX = 7.5
    PH_WARNING_MIN = 6.0
    PH_WARNING_MAX = 8.0
    PH_DANGER_MIN = 5.5
    PH_DANGER_MAX = 8.5

    @staticmethod
    def assess_daily(quality: WaterQuality, scenario: Scenario) -> RiskAssessment:
        """
        评估单日水质风险
        
        Args:
            quality: 当日水质数据
            scenario: 场景信息
            
        Returns:
            风险评估结果
        """
        ammonia_risk = RiskAssessor._assess_ammonia(quality.ammonia)
        nitrite_risk = RiskAssessor._assess_nitrite(quality.nitrite)
        nitrate_risk = RiskAssessor._assess_nitrate(quality.nitrate)

        risks = [ammonia_risk, nitrite_risk, nitrate_risk]
        overall_risk = RiskAssessor._combine_risks(risks)

        reasons = RiskAssessor._generate_reasons(
            quality, ammonia_risk, nitrite_risk, nitrate_risk, scenario
        )
        suggestions = RiskAssessor._generate_suggestions(
            quality, ammonia_risk, nitrite_risk, nitrate_risk, scenario
        )

        return RiskAssessment(
            day=quality.day,
            ammonia_risk=ammonia_risk,
            nitrite_risk=nitrite_risk,
            nitrate_risk=nitrate_risk,
            overall_risk=overall_risk,
            reasons=reasons,
            suggestions=suggestions
        )

    @staticmethod
    def _assess_ammonia(value: float) -> RiskLevel:
        """评估氨氮风险"""
        if value <= RiskAssessor.AMMONIA_THRESHOLDS['safe']:
            return RiskLevel.SAFE
        elif value <= RiskAssessor.AMMONIA_THRESHOLDS['warning']:
            return RiskLevel.WARNING
        elif value <= RiskAssessor.AMMONIA_THRESHOLDS['danger']:
            return RiskLevel.DANGER
        else:
            return RiskLevel.CRITICAL

    @staticmethod
    def _assess_nitrite(value: float) -> RiskLevel:
        """评估亚硝酸盐风险"""
        if value <= RiskAssessor.NITRITE_THRESHOLDS['safe']:
            return RiskLevel.SAFE
        elif value <= RiskAssessor.NITRITE_THRESHOLDS['warning']:
            return RiskLevel.WARNING
        elif value <= RiskAssessor.NITRITE_THRESHOLDS['danger']:
            return RiskLevel.DANGER
        else:
            return RiskLevel.CRITICAL

    @staticmethod
    def _assess_nitrate(value: float) -> RiskLevel:
        """评估硝酸盐风险"""
        if value <= RiskAssessor.NITRATE_THRESHOLDS['safe']:
            return RiskLevel.SAFE
        elif value <= RiskAssessor.NITRATE_THRESHOLDS['warning']:
            return RiskLevel.WARNING
        elif value <= RiskAssessor.NITRATE_THRESHOLDS['danger']:
            return RiskLevel.DANGER
        else:
            return RiskLevel.CRITICAL

    @staticmethod
    def _combine_risks(risks: List[RiskLevel]) -> RiskLevel:
        """合并多个风险等级，取最高风险"""
        risk_order = [RiskLevel.SAFE, RiskLevel.WARNING, RiskLevel.DANGER, RiskLevel.CRITICAL]
        max_index = 0
        for risk in risks:
            idx = risk_order.index(risk)
            if idx > max_index:
                max_index = idx
        return risk_order[max_index]

    @staticmethod
    def _generate_reasons(
        quality: WaterQuality,
        ammonia_risk: RiskLevel,
        nitrite_risk: RiskLevel,
        nitrate_risk: RiskLevel,
        scenario: Scenario
    ) -> List[str]:
        """生成风险原因"""
        reasons = []

        if ammonia_risk != RiskLevel.SAFE:
            reasons.append(
                f"氨氮浓度 {quality.ammonia:.4f} mg/L {RiskAssessor._risk_to_text(ammonia_risk)}，"
                f"安全阈值为 {RiskAssessor.AMMONIA_THRESHOLDS['safe']} mg/L"
            )

        if nitrite_risk != RiskLevel.SAFE:
            reasons.append(
                f"亚硝酸盐浓度 {quality.nitrite:.4f} mg/L {RiskAssessor._risk_to_text(nitrite_risk)}，"
                f"安全阈值为 {RiskAssessor.NITRITE_THRESHOLDS['safe']} mg/L"
            )

        if nitrate_risk != RiskLevel.SAFE:
            reasons.append(
                f"硝酸盐浓度 {quality.nitrate:.2f} mg/L {RiskAssessor._risk_to_text(nitrate_risk)}，"
                f"安全阈值为 {RiskAssessor.NITRATE_THRESHOLDS['safe']} mg/L"
            )

        if quality.ph < RiskAssessor.PH_OPTIMAL_MIN or quality.ph > RiskAssessor.PH_OPTIMAL_MAX:
            reasons.append(
                f"pH 值 {quality.ph} 偏离最佳范围 ({RiskAssessor.PH_OPTIMAL_MIN}-{RiskAssessor.PH_OPTIMAL_MAX})"
            )

        if not reasons:
            reasons.append("各项水质指标均在安全范围内")

        return reasons

    @staticmethod
    def _generate_suggestions(
        quality: WaterQuality,
        ammonia_risk: RiskLevel,
        nitrite_risk: RiskLevel,
        nitrate_risk: RiskLevel,
        scenario: Scenario
    ) -> List[str]:
        """生成建议"""
        suggestions = []

        if ammonia_risk in [RiskLevel.WARNING, RiskLevel.DANGER, RiskLevel.CRITICAL]:
            suggestions.append("建议减少喂食量或暂停喂食 1-2 天")
            suggestions.append("检查过滤系统是否正常运行，必要时增加过滤")

        if nitrite_risk in [RiskLevel.WARNING, RiskLevel.DANGER, RiskLevel.CRITICAL]:
            suggestions.append("亚硝酸盐偏高表明硝化系统可能未完全建立或超负荷")
            suggestions.append("建议添加硝化细菌，或增加有益菌补充")

        if nitrate_risk in [RiskLevel.WARNING, RiskLevel.DANGER, RiskLevel.CRITICAL]:
            suggestions.append("硝酸盐积累过多，建议定期换水降低浓度")
            if nitrate_risk == RiskLevel.CRITICAL:
                suggestions.append("紧急情况：建议每天换水 20-30%，连续 3-5 天")

        if ammonia_risk == RiskLevel.CRITICAL or nitrite_risk == RiskLevel.CRITICAL:
            suggestions.append("⚠️ 危险！建议立即换水 20-30%，并持续监测水质")
            suggestions.append("考虑使用水质稳定剂或应急处理产品")

        if scenario.filtration_level == FiltrationLevel.LOW:
            if ammonia_risk != RiskLevel.SAFE or nitrite_risk != RiskLevel.SAFE:
                suggestions.append("当前过滤能力较低，建议升级过滤系统或增加过滤材料")

        if not suggestions:
            suggestions.append("继续保持当前的饲养和换水习惯")

        return suggestions

    @staticmethod
    def _risk_to_text(risk: RiskLevel) -> str:
        """将风险等级转换为文本描述"""
        mapping = {
            RiskLevel.SAFE: "安全",
            RiskLevel.WARNING: "偏高",
            RiskLevel.DANGER: "危险",
            RiskLevel.CRITICAL: "极危险"
        }
        return mapping.get(risk, "未知")

    @staticmethod
    def assess_all(
        daily_quality: List[WaterQuality],
        scenario: Scenario,
        summary: Dict[str, Any]
    ) -> Tuple[List[RiskAssessment], Dict[str, Any]]:
        """
        评估所有天数的水质风险，并生成总体评估
        
        Args:
            daily_quality: 每日水质数据
            scenario: 场景信息
            summary: 模拟摘要
            
        Returns:
            Tuple[每日风险评估列表, 总体评估摘要]
        """
        daily_risks = []
        for quality in daily_quality:
            risk = RiskAssessor.assess_daily(quality, scenario)
            daily_risks.append(risk)

        overall_summary = RiskAssessor._generate_overall_summary(
            daily_risks, scenario, summary
        )

        return daily_risks, overall_summary

    @staticmethod
    def _generate_overall_summary(
        daily_risks: List[RiskAssessment],
        scenario: Scenario,
        simulation_summary: Dict[str, Any]
    ) -> Dict[str, Any]:
        """生成总体评估摘要"""
        if not daily_risks:
            return {}

        max_risk = RiskAssessor._combine_risks([r.overall_risk for r in daily_risks])

        danger_days = sum(1 for r in daily_risks if r.overall_risk in [RiskLevel.DANGER, RiskLevel.CRITICAL])
        warning_days = sum(1 for r in daily_risks if r.overall_risk == RiskLevel.WARNING)
        safe_days = sum(1 for r in daily_risks if r.overall_risk == RiskLevel.SAFE)

        first_danger_day = None
        for r in daily_risks:
            if r.overall_risk in [RiskLevel.DANGER, RiskLevel.CRITICAL]:
                first_danger_day = r.day
                break

        high_risk_factors = RiskAssessor._identify_high_risk_factors(
            daily_risks, scenario, simulation_summary
        )

        overall_suggestions = RiskAssessor._generate_overall_suggestions(
            daily_risks, scenario, simulation_summary, high_risk_factors
        )

        return {
            'max_risk': max_risk.value,
            'max_risk_text': RiskAssessor._risk_to_text(max_risk),
            'safe_days': safe_days,
            'warning_days': warning_days,
            'danger_days': danger_days,
            'critical_days': sum(1 for r in daily_risks if r.overall_risk == RiskLevel.CRITICAL),
            'first_danger_day': first_danger_day,
            'high_risk_factors': high_risk_factors,
            'overall_suggestions': overall_suggestions,
            'simulation_summary': simulation_summary
        }

    @staticmethod
    def _identify_high_risk_factors(
        daily_risks: List[RiskAssessment],
        scenario: Scenario,
        summary: Dict[str, Any]
    ) -> List[str]:
        """识别高风险因素"""
        factors = []

        ammonia_danger = any(r.ammonia_risk in [RiskLevel.DANGER, RiskLevel.CRITICAL] for r in daily_risks)
        nitrite_danger = any(r.nitrite_risk in [RiskLevel.DANGER, RiskLevel.CRITICAL] for r in daily_risks)
        nitrate_danger = any(r.nitrate_risk in [RiskLevel.DANGER, RiskLevel.CRITICAL] for r in daily_risks)

        if ammonia_danger:
            factors.append("氨氮浓度高风险 - 可能由喂食过量或过滤不足导致")
        if nitrite_danger:
            factors.append("亚硝酸盐高风险 - 硝化系统可能未成熟或超负荷")
        if nitrate_danger:
            factors.append("硝酸盐高风险 - 换水频率不足或生物负载过高")

        total_fish = sum(f.quantity for f in scenario.fish)
        bioload = RiskAssessor._calculate_bioload(scenario)
        if bioload > scenario.tank_volume * 0.5:
            factors.append("生物负载相对鱼缸体积偏高")

        if total_fish > 0:
            feeding_per_fish = scenario.daily_feeding_amount / total_fish
            if feeding_per_fish > 0.3:
                factors.append("喂食量相对鱼的数量偏高")

        if scenario.filtration_level == FiltrationLevel.LOW:
            if ammonia_danger or nitrite_danger:
                factors.append("过滤能力偏低，无法有效处理当前生物负载")

        water_change_days = set(wc.day for wc in scenario.water_changes)
        expected_water_changes = summary['simulation_days'] // 7
        if len(water_change_days) < expected_water_changes:
            factors.append("换水频率低于建议的每周一次")

        return factors

    @staticmethod
    def _calculate_bioload(scenario: Scenario) -> float:
        """计算生物负载"""
        load = 0.0
        for fish in scenario.fish:
            if fish.size == FishSize.SMALL:
                load += fish.quantity * 1.0
            elif fish.size == FishSize.MEDIUM:
                load += fish.quantity * 3.0
            elif fish.size == FishSize.LARGE:
                load += fish.quantity * 8.0
        return load

    @staticmethod
    def _generate_overall_suggestions(
        daily_risks: List[RiskAssessment],
        scenario: Scenario,
        summary: Dict[str, Any],
        high_risk_factors: List[str]
    ) -> List[str]:
        """生成总体建议"""
        suggestions = []

        max_risk = RiskAssessor._combine_risks([r.overall_risk for r in daily_risks])

        if max_risk == RiskLevel.CRITICAL:
            suggestions.append("⚠️ 紧急：存在极高风险天数，建议立即采取行动")
            suggestions.append("建议：每天换水 20-30%，连续 3-5 天，密切监测水质")
        elif max_risk == RiskLevel.DANGER:
            suggestions.append("存在危险天数，建议调整饲养方式")
            suggestions.append("建议：增加换水频率，考虑减少喂食量")
        elif max_risk == RiskLevel.WARNING:
            suggestions.append("存在一些偏高的指标，建议优化饲养习惯")
        else:
            suggestions.append("整体风险可控，继续保持良好的饲养习惯")

        water_change_count = len(scenario.water_changes)
        simulation_days = summary.get('simulation_days', 14)
        recommended_changes = max(1, simulation_days // 7)

        if water_change_count < recommended_changes:
            suggestions.append(
                f"建议增加换水频率：模拟期 {simulation_days} 天内应至少换水 {recommended_changes} 次"
            )

        if scenario.daily_feeding_amount > 0:
            suggestions.append("建议：喂食后观察 5 分钟，如有剩余饲料及时吸出")
            suggestions.append("建议：每周至少停喂一天，帮助消化系统清理")

        if max_risk in [RiskLevel.DANGER, RiskLevel.CRITICAL]:
            suggestions.append("建议：考虑测试水质稳定剂或硝化细菌产品")
            suggestions.append("建议：如有异常行为（浮头、不进食等），及时咨询专业人士")

        return suggestions
