"""规则引擎 - 实验风险评估规则"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Any, Optional, Callable, Protocol
from abc import ABC, abstractmethod

from .units import convert
from .fluidics import SimulationResult, TimeSegmentResult, Channel, FluidNetwork


class RuleSeverity(Enum):
    """规则严重程度"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class RuleViolation:
    """规则违规"""
    rule_id: str
    rule_name: str
    severity: RuleSeverity
    message: str
    
    # 相关数值
    value: Optional[float] = None
    unit: Optional[str] = None
    threshold: Optional[float] = None
    
    # 位置信息
    location: Optional[str] = None
    
    # 建议的修复措施
    suggestion: Optional[str] = None
    
    # 额外的上下文数据
    context: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RuleEvaluationResult:
    """规则评估结果"""
    rule_id: str
    rule_name: str
    is_passed: bool
    violations: List[RuleViolation] = field(default_factory=list)


class Rule(ABC):
    """规则基类"""
    
    rule_id: str = ""
    rule_name: str = ""
    severity: RuleSeverity = RuleSeverity.MEDIUM
    description: str = ""
    
    @abstractmethod
    def evaluate(self, context: Dict[str, Any]) -> RuleEvaluationResult:
        """
        评估规则
        
        Args:
            context: 评估上下文，包含所有需要的数据
        
        Returns:
            规则评估结果
        """
        pass


class HighPressureDropRule(Rule):
    """高压降规则"""
    
    rule_id = "FLUID_001"
    rule_name = "高压降检测"
    severity = RuleSeverity.HIGH
    description = "检测通道压降是否过高，可能导致芯片破裂或泄漏"
    
    # 默认阈值: 1 bar = 100000 Pa
    DEFAULT_THRESHOLD_PA = 100000.0
    
    def __init__(self, threshold_pa: Optional[float] = None):
        self.threshold_pa = threshold_pa or self.DEFAULT_THRESHOLD_PA
    
    def evaluate(self, context: Dict[str, Any]) -> RuleEvaluationResult:
        result = RuleEvaluationResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            is_passed=True,
        )
        
        sim_result: Optional[SimulationResult] = context.get("simulation_result")
        if sim_result is None:
            return result
        
        # 检查每个时间段
        for seg_idx, segment in enumerate(sim_result.time_segments):
            for ch_id, pressure_drop in segment.channel_pressure_drops.items():
                if pressure_drop > self.threshold_pa:
                    result.is_passed = False
                    
                    # 转换为更易读的单位
                    pressure_drop_bar = convert(pressure_drop, "Pa", "bar", "pressure")
                    threshold_bar = convert(self.threshold_pa, "Pa", "bar", "pressure")
                    
                    violation = RuleViolation(
                        rule_id=self.rule_id,
                        rule_name=self.rule_name,
                        severity=self.severity,
                        message=f"通道 '{ch_id}' 压降过高 ({pressure_drop_bar:.3f} bar)，超过阈值 ({threshold_bar:.3f} bar)",
                        value=pressure_drop_bar,
                        unit="bar",
                        threshold=threshold_bar,
                        location=f"segment[{seg_idx}].channel.{ch_id}",
                        suggestion="建议降低流量、增加通道截面积或缩短通道长度",
                        context={
                            "channel_id": ch_id,
                            "segment_index": seg_idx,
                            "pressure_drop_pa": pressure_drop,
                            "threshold_pa": self.threshold_pa,
                        },
                    )
                    result.violations.append(violation)
        
        return result


class RatioDeviationRule(Rule):
    """混合比例偏差规则"""
    
    rule_id = "MIX_001"
    rule_name = "混合比例偏差"
    severity = RuleSeverity.MEDIUM
    description = "检测实际混合比例与目标比例的偏差是否过大"
    
    # 默认阈值: 5% 相对偏差
    DEFAULT_THRESHOLD_PERCENT = 5.0
    
    def __init__(self, threshold_percent: Optional[float] = None):
        self.threshold_percent = threshold_percent or self.DEFAULT_THRESHOLD_PERCENT
    
    def evaluate(self, context: Dict[str, Any]) -> RuleEvaluationResult:
        result = RuleEvaluationResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            is_passed=True,
        )
        
        sim_result: Optional[SimulationResult] = context.get("simulation_result")
        if sim_result is None:
            return result
        
        for seg_idx, segment in enumerate(sim_result.time_segments):
            for ratio in segment.mixing_ratios:
                abs_deviation = abs(ratio.relative_deviation)
                
                if abs_deviation > self.threshold_percent:
                    result.is_passed = False
                    
                    violation = RuleViolation(
                        rule_id=self.rule_id,
                        rule_name=self.rule_name,
                        severity=self.severity,
                        message=f"试剂 '{ratio.reagent_name}' 比例偏差过大 ({abs_deviation:.2f}%)，目标: {ratio.target_ratio:.1%}, 实际: {ratio.actual_ratio:.1%}",
                        value=abs_deviation,
                        unit="%",
                        threshold=self.threshold_percent,
                        location=f"segment[{seg_idx}].reagent.{ratio.reagent_id}",
                        suggestion="建议检查泵流量设置和通道阻力平衡",
                        context={
                            "reagent_id": ratio.reagent_id,
                            "reagent_name": ratio.reagent_name,
                            "segment_index": seg_idx,
                            "target_ratio": ratio.target_ratio,
                            "actual_ratio": ratio.actual_ratio,
                            "relative_deviation": ratio.relative_deviation,
                        },
                    )
                    result.violations.append(violation)
        
        return result


class DeadVolumeRule(Rule):
    """死体积规则"""
    
    rule_id = "VOL_001"
    rule_name = "死体积过大"
    severity = RuleSeverity.MEDIUM
    description = "检测系统死体积是否过大，可能导致试剂残留和切换延迟"
    
    # 默认阈值: 10 μL
    DEFAULT_THRESHOLD_UL = 10.0
    
    def __init__(self, threshold_ul: Optional[float] = None):
        self.threshold_ul = threshold_ul or self.DEFAULT_THRESHOLD_UL
    
    def evaluate(self, context: Dict[str, Any]) -> RuleEvaluationResult:
        result = RuleEvaluationResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            is_passed=True,
        )
        
        sim_result: Optional[SimulationResult] = context.get("simulation_result")
        network: Optional[FluidNetwork] = context.get("fluid_network")
        
        # 从仿真结果获取死体积
        total_dead_volume = 0.0
        if sim_result:
            total_dead_volume = sim_result.total_dead_volume
        elif network:
            total_dead_volume = sum(ch.volume for ch in network.channels.values())
        
        if total_dead_volume <= 0:
            return result
        
        # 转换为 μL
        total_dead_volume_ul = convert(total_dead_volume, "m3", "uL", "volume")
        
        if total_dead_volume_ul > self.threshold_ul:
            result.is_passed = False
            
            violation = RuleViolation(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                severity=self.severity,
                message=f"系统死体积过大 ({total_dead_volume_ul:.2f} μL)，超过阈值 ({self.threshold_ul:.2f} μL)",
                value=total_dead_volume_ul,
                unit="μL",
                threshold=self.threshold_ul,
                location="system",
                suggestion="建议优化通道设计，减少不必要的通道长度",
                context={
                    "total_dead_volume_m3": total_dead_volume,
                    "total_dead_volume_ul": total_dead_volume_ul,
                    "threshold_ul": self.threshold_ul,
                },
            )
            result.violations.append(violation)
        
        return result


class ExtremeAspectRatioRule(Rule):
    """极端宽高比规则"""
    
    rule_id = "GEO_001"
    rule_name = "极端通道宽高比"
    severity = RuleSeverity.LOW
    description = "检测通道宽高比是否极端，可能影响计算精度和制造难度"
    
    DEFAULT_MIN_RATIO = 0.05
    DEFAULT_MAX_RATIO = 20.0
    
    def __init__(
        self,
        min_ratio: Optional[float] = None,
        max_ratio: Optional[float] = None,
    ):
        self.min_ratio = min_ratio or self.DEFAULT_MIN_RATIO
        self.max_ratio = max_ratio or self.DEFAULT_MAX_RATIO
    
    def evaluate(self, context: Dict[str, Any]) -> RuleEvaluationResult:
        result = RuleEvaluationResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            is_passed=True,
        )
        
        network: Optional[FluidNetwork] = context.get("fluid_network")
        if network is None:
            return result
        
        for ch_id, channel in network.channels.items():
            if channel.height <= 0:
                continue
            
            aspect_ratio = channel.width / channel.height
            
            if aspect_ratio < self.min_ratio or aspect_ratio > self.max_ratio:
                result.is_passed = False
                
                violation = RuleViolation(
                    rule_id=self.rule_id,
                    rule_name=self.rule_name,
                    severity=self.severity,
                    message=f"通道 '{ch_id}' 宽高比极端 ({aspect_ratio:.2f})，建议范围: {self.min_ratio:.2f} - {self.max_ratio:.2f}",
                    value=aspect_ratio,
                    unit="",
                    threshold=None,
                    location=f"channel.{ch_id}",
                    suggestion="建议调整通道尺寸，使宽高比更接近1",
                    context={
                        "channel_id": ch_id,
                        "width": channel.width,
                        "height": channel.height,
                        "aspect_ratio": aspect_ratio,
                    },
                )
                result.violations.append(violation)
        
        return result


class FlowRateConsistencyRule(Rule):
    """流量单位一致性规则"""
    
    rule_id = "UNIT_001"
    rule_name = "流量单位不一致"
    severity = RuleSeverity.INFO
    description = "检测泵程序中是否使用了不一致的流量单位"
    
    def evaluate(self, context: Dict[str, Any]) -> RuleEvaluationResult:
        result = RuleEvaluationResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            is_passed=True,
        )
        
        pump_program = context.get("pump_program")
        if pump_program is None:
            return result
        
        # 收集所有使用的单位
        units_used: Dict[str, int] = {}
        
        for segment in pump_program.segments:
            for pump_id, (flow_value, flow_unit) in segment.pump_flows.items():
                if flow_unit:
                    units_used[flow_unit] = units_used.get(flow_unit, 0) + 1
        
        if len(units_used) > 1:
            result.is_passed = False
            
            units_list = ", ".join([f"{u} ({c}次)" for u, c in units_used.items()])
            
            violation = RuleViolation(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                severity=self.severity,
                message=f"检测到多种流量单位: {units_list}，建议统一使用相同单位",
                location="pump_program",
                suggestion="建议统一使用 μL/min 作为流量单位",
                context={
                    "units_used": units_used,
                },
            )
            result.violations.append(violation)
        
        return result


class ZeroFlowDurationRule(Rule):
    """零流量持续时间规则"""
    
    rule_id = "TIME_001"
    rule_name = "长时间零流量"
    severity = RuleSeverity.LOW
    description = "检测是否有泵长时间处于零流量状态，可能导致管路堵塞"
    
    # 默认阈值: 5 分钟
    DEFAULT_THRESHOLD_SEC = 300.0
    
    def __init__(self, threshold_sec: Optional[float] = None):
        self.threshold_sec = threshold_sec or self.DEFAULT_THRESHOLD_SEC
    
    def evaluate(self, context: Dict[str, Any]) -> RuleEvaluationResult:
        result = RuleEvaluationResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            is_passed=True,
        )
        
        pump_program = context.get("pump_program")
        if pump_program is None:
            return result
        
        # 跟踪每个泵的零流量累计时间
        zero_flow_duration: Dict[str, float] = {}
        
        for segment in pump_program.segments:
            for pump_id, (flow_value, flow_unit) in segment.pump_flows.items():
                if flow_value <= 0:
                    # 累加持续时间
                    try:
                        duration_sec = convert(segment.duration, segment.duration_unit, "s", "time")
                        zero_flow_duration[pump_id] = zero_flow_duration.get(pump_id, 0.0) + duration_sec
                    except Exception:
                        pass
        
        for pump_id, duration in zero_flow_duration.items():
            if duration > self.threshold_sec:
                result.is_passed = False
                
                duration_min = duration / 60.0
                threshold_min = self.threshold_sec / 60.0
                
                violation = RuleViolation(
                    rule_id=self.rule_id,
                    rule_name=self.rule_name,
                    severity=self.severity,
                    message=f"泵 '{pump_id}' 零流量时间过长 ({duration_min:.1f} 分钟)，超过阈值 ({threshold_min:.1f} 分钟)",
                    value=duration_min,
                    unit="min",
                    threshold=threshold_min,
                    location=f"pump.{pump_id}",
                    suggestion="建议在长时间不使用时设置低流量冲洗模式",
                    context={
                        "pump_id": pump_id,
                        "zero_flow_duration_sec": duration,
                        "threshold_sec": self.threshold_sec,
                    },
                )
                result.violations.append(violation)
        
        return result


class RuleEngine:
    """规则引擎"""
    
    def __init__(self, rules: Optional[List[Rule]] = None):
        self.rules: List[Rule] = rules or []
    
    @classmethod
    def create_default(cls) -> "RuleEngine":
        """创建包含默认规则的规则引擎"""
        return cls([
            HighPressureDropRule(),
            RatioDeviationRule(),
            DeadVolumeRule(),
            ExtremeAspectRatioRule(),
            FlowRateConsistencyRule(),
            ZeroFlowDurationRule(),
        ])
    
    def add_rule(self, rule: Rule) -> None:
        """添加规则"""
        self.rules.append(rule)
    
    def evaluate_all(self, context: Dict[str, Any]) -> List[RuleEvaluationResult]:
        """
        执行所有规则评估
        
        Args:
            context: 评估上下文
        
        Returns:
            所有规则的评估结果
        """
        results: List[RuleEvaluationResult] = []
        
        for rule in self.rules:
            try:
                result = rule.evaluate(context)
                results.append(result)
            except Exception as e:
                # 记录错误但继续执行其他规则
                error_result = RuleEvaluationResult(
                    rule_id=rule.rule_id,
                    rule_name=rule.rule_name,
                    is_passed=False,
                )
                error_result.violations.append(RuleViolation(
                    rule_id=rule.rule_id,
                    rule_name=rule.rule_name,
                    severity=RuleSeverity.INFO,
                    message=f"规则评估出错: {str(e)}",
                    context={"error": str(e)},
                ))
                results.append(error_result)
        
        return results
    
    def get_all_violations(self, results: List[RuleEvaluationResult]) -> List[RuleViolation]:
        """从评估结果中提取所有违规"""
        violations: List[RuleViolation] = []
        for result in results:
            violations.extend(result.violations)
        return violations
    
    def get_violations_by_severity(
        self,
        results: List[RuleEvaluationResult],
        severity: RuleSeverity,
    ) -> List[RuleViolation]:
        """按严重程度筛选违规"""
        violations = self.get_all_violations(results)
        return [v for v in violations if v.severity == severity]


# 便捷函数
def create_default_rules() -> List[Rule]:
    return [
        HighPressureDropRule(),
        RatioDeviationRule(),
        DeadVolumeRule(),
        ExtremeAspectRatioRule(),
        FlowRateConsistencyRule(),
        ZeroFlowDurationRule(),
    ]


def run_default_rules(context: Dict[str, Any]) -> List[RuleEvaluationResult]:
    engine = RuleEngine.create_default()
    return engine.evaluate_all(context)
