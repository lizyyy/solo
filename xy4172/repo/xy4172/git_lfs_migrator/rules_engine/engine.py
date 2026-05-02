"""规则引擎核心"""
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Callable, Dict, List, Optional

from git_lfs_migrator.models import Issue, IssueSeverity, IssueType


class RuleCategory(Enum):
    FILE_SIZE = auto()
    GITATTRIBUTES = auto()
    CASE_SENSITIVITY = auto()
    HASH_CONFLICT = auto()
    PROTECTED_REFS = auto()
    ROLLBACK = auto()
    SUBMODULE = auto()


@dataclass
class RuleResult:
    """规则检查结果"""
    rule_name: str
    category: RuleCategory
    passed: bool
    issues: List[Issue] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    suggestion: Optional[str] = None


class RulesEngine:
    """规则引擎"""
    
    def __init__(self):
        self._rules: Dict[str, Dict] = {}
        self._registered_categories: Dict[RuleCategory, List[str]] = {}
    
    def register_rule(
        self,
        name: str,
        category: RuleCategory,
        check_function: Callable,
        enabled: bool = True,
        severity: IssueSeverity = IssueSeverity.MEDIUM,
    ) -> None:
        """
        注册一个规则
        
        Args:
            name: 规则名称
            category: 规则分类
            check_function: 检查函数，返回 RuleResult
            enabled: 是否启用
            severity: 默认严重程度
        """
        self._rules[name] = {
            "name": name,
            "category": category,
            "check_function": check_function,
            "enabled": enabled,
            "severity": severity,
        }
        
        if category not in self._registered_categories:
            self._registered_categories[category] = []
        self._registered_categories[category].append(name)
    
    def enable_rule(self, name: str) -> bool:
        """启用规则"""
        if name in self._rules:
            self._rules[name]["enabled"] = True
            return True
        return False
    
    def disable_rule(self, name: str) -> bool:
        """禁用规则"""
        if name in self._rules:
            self._rules[name]["enabled"] = False
            return True
        return False
    
    def run_check(
        self,
        context: Dict[str, Any],
        categories: Optional[List[RuleCategory]] = None,
        rule_names: Optional[List[str]] = None,
    ) -> List[RuleResult]:
        """
        运行规则检查
        
        Args:
            context: 检查上下文
            categories: 要检查的分类（如果为 None 则检查所有）
            rule_names: 要检查的特定规则（优先级高于 categories）
        
        Returns:
            规则结果列表
        """
        results: List[RuleResult] = []
        
        rules_to_run: List[Dict] = []
        
        if rule_names:
            for name in rule_names:
                if name in self._rules and self._rules[name]["enabled"]:
                    rules_to_run.append(self._rules[name])
        elif categories:
            for category in categories:
                if category in self._registered_categories:
                    for name in self._registered_categories[category]:
                        if name in self._rules and self._rules[name]["enabled"]:
                            rules_to_run.append(self._rules[name])
        else:
            for rule in self._rules.values():
                if rule["enabled"]:
                    rules_to_run.append(rule)
        
        for rule in rules_to_run:
            try:
                result = rule["check_function"](context)
                results.append(result)
            except Exception as e:
                results.append(RuleResult(
                    rule_name=rule["name"],
                    category=rule["category"],
                    passed=False,
                    issues=[Issue(
                        issue_type=IssueType.RULE_CONFLICT,
                        severity=IssueSeverity.HIGH,
                        message=f"规则执行失败: {rule['name']}",
                        details={"error": str(e)},
                    )],
                ))
        
        return results
    
    def get_all_rule_names(self) -> List[str]:
        """获取所有规则名称"""
        return list(self._rules.keys())
    
    def get_enabled_rules(self) -> List[str]:
        """获取启用的规则名称"""
        return [name for name, rule in self._rules.items() if rule["enabled"]]
    
    def get_rules_by_category(self, category: RuleCategory) -> List[str]:
        """获取指定分类的规则"""
        return self._registered_categories.get(category, [])
