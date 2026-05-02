"""规则引擎 - 主引擎"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Type
from collections import defaultdict
import time

from src.models import (
    Application, Context, Shortcut, ShortcutKey,
    Conflict, ConflictType, ConflictSeverity,
    PlatformDifference, UnreachableShortcut, DuplicateMacro,
)


@dataclass
class RuleResult:
    """单个规则的执行结果"""
    
    # 规则信息
    rule_name: str = ""
    rule_description: str = ""
    
    # 执行状态
    success: bool = True
    error_message: str = ""
    
    # 检测到的问题
    conflicts: List[Conflict] = field(default_factory=list)
    platform_differences: List[PlatformDifference] = field(default_factory=list)
    unreachable_shortcuts: List[UnreachableShortcut] = field(default_factory=list)
    duplicate_macros: List[DuplicateMacro] = field(default_factory=list)
    
    # 统计信息
    total_checked: int = 0
    issues_found: int = 0
    
    # 执行时间
    execution_time_ms: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "rule_name": self.rule_name,
            "rule_description": self.rule_description,
            "success": self.success,
            "error_message": self.error_message,
            "conflicts": [c.to_dict() for c in self.conflicts],
            "platform_differences": [p.to_dict() for p in self.platform_differences],
            "unreachable_shortcuts": [u.to_dict() for u in self.unreachable_shortcuts],
            "duplicate_macros": [d.to_dict() for d in self.duplicate_macros],
            "total_checked": self.total_checked,
            "issues_found": self.issues_found,
            "execution_time_ms": self.execution_time_ms,
        }


@dataclass
class AnalysisResult:
    """完整分析结果"""
    
    # 基本信息
    analysis_id: str = ""
    analysis_time: float = field(default_factory=time.time)
    
    # 执行状态
    success: bool = True
    error_message: str = ""
    
    # 各规则的结果
    rule_results: List[RuleResult] = field(default_factory=list)
    
    # 汇总信息
    total_shortcuts: int = 0
    total_applications: int = 0
    total_contexts: int = 0
    
    # 问题汇总
    total_conflicts: int = 0
    total_platform_differences: int = 0
    total_unreachable: int = 0
    total_duplicate_macros: int = 0
    
    # 按严重程度分类
    critical_issues: int = 0
    high_issues: int = 0
    medium_issues: int = 0
    low_issues: int = 0
    
    # 执行时间
    total_execution_time_ms: float = 0.0
    
    def calculate_summary(self):
        """计算汇总信息"""
        self.total_conflicts = 0
        self.total_platform_differences = 0
        self.total_unreachable = 0
        self.total_duplicate_macros = 0
        
        self.critical_issues = 0
        self.high_issues = 0
        self.medium_issues = 0
        self.low_issues = 0
        
        self.total_execution_time_ms = 0.0
        
        for rule_result in self.rule_results:
            self.total_conflicts += len(rule_result.conflicts)
            self.total_platform_differences += len(rule_result.platform_differences)
            self.total_unreachable += len(rule_result.unreachable_shortcuts)
            self.total_duplicate_macros += len(rule_result.duplicate_macros)
            
            self.total_execution_time_ms += rule_result.execution_time_ms
            
            # 按严重程度统计
            for conflict in rule_result.conflicts:
                severity = conflict.severity
                if severity == ConflictSeverity.CRITICAL.value:
                    self.critical_issues += 1
                elif severity == ConflictSeverity.HIGH.value:
                    self.high_issues += 1
                elif severity == ConflictSeverity.MEDIUM.value:
                    self.medium_issues += 1
                elif severity == ConflictSeverity.LOW.value:
                    self.low_issues += 1
    
    def get_all_conflicts(self) -> List[Conflict]:
        """获取所有冲突"""
        conflicts = []
        for rule_result in self.rule_results:
            conflicts.extend(rule_result.conflicts)
        return conflicts
    
    def get_all_platform_differences(self) -> List[PlatformDifference]:
        """获取所有平台差异"""
        differences = []
        for rule_result in self.rule_results:
            differences.extend(rule_result.platform_differences)
        return differences
    
    def get_all_unreachable_shortcuts(self) -> List[UnreachableShortcut]:
        """获取所有不可达快捷键"""
        unreachable = []
        for rule_result in self.rule_results:
            unreachable.extend(rule_result.unreachable_shortcuts)
        return unreachable
    
    def get_all_duplicate_macros(self) -> List[DuplicateMacro]:
        """获取所有重复宏"""
        macros = []
        for rule_result in self.rule_results:
            macros.extend(rule_result.duplicate_macros)
        return macros
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "analysis_id": self.analysis_id,
            "analysis_time": self.analysis_time,
            "success": self.success,
            "error_message": self.error_message,
            "rule_results": [r.to_dict() for r in self.rule_results],
            "total_shortcuts": self.total_shortcuts,
            "total_applications": self.total_applications,
            "total_contexts": self.total_contexts,
            "total_conflicts": self.total_conflicts,
            "total_platform_differences": self.total_platform_differences,
            "total_unreachable": self.total_unreachable,
            "total_duplicate_macros": self.total_duplicate_macros,
            "critical_issues": self.critical_issues,
            "high_issues": self.high_issues,
            "medium_issues": self.medium_issues,
            "low_issues": self.low_issues,
            "total_execution_time_ms": self.total_execution_time_ms,
        }


class BaseRule(ABC):
    """规则基类"""
    
    def __init__(self):
        self.rule_name = ""
        self.rule_description = ""
    
    @abstractmethod
    def execute(
        self,
        shortcuts: List[Shortcut],
        applications: List[Application],
        contexts: List[Context],
        **kwargs
    ) -> RuleResult:
        """执行规则检测"""
        pass


class RuleEngine:
    """规则引擎 - 协调执行所有规则"""
    
    def __init__(self):
        # 注册的规则
        self.rules: List[Type[BaseRule]] = []
        self._register_default_rules()
    
    def _register_default_rules(self):
        """注册默认规则"""
        from src.rules.conflict_detector import ConflictDetector
        from src.rules.platform_checker import PlatformChecker
        from src.rules.unreachable_checker import UnreachableChecker
        from src.rules.duplicate_macro_checker import DuplicateMacroChecker
        
        self.rules = [
            ConflictDetector,
            PlatformChecker,
            UnreachableChecker,
            DuplicateMacroChecker,
        ]
    
    def register_rule(self, rule_class: Type[BaseRule]):
        """注册新规则"""
        if rule_class not in self.rules:
            self.rules.append(rule_class)
    
    def unregister_rule(self, rule_class: Type[BaseRule]):
        """注销规则"""
        if rule_class in self.rules:
            self.rules.remove(rule_class)
    
    def analyze(
        self,
        shortcuts: List[Shortcut],
        applications: List[Application],
        contexts: List[Context],
        **kwargs
    ) -> AnalysisResult:
        """执行完整分析"""
        import hashlib
        
        result = AnalysisResult(
            analysis_id=hashlib.md5(f"{time.time()}:{len(shortcuts)}".encode()).hexdigest()[:12],
            total_shortcuts=len(shortcuts),
            total_applications=len(applications),
            total_contexts=len(contexts),
        )
        
        try:
            # 执行每个规则
            for rule_class in self.rules:
                rule = rule_class()
                start_time = time.time()
                
                try:
                    rule_result = rule.execute(
                        shortcuts=shortcuts,
                        applications=applications,
                        contexts=contexts,
                        **kwargs
                    )
                    rule_result.execution_time_ms = (time.time() - start_time) * 1000
                    result.rule_results.append(rule_result)
                    
                except Exception as e:
                    rule_result = RuleResult(
                        rule_name=rule.rule_name,
                        rule_description=rule.rule_description,
                        success=False,
                        error_message=str(e),
                        execution_time_ms=(time.time() - start_time) * 1000,
                    )
                    result.rule_results.append(rule_result)
            
            # 计算汇总信息
            result.calculate_summary()
            result.success = True
            
        except Exception as e:
            result.success = False
            result.error_message = f"分析失败: {str(e)}"
        
        return result
    
    def get_rule_names(self) -> List[str]:
        """获取所有注册的规则名称"""
        names = []
        for rule_class in self.rules:
            rule = rule_class()
            names.append(rule.rule_name)
        return names
