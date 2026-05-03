"""
规则引擎模块：负责年龄段、库存、重复借阅、禁推主题和冷启动风险的检测
"""
from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict

from .parser_validator import (
    Book, BorrowRecord, ActivityRegistration, ParentFeedback, ForbiddenTheme,
    DataValidator
)


class RiskLevel(Enum):
    """风险等级"""
    LOW = ("低风险", 1)
    MEDIUM = ("中风险", 2)
    HIGH = ("高风险", 3)
    CRITICAL = ("严重风险", 4)
    
    def __init__(self, value: str, severity: int):
        self._value_ = value
        self.severity = severity
    
    def __gt__(self, other):
        if self.__class__ is other.__class__:
            return self.severity > other.severity
        return NotImplemented
    
    def __ge__(self, other):
        if self.__class__ is other.__class__:
            return self.severity >= other.severity
        return NotImplemented
    
    def __lt__(self, other):
        if self.__class__ is other.__class__:
            return self.severity < other.severity
        return NotImplemented
    
    def __le__(self, other):
        if self.__class__ is other.__class__:
            return self.severity <= other.severity
        return NotImplemented


@dataclass
class CheckResult:
    """检查结果"""
    book_id: str
    child_id: str
    risk_level: RiskLevel
    issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    is_eligible: bool = True
    
    def add_issue(self, issue: str, level: RiskLevel = RiskLevel.HIGH):
        """添加问题"""
        self.issues.append(issue)
        if level > self.risk_level:
            self.risk_level = level
        if level >= RiskLevel.MEDIUM:
            self.is_eligible = False
    
    def add_warning(self, warning: str, level: RiskLevel = RiskLevel.MEDIUM):
        """添加警告"""
        self.warnings.append(warning)
        if level > self.risk_level:
            self.risk_level = level


@dataclass
class ChildContext:
    """孩子的上下文信息"""
    child_id: str
    name: str = ""
    age: int = 0
    age_group: str = ""
    borrowed_books: Set[str] = field(default_factory=set)
    interests: Set[str] = field(default_factory=set)
    liked_themes: Set[str] = field(default_factory=set)
    disliked_themes: Set[str] = field(default_factory=set)
    is_cold_start: bool = True
    borrow_count: int = 0
    activity_count: int = 0
    feedback_count: int = 0


class RulesEngine:
    """规则引擎"""
    
    def __init__(
        self,
        books: Dict[str, Book],
        forbidden_themes: List[ForbiddenTheme],
        borrow_records: List[BorrowRecord] = None,
        activity_registrations: List[ActivityRegistration] = None,
        feedbacks: List[ParentFeedback] = None
    ):
        self.books = books
        self.forbidden_themes = forbidden_themes
        self.validator = DataValidator()
        
        self.child_contexts: Dict[str, ChildContext] = {}
        self._build_child_contexts(borrow_records or [], activity_registrations or [], feedbacks or [])
        self._build_forbidden_index()
    
    def _build_child_contexts(
        self,
        borrow_records: List[BorrowRecord],
        activity_registrations: List[ActivityRegistration],
        feedbacks: List[ParentFeedback]
    ):
        """构建孩子的上下文信息"""
        contexts: Dict[str, ChildContext] = {}
        
        for record in borrow_records:
            child_id = record.child_id
            if child_id not in contexts:
                contexts[child_id] = ChildContext(child_id=child_id)
            contexts[child_id].borrowed_books.add(record.book_id)
            contexts[child_id].borrow_count += 1
        
        for reg in activity_registrations:
            child_id = reg.child_id
            if child_id not in contexts:
                contexts[child_id] = ChildContext(child_id=child_id)
            
            contexts[child_id].name = reg.child_name or contexts[child_id].name
            contexts[child_id].age = reg.age
            contexts[child_id].activity_count += 1
            
            if reg.age > 0:
                age_group = self.validator.get_age_group_by_age(reg.age)
                if age_group:
                    contexts[child_id].age_group = age_group
            
            for interest in reg.interests:
                contexts[child_id].interests.add(interest)
        
        for feedback in feedbacks:
            child_id = feedback.child_id
            if child_id not in contexts:
                contexts[child_id] = ChildContext(child_id=child_id)
            contexts[child_id].feedback_count += 1
            
            for theme in feedback.liked_themes:
                contexts[child_id].liked_themes.add(theme)
            for theme in feedback.disliked_themes:
                contexts[child_id].disliked_themes.add(theme)
        
        for child_id, context in contexts.items():
            context.is_cold_start = (
                context.borrow_count == 0 and 
                context.activity_count == 0 and 
                context.feedback_count == 0
            )
        
        self.child_contexts = contexts
    
    def _build_forbidden_index(self):
        """构建禁推主题索引"""
        self.forbidden_index: Dict[str, Set[str]] = defaultdict(set)
        self.global_forbidden: Set[str] = set()
        
        for forbidden in self.forbidden_themes:
            theme = forbidden.theme.lower()
            if forbidden.age_groups:
                for age_group in forbidden.age_groups:
                    self.forbidden_index[age_group].add(theme)
            else:
                self.global_forbidden.add(theme)
    
    def get_child_context(self, child_id: str) -> ChildContext:
        """获取孩子的上下文，如果不存在则创建新的"""
        if child_id not in self.child_contexts:
            self.child_contexts[child_id] = ChildContext(child_id=child_id)
        return self.child_contexts[child_id]
    
    def check_age_eligibility(self, book: Book, child_context: ChildContext) -> Tuple[bool, str]:
        """
        检查年龄段是否匹配
        返回 (是否符合, 问题描述)
        """
        if not book.age_group:
            return True, ""
        
        if child_context.age > 0:
            is_match = self.validator.is_age_in_group(child_context.age, book.age_group)
            if not is_match:
                age_group_range = DataValidator.AGE_GROUPS.get(book.age_group, (0, 0))
                return False, f"年龄段不匹配：孩子{child_context.age}岁，图书适合{book.age_group}({age_group_range[0]}-{age_group_range[1]}岁)"
        
        if child_context.age_group and child_context.age_group != book.age_group:
            return False, f"年龄段不匹配：孩子属于{child_context.age_group}，图书适合{book.age_group}"
        
        return True, ""
    
    def check_stock(self, book: Book) -> Tuple[bool, str]:
        """
        检查库存
        返回 (是否有库存, 问题描述)
        """
        if book.stock <= 0:
            return False, f"库存不足：《{book.title}》当前库存为 {book.stock}"
        return True, ""
    
    def check_duplicate_borrow(self, book: Book, child_context: ChildContext) -> Tuple[bool, str]:
        """
        检查是否重复借阅
        返回 (是否重复, 问题描述)
        """
        if book.book_id in child_context.borrowed_books:
            return False, f"重复推荐：孩子已借阅过《{book.title}》"
        return True, ""
    
    def check_forbidden_themes(self, book: Book, child_context: ChildContext) -> Tuple[bool, List[str]]:
        """
        检查是否包含禁推主题
        返回 (是否安全, 问题列表)
        """
        issues = []
        
        book_themes = {t.lower() for t in book.themes}
        
        for theme in self.global_forbidden:
            if theme in book_themes:
                issues.append(f"包含全局禁推主题：{theme}")
        
        if child_context.age_group:
            forbidden_for_age = self.forbidden_index.get(child_context.age_group, set())
            for theme in forbidden_for_age:
                if theme in book_themes:
                    issues.append(f"包含{child_context.age_group}禁推主题：{theme}")
        
        if child_context.age > 0:
            for age_group, themes in self.forbidden_index.items():
                if self.validator.is_age_in_group(child_context.age, age_group):
                    for theme in themes:
                        if theme in book_themes:
                            issues.append(f"包含{age_group}禁推主题：{theme}")
        
        return len(issues) == 0, issues
    
    def check_disliked_themes(self, book: Book, child_context: ChildContext) -> Tuple[bool, List[str]]:
        """
        检查是否包含孩子不喜欢的主题
        返回 (是否安全, 警告列表)
        """
        warnings = []
        
        book_themes = {t.lower() for t in book.themes}
        disliked = {t.lower() for t in child_context.disliked_themes}
        
        for theme in disliked:
            if theme in book_themes:
                warnings.append(f"包含家长反馈不喜欢的主题：{theme}")
        
        return len(warnings) == 0, warnings
    
    def check_cold_start(self, child_context: ChildContext) -> Tuple[bool, str]:
        """
        检查是否为冷启动用户
        返回 (是否冷启动, 描述)
        """
        if child_context.is_cold_start:
            return True, "冷启动风险：该孩子没有借阅记录、活动记录或反馈记录"
        return False, ""
    
    def check_book(
        self,
        book_id: str,
        child_id: str,
        include_warnings: bool = True
    ) -> CheckResult:
        """
        检查单本图书对某个孩子的推荐是否合适
        
        Args:
            book_id: 图书ID
            child_id: 孩子ID
            include_warnings: 是否包含警告（非严重问题）
            
        Returns:
            CheckResult 检查结果
        """
        result = CheckResult(
            book_id=book_id,
            child_id=child_id,
            risk_level=RiskLevel.LOW,
            is_eligible=True
        )
        
        if book_id not in self.books:
            result.add_issue(f"图书不存在：{book_id}", RiskLevel.CRITICAL)
            return result
        
        book = self.books[book_id]
        child_context = self.get_child_context(child_id)
        
        is_eligible, issue = self.check_age_eligibility(book, child_context)
        if not is_eligible:
            result.add_issue(issue, RiskLevel.HIGH)
        
        has_stock, issue = self.check_stock(book)
        if not has_stock:
            result.add_issue(issue, RiskLevel.HIGH)
        
        is_unique, issue = self.check_duplicate_borrow(book, child_context)
        if not is_unique:
            result.add_issue(issue, RiskLevel.MEDIUM)
        
        is_safe, issues = self.check_forbidden_themes(book, child_context)
        if not is_safe:
            for issue in issues:
                result.add_issue(issue, RiskLevel.CRITICAL)
        
        if include_warnings:
            is_ok, warnings = self.check_disliked_themes(book, child_context)
            if not is_ok:
                for warning in warnings:
                    result.add_warning(warning, RiskLevel.MEDIUM)
            
            is_cold, cold_msg = self.check_cold_start(child_context)
            if is_cold:
                result.add_warning(cold_msg, RiskLevel.LOW)
        
        return result
    
    def check_recommendations(
        self,
        recommendations: List[Dict[str, Any]],
        child_id: str,
        include_warnings: bool = True
    ) -> List[Tuple[Dict[str, Any], CheckResult]]:
        """
        检查一批推荐结果
        
        Args:
            recommendations: 推荐列表，每个元素包含 book_id 字段
            child_id: 孩子ID
            include_warnings: 是否包含警告
            
        Returns:
            列表，每个元素为 (推荐信息, 检查结果)
        """
        results = []
        
        for rec in recommendations:
            book_id = rec.get('book_id', '')
            if not book_id:
                result = CheckResult(
                    book_id='',
                    child_id=child_id,
                    risk_level=RiskLevel.CRITICAL,
                    is_eligible=False
                )
                result.add_issue("推荐信息缺少 book_id", RiskLevel.CRITICAL)
            else:
                result = self.check_book(book_id, child_id, include_warnings)
            results.append((rec, result))
        
        return results
    
    def batch_check_all_children(
        self,
        recommendations: Dict[str, List[Dict[str, Any]]],
        include_warnings: bool = True
    ) -> Dict[str, List[Tuple[Dict[str, Any], CheckResult]]]:
        """
        批量检查所有孩子的推荐结果
        
        Args:
            recommendations: 字典，key 为 child_id，value 为该孩子的推荐列表
            include_warnings: 是否包含警告
            
        Returns:
            字典，key 为 child_id，value 为 (推荐信息, 检查结果) 列表
        """
        all_results = {}
        
        for child_id, recs in recommendations.items():
            all_results[child_id] = self.check_recommendations(recs, child_id, include_warnings)
        
        return all_results
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        total_children = len(self.child_contexts)
        cold_start_count = sum(1 for c in self.child_contexts.values() if c.is_cold_start)
        total_borrows = sum(c.borrow_count for c in self.child_contexts.values())
        total_activities = sum(c.activity_count for c in self.child_contexts.values())
        total_feedbacks = sum(c.feedback_count for c in self.child_contexts.values())
        
        return {
            "total_children": total_children,
            "cold_start_count": cold_start_count,
            "cold_start_ratio": cold_start_count / total_children if total_children > 0 else 0,
            "total_borrow_records": total_borrows,
            "total_activity_registrations": total_activities,
            "total_feedbacks": total_feedbacks,
            "total_books": len(self.books),
            "total_forbidden_themes": len(self.forbidden_themes),
        }
    
    def filter_eligible_books(
        self,
        book_ids: List[str],
        child_id: str
    ) -> List[str]:
        """
        过滤掉不符合规则的图书
        
        Args:
            book_ids: 待筛选的图书ID列表
            child_id: 孩子ID
            
        Returns:
            符合规则的图书ID列表
        """
        eligible = []
        
        for book_id in book_ids:
            result = self.check_book(book_id, child_id, include_warnings=False)
            if result.is_eligible:
                eligible.append(book_id)
        
        return eligible
