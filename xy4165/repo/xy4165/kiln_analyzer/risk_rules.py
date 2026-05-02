import pandas as pd
import numpy as np
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import timedelta

from .data_parser import ThermocoupleData, GlazeRecipe, KilnPosition
from .curve_calculator import CurveCalculator, CurveCalculationResult, HeatingRateResult


class RiskLevel(Enum):
    """风险等级"""
    LOW = "低风险"
    MEDIUM = "中等风险"
    HIGH = "高风险"
    CRITICAL = "临界风险"


class RiskType(Enum):
    """风险类型"""
    CRACKING = "开裂风险"
    GLAZE_RUN = "流釉风险"
    UNDER_FIRED = "欠烧风险"
    OVER_FIRED = "过烧风险"
    THERMAL_SHOCK = "热震风险"


@dataclass
class RiskItem:
    """风险项"""
    risk_type: RiskType
    risk_level: RiskLevel
    description: str
    severity_score: float
    contributing_factors: Dict[str, Any]
    suggestions: List[str]


@dataclass
class GlazeRiskAssessment:
    """釉料风险评估"""
    glaze_id: str
    glaze_name: str
    position_id: str
    position_name: str
    overall_risk_level: RiskLevel
    risks: List[RiskItem]
    summary: str


@dataclass
class RiskRule:
    """风险规则定义"""
    rule_id: str
    rule_name: str
    risk_type: RiskType
    condition: Dict[str, Any]
    thresholds: Dict[str, float]
    weight: float = 1.0


class DefaultRiskRules:
    """默认风险规则库"""
    
    @staticmethod
    def get_default_rules() -> List[RiskRule]:
        """获取默认风险规则"""
        return [
            RiskRule(
                rule_id="fast_heating_cracking",
                rule_name="升温过快导致开裂",
                risk_type=RiskType.CRACKING,
                condition={"parameter": "heating_rate", "comparison": "greater_than"},
                thresholds={"medium": 150.0, "high": 200.0, "critical": 300.0},
                weight=1.2
            ),
            RiskRule(
                rule_id="fast_cooling_cracking",
                rule_name="冷却过快导致开裂",
                risk_type=RiskType.CRACKING,
                condition={"parameter": "cooling_rate", "comparison": "greater_than"},
                thresholds={"medium": -100.0, "high": -150.0, "critical": -200.0},
                weight=1.5
            ),
            RiskRule(
                rule_id="critical_range_cooling",
                rule_name="临界温度区间冷却过快",
                risk_type=RiskType.THERMAL_SHOCK,
                condition={"parameter": "cooling_rate_in_range", "comparison": "greater_than"},
                thresholds={"medium": -80.0, "high": -120.0, "critical": -160.0},
                weight=2.0
            ),
            RiskRule(
                rule_id="insufficient_holding",
                rule_name="保温时间不足导致欠烧",
                risk_type=RiskType.UNDER_FIRED,
                condition={"parameter": "holding_duration", "comparison": "less_than"},
                thresholds={"medium": 20.0, "high": 15.0, "critical": 10.0},
                weight=1.0
            ),
            RiskRule(
                rule_id="excessive_holding",
                rule_name="保温时间过长导致流釉",
                risk_type=RiskType.GLAZE_RUN,
                condition={"parameter": "holding_duration", "comparison": "greater_than"},
                thresholds={"medium": 60.0, "high": 90.0, "critical": 120.0},
                weight=1.0
            ),
            RiskRule(
                rule_id="temperature_too_high",
                rule_name="温度过高导致过烧/流釉",
                risk_type=RiskType.OVER_FIRED,
                condition={"parameter": "peak_temperature", "comparison": "greater_than"},
                thresholds={"medium": 20.0, "high": 40.0, "critical": 60.0},
                weight=1.3
            ),
            RiskRule(
                rule_id="temperature_too_low",
                rule_name="温度过低导致欠烧",
                risk_type=RiskType.UNDER_FIRED,
                condition={"parameter": "peak_temperature", "comparison": "less_than"},
                thresholds={"medium": -20.0, "high": -40.0, "critical": -60.0},
                weight=1.3
            ),
            RiskRule(
                rule_id="large_temp_variation",
                rule_name="窑位温差大导致风险",
                risk_type=RiskType.CRACKING,
                condition={"parameter": "position_temperature_diff", "comparison": "greater_than"},
                thresholds={"medium": 30.0, "high": 50.0, "critical": 80.0},
                weight=1.0
            )
        ]


class RiskAnalyzer:
    """
    风险分析器 - 根据釉料规则标记开裂/流釉风险
    
    主要功能:
    1. 基于釉料配方规则评估风险
    2. 计算升温、保温、冷却各阶段风险
    3. 标记风险等级和提供改进建议
    """
    
    def __init__(self, custom_rules: Optional[List[RiskRule]] = None):
        """
        初始化风险分析器
        
        Args:
            custom_rules: 自定义风险规则列表
        """
        self.rules = custom_rules if custom_rules else DefaultRiskRules.get_default_rules()
        self.curve_calculator = CurveCalculator()
        
    def analyze_heating_risk(self, heating_rates: HeatingRateResult,
                              glaze_rules: Dict[str, Any]) -> List[RiskItem]:
        """
        分析升温阶段风险
        
        Args:
            heating_rates: 升温速率计算结果
            glaze_rules: 釉料风险规则
            
        Returns:
            风险项列表
        """
        risks = []
        
        max_heating_rule = glaze_rules.get('max_heating_rate', 150.0)
        
        max_rate = heating_rates.max_rate
        
        if max_rate > max_heating_rule * 1.5:
            risks.append(RiskItem(
                risk_type=RiskType.CRACKING,
                risk_level=RiskLevel.HIGH,
                description=f"升温速率过高，最大达到 {max_rate:.1f} ℃/小时，超过建议值 {max_heating_rule:.1f} ℃/小时",
                severity_score=0.8,
                contributing_factors={
                    'max_heating_rate': max_rate,
                    'recommended_max': max_heating_rule,
                    'ratio': max_rate / max_heating_rule
                },
                suggestions=[
                    "建议降低升温速率，尤其是在石英相变温度区域(500-600℃)",
                    "考虑增加升温阶段的保温点",
                    "检查窑炉升温控制系统"
                ]
            ))
        elif max_rate > max_heating_rule:
            risks.append(RiskItem(
                risk_type=RiskType.CRACKING,
                risk_level=RiskLevel.MEDIUM,
                description=f"升温速率偏高，最大达到 {max_rate:.1f} ℃/小时，接近建议值上限 {max_heating_rule:.1f} ℃/小时",
                severity_score=0.4,
                contributing_factors={
                    'max_heating_rate': max_rate,
                    'recommended_max': max_heating_rule,
                    'ratio': max_rate / max_heating_rule
                },
                suggestions=[
                    "建议密切关注升温速率，考虑适当降低",
                    "注意观察坯体是否有开裂迹象"
                ]
            ))
        
        return risks
    
    def analyze_cooling_risk(self, heating_rates: HeatingRateResult,
                              glaze_rules: Dict[str, Any]) -> List[RiskItem]:
        """
        分析冷却阶段风险
        
        Args:
            heating_rates: 升温速率计算结果(包含冷却速率)
            glaze_rules: 釉料风险规则
            
        Returns:
            风险项列表
        """
        risks = []
        
        critical_cooling_range = glaze_rules.get('critical_cooling_range', [500, 300])
        max_cooling_rate = glaze_rules.get('max_cooling_rate', -100.0)
        
        min_rate = heating_rates.rates.min() if len(heating_rates.rates) > 0 else 0
        
        if min_rate < max_cooling_rate * 1.5:
            risks.append(RiskItem(
                risk_type=RiskType.THERMAL_SHOCK,
                risk_level=RiskLevel.HIGH,
                description=f"冷却速率过快，最大冷却速率达到 {abs(min_rate):.1f} ℃/小时，超过建议值",
                severity_score=0.9,
                contributing_factors={
                    'max_cooling_rate': abs(min_rate),
                    'recommended_max': abs(max_cooling_rate),
                    'critical_range': critical_cooling_range
                },
                suggestions=[
                    f"在临界冷却区间 {critical_cooling_range[0]}-{critical_cooling_range[1]}℃ 应特别注意控制冷却速率",
                    "考虑在冷却阶段增加保温点",
                    "检查窑炉冷却系统的控制"
                ]
            ))
        elif min_rate < max_cooling_rate:
            risks.append(RiskItem(
                risk_type=RiskType.CRACKING,
                risk_level=RiskLevel.MEDIUM,
                description=f"冷却速率偏快，最大冷却速率达到 {abs(min_rate):.1f} ℃/小时",
                severity_score=0.5,
                contributing_factors={
                    'max_cooling_rate': abs(min_rate),
                    'recommended_max': abs(max_cooling_rate)
                },
                suggestions=[
                    "建议控制冷却速率，尤其是在高温阶段",
                    "注意观察釉面是否有裂纹"
                ]
            ))
        
        return risks
    
    def analyze_holding_risk(self, curve_result: CurveCalculationResult,
                              glaze_profile: Dict[str, Any],
                              glaze_rules: Dict[str, Any]) -> List[RiskItem]:
        """
        分析保温阶段风险
        
        Args:
            curve_result: 曲线计算结果
            glaze_profile: 釉料烧成曲线要求
            glaze_rules: 釉料风险规则
            
        Returns:
            风险项列表
        """
        risks = []
        
        target_temp = glaze_profile.get('max_temp', 1280)
        target_holding_time = glaze_profile.get('holding_time_min', 30)
        
        holding_segments = curve_result.holding_segments
        
        if not holding_segments:
            risks.append(RiskItem(
                risk_type=RiskType.UNDER_FIRED,
                risk_level=RiskLevel.HIGH,
                description="未检测到有效的保温段，可能导致欠烧",
                severity_score=0.9,
                contributing_factors={
                    'detected_holding_segments': 0,
                    'target_holding_time': target_holding_time
                },
                suggestions=[
                    "检查窑温曲线是否完整",
                    "确认保温阶段是否设置正确",
                    "建议在目标温度增加保温时间"
                ]
            ))
        else:
            total_holding_time = sum(seg.duration_minutes for seg in holding_segments)
            avg_holding_temp = np.mean([seg.start_temp for seg in holding_segments])
            
            if total_holding_time < target_holding_time * 0.7:
                risks.append(RiskItem(
                    risk_type=RiskType.UNDER_FIRED,
                    risk_level=RiskLevel.HIGH,
                    description=f"保温时间严重不足，实际 {total_holding_time:.1f} 分钟，目标 {target_holding_time} 分钟",
                    severity_score=0.8,
                    contributing_factors={
                        'actual_holding_time': total_holding_time,
                        'target_holding_time': target_holding_time,
                        'ratio': total_holding_time / target_holding_time
                    },
                    suggestions=[
                        "大幅增加保温时间",
                        "检查保温阶段的温度控制是否稳定"
                    ]
                ))
            elif total_holding_time < target_holding_time * 0.9:
                risks.append(RiskItem(
                    risk_type=RiskType.UNDER_FIRED,
                    risk_level=RiskLevel.MEDIUM,
                    description=f"保温时间略短，实际 {total_holding_time:.1f} 分钟，目标 {target_holding_time} 分钟",
                    severity_score=0.3,
                    contributing_factors={
                        'actual_holding_time': total_holding_time,
                        'target_holding_time': target_holding_time
                    },
                    suggestions=[
                        "考虑适当增加保温时间",
                        "观察釉面熔融情况"
                    ]
                ))
            
            if total_holding_time > target_holding_time * 2.0:
                risks.append(RiskItem(
                    risk_type=RiskType.GLAZE_RUN,
                    risk_level=RiskLevel.HIGH,
                    description=f"保温时间过长，实际 {total_holding_time:.1f} 分钟，可能导致流釉",
                    severity_score=0.7,
                    contributing_factors={
                        'actual_holding_time': total_holding_time,
                        'target_holding_time': target_holding_time,
                        'ratio': total_holding_time / target_holding_time
                    },
                    suggestions=[
                        "减少保温时间",
                        "检查是否在过高温度下保温"
                    ]
                ))
            
            temp_deviation = avg_holding_temp - target_temp
            if abs(temp_deviation) > 30:
                risks.append(RiskItem(
                    risk_type=RiskType.OVER_FIRED if temp_deviation > 0 else RiskType.UNDER_FIRED,
                    risk_level=RiskLevel.HIGH,
                    description=f"保温温度偏差过大，实际 {avg_holding_temp:.1f}℃，目标 {target_temp}℃，偏差 {temp_deviation:+.1f}℃",
                    severity_score=0.85,
                    contributing_factors={
                        'actual_temp': avg_holding_temp,
                        'target_temp': target_temp,
                        'deviation': temp_deviation
                    },
                    suggestions=[
                        "校准热电偶",
                        "调整窑温控制程序",
                        "检查窑炉密封情况"
                    ]
                ))
        
        return risks
    
    def analyze_temperature_risk(self, curve_result: CurveCalculationResult,
                                  glaze_profile: Dict[str, Any]) -> List[RiskItem]:
        """
        分析温度相关风险
        
        Args:
            curve_result: 曲线计算结果
            glaze_profile: 釉料烧成曲线要求
            
        Returns:
            风险项列表
        """
        risks = []
        
        target_temp = glaze_profile.get('max_temp', 1280)
        actual_peak = curve_result.peak_temperature
        
        temp_diff = actual_peak - target_temp
        
        if temp_diff > 50:
            risks.append(RiskItem(
                risk_type=RiskType.OVER_FIRED,
                risk_level=RiskLevel.CRITICAL,
                description=f"最高温度严重过高，实际 {actual_peak:.1f}℃，目标 {target_temp}℃，高出 {temp_diff:.1f}℃",
                severity_score=1.0,
                contributing_factors={
                    'actual_peak': actual_peak,
                    'target_temp': target_temp,
                    'deviation': temp_diff
                },
                suggestions=[
                    "立即检查和校准热电偶",
                    "检查窑温控制程序",
                    "观察是否有过烧、起泡、流釉等缺陷"
                ]
            ))
        elif temp_diff > 30:
            risks.append(RiskItem(
                risk_type=RiskType.OVER_FIRED,
                risk_level=RiskLevel.HIGH,
                description=f"最高温度过高，实际 {actual_peak:.1f}℃，目标 {target_temp}℃，高出 {temp_diff:.1f}℃",
                severity_score=0.7,
                contributing_factors={
                    'actual_peak': actual_peak,
                    'target_temp': target_temp,
                    'deviation': temp_diff
                },
                suggestions=[
                    "降低最高温度设定",
                    "检查热电偶准确性"
                ]
            ))
        elif temp_diff < -50:
            risks.append(RiskItem(
                risk_type=RiskType.UNDER_FIRED,
                risk_level=RiskLevel.CRITICAL,
                description=f"最高温度严重不足，实际 {actual_peak:.1f}℃，目标 {target_temp}℃，低了 {abs(temp_diff):.1f}℃",
                severity_score=1.0,
                contributing_factors={
                    'actual_peak': actual_peak,
                    'target_temp': target_temp,
                    'deviation': temp_diff
                },
                suggestions=[
                    "检查窑炉是否达到目标温度",
                    "检查热电偶位置和准确性",
                    "延长升温时间或提高目标温度"
                ]
            ))
        elif temp_diff < -30:
            risks.append(RiskItem(
                risk_type=RiskType.UNDER_FIRED,
                risk_level=RiskLevel.HIGH,
                description=f"最高温度不足，实际 {actual_peak:.1f}℃，目标 {target_temp}℃，低了 {abs(temp_diff):.1f}℃",
                severity_score=0.7,
                contributing_factors={
                    'actual_peak': actual_peak,
                    'target_temp': target_temp,
                    'deviation': temp_diff
                },
                suggestions=[
                    "适当提高最高温度设定",
                    "检查窑炉密封性"
                ]
            ))
        
        return risks
    
    def analyze_glaze_risk(self, thermocouple_data: ThermocoupleData,
                           glaze_recipe: GlazeRecipe,
                           position: Optional[KilnPosition] = None,
                           position_temp_diff: Optional[float] = None) -> GlazeRiskAssessment:
        """
        分析单个釉料的风险
        
        Args:
            thermocouple_data: 热电偶数据
            glaze_recipe: 釉料配方
            position: 窑位信息(可选)
            position_temp_diff: 该窑位与基准的温差(可选)
            
        Returns:
            釉料风险评估
        """
        curve_result = self.curve_calculator.calculate_full_curve(
            thermocouple_data,
            glaze_recipe.firing_profile.get('max_temp')
        )
        
        all_risks = []
        
        all_risks.extend(self.analyze_heating_risk(
            curve_result.heating_rates,
            glaze_recipe.risk_rules
        ))
        
        all_risks.extend(self.analyze_cooling_risk(
            curve_result.heating_rates,
            glaze_recipe.risk_rules
        ))
        
        all_risks.extend(self.analyze_holding_risk(
            curve_result,
            glaze_recipe.firing_profile,
            glaze_recipe.risk_rules
        ))
        
        all_risks.extend(self.analyze_temperature_risk(
            curve_result,
            glaze_recipe.firing_profile
        ))
        
        if position_temp_diff and abs(position_temp_diff) > 30:
            all_risks.append(RiskItem(
                risk_type=RiskType.CRACKING,
                risk_level=RiskLevel.HIGH if abs(position_temp_diff) > 50 else RiskLevel.MEDIUM,
                description=f"该窑位温差较大，与基准温差 {position_temp_diff:+.1f}℃",
                severity_score=0.6 if abs(position_temp_diff) > 50 else 0.3,
                contributing_factors={
                    'position_temp_diff': position_temp_diff,
                    'position_name': position.name if position else '未知'
                },
                suggestions=[
                    "考虑调整窑位摆放",
                    "检查窑内气流分布",
                    "对于敏感釉料，建议放在温度更均匀的位置"
                ]
            ))
        
        if all_risks:
            max_severity = max(risk.severity_score for risk in all_risks)
            if max_severity >= 0.9:
                overall_risk = RiskLevel.CRITICAL
            elif max_severity >= 0.7:
                overall_risk = RiskLevel.HIGH
            elif max_severity >= 0.3:
                overall_risk = RiskLevel.MEDIUM
            else:
                overall_risk = RiskLevel.LOW
        else:
            overall_risk = RiskLevel.LOW
        
        summary_parts = []
        if overall_risk != RiskLevel.LOW:
            risk_types = set(risk.risk_type.value for risk in all_risks)
            summary_parts.append(f"检测到 {', '.join(risk_types)}")
        else:
            summary_parts.append("未检测到显著风险")
        
        return GlazeRiskAssessment(
            glaze_id=glaze_recipe.id,
            glaze_name=glaze_recipe.name,
            position_id=position.id if position else '',
            position_name=position.name if position else '',
            overall_risk_level=overall_risk,
            risks=all_risks,
            summary='; '.join(summary_parts)
        )
    
    def analyze_all_positions(self, thermocouples: Dict[str, ThermocoupleData],
                               positions: Dict[str, KilnPosition],
                               glaze_recipes: Dict[str, GlazeRecipe]) -> List[GlazeRiskAssessment]:
        """
        分析所有窑位的风险
        
        Args:
            thermocouples: 热电偶数据字典
            positions: 窑位数据字典
            glaze_recipes: 釉料配方字典
            
        Returns:
            风险评估列表
        """
        assessments = []
        
        if thermocouples:
            baseline_tc = next(iter(thermocouples.values()))
            baseline_peak = baseline_tc.temperatures.max()
        else:
            baseline_peak = 1280
        
        for pos_id, position in positions.items():
            tc_id = position.thermocouple_id
            
            if tc_id in thermocouples:
                tc_data = thermocouples[tc_id]
                position_peak = tc_data.temperatures.max()
                temp_diff = position_peak - baseline_peak
            else:
                continue
            
            for item in position.items:
                glaze_id = item.get('glaze_id')
                if glaze_id in glaze_recipes:
                    assessment = self.analyze_glaze_risk(
                        tc_data,
                        glaze_recipes[glaze_id],
                        position,
                        temp_diff
                    )
                    assessments.append(assessment)
        
        return assessments
    
    def get_risk_summary(self, assessments: List[GlazeRiskAssessment]) -> Dict[str, Any]:
        """
        获取风险汇总统计
        
        Args:
            assessments: 风险评估列表
            
        Returns:
            风险汇总字典
        """
        risk_counts = {
            RiskLevel.LOW.value: 0,
            RiskLevel.MEDIUM.value: 0,
            RiskLevel.HIGH.value: 0,
            RiskLevel.CRITICAL.value: 0
        }
        
        risk_type_counts = {}
        
        for assessment in assessments:
            risk_counts[assessment.overall_risk_level.value] += 1
            
            for risk in assessment.risks:
                risk_type = risk.risk_type.value
                if risk_type not in risk_type_counts:
                    risk_type_counts[risk_type] = 0
                risk_type_counts[risk_type] += 1
        
        highest_risk = RiskLevel.LOW
        for assessment in assessments:
            if assessment.overall_risk_level == RiskLevel.CRITICAL:
                highest_risk = RiskLevel.CRITICAL
                break
            elif assessment.overall_risk_level == RiskLevel.HIGH and highest_risk != RiskLevel.CRITICAL:
                highest_risk = RiskLevel.HIGH
            elif assessment.overall_risk_level == RiskLevel.MEDIUM and highest_risk == RiskLevel.LOW:
                highest_risk = RiskLevel.MEDIUM
        
        return {
            'total_assessments': len(assessments),
            'risk_distribution': risk_counts,
            'risk_type_distribution': risk_type_counts,
            'highest_risk_level': highest_risk.value,
            'has_high_risk': highest_risk in [RiskLevel.HIGH, RiskLevel.CRITICAL]
        }
