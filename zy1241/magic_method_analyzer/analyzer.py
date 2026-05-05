"""魔术方法分析引擎"""

from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple

from .models import (
    Issue,
    IssueSeverity,
    IssueType,
    MagicMethodCall,
    MagicMethodType,
)


class MagicMethodAnalyzer:
    """魔术方法调用顺序分析器"""
    
    # 定义方法调用顺序规则
    METHOD_ORDER_RULES: Dict[str, List[str]] = {
        "attribute_access": ["__getattribute__", "__getattr__"],
        "attribute_set": ["__setattr__"],
        "context_manager": ["__enter__", "__exit__"],
        "truth_value": ["__bool__", "__len__"],
        "equality": ["__eq__"],
        "hashing": ["__hash__"],
    }
    
    # 定义有问题的模式
    PROBLEMATIC_PATTERNS: Dict[IssueType, List[Dict]] = {
        IssueType.EXCEPTION_OVERRIDE: [
            {
                "pattern": "getattribute_raises_then_getattr",
                "description": "__getattribute__ 抛出异常后，__getattr__ 被调用",
                "severity": IssueSeverity.WARNING,
            },
            {
                "pattern": "exit_returns_true",
                "description": "__exit__ 返回 True 会抑制异常",
                "severity": IssueSeverity.CRITICAL,
            },
        ],
        IssueType.HASH_INVALIDATION: [
            {
                "pattern": "eq_without_hash",
                "description": "定义了 __eq__ 但没有定义 __hash__",
                "severity": IssueSeverity.CRITICAL,
            },
            {
                "pattern": "hash_returns_none",
                "description": "__hash__ 返回 None 会使对象不可哈希",
                "severity": IssueSeverity.WARNING,
            },
        ],
        IssueType.TRUTH_VALUE_MISUSE: [
            {
                "pattern": "len_returns_negative",
                "description": "__len__ 返回负值会导致异常",
                "severity": IssueSeverity.CRITICAL,
            },
            {
                "pattern": "bool_not_called_first",
                "description": "当 __bool__ 存在时，应该优先调用",
                "severity": IssueSeverity.INFO,
            },
        ],
        IssueType.CONTEXT_CLEANUP_MISSING: [
            {
                "pattern": "enter_without_exit",
                "description": "__enter__ 被调用但 __exit__ 未被调用",
                "severity": IssueSeverity.CRITICAL,
            },
            {
                "pattern": "exit_exception_not_handled",
                "description": "__exit__ 接收到异常但未正确处理",
                "severity": IssueSeverity.WARNING,
            },
        ],
    }
    
    def __init__(self):
        self._method_calls: List[MagicMethodCall] = []
        self._issues: List[Issue] = []
        self._call_groups: Dict[str, List[MagicMethodCall]] = defaultdict(list)
    
    def add_method_call(self, call: MagicMethodCall) -> None:
        """添加方法调用记录"""
        self._method_calls.append(call)
        self._call_groups[call.target].append(call)
    
    def analyze(self) -> List[Issue]:
        """执行完整分析"""
        self._issues = []
        
        # 按目标对象分组分析
        for target, calls in self._call_groups.items():
            sorted_calls = sorted(calls, key=lambda x: x.timestamp)
            self._analyze_target_calls(target, sorted_calls)
        
        # 分析整体调用模式
        self._analyze_global_patterns()
        
        return self._issues
    
    def _analyze_target_calls(self, target: str, calls: List[MagicMethodCall]) -> None:
        """分析单个目标对象的调用序列"""
        method_names = [c.method_type.value for c in calls]
        
        # 检查属性访问顺序
        self._check_attribute_access_order(target, calls, method_names)
        
        # 检查上下文管理器使用
        self._check_context_manager(target, calls, method_names)
        
        # 检查真值判断
        self._check_truth_value(target, calls, method_names)
        
        # 检查相等性和哈希
        self._check_equality_hash(target, calls, method_names)
        
        # 检查异常处理
        self._check_exception_handling(target, calls)
    
    def _check_attribute_access_order(
        self, target: str, calls: List[MagicMethodCall], method_names: List[str]
    ) -> None:
        """检查属性访问方法的调用顺序"""
        # 检查 __getattribute__ -> __getattr__ 模式
        getattribute_indices = [
            i for i, name in enumerate(method_names)
            if name == "__getattribute__"
        ]
        getattr_indices = [
            i for i, name in enumerate(method_names)
            if name == "__getattr__"
        ]
        
        # 检查每个 __getattribute__ 调用后是否有异常
        for idx in getattribute_indices:
            call = calls[idx]
            if call.exception:
                # 检查后续是否有 __getattr__ 调用
                next_getattr = [i for i in getattr_indices if i > idx]
                if next_getattr:
                    # 检查是否是同一个属性访问
                    getattr_call = calls[next_getattr[0]]
                    if (
                        len(call.args) > 0 and len(getattr_call.args) > 0
                        and call.args[0] == getattr_call.args[0]
                    ):
                        self._issues.append(Issue(
                            issue_type=IssueType.EXCEPTION_OVERRIDE,
                            severity=IssueSeverity.WARNING,
                            title=f"{target} 的 __getattribute__ 异常后调用 __getattr__",
                            description=(
                                f"__getattribute__ 访问属性 '{call.args[0]}' 时抛出异常 "
                                f"{call.exception}，随后 __getattr__ 被调用。这可能是预期行为，"
                                f"但请确保 __getattribute__ 中的逻辑正确。"
                            ),
                            location=target,
                            related_calls=[call, getattr_call],
                            suggestion=(
                                "如果这是预期行为，请确保 __getattribute__ 只在必要时抛出异常。"
                                "如果不希望 __getattr__ 被调用，检查 __getattribute__ 的实现。"
                            ),
                        ))
        
        # 检查 __setattr__ 的实现是否可能导致无限递归
        for idx, call in enumerate(calls):
            if call.method_type == MagicMethodType.SETATTR:
                # 检查是否有 self.__dict__ 或 object.__setattr__ 的使用
                if "stack_trace" in call.metadata:
                    stack = call.metadata.get("stack_trace", [])
                    has_safe_implementation = any(
                        "__dict__" in frame or "object.__setattr__" in frame
                        for frame in stack
                    )
                    if not has_safe_implementation and len(stack) > 0:
                        # 检查是否有递归调用
                        recursive_calls = [
                            c for c in calls
                            if c.method_type == MagicMethodType.SETATTR
                            and c.timestamp > call.timestamp
                            and c.args == call.args
                        ]
                        if len(recursive_calls) > 3:
                            self._issues.append(Issue(
                                issue_type=IssueType.ATTRIBUTE_ACCESS_ISSUE,
                                severity=IssueSeverity.CRITICAL,
                                title=f"{target} 的 __setattr__ 可能存在无限递归",
                                description=(
                                    f"检测到对同一属性 '{call.args[0] if call.args else 'unknown'}' "
                                    f"的多次 __setattr__ 调用，可能存在无限递归。"
                                ),
                                location=target,
                                related_calls=[call] + recursive_calls[:3],
                                suggestion=(
                                    "在 __setattr__ 中使用 object.__setattr__(self, name, value) "
                                    "或 self.__dict__[name] = value 来避免无限递归。"
                                ),
                            ))
    
    def _check_context_manager(
        self, target: str, calls: List[MagicMethodCall], method_names: List[str]
    ) -> None:
        """检查上下文管理器的使用"""
        enter_indices = [
            i for i, name in enumerate(method_names)
            if name == "__enter__"
        ]
        exit_indices = [
            i for i, name in enumerate(method_names)
            if name == "__exit__"
        ]
        
        # 检查是否有未配对的 __enter__
        for enter_idx in enter_indices:
            exit_found = any(
                exit_idx > enter_idx for exit_idx in exit_indices
            )
            if not exit_found:
                enter_call = calls[enter_idx]
                self._issues.append(Issue(
                    issue_type=IssueType.CONTEXT_CLEANUP_MISSING,
                    severity=IssueSeverity.CRITICAL,
                    title=f"{target} 的上下文管理器未正确关闭",
                    description=(
                        "__enter__ 被调用但 __exit__ 未被调用。这可能导致资源泄漏。"
                    ),
                    location=target,
                    related_calls=[enter_call],
                    suggestion=(
                        "确保使用 with 语句，或在异常情况下也能正确调用 __exit__。"
                    ),
                ))
        
        # 检查 __exit__ 的返回值
        for exit_idx in exit_indices:
            exit_call = calls[exit_idx]
            # 检查 __exit__ 是否返回 True（会抑制异常）
            if exit_call.result is True:
                self._issues.append(Issue(
                    issue_type=IssueType.EXCEPTION_OVERRIDE,
                    severity=IssueSeverity.CRITICAL,
                    title=f"{target} 的 __exit__ 抑制了异常",
                    description=(
                        "__exit__ 返回 True 会抑制 with 块中的异常。这可能隐藏错误。"
                    ),
                    location=target,
                    related_calls=[exit_call],
                    suggestion=(
                        "只有在明确要处理异常时才让 __exit__ 返回 True。"
                        "否则应该返回 None 或 False。"
                    ),
                ))
            
            # 检查 __exit__ 接收到的异常参数
            if exit_call.args and len(exit_call.args) >= 3:
                exc_type, exc_val, exc_tb = exit_call.args[:3]
                if exc_type is not None:
                    # 有异常传入
                    if exit_call.exception:
                        # __exit__ 自身也抛出了异常
                        self._issues.append(Issue(
                            issue_type=IssueType.EXCEPTION_OVERRIDE,
                            severity=IssueSeverity.WARNING,
                            title=f"{target} 的 __exit__ 在处理异常时又抛出异常",
                            description=(
                                f"__exit__ 接收到异常 {exc_type}，但自身也抛出了 "
                                f"{exit_call.exception}。这会替换原始异常。"
                            ),
                            location=target,
                            related_calls=[exit_call],
                            suggestion=(
                                "确保 __exit__ 中的清理代码不会抛出新异常。"
                                "如果必须抛出，确保这是预期行为。"
                            ),
                        ))
    
    def _check_truth_value(
        self, target: str, calls: List[MagicMethodCall], method_names: List[str]
    ) -> None:
        """检查真值判断方法"""
        # 检查 __len__ 返回负值
        for call in calls:
            if call.method_type == MagicMethodType.LEN:
                if isinstance(call.result, int) and call.result < 0:
                    self._issues.append(Issue(
                        issue_type=IssueType.TRUTH_VALUE_MISUSE,
                        severity=IssueSeverity.CRITICAL,
                        title=f"{target} 的 __len__ 返回负值",
                        description=(
                            f"__len__ 返回 {call.result}，这是不允许的，会导致 ValueError。"
                        ),
                        location=target,
                        related_calls=[call],
                        suggestion="__len__ 应该返回非负整数。",
                    ))
        
        # 检查调用顺序：当 __bool__ 存在时，应该优先调用
        bool_calls = [c for c in calls if c.method_type == MagicMethodType.BOOL]
        len_calls = [c for c in calls if c.method_type == MagicMethodType.LEN]
        
        # 检查是否有 __len__ 被调用用于真值判断
        for len_call in len_calls:
            # 检查是否在布尔上下文中调用（通过 stack trace 或 metadata）
            context = len_call.metadata.get("context", "")
            if "bool" in context.lower() or "if" in context.lower():
                # 检查是否有 __bool__ 方法
                has_bool = any(
                    c.method_type == MagicMethodType.BOOL for c in calls
                )
                if has_bool:
                    # 有 __bool__ 但调用了 __len__
                    self._issues.append(Issue(
                        issue_type=IssueType.TRUTH_VALUE_MISUSE,
                        severity=IssueSeverity.INFO,
                        title=f"{target} 在布尔判断中使用了 __len__ 而非 __bool__",
                        description=(
                            "对象定义了 __bool__ 方法，但在布尔判断中调用了 __len__。"
                            "这可能是预期行为，但通常 __bool__ 应该优先。"
                        ),
                        location=target,
                        related_calls=[len_call],
                        suggestion=(
                            "如果需要自定义布尔判断，确保 __bool__ 正确实现。"
                            "如果只是检查长度，__len__ 就足够了。"
                        ),
                    ))
    
    def _check_equality_hash(
        self, target: str, calls: List[MagicMethodCall], method_names: List[str]
    ) -> None:
        """检查相等性和哈希方法"""
        eq_calls = [c for c in calls if c.method_type == MagicMethodType.EQ]
        hash_calls = [c for c in calls if c.method_type == MagicMethodType.HASH]
        
        # 检查是否定义了 __eq__ 但没有 __hash__
        # 这里我们通过是否有调用来推断（实际应该检查代码）
        if eq_calls and not hash_calls:
            # 检查 __eq__ 的结果
            for eq_call in eq_calls:
                # 如果 __eq__ 被调用，可能意味着对象需要哈希
                # 这是一个启发式检查
                self._issues.append(Issue(
                    issue_type=IssueType.HASH_INVALIDATION,
                    severity=IssueSeverity.WARNING,
                    title=f"{target} 可能缺少 __hash__ 方法",
                    description=(
                        "检测到 __eq__ 调用但没有 __hash__ 调用。"
                        "如果定义了 __eq__，应该同时定义 __hash__ 或将其设为 None。"
                    ),
                    location=target,
                    related_calls=eq_calls[:2],
                    suggestion=(
                        "如果对象需要可哈希，实现 __hash__。"
                        "如果对象不可哈希，设置 __hash__ = None。"
                    ),
                ))
        
        # 检查 __hash__ 返回 None
        for hash_call in hash_calls:
            if hash_call.result is None:
                self._issues.append(Issue(
                    issue_type=IssueType.HASH_INVALIDATION,
                    severity=IssueSeverity.INFO,
                    title=f"{target} 的 __hash__ 返回 None",
                    description=(
                        "__hash__ 返回 None 使对象不可哈希，不能用于字典键或集合。"
                    ),
                    location=target,
                    related_calls=[hash_call],
                    suggestion=(
                        "如果对象确实不可哈希，这是正确的。"
                        "否则应该返回一个整数哈希值。"
                    ),
                ))
        
        # 检查相等对象的哈希一致性
        # 这需要更复杂的分析，检查多个调用
        
    def _check_exception_handling(self, target: str, calls: List[MagicMethodCall]) -> None:
        """检查异常处理模式"""
        for call in calls:
            if call.exception:
                # 检查是否是预期的异常
                exception_type = type(call.exception).__name__
                
                # 检查常见的魔术方法异常
                if call.method_type == MagicMethodType.GETATTRIBUTE:
                    if exception_type == "AttributeError":
                        # 这可能是预期的（触发 __getattr__）
                        pass
                    else:
                        self._issues.append(Issue(
                            issue_type=IssueType.EXCEPTION_OVERRIDE,
                            severity=IssueSeverity.WARNING,
                            title=f"{target} 的 __getattribute__ 抛出意外异常",
                            description=(
                                f"__getattribute__ 抛出 {exception_type}: {call.exception}。"
                                "__getattribute__ 通常只应该抛出 AttributeError。"
                            ),
                            location=target,
                            related_calls=[call],
                            suggestion=(
                                "__getattribute__ 应该只在属性不存在时抛出 AttributeError。"
                                "其他异常应该在其他地方处理。"
                            ),
                        ))
    
    def _analyze_global_patterns(self) -> None:
        """分析全局调用模式"""
        # 分析多个对象之间的交互
        pass
    
    def get_call_sequence(self, target: Optional[str] = None) -> List[MagicMethodCall]:
        """获取方法调用序列"""
        if target:
            return sorted(self._call_groups.get(target, []), key=lambda x: x.timestamp)
        return sorted(self._method_calls, key=lambda x: x.timestamp)
    
    def get_method_statistics(self) -> Dict[str, int]:
        """获取方法调用统计"""
        stats: Dict[str, int] = defaultdict(int)
        for call in self._method_calls:
            stats[call.method_type.value] += 1
        return dict(stats)
