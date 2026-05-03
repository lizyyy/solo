from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid

from models.case import Case
from models.risk import Risk, RiskType, RiskSeverity, RiskStatus, RiskSegment
from .rule_config import RuleConfig, DEFAULT_RULE_CONFIG


@dataclass
class RuleResult:
    """
    规则执行结果
    """
    rule_name: str
    rule_description: str
    risks: List[Risk] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    execution_time: float = 0.0  # 执行时间(秒)
    
    @property
    def has_risks(self) -> bool:
        """
        是否检测到风险
        """
        return len(self.risks) > 0


class BaseRule(ABC):
    """
    规则基类
    所有风险检测规则都应该继承此类
    """
    
    def __init__(self, config: RuleConfig = None):
        self.config = config or DEFAULT_RULE_CONFIG
        self.rule_name = self.__class__.__name__
        self.rule_description = ""
    
    @abstractmethod
    def execute(self, case: Case) -> RuleResult:
        """
        执行规则检测
        """
        pass
    
    def _create_risk(self, 
                     case: Case,
                     risk_type: RiskType,
                     severity: RiskSeverity,
                     description: str,
                     recommendation: str,
                     segments: List[RiskSegment] = None) -> Risk:
        """
        创建风险对象
        """
        risk_id = f"RISK_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
        
        risk = Risk(
            risk_id=risk_id,
            case_id=case.case_id,
            risk_type=risk_type,
            severity=severity,
            status=RiskStatus.PENDING,
            description=description,
            recommendation=recommendation,
            detected_at=datetime.now(),
            segments=segments or []
        )
        
        return risk
    
    def _create_segment(self,
                        start_time: datetime,
                        end_time: datetime,
                        min_value: float = None,
                        max_value: float = None,
                        avg_value: float = None,
                        trigger_value: float = None,
                        parameter: str = None) -> RiskSegment:
        """
        创建风险片段
        """
        return RiskSegment(
            start_time=start_time,
            end_time=end_time,
            min_value=min_value,
            max_value=max_value,
            avg_value=avg_value,
            trigger_value=trigger_value,
            parameter=parameter
        )


class RuleEngine:
    """
    规则引擎
    管理和执行所有风险检测规则
    """
    
    def __init__(self, config: RuleConfig = None):
        self.config = config or DEFAULT_RULE_CONFIG
        self.rules: List[BaseRule] = []
        self.last_results: Dict[str, RuleResult] = {}
    
    def register_rule(self, rule: BaseRule):
        """
        注册规则
        """
        self.rules.append(rule)
    
    def register_rules(self, rules: List[BaseRule]):
        """
        批量注册规则
        """
        self.rules.extend(rules)
    
    def execute_all(self, case: Case) -> Dict[str, RuleResult]:
        """
        执行所有注册的规则
        """
        self.last_results = {}
        
        for rule in self.rules:
            import time
            start_time = time.time()
            
            result = rule.execute(case)
            result.execution_time = time.time() - start_time
            
            self.last_results[rule.rule_name] = result
        
        return self.last_results
    
    def get_all_risks(self) -> List[Risk]:
        """
        获取所有检测到的风险
        """
        risks = []
        for result in self.last_results.values():
            risks.extend(result.risks)
        return risks
    
    def get_risks_by_type(self, risk_type: RiskType) -> List[Risk]:
        """
        按类型获取风险
        """
        risks = []
        for result in self.last_results.values():
            for risk in result.risks:
                if risk.risk_type == risk_type:
                    risks.append(risk)
        return risks
    
    def get_risk_summary(self) -> Dict[str, Any]:
        """
        获取风险摘要
        """
        summary = {
            "total_rules_executed": len(self.last_results),
            "rules_with_risks": 0,
            "total_risks": 0,
            "risks_by_severity": {
                "MILD": 0,
                "MODERATE": 0,
                "SEVERE": 0,
                "CRITICAL": 0
            },
            "risks_by_type": {},
            "rule_details": {}
        }
        
        for rule_name, result in self.last_results.items():
            rule_summary = {
                "has_risks": result.has_risks,
                "risk_count": len(result.risks),
                "execution_time": result.execution_time,
                "errors": result.errors,
                "warnings": result.warnings
            }
            
            if result.has_risks:
                summary["rules_with_risks"] += 1
                summary["total_risks"] += len(result.risks)
                
                for risk in result.risks:
                    # 按严重程度统计
                    severity = risk.severity.name
                    if severity in summary["risks_by_severity"]:
                        summary["risks_by_severity"][severity] += 1
                    
                    # 按类型统计
                    risk_type = risk.risk_type.name
                    if risk_type not in summary["risks_by_type"]:
                        summary["risks_by_type"][risk_type] = 0
                    summary["risks_by_type"][risk_type] += 1
            
            summary["rule_details"][rule_name] = rule_summary
        
        return summary
