import re
import string
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from .policy_parser import PasswordPolicy
from .boundary_generator import BoundarySample


@dataclass
class FailureReason:
    rule_id: str
    rule_name: str
    message: str
    severity: str = 'error'
    expected: Optional[Any] = None
    actual: Optional[Any] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'rule_id': self.rule_id,
            'rule_name': self.rule_name,
            'message': self.message,
            'severity': self.severity,
            'expected': self.expected,
            'actual': self.actual
        }


@dataclass
class PasswordResult:
    password: str
    is_valid: bool
    failure_reasons: List[FailureReason] = field(default_factory=list)
    test_group: str = ''
    description: str = ''
    source_file: Optional[str] = None
    line_number: Optional[int] = None
    character_classes: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'password': self.password,
            'is_valid': self.is_valid,
            'failure_reasons': [fr.to_dict() for fr in self.failure_reasons],
            'test_group': self.test_group,
            'description': self.description,
            'source_file': self.source_file,
            'line_number': self.line_number,
            'character_classes': self.character_classes,
            'metadata': self.metadata
        }


class RuleEngine:
    def __init__(self, policy: PasswordPolicy):
        self.policy = policy

    def _count_uppercase(self, password: str) -> int:
        return sum(1 for c in password if c.isupper())

    def _count_lowercase(self, password: str) -> int:
        return sum(1 for c in password if c.islower())

    def _count_digits(self, password: str) -> int:
        return sum(1 for c in password if c.isdigit())

    def _count_special(self, password: str) -> int:
        return sum(1 for c in password if c in self.policy.special_chars)

    def validate_length(self, password: str) -> Tuple[bool, List[FailureReason]]:
        failures = []
        length = len(password)

        if length < self.policy.min_length:
            failures.append(FailureReason(
                rule_id='length_min',
                rule_name='最小长度',
                message=f'密码长度不足: 需要{self.policy.min_length}个字符，实际{length}个',
                expected=self.policy.min_length,
                actual=length
            ))

        if length > self.policy.max_length:
            failures.append(FailureReason(
                rule_id='length_max',
                rule_name='最大长度',
                message=f'密码长度超出: 最多{self.policy.max_length}个字符，实际{length}个',
                expected=self.policy.max_length,
                actual=length
            ))

        return len(failures) == 0, failures

    def validate_uppercase(self, password: str) -> Tuple[bool, List[FailureReason]]:
        failures = []
        count = self._count_uppercase(password)

        if count < self.policy.min_uppercase:
            failures.append(FailureReason(
                rule_id='uppercase_min',
                rule_name='大写字母要求',
                message=f'大写字母数量不足: 需要{self.policy.min_uppercase}个，实际{count}个',
                expected=self.policy.min_uppercase,
                actual=count
            ))

        return len(failures) == 0, failures

    def validate_lowercase(self, password: str) -> Tuple[bool, List[FailureReason]]:
        failures = []
        count = self._count_lowercase(password)

        if count < self.policy.min_lowercase:
            failures.append(FailureReason(
                rule_id='lowercase_min',
                rule_name='小写字母要求',
                message=f'小写字母数量不足: 需要{self.policy.min_lowercase}个，实际{count}个',
                expected=self.policy.min_lowercase,
                actual=count
            ))

        return len(failures) == 0, failures

    def validate_digits(self, password: str) -> Tuple[bool, List[FailureReason]]:
        failures = []
        count = self._count_digits(password)

        if count < self.policy.min_digits:
            failures.append(FailureReason(
                rule_id='digit_min',
                rule_name='数字要求',
                message=f'数字数量不足: 需要{self.policy.min_digits}个，实际{count}个',
                expected=self.policy.min_digits,
                actual=count
            ))

        return len(failures) == 0, failures

    def validate_special(self, password: str) -> Tuple[bool, List[FailureReason]]:
        failures = []
        count = self._count_special(password)

        if count < self.policy.min_special:
            failures.append(FailureReason(
                rule_id='special_min',
                rule_name='特殊字符要求',
                message=f'特殊字符数量不足: 需要{self.policy.min_special}个，实际{count}个',
                expected=self.policy.min_special,
                actual=count
            ))

        return len(failures) == 0, failures

    def validate_character_classes(self, password: str) -> Tuple[bool, List[FailureReason]]:
        failures = []

        for cc in self.policy.character_classes:
            if cc.charset and cc.min_count > 0:
                count = sum(1 for c in password if c in cc.charset)
                if count < cc.min_count:
                    failures.append(FailureReason(
                        rule_id=f'custom_{cc.name}_min',
                        rule_name=f'自定义字符类-{cc.name}',
                        message=f'{cc.name}字符数量不足: 需要{cc.min_count}个，实际{count}个',
                        expected=cc.min_count,
                        actual=count
                    ))

        return len(failures) == 0, failures

    def validate_forbidden_patterns(self, password: str) -> Tuple[bool, List[FailureReason]]:
        failures = []

        for pattern in self.policy.forbidden_patterns:
            if re.search(pattern, password):
                failures.append(FailureReason(
                    rule_id='forbidden_pattern',
                    rule_name='禁用模式',
                    message=f'密码包含禁用模式: {pattern}',
                    expected=None,
                    actual=pattern
                ))

        return len(failures) == 0, failures

    def validate_consecutive(self, password: str) -> Tuple[bool, List[FailureReason]]:
        if not self.policy.forbid_consecutive:
            return True, []

        failures = []
        for i in range(len(password) - 2):
            if password[i] == password[i + 1] == password[i + 2]:
                failures.append(FailureReason(
                    rule_id='consecutive_chars',
                    rule_name='连续字符',
                    message=f'密码包含连续3个相同字符: "{password[i:i+3]}"',
                    expected=None,
                    actual=password[i:i+3]
                ))
                break

        return len(failures) == 0, failures

    def validate_password(self, sample: BoundarySample) -> PasswordResult:
        all_failures = []

        _, failures = self.validate_length(sample.password)
        all_failures.extend(failures)

        _, failures = self.validate_uppercase(sample.password)
        all_failures.extend(failures)

        _, failures = self.validate_lowercase(sample.password)
        all_failures.extend(failures)

        _, failures = self.validate_digits(sample.password)
        all_failures.extend(failures)

        _, failures = self.validate_special(sample.password)
        all_failures.extend(failures)

        _, failures = self.validate_character_classes(sample.password)
        all_failures.extend(failures)

        _, failures = self.validate_forbidden_patterns(sample.password)
        all_failures.extend(failures)

        _, failures = self.validate_consecutive(sample.password)
        all_failures.extend(failures)

        all_failures.sort(key=lambda x: x.rule_id)

        return PasswordResult(
            password=sample.password,
            is_valid=len(all_failures) == 0,
            failure_reasons=all_failures,
            test_group=sample.test_group,
            description=sample.description,
            source_file=sample.metadata.get('source_file'),
            line_number=sample.metadata.get('line_number'),
            character_classes=sample.character_classes,
            metadata=sample.metadata
        )

    def validate_batch(self, samples: List[BoundarySample]) -> List[PasswordResult]:
        results = []
        for sample in samples:
            result = self.validate_password(sample)
            results.append(result)
        return results
