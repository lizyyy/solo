import fnmatch
import re
from typing import List, Optional, Tuple

from .models import LoggerRule


def is_wildcard_pattern(pattern: str) -> bool:
    return '*' in pattern or '?' in pattern


def pattern_to_regex(pattern: str) -> re.Pattern:
    regex_pattern = fnmatch.translate(pattern)
    if pattern.endswith('.*'):
        regex_pattern = regex_pattern.replace(r'\Z', r'(\..*)?\Z')
    elif not pattern.endswith('*'):
        regex_pattern = regex_pattern.replace(r'\Z', r'(\..*)?\Z')
    return re.compile(regex_pattern)


def matches_package(pattern: str, package_name: str) -> Tuple[bool, int]:
    pattern_lower = pattern.lower()
    package_lower = package_name.lower()
    
    if pattern_lower == package_lower:
        return True, len(package_name.split('.')) * 1000
    
    if not is_wildcard_pattern(pattern):
        if package_lower.startswith(pattern_lower + '.'):
            return True, len(pattern.split('.')) * 100
        return False, 0
    
    regex = pattern_to_regex(pattern_lower)
    if regex.match(package_lower):
        specificity = _calculate_specificity(pattern_lower, package_lower)
        return True, specificity
    return False, 0


def _calculate_specificity(pattern: str, package_name: str) -> int:
    pattern_parts = pattern.split('.')
    package_parts = package_name.split('.')
    
    exact_matches = 0
    wildcard_count = pattern.count('*') + pattern.count('?')
    
    for i, (p_part, pkg_part) in enumerate(zip(pattern_parts, package_parts)):
        if p_part == pkg_part:
            exact_matches += 1
        elif '*' in p_part or '?' in p_part:
            exact_matches += 0.5
    
    base_score = exact_matches * 100
    wildcard_penalty = wildcard_count * 10
    length_bonus = len(pattern_parts) * 5
    
    return int(base_score - wildcard_penalty + length_bonus)


def find_matching_rules(
    package_name: str,
    rules: List[LoggerRule]
) -> List[Tuple[LoggerRule, int]]:
    matches = []
    for rule in rules:
        is_match, specificity = matches_package(rule.package_pattern, package_name)
        if is_match:
            matches.append((rule, specificity + rule.source.priority * 10000))
    matches.sort(key=lambda x: -x[1])
    return matches


def resolve_package_level(
    package_name: str,
    rules: List[LoggerRule],
    root_level: Optional[str] = None
) -> Tuple[str, List[LoggerRule]]:
    matching = find_matching_rules(package_name, rules)
    
    if matching:
        chain = [rule for rule, _ in matching]
        final_level = matching[0][0].level
        return final_level, chain
    
    parent_parts = package_name.split('.')
    while parent_parts:
        parent_parts.pop()
        if not parent_parts:
            break
        parent_package = '.'.join(parent_parts)
        for rule in rules:
            if rule.package_pattern == parent_package:
                return rule.level, [rule]
    
    return root_level or "INFO", []
