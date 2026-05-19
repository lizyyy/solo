from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Tuple, Optional, List
from dataclasses import dataclass

from models import ExceptionType


T = TypeVar('T')


@dataclass
class RuleResult:
    passed: bool
    exception_type: ExceptionType = ExceptionType.NONE
    message: Optional[str] = None
    blocking: bool = False

    @classmethod
    def success(cls) -> 'RuleResult':
        return cls(passed=True)

    @classmethod
    def fail(cls, exception_type: ExceptionType, message: str, blocking: bool = True) -> 'RuleResult':
        return cls(
            passed=False,
            exception_type=exception_type,
            message=message,
            blocking=blocking
        )


class BaseRule(ABC, Generic[T]):
    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description

    @abstractmethod
    def apply(self, context: T) -> RuleResult:
        pass


class RuleEngine(Generic[T]):
    def __init__(self):
        self._rules: List[BaseRule[T]] = []

    def register(self, rule: BaseRule[T]):
        self._rules.append(rule)

    def register_all(self, rules: List[BaseRule[T]]):
        self._rules.extend(rules)

    def execute(self, context: T) -> Tuple[List[RuleResult], bool]:
        results = []
        all_passed = True

        for rule in self._rules:
            result = rule.apply(context)
            results.append(result)
            if not result.passed:
                if result.blocking:
                    all_passed = False
                    break

        return results, all_passed

    def clear(self):
        self._rules.clear()
