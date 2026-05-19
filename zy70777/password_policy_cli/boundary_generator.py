import itertools
import string
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from .policy_parser import PasswordPolicy, CharacterClassRule


@dataclass
class BoundarySample:
    password: str
    test_group: str
    description: str
    character_classes: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class BoundaryGenerator:
    UPPERCASE = string.ascii_uppercase
    LOWERCASE = string.ascii_lowercase
    DIGITS = string.digits

    def __init__(self, policy: PasswordPolicy):
        self.policy = policy
        self.special_chars = policy.special_chars

    def _get_base_char(self, char_type: str) -> str:
        if char_type == 'uppercase':
            return 'A'
        elif char_type == 'lowercase':
            return 'a'
        elif char_type == 'digit':
            return '1'
        elif char_type == 'special':
            return self.special_chars[0] if self.special_chars else '!'
        return 'a'

    def _fill_password(self, base_chars: List[str], target_length: int, fill_chars: str = 'ab') -> str:
        result = list(base_chars)
        fill_idx = 0
        while len(result) < target_length:
            result.append(fill_chars[fill_idx % len(fill_chars)])
            fill_idx += 1
        return ''.join(result[:target_length])

    def _generate_nonconsecutive(self, length: int, chars: str = 'ab') -> str:
        result = []
        for i in range(length):
            result.append(chars[i % len(chars)])
        return ''.join(result)

    def generate_length_boundaries(self) -> List[BoundarySample]:
        samples = []
        min_len = self.policy.min_length
        max_len = self.policy.max_length

        if min_len > 0:
            samples.append(BoundarySample(
                password=self._generate_nonconsecutive(min_len - 1),
                test_group='length_boundary',
                description=f'长度小于最小值 ({min_len - 1} < {min_len})',
                character_classes=['lowercase'],
                metadata={'length': min_len - 1, 'boundary': 'below_min'}
            ))

            samples.append(BoundarySample(
                password=self._generate_nonconsecutive(min_len),
                test_group='length_boundary',
                description=f'长度等于最小值 ({min_len})',
                character_classes=['lowercase'],
                metadata={'length': min_len, 'boundary': 'min'}
            ))

        if max_len > 0:
            samples.append(BoundarySample(
                password=self._generate_nonconsecutive(max_len),
                test_group='length_boundary',
                description=f'长度等于最大值 ({max_len})',
                character_classes=['lowercase'],
                metadata={'length': max_len, 'boundary': 'max'}
            ))

            samples.append(BoundarySample(
                password=self._generate_nonconsecutive(max_len + 1),
                test_group='length_boundary',
                description=f'长度大于最大值 ({max_len + 1} > {max_len})',
                character_classes=['lowercase'],
                metadata={'length': max_len + 1, 'boundary': 'above_max'}
            ))

        return samples

    def generate_character_class_boundaries(self) -> List[BoundarySample]:
        samples = []
        base_length = max(self.policy.min_length, 8)

        requirements = [
            ('uppercase', self.policy.min_uppercase, self.UPPERCASE[0]),
            ('lowercase', self.policy.min_lowercase, self.LOWERCASE[0]),
            ('digit', self.policy.min_digits, self.DIGITS[0]),
            ('special', self.policy.min_special, self.special_chars[0] if self.special_chars else '!'),
        ]

        for char_type, min_count, base_char in requirements:
            if min_count > 0:
                base_chars = []
                for ct, mc, bc in requirements:
                    if ct != char_type:
                        base_chars.extend([bc] * max(1, self.policy.min_digits if ct == 'digit' else 1))

                samples.append(BoundarySample(
                    password=self._fill_password(
                        [base_char] * (min_count - 1) + [bc for bc in base_chars],
                        base_length
                    ),
                    test_group=f'{char_type}_boundary',
                    description=f'{char_type}字符数不足 (需要{min_count}, 实际{min_count - 1})',
                    character_classes=[ct for ct, _, _ in requirements if ct != char_type],
                    metadata={'char_type': char_type, 'required': min_count, 'actual': min_count - 1}
                ))

                samples.append(BoundarySample(
                    password=self._fill_password(
                        [base_char] * min_count + [bc for bc in base_chars],
                        base_length
                    ),
                    test_group=f'{char_type}_boundary',
                    description=f'{char_type}字符数刚好满足 (需要{min_count}, 实际{min_count})',
                    character_classes=[char_type] + [ct for ct, _, _ in requirements if ct != char_type],
                    metadata={'char_type': char_type, 'required': min_count, 'actual': min_count}
                ))

        return samples

    def generate_special_char_boundaries(self) -> List[BoundarySample]:
        samples = []
        base_length = max(self.policy.min_length, 8)

        if self.policy.min_special > 0 and self.special_chars:
            for i, special_char in enumerate(self.special_chars):
                base_chars = (
                    ['A'] * max(1, self.policy.min_uppercase) +
                    ['a'] * max(1, self.policy.min_lowercase) +
                    ['1'] * max(1, self.policy.min_digits) +
                    [special_char] * self.policy.min_special
                )
                samples.append(BoundarySample(
                    password=self._fill_password(base_chars, base_length),
                    test_group='special_char_variants',
                    description=f'使用特殊字符: {repr(special_char)}',
                    character_classes=['uppercase', 'lowercase', 'digit', 'special'],
                    metadata={'special_char': special_char, 'char_index': i}
                ))

        return samples

    def generate_custom_class_boundaries(self) -> List[BoundarySample]:
        samples = []
        base_length = max(self.policy.min_length, 8)

        for cc_rule in self.policy.character_classes:
            if cc_rule.min_count > 0 and cc_rule.charset:
                base_char = cc_rule.charset[0]

                base_chars = (
                    ['A'] * max(1, self.policy.min_uppercase) +
                    ['a'] * max(1, self.policy.min_lowercase) +
                    ['1'] * max(1, self.policy.min_digits)
                )

                samples.append(BoundarySample(
                    password=self._fill_password(
                        [base_char] * (cc_rule.min_count - 1) + base_chars,
                        base_length
                    ),
                    test_group=f'custom_{cc_rule.name}_boundary',
                    description=f'自定义字符类{cc_rule.name}不足 (需要{cc_rule.min_count}, 实际{cc_rule.min_count - 1})',
                    character_classes=['uppercase', 'lowercase', 'digit'],
                    metadata={'custom_class': cc_rule.name, 'required': cc_rule.min_count, 'actual': cc_rule.min_count - 1}
                ))

                samples.append(BoundarySample(
                    password=self._fill_password(
                        [base_char] * cc_rule.min_count + base_chars,
                        base_length
                    ),
                    test_group=f'custom_{cc_rule.name}_boundary',
                    description=f'自定义字符类{cc_rule.name}刚好满足 (需要{cc_rule.min_count}, 实际{cc_rule.min_count})',
                    character_classes=['uppercase', 'lowercase', 'digit', cc_rule.name],
                    metadata={'custom_class': cc_rule.name, 'required': cc_rule.min_count, 'actual': cc_rule.min_count}
                ))

        return samples

    def generate_all_boundaries(self) -> List[BoundarySample]:
        samples = []
        samples.extend(self.generate_length_boundaries())
        samples.extend(self.generate_character_class_boundaries())
        samples.extend(self.generate_special_char_boundaries())
        samples.extend(self.generate_custom_class_boundaries())
        return samples

    @staticmethod
    def load_candidates_from_file(file_path: str) -> List[BoundarySample]:
        from pathlib import Path
        samples = []
        path = Path(file_path)

        with open(path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.rstrip('\n')
                if not line or line.startswith('#'):
                    continue

                parts = line.split('\t')
                password = parts[0]
                test_group = parts[1] if len(parts) > 1 else 'candidate'
                description = parts[2] if len(parts) > 2 else f'候选密码: {password}'

                samples.append(BoundarySample(
                    password=password,
                    test_group=test_group,
                    description=description,
                    metadata={'source_file': str(path), 'line_number': line_num}
                ))

        return samples
