"""
规则引擎
整合所有规则并提供统一的检查接口
"""

from typing import List, Dict, Any, Optional
from datetime import datetime

from .base_rule import BaseRule
from .rate_rule import HeatingRateRule
from .insulation_rule import InsulationTimeRule
from .temperature_diff_rule import TemperatureDifferenceRule
from .batch_match_rule import BatchMatchRule
from ..models import (
    Risk, RiskType, RiskLevel, ReviewStatus,
    FiringRecord, TimelineEvent
)


class RuleEngine:
    """规则引擎 - 整合所有检查规则"""
    
    def __init__(self):
        self.rules: List[BaseRule] = [
            HeatingRateRule(),
            InsulationTimeRule(),
            TemperatureDifferenceRule(),
            BatchMatchRule()
        ]
        self.rule_warnings: Dict[str, List[str]] = {}
        self.rule_errors: Dict[str, List[str]] = {}
    
    def add_rule(self, rule: BaseRule):
        """添加自定义规则"""
        self.rules.append(rule)
    
    def check_all(self, firing_record: FiringRecord) -> List[Risk]:
        """
        执行所有规则检查
        
        Args:
            firing_record: 烧成记录
            
        Returns:
            所有检测到的风险列表
        """
        self.rule_warnings.clear()
        self.rule_errors.clear()
        
        all_risks: List[Risk] = []
        
        for rule in self.rules:
            risks = rule.check(firing_record)
            all_risks.extend(risks)
            
            if rule.has_warnings():
                self.rule_warnings[rule.name] = rule.get_warnings()
            if rule.has_errors():
                self.rule_errors[rule.name] = rule.get_errors()
        
        all_risks.sort(key=lambda r: (
            self._risk_level_order(r.level),
            r.timestamp if r.timestamp else datetime.min
        ))
        
        return all_risks
    
    def check_by_type(self, firing_record: FiringRecord, risk_type: RiskType) -> List[Risk]:
        """
        按风险类型执行检查
        
        Args:
            firing_record: 烧成记录
            risk_type: 风险类型
            
        Returns:
            检测到的特定类型风险列表
        """
        all_risks = self.check_all(firing_record)
        return [r for r in all_risks if r.risk_type == risk_type]
    
    def generate_timeline_events(self, 
                                   firing_record: FiringRecord,
                                   risks: List[Risk]) -> List[TimelineEvent]:
        """
        根据检查结果生成时间线事件
        
        Args:
            firing_record: 烧成记录
            risks: 风险列表
            
        Returns:
            时间线事件列表
        """
        events: List[TimelineEvent] = []
        event_counter = 1
        
        for i, point in enumerate(firing_record.temperature_data):
            event = TimelineEvent(
                event_id=f"EVT-{event_counter:06d}",
                timestamp=point.timestamp,
                event_type="temperature_reading",
                title=f"温度读数 - {point.avg_temperature:.1f}°C",
                description=f"平均温度: {point.avg_temperature:.1f}°C, "
                           f"最高: {point.max_temperature:.1f}°C, "
                           f"最低: {point.min_temperature:.1f}°C, "
                           f"温差: {point.temperature_difference:.1f}°C",
                related_objects={"temperature_points": [str(i)]},
                metadata={
                    "avg_temperature": point.avg_temperature,
                    "max_temperature": point.max_temperature,
                    "min_temperature": point.min_temperature,
                    "temperature_difference": point.temperature_difference,
                    "layers": list(point.temperatures.keys())
                }
            )
            events.append(event)
            event_counter += 1
        
        for risk in risks:
            if risk.timestamp:
                event = TimelineEvent(
                    event_id=f"EVT-{event_counter:06d}",
                    timestamp=risk.timestamp,
                    event_type="risk",
                    title=f"{risk.level.value}风险: {risk.title}",
                    description=risk.description,
                    related_objects={"risks": [risk.risk_id]},
                    metadata={
                        "risk_type": risk.risk_type.value,
                        "risk_level": risk.level.value,
                        "review_status": risk.review_status.value
                    }
                )
                events.append(event)
                event_counter += 1
        
        for obs in firing_record.observations:
            event = TimelineEvent(
                event_id=f"EVT-{event_counter:06d}",
                timestamp=obs.timestamp,
                event_type="observation",
                title=f"观察备注: {obs.content[:50]}..." if len(obs.content) > 50 else f"观察备注: {obs.content}",
                description=f"作者: {obs.author or '未知'}\n"
                           f"分类: {obs.category or '未分类'}\n"
                           f"内容: {obs.content}",
                related_objects={
                    "observations": [obs.observation_id],
                    "works": obs.related_work_ids
                },
                metadata={
                    "author": obs.author,
                    "category": obs.category
                }
            )
            events.append(event)
            event_counter += 1
        
        events.sort(key=lambda e: e.timestamp)
        
        return events
    
    def get_risk_summary(self, risks: List[Risk]) -> Dict[str, Any]:
        """
        获取风险统计摘要
        
        Args:
            risks: 风险列表
            
        Returns:
            风险统计摘要
        """
        level_counts = {level: 0 for level in RiskLevel}
        type_counts = {risk_type: 0 for risk_type in RiskType}
        status_counts = {status: 0 for status in ReviewStatus}
        
        for risk in risks:
            level_counts[risk.level] += 1
            type_counts[risk.risk_type] += 1
            status_counts[risk.review_status] += 1
        
        return {
            "total_risks": len(risks),
            "by_level": {level.value: count for level, count in level_counts.items()},
            "by_type": {risk_type.value: count for risk_type, count in type_counts.items()},
            "by_status": {status.value: count for status, count in status_counts.items()},
            "pending_review": status_counts[ReviewStatus.PENDING],
            "critical_count": level_counts[RiskLevel.CRITICAL],
            "high_count": level_counts[RiskLevel.HIGH]
        }
    
    def get_rule_warnings(self) -> Dict[str, List[str]]:
        """获取规则执行期间的警告"""
        return {k: v.copy() for k, v in self.rule_warnings.items()}
    
    def get_rule_errors(self) -> Dict[str, List[str]]:
        """获取规则执行期间的错误"""
        return {k: v.copy() for k, v in self.rule_errors.items()}
    
    def _risk_level_order(self, level: RiskLevel) -> int:
        """风险级别排序顺序"""
        order = {
            RiskLevel.CRITICAL: 0,
            RiskLevel.HIGH: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.LOW: 3
        }
        return order.get(level, 999)
