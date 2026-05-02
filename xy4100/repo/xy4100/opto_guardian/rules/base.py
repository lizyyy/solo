"""规则引擎基础类"""

from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from ..models.config import StoreConfig, ValidationRules
from ..models.frame import Frame
from ..models.lens import LensInventory
from ..models.prescription import Prescription
from ..models.validation import ValidationCategory, ValidationIssue, ValidationSeverity


class RuleResult(BaseModel):
    """规则执行结果"""
    
    rule_name: str = Field(description="规则名称")
    rule_id: str = Field(description="规则ID")
    passed: bool = Field(default=True, description="是否通过")
    
    issues: list[ValidationIssue] = Field(default_factory=list, description="问题列表")
    
    executed_at: datetime = Field(default_factory=datetime.now, description="执行时间")
    execution_time_ms: float = Field(default=0.0, description="执行耗时(ms)")
    
    metadata: dict = Field(default_factory=dict, description="元数据")
    
    @property
    def has_errors(self) -> bool:
        """是否有错误"""
        return any(
            i.severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]
            for i in self.issues
        )
    
    @property
    def has_warnings(self) -> bool:
        """是否有警告"""
        return any(i.severity == ValidationSeverity.WARNING for i in self.issues)
    
    def add_issue(
        self,
        category: ValidationCategory,
        severity: ValidationSeverity,
        message: str,
        detail: Optional[str] = None,
        location: Optional[str] = None,
        affected_field: Optional[str] = None,
        suggested_fix: Optional[str] = None,
        reference_value: Optional[Any] = None,
        actual_value: Optional[Any] = None,
    ) -> None:
        """添加问题
        
        Args:
            category: 问题类别
            severity: 严重程度
            message: 问题描述
            detail: 详细说明
            location: 问题位置
            affected_field: 受影响字段
            suggested_fix: 建议修复方案
            reference_value: 参考值
            actual_value: 实际值
        """
        issue = ValidationIssue(
            issue_id=f"{self.rule_id}_{len(self.issues) + 1}",
            category=category,
            severity=severity,
            message=message,
            detail=detail,
            location=location,
            affected_field=affected_field,
            suggested_fix=suggested_fix,
            reference_value=reference_value,
            actual_value=actual_value,
        )
        self.issues.append(issue)
        
        if severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]:
            self.passed = False


class RuleContext(BaseModel):
    """规则执行上下文"""
    
    prescription: Prescription = Field(description="处方数据")
    frame: Optional[Frame] = Field(default=None, description="镜架数据")
    inventory: Optional[LensInventory] = Field(default=None, description="镜片库存")
    
    store_config: StoreConfig = Field(description="门店配置")
    
    existing_orders: list[dict] = Field(default_factory=list, description="已有订单列表")
    
    metadata: dict = Field(default_factory=dict, description="额外元数据")
    
    @property
    def rules(self) -> ValidationRules:
        """获取校验规则"""
        return self.store_config.rules


class BaseRule(ABC):
    """规则基类"""
    
    rule_id: str = ""
    rule_name: str = ""
    rule_description: str = ""
    
    def __init__(self):
        if not self.rule_id:
            self.rule_id = self.__class__.__name__.lower()
    
    @abstractmethod
    def execute(self, context: RuleContext) -> RuleResult:
        """执行规则
        
        Args:
            context: 规则上下文
            
        Returns:
            规则执行结果
        """
        pass
    
    def create_result(self) -> RuleResult:
        """创建规则结果"""
        return RuleResult(
            rule_name=self.rule_name or self.__class__.__name__,
            rule_id=self.rule_id,
        )


class RuleEngine:
    """规则引擎"""
    
    def __init__(self, rules: Optional[list[BaseRule]] = None):
        self.rules: list[BaseRule] = rules or []
        self._rule_map: dict[str, BaseRule] = {r.rule_id: r for r in self.rules}
    
    def register_rule(self, rule: BaseRule) -> None:
        """注册规则"""
        self.rules.append(rule)
        self._rule_map[rule.rule_id] = rule
    
    def get_rule(self, rule_id: str) -> Optional[BaseRule]:
        """获取规则"""
        return self._rule_map.get(rule_id)
    
    def execute(
        self,
        context: RuleContext,
        rule_ids: Optional[list[str]] = None,
    ) -> list[RuleResult]:
        """执行规则
        
        Args:
            context: 规则上下文
            rule_ids: 指定执行的规则ID列表，None表示执行所有规则
            
        Returns:
            规则执行结果列表
        """
        results = []
        
        rules_to_execute = self.rules
        if rule_ids:
            rules_to_execute = [r for r in self.rules if r.rule_id in rule_ids]
        
        for rule in rules_to_execute:
            import time
            start_time = time.time()
            
            result = rule.execute(context)
            
            elapsed = (time.time() - start_time) * 1000
            result.execution_time_ms = round(elapsed, 3)
            
            results.append(result)
        
        return results
    
    def execute_all(self, context: RuleContext) -> tuple[bool, list[RuleResult]]:
        """执行所有规则并返回汇总结果
        
        Args:
            context: 规则上下文
            
        Returns:
            (是否全部通过, 规则结果列表)
        """
        results = self.execute(context)
        all_passed = all(r.passed for r in results)
        return all_passed, results


def get_default_rules() -> list[BaseRule]:
    """获取默认规则列表"""
    from .power_rules import PowerRangeRule, CylinderFormatRule, PowerStepRule
    from .axis_rules import AxisValidationRule, AxisSwapDetectionRule
    from .pd_rules import PDValidationRule, PDFrameMatchRule, PHValidationRule
    from .inventory_rules import InventoryAvailabilityRule
    from .duplicate_rules import DuplicateOrderRule
    
    return [
        PowerRangeRule(),
        PowerStepRule(),
        CylinderFormatRule(),
        AxisValidationRule(),
        AxisSwapDetectionRule(),
        PDValidationRule(),
        PDFrameMatchRule(),
        PHValidationRule(),
        InventoryAvailabilityRule(),
        DuplicateOrderRule(),
    ]
