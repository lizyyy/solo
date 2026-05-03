#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
风险规则模块 - Risk Rules Module

风险检测与评估：
- RiskRule: 风险规则基类
- VoltageLimitRule: 电压超限检测
- CurrentMismatchRule: 电流不匹配检测
- CableLossRule: 线损过高检测
- RiskAssessor: 风险综合评估器
"""

from typing import Dict, List, Optional, Tuple, Any, Union, Callable
from dataclasses import dataclass, asdict, field
from enum import Enum
from abc import ABC, abstractmethod
import math

from pvchecker import PVModule, InverterMPPT, StringConfig, RiskItem
from pvchecker.pvcalc import (
    TemperatureCorrector,
    ShadingCalculator,
    CableLossCalculator,
    CableLossResult
)
from pvchecker.solver import ConfigurationSolution


class RiskLevel(Enum):
    """风险等级"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskCategory(Enum):
    """风险类别"""
    VOLTAGE = "voltage"
    CURRENT = "current"
    CABLE = "cable"
    SHADING = "shading"
    MPPT = "mppt"


@dataclass
class RiskThreshold:
    """风险阈值配置"""
    warning: float
    critical: float
    description: str = ""


class RiskRule(ABC):
    """风险规则基类
    
    所有风险检测规则都需要继承此类并实现评估方法。
    """
    
    def __init__(
        self,
        rule_name: str,
        category: RiskCategory,
        thresholds: Optional[RiskThreshold] = None
    ):
        """
        Args:
            rule_name: 规则名称
            category: 风险类别
            thresholds: 风险阈值配置
        """
        self._rule_name = rule_name
        self._category = category
        self._thresholds = thresholds or RiskThreshold(
            warning=10.0,
            critical=20.0,
            description="默认阈值"
        )
        self._last_result: Optional[Dict] = None
    
    @property
    def rule_name(self) -> str:
        """获取规则名称"""
        return self._rule_name
    
    @property
    def category(self) -> RiskCategory:
        """获取风险类别"""
        return self._category
    
    @property
    def thresholds(self) -> RiskThreshold:
        """获取阈值配置"""
        return self._thresholds
    
    @abstractmethod
    def evaluate(self, **kwargs) -> Tuple[bool, RiskLevel, str]:
        """评估风险
        
        Returns:
            (是否触发风险, 风险等级, 描述信息)
        """
        pass
    
    @abstractmethod
    def get_risk_item(self, **kwargs) -> Optional[RiskItem]:
        """获取风险项对象
        
        Returns:
            RiskItem对象，如果没有风险则返回None
        """
        pass
    
    def _calculate_risk_score(
        self, 
        value: float, 
        threshold: RiskThreshold
    ) -> Tuple[RiskLevel, float]:
        """根据值和阈值计算风险等级和分数
        
        分数范围：0-100，越高风险越大
        """
        if value <= 0:
            return RiskLevel.LOW, 0.0
        
        if value >= threshold.critical:
            excess_ratio = (value - threshold.critical) / max(1, threshold.critical)
            score = 80.0 + min(20.0, excess_ratio * 20.0)
            return RiskLevel.CRITICAL, score
        
        if value >= threshold.warning:
            ratio = (value - threshold.warning) / (threshold.critical - threshold.warning)
            score = 50.0 + ratio * 30.0
            return RiskLevel.HIGH, score
        
        if value >= threshold.warning * 0.7:
            ratio = value / threshold.warning
            score = 20.0 + ratio * 30.0
            return RiskLevel.MEDIUM, score
        
        ratio = value / (threshold.warning * 0.7) if threshold.warning > 0 else 0
        score = ratio * 20.0
        return RiskLevel.LOW, score
    
    def suggest_action(self, risk_level: RiskLevel, **kwargs) -> str:
        """根据风险等级提供建议措施"""
        if risk_level == RiskLevel.LOW:
            return "当前风险较低，建议定期监测"
        elif risk_level == RiskLevel.MEDIUM:
            return "建议关注此风险，考虑调整相关参数"
        elif risk_level == RiskLevel.HIGH:
            return "建议尽快调整配置，降低风险"
        elif risk_level == RiskLevel.CRITICAL:
            return "严重风险！必须立即调整配置，否则可能造成设备损坏"
        return "请评估具体情况"


class VoltageLimitRule(RiskRule):
    """电压超限风险检测规则
    
    检测低温下组串开路电压是否超过逆变器最大直流输入电压。
    
    风险原因：
    1. 低温环境下，光伏组件开路电压升高
    2. 串联块数过多导致总电压超限
    3. 可能损坏逆变器或造成安全隐患
    
    检测逻辑：
    - 计算最低环境温度下的组串开路电压
    - 与逆变器最大直流输入电压比较
    - 计算电压裕度百分比
    """
    
    DEFAULT_THRESHOLDS = RiskThreshold(
        warning=5.0,
        critical=0.0,
        description="电压裕度百分比（负值表示超限）"
    )
    
    def __init__(self, thresholds: Optional[RiskThreshold] = None):
        super().__init__(
            rule_name="低温开路电压超限风险",
            category=RiskCategory.VOLTAGE,
            thresholds=thresholds or self.DEFAULT_THRESHOLDS
        )
        self._temp_corrector: Optional[TemperatureCorrector] = None
    
    def evaluate(
        self,
        module: PVModule,
        inverter: InverterMPPT,
        modules_per_string: int,
        min_temp: float = -10.0,
        **kwargs
    ) -> Tuple[bool, RiskLevel, str]:
        """评估电压超限风险
        
        Args:
            module: 光伏组件参数
            inverter: 逆变器参数
            modules_per_string: 每串组件数
            min_temp: 最低环境温度 (°C)
            
        Returns:
            (是否触发风险, 风险等级, 描述信息)
        """
        self._temp_corrector = TemperatureCorrector(module)
        
        voc_low_temp = self._temp_corrector.get_low_temp_voc(min_temp)
        string_voc_low_temp = voc_low_temp * modules_per_string
        
        inverter_max_v = inverter.v_max
        
        voltage_margin = inverter_max_v - string_voc_low_temp
        voltage_margin_percent = (voltage_margin / inverter_max_v) * 100
        
        self._last_result = {
            'string_voc_low_temp': string_voc_low_temp,
            'inverter_max_v': inverter_max_v,
            'voltage_margin': voltage_margin,
            'voltage_margin_percent': voltage_margin_percent,
            'min_temp': min_temp,
            'modules_per_string': modules_per_string
        }
        
        if voltage_margin_percent <= 0:
            risk_level = RiskLevel.CRITICAL
            is_risky = True
            message = (f"低温({min_temp}°C)下组串开路电压 {string_voc_low_temp:.1f}V "
                      f"超过逆变器最大输入电压 {inverter_max_v:.1f}V，"
                      f"超限 {abs(voltage_margin_percent):.1f}%")
        elif voltage_margin_percent < self._thresholds.warning:
            risk_level = RiskLevel.HIGH
            is_risky = True
            message = (f"低温({min_temp}°C)下电压裕度不足，仅 {voltage_margin_percent:.1f}%，"
                      f"建议减少串联块数")
        else:
            risk_level = RiskLevel.LOW
            is_risky = False
            message = (f"低温({min_temp}°C)下电压裕度充足，为 {voltage_margin_percent:.1f}%")
        
        return is_risky, risk_level, message
    
    def get_risk_item(
        self,
        module: PVModule,
        inverter: InverterMPPT,
        modules_per_string: int,
        min_temp: float = -10.0,
        **kwargs
    ) -> Optional[RiskItem]:
        """获取电压超限风险项"""
        is_risky, risk_level, message = self.evaluate(
            module=module,
            inverter=inverter,
            modules_per_string=modules_per_string,
            min_temp=min_temp
        )
        
        if not is_risky and self._last_result:
            margin_pct = self._last_result.get('voltage_margin_percent', 100)
            if margin_pct < self._thresholds.warning * 1.5:
                pass
            else:
                return None
        
        if not self._last_result:
            return None
        
        _, risk_score = self._calculate_risk_score(
            -self._last_result['voltage_margin_percent'] 
            if self._last_result['voltage_margin_percent'] < 0 else 0,
            self._thresholds
        )
        
        suggested_action = self.suggest_action(risk_level)
        if risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            suggested_action = (
                f"建议减少串联块数。当前每串 {modules_per_string} 块，"
                f"建议减少至最多 {self._calculate_safe_modules(module, inverter, min_temp)} 块"
            )
        
        return RiskItem(
            rule_name=self._rule_name,
            severity=risk_level.value,
            message=message,
            affected_components=[f"组串（每串{modules_per_string}块）"],
            suggested_action=suggested_action,
            risk_score=risk_score
        )
    
    def _calculate_safe_modules(
        self, 
        module: PVModule, 
        inverter: InverterMPPT, 
        min_temp: float
    ) -> int:
        """计算安全的串联块数"""
        if not self._temp_corrector:
            self._temp_corrector = TemperatureCorrector(module)
        
        voc_low_temp = self._temp_corrector.get_low_temp_voc(min_temp)
        
        safe_modules = int(math.floor(inverter.v_max / voc_low_temp * 0.95))
        
        return max(1, safe_modules)
    
    def evaluate_solution(
        self,
        solution: ConfigurationSolution,
        inverter: InverterMPPT,
        module: PVModule
    ) -> Optional[RiskItem]:
        """从方案对象评估电压风险"""
        return self.get_risk_item(
            module=module,
            inverter=inverter,
            modules_per_string=solution.modules_per_string,
            min_temp=-10.0
        )


class CurrentMismatchRule(RiskRule):
    """电流不匹配风险检测规则
    
    检测并联组串间的电流不匹配风险。
    
    风险原因：
    1. 不同组串遮挡情况不同
    2. 组件老化程度差异
    3. 不同朝向或倾角
    4. 组串规格不一致
    
    检测逻辑：
    - 计算各组串的短路电流（或最大功率点电流）
    - 计算最大电流差异百分比
    - 与阈值比较
    """
    
    DEFAULT_THRESHOLDS = RiskThreshold(
        warning=10.0,
        critical=20.0,
        description="电流差异百分比"
    )
    
    def __init__(self, thresholds: Optional[RiskThreshold] = None):
        super().__init__(
            rule_name="并联组串电流不匹配风险",
            category=RiskCategory.CURRENT,
            thresholds=thresholds or self.DEFAULT_THRESHOLDS
        )
    
    def evaluate(
        self,
        string_currents: List[float],
        **kwargs
    ) -> Tuple[bool, RiskLevel, str]:
        """评估电流不匹配风险
        
        Args:
            string_currents: 各组串的电流列表
            
        Returns:
            (是否触发风险, 风险等级, 描述信息)
        """
        if len(string_currents) < 2:
            self._last_result = {
                'string_currents': string_currents,
                'max_diff_percent': 0.0,
                'note': '单路串，无并联不匹配风险'
            }
            return False, RiskLevel.LOW, "单路串，无并联不匹配风险"
        
        min_current = min(string_currents)
        max_current = max(string_currents)
        
        if max_current <= 0:
            self._last_result = {
                'string_currents': string_currents,
                'max_diff_percent': 0.0,
                'note': '电流为0'
            }
            return False, RiskLevel.LOW, "电流为0，无法评估"
        
        max_diff_percent = ((max_current - min_current) / max_current) * 100
        
        self._last_result = {
            'string_currents': string_currents,
            'min_current': min_current,
            'max_current': max_current,
            'max_diff_percent': max_diff_percent,
            'string_count': len(string_currents)
        }
        
        if max_diff_percent >= self._thresholds.critical:
            risk_level = RiskLevel.CRITICAL
            is_risky = True
            message = (f"并联组串电流差异严重，达 {max_diff_percent:.1f}%，"
                      f"最小电流 {min_current:.2f}A，最大电流 {max_current:.2f}A")
        elif max_diff_percent >= self._thresholds.warning:
            risk_level = RiskLevel.HIGH
            is_risky = True
            message = (f"并联组串电流差异较大，达 {max_diff_percent:.1f}%，"
                      f"建议检查各组串遮挡情况")
        else:
            risk_level = RiskLevel.LOW
            is_risky = False
            message = (f"并联组串电流差异正常，为 {max_diff_percent:.1f}%")
        
        return is_risky, risk_level, message
    
    def evaluate_from_shading(
        self,
        string_shading_factors: List[List[float]],
        module: PVModule,
        temperature: float = 25.0
    ) -> Tuple[bool, RiskLevel, str]:
        """从遮挡系数估算电流不匹配
        
        Args:
            string_shading_factors: 各组串的遮挡系数列表的列表
            module: 光伏组件参数
            temperature: 电池温度
            
        Returns:
            (是否触发风险, 风险等级, 描述信息)
        """
        string_currents = []
        temp_corrector = TemperatureCorrector(module)
        temp_params = temp_corrector.calculate(temperature)
        
        for shading_factors in string_shading_factors:
            if not shading_factors:
                continue
            min_shading = min(shading_factors)
            estimated_current = temp_params.isc * min_shading
            string_currents.append(estimated_current)
        
        return self.evaluate(string_currents=string_currents)
    
    def get_risk_item(
        self,
        string_currents: List[float],
        **kwargs
    ) -> Optional[RiskItem]:
        """获取电流不匹配风险项"""
        is_risky, risk_level, message = self.evaluate(string_currents=string_currents)
        
        if not is_risky:
            return None
        
        if not self._last_result:
            return None
        
        _, risk_score = self._calculate_risk_score(
            self._last_result['max_diff_percent'],
            self._thresholds
        )
        
        suggested_action = self.suggest_action(risk_level)
        if risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            suggested_action = (
                "建议检查各组串的遮挡情况，考虑将遮挡严重的组串分开连接到不同的MPPT通道；"
                "如各组串朝向/倾角不同，也建议分开连接"
            )
        
        return RiskItem(
            rule_name=self._rule_name,
            severity=risk_level.value,
            message=message,
            affected_components=[f"并联组串（共{len(string_currents)}路）"],
            suggested_action=suggested_action,
            risk_score=risk_score
        )


class CableLossRule(RiskRule):
    """线缆损失过高风险检测规则
    
    检测线缆压降和功率损失是否过高。
    
    风险原因：
    1. 线缆过长
    2. 线缆截面积过小
    3. 工作电流过大
    4. 接头接触不良
    
    行业标准：
    - 直流侧压降建议 < 2%
    - 交流侧压降建议 < 1%
    - 总压降建议 < 3%
    """
    
    DEFAULT_THRESHOLDS = RiskThreshold(
        warning=2.0,
        critical=5.0,
        description="线缆压降百分比"
    )
    
    def __init__(self, thresholds: Optional[RiskThreshold] = None):
        super().__init__(
            rule_name="线缆压降过高风险",
            category=RiskCategory.CABLE,
            thresholds=thresholds or self.DEFAULT_THRESHOLDS
        )
        self._cable_calc = CableLossCalculator('copper')
    
    def evaluate(
        self,
        cable_loss_result: CableLossResult,
        **kwargs
    ) -> Tuple[bool, RiskLevel, str]:
        """评估线缆损失风险
        
        Args:
            cable_loss_result: 线缆损失计算结果
            
        Returns:
            (是否触发风险, 风险等级, 描述信息)
        """
        drop_percent = cable_loss_result.voltage_drop_percent
        power_loss_percent = cable_loss_result.power_loss_percent
        
        self._last_result = {
            'voltage_drop_percent': drop_percent,
            'power_loss_percent': power_loss_percent,
            'cable_length': cable_loss_result.cable_length,
            'cross_section': cable_loss_result.cross_section,
            'current': cable_loss_result.current
        }
        
        if drop_percent >= self._thresholds.critical:
            risk_level = RiskLevel.CRITICAL
            is_risky = True
            message = (f"线缆压降严重，达 {drop_percent:.2f}%，"
                      f"功率损失 {power_loss_percent:.2f}%，"
                      f"将显著影响发电收益")
        elif drop_percent >= self._thresholds.warning:
            risk_level = RiskLevel.HIGH
            is_risky = True
            message = (f"线缆压降较高，达 {drop_percent:.2f}%，"
                      f"功率损失 {power_loss_percent:.2f}%，"
                      f"建议增大线缆截面积")
        else:
            risk_level = RiskLevel.LOW
            is_risky = False
            message = (f"线缆压降正常，为 {drop_percent:.2f}%，"
                      f"功率损失 {power_loss_percent:.2f}%")
        
        return is_risky, risk_level, message
    
    def evaluate_direct(
        self,
        current: float,
        voltage: float,
        cable_length: float,
        cross_section: float,
        round_trip: bool = True,
        wire_type: str = 'copper'
    ) -> Tuple[bool, RiskLevel, str]:
        """直接从参数评估线缆风险
        
        Args:
            current: 工作电流 (A)
            voltage: 工作电压 (V)
            cable_length: 线缆长度 (m)
            cross_section: 线缆截面积 (mm²)
            round_trip: 是否为往返距离
            wire_type: 线缆类型 ('copper' 或 'aluminum')
            
        Returns:
            (是否触发风险, 风险等级, 描述信息)
        """
        calc = CableLossCalculator(wire_type)
        result = calc.calculate(
            current=current,
            voltage=voltage,
            cable_length=cable_length,
            cross_section=cross_section,
            round_trip=round_trip
        )
        return self.evaluate(cable_loss_result=result)
    
    def get_risk_item(
        self,
        cable_loss_result: CableLossResult,
        **kwargs
    ) -> Optional[RiskItem]:
        """获取线缆损失风险项"""
        is_risky, risk_level, message = self.evaluate(cable_loss_result=cable_loss_result)
        
        if not is_risky:
            return None
        
        if not self._last_result:
            return None
        
        _, risk_score = self._calculate_risk_score(
            self._last_result['voltage_drop_percent'],
            self._thresholds
        )
        
        suggested_action = self.suggest_action(risk_level)
        if risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            current = self._last_result['current']
            voltage = self._last_result.get('voltage', 400)
            
            recommendation = self._cable_calc.recommend_cable_size(
                current=current,
                voltage=voltage,
                cable_length=self._last_result['cable_length'] / 2,
                max_voltage_drop_percent=2.0
            )
            
            suggested_action = (
                f"建议增大线缆截面积。当前使用 {self._last_result['cross_section']}mm²，"
                f"推荐使用 {recommendation['recommended_size']}mm² 或更大规格；"
                f"如条件允许，也可缩短线缆长度或增加并联路数"
            )
        
        return RiskItem(
            rule_name=self._rule_name,
            severity=risk_level.value,
            message=message,
            affected_components=[f"线缆({self._last_result['cross_section']}mm²)"],
            suggested_action=suggested_action,
            risk_score=risk_score
        )


class ShadingRiskRule(RiskRule):
    """遮挡损失过高风险检测规则
    
    检测组串遮挡损失是否过高。
    """
    
    DEFAULT_THRESHOLDS = RiskThreshold(
        warning=5.0,
        critical=10.0,
        description="遮挡损失百分比"
    )
    
    def __init__(self, thresholds: Optional[RiskThreshold] = None):
        super().__init__(
            rule_name="遮挡损失过高风险",
            category=RiskCategory.SHADING,
            thresholds=thresholds or self.DEFAULT_THRESHOLDS
        )
    
    def evaluate(
        self,
        shading_loss_percent: float,
        **kwargs
    ) -> Tuple[bool, RiskLevel, str]:
        """评估遮挡损失风险"""
        self._last_result = {
            'shading_loss_percent': shading_loss_percent
        }
        
        if shading_loss_percent >= self._thresholds.critical:
            risk_level = RiskLevel.HIGH
            is_risky = True
            message = (f"遮挡损失严重，达 {shading_loss_percent:.1f}%，"
                      f"将显著影响发电收益")
        elif shading_loss_percent >= self._thresholds.warning:
            risk_level = RiskLevel.MEDIUM
            is_risky = True
            message = (f"遮挡损失较高，达 {shading_loss_percent:.1f}%，"
                      f"建议检查组件布局")
        else:
            risk_level = RiskLevel.LOW
            is_risky = False
            message = (f"遮挡损失正常，为 {shading_loss_percent:.1f}%")
        
        return is_risky, risk_level, message
    
    def get_risk_item(
        self,
        shading_loss_percent: float,
        **kwargs
    ) -> Optional[RiskItem]:
        """获取遮挡损失风险项"""
        is_risky, risk_level, message = self.evaluate(shading_loss_percent=shading_loss_percent)
        
        if not is_risky:
            return None
        
        _, risk_score = self._calculate_risk_score(
            shading_loss_percent,
            self._thresholds
        )
        
        suggested_action = (
            "建议检查组件遮挡情况，考虑：1) 调整组件安装位置避开遮挡物；"
            "2) 增加组串并联路数减少单串受影响程度；"
            "3) 如为季节性遮挡，可根据季节调整运维策略"
        )
        
        return RiskItem(
            rule_name=self._rule_name,
            severity=risk_level.value,
            message=message,
            affected_components=["受遮挡的组件/组串"],
            suggested_action=suggested_action,
            risk_score=risk_score
        )


class RiskAssessor:
    """风险综合评估器
    
    综合所有风险规则，对方案进行全面风险评估。
    """
    
    def __init__(
        self,
        custom_rules: Optional[List[RiskRule]] = None
    ):
        """
        Args:
            custom_rules: 自定义风险规则列表，None表示使用默认规则
        """
        self._rules: List[RiskRule] = custom_rules or [
            VoltageLimitRule(),
            CurrentMismatchRule(),
            CableLossRule(),
            ShadingRiskRule()
        ]
        
        self._last_risks: List[RiskItem] = []
    
    @property
    def rules(self) -> List[RiskRule]:
        """获取所有风险规则"""
        return self._rules
    
    def add_rule(self, rule: RiskRule):
        """添加自定义规则"""
        self._rules.append(rule)
    
    def assess_solution(
        self,
        solution: ConfigurationSolution,
        module: PVModule,
        inverter: InverterMPPT,
        string_shading_factors: Optional[List[List[float]]] = None,
        min_temp: float = -10.0
    ) -> List[RiskItem]:
        """评估方案的所有风险
        
        Args:
            solution: 方案配置
            module: 组件参数
            inverter: 逆变器参数
            string_shading_factors: 各组串的遮挡系数列表（可选）
            min_temp: 最低环境温度
            
        Returns:
            RiskItem列表
        """
        risks: List[RiskItem] = []
        
        for rule in self._rules:
            if isinstance(rule, VoltageLimitRule):
                risk = rule.get_risk_item(
                    module=module,
                    inverter=inverter,
                    modules_per_string=solution.modules_per_string,
                    min_temp=min_temp
                )
                if risk:
                    risks.append(risk)
            
            elif isinstance(rule, CurrentMismatchRule):
                if string_shading_factors and len(string_shading_factors) >= 2:
                    is_risky, risk_level, message = rule.evaluate_from_shading(
                        string_shading_factors=string_shading_factors,
                        module=module
                    )
                    if is_risky:
                        risk = rule.get_risk_item(
                            string_currents=[
                                min(sf) * module.isc if sf else module.isc
                                for sf in string_shading_factors
                            ]
                        )
                        if risk:
                            risks.append(risk)
            
            elif isinstance(rule, CableLossRule):
                risk = rule.get_risk_item(
                    CableLossResult(
                        cable_length=solution.cable_config.get('estimated_length', 50.0),
                        cross_section=solution.cable_config.get('recommended_cross_section', 6.0),
                        current=solution.estimated_i_mp / solution.strings_in_parallel 
                        if solution.strings_in_parallel > 0 else 0,
                        voltage_drop=solution.estimated_cable_loss_percent * solution.estimated_v_mp / 100,
                        voltage_drop_percent=solution.estimated_cable_loss_percent,
                        power_loss=solution.estimated_total_power * solution.estimated_cable_loss_percent / 100,
                        power_loss_percent=solution.estimated_cable_loss_percent,
                        wire_type='copper'
                    )
                )
                if risk:
                    risks.append(risk)
            
            elif isinstance(rule, ShadingRiskRule):
                risk = rule.get_risk_item(
                    shading_loss_percent=solution.estimated_shading_loss_percent
                )
                if risk:
                    risks.append(risk)
        
        self._last_risks = risks
        return risks
    
    def assess_all(
        self,
        solutions: List[ConfigurationSolution],
        module: PVModule,
        inverter: InverterMPPT,
        string_shading_factors: Optional[List[List[float]]] = None,
        min_temp: float = -10.0
    ) -> Dict[str, List[RiskItem]]:
        """评估所有方案的风险
        
        Returns:
            方案ID到风险列表的映射
        """
        results = {}
        for solution in solutions:
            risks = self.assess_solution(
                solution=solution,
                module=module,
                inverter=inverter,
                string_shading_factors=string_shading_factors,
                min_temp=min_temp
            )
            results[solution.solution_id] = risks
        
        return results
    
    def get_summary(self, risks: List[RiskItem]) -> Dict[str, Any]:
        """获取风险摘要
        
        Args:
            risks: 风险项列表
            
        Returns:
            包含风险统计的摘要字典
        """
        if not risks:
            return {
                'total_risks': 0,
                'by_severity': {
                    'critical': 0,
                    'high': 0,
                    'medium': 0,
                    'low': 0
                },
                'highest_risk': None,
                'overall_status': 'ok',
                'recommendations': []
            }
        
        severity_counts = {
            'critical': 0,
            'high': 0,
            'medium': 0,
            'low': 0
        }
        
        highest_risk = None
        highest_score = -1
        
        recommendations = []
        
        for risk in risks:
            severity = risk.severity
            if severity in severity_counts:
                severity_counts[severity] += 1
            
            if risk.risk_score > highest_score:
                highest_score = risk.risk_score
                highest_risk = risk
            
            if severity in ['critical', 'high']:
                recommendations.append({
                    'rule': risk.rule_name,
                    'message': risk.message,
                    'suggestion': risk.suggested_action
                })
        
        if severity_counts['critical'] > 0:
            overall_status = 'critical'
        elif severity_counts['high'] > 0:
            overall_status = 'warning'
        elif severity_counts['medium'] > 0:
            overall_status = 'attention'
        else:
            overall_status = 'ok'
        
        return {
            'total_risks': len(risks),
            'by_severity': severity_counts,
            'highest_risk': highest_risk,
            'overall_status': overall_status,
            'recommendations': recommendations[:5]
        }
    
    def compare_risk_profiles(
        self,
        solutions_risks: Dict[str, List[RiskItem]]
    ) -> Dict[str, Any]:
        """比较多个方案的风险状况
        
        Args:
            solutions_risks: 方案ID到风险列表的映射
            
        Returns:
            包含对比分析的字典
        """
        comparison = []
        
        for solution_id, risks in solutions_risks.items():
            summary = self.get_summary(risks)
            comparison.append({
                'solution_id': solution_id,
                'risk_count': len(risks),
                'critical_count': summary['by_severity']['critical'],
                'high_count': summary['by_severity']['high'],
                'medium_count': summary['by_severity']['medium'],
                'status': summary['overall_status'],
                'total_risk_score': sum(r.risk_score for r in risks)
            })
        
        comparison = sorted(
            comparison,
            key=lambda x: (
                x['critical_count'],
                x['high_count'],
                x['total_risk_score']
            )
        )
        
        return {
            'comparison': comparison,
            'safest_solution': comparison[0]['solution_id'] if comparison else None,
            'riskiest_solution': comparison[-1]['solution_id'] if comparison else None
        }
