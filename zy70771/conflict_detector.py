import re
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum
from nginx_parser import LocationRule, LocationModifier, ServerBlock
from matcher import NginxMatcher, MatchResult


class ConflictType(Enum):
    SHADOWED_RULE = "shadowed_rule"
    REGEX_ORDER_ISSUE = "regex_order_issue"
    OVERLAPPING_PREFIX = "overlapping_prefix"
    UNREACHABLE_REGEX = "unreachable_regex"
    AMBIGUOUS_MATCH = "ambiguous_match"


@dataclass
class Conflict:
    conflict_type: ConflictType
    severity: str
    rules: List[LocationRule]
    affected_paths: List[str]
    explanation: str
    recommendation: str


class ConflictDetector:
    def __init__(self):
        self.matcher = NginxMatcher()

    def detect_all_conflicts(self, server: ServerBlock) -> List[Conflict]:
        conflicts = []

        conflicts.extend(self._detect_shadowed_rules(server))
        conflicts.extend(self._detect_regex_order_issues(server))
        conflicts.extend(self._detect_overlapping_prefixes(server))
        conflicts.extend(self._detect_unreachable_regex(server))
        conflicts.extend(self._detect_ambiguous_matches(server))

        return conflicts

    def _detect_shadowed_rules(self, server: ServerBlock) -> List[Conflict]:
        conflicts = []
        locations = server.locations

        for i, loc in enumerate(locations):
            shadowed_by = []
            for j, other_loc in enumerate(locations):
                if i == j:
                    continue

                if self._can_shadow(other_loc, loc):
                    test_paths = self._generate_test_paths(loc.pattern)
                    shadow_count = 0
                    for path in test_paths:
                        result = self.matcher.match_path(path, locations)
                        if (
                            result.matched_rule
                            and result.matched_rule == other_loc
                        ):
                            shadow_count += 1

                    if shadow_count > 0:
                        shadowed_by.append(other_loc)

            if shadowed_by:
                conflicts.append(
                    Conflict(
                        conflict_type=ConflictType.SHADOWED_RULE,
                        severity="high",
                        rules=[loc] + shadowed_by,
                        affected_paths=self._generate_test_paths(loc.pattern),
                        explanation=(
                            f"第 {loc.line_number} 行的 location 规则 '{loc.pattern}' "
                            f"被以下规则覆盖: {', '.join([f'第 {r.line_number} 行: {r.pattern}' for r in shadowed_by])}"
                        ),
                        recommendation=(
                            "建议: 1) 调整规则顺序; 2) 使用更具体的修饰符; "
                            "3) 合并重复规则"
                        ),
                    )
                )

        return conflicts

    def _can_shadow(self, shadowing: LocationRule, shadowed: LocationRule) -> bool:
        if shadowing.modifier == LocationModifier.EXACT:
            return False

        if shadowing.modifier == LocationModifier.PREFIX:
            if shadowed.modifier in (
                LocationModifier.REGEX_CASE_SENSITIVE,
                LocationModifier.REGEX_CASE_INSENSITIVE,
            ):
                return True

        if shadowing.modifier in (
            LocationModifier.REGEX_CASE_SENSITIVE,
            LocationModifier.REGEX_CASE_INSENSITIVE,
        ) and shadowed.modifier in (
            LocationModifier.REGEX_CASE_SENSITIVE,
            LocationModifier.REGEX_CASE_INSENSITIVE,
        ):
            return shadowing.line_number < shadowed.line_number

        if shadowed.modifier == LocationModifier.NONE:
            if len(shadowing.pattern) > len(shadowed.pattern):
                return True

        return False

    def _detect_regex_order_issues(self, server: ServerBlock) -> List[Conflict]:
        conflicts = []
        regex_locs = [
            loc
            for loc in server.locations
            if loc.modifier
            in (LocationModifier.REGEX_CASE_SENSITIVE, LocationModifier.REGEX_CASE_INSENSITIVE)
        ]

        for i, loc1 in enumerate(regex_locs):
            for j, loc2 in enumerate(regex_locs):
                if i >= j:
                    continue

                if self._regex_overlap(loc1, loc2) and loc1.line_number < loc2.line_number:
                    test_path = self._generate_overlap_test_path(loc1, loc2)
                    if test_path:
                        result = self.matcher.match_path(
                            test_path, server.locations
                        )
                        if result.matched_rule == loc1:
                            conflicts.append(
                                Conflict(
                                    conflict_type=ConflictType.REGEX_ORDER_ISSUE,
                                    severity="medium",
                                    rules=[loc1, loc2],
                                    affected_paths=[test_path],
                                    explanation=(
                                        f"正则表达式顺序问题: 第 {loc1.line_number} 行的 '{loc1.pattern}' "
                                        f"在第 {loc2.line_number} 行的 '{loc2.pattern}' 之前匹配，"
                                        f"导致后者永远不会匹配重叠的路径"
                                    ),
                                    recommendation=(
                                        "建议: 1) 将更具体的正则放在前面; "
                                        "2) 合并正则表达式; 3) 使用 ^~ 前缀优先"
                                    ),
                                )
                            )

        return conflicts

    def _detect_overlapping_prefixes(self, server: ServerBlock) -> List[Conflict]:
        conflicts = []
        prefix_locs = [
            loc
            for loc in server.locations
            if loc.modifier in (LocationModifier.PREFIX, LocationModifier.NONE)
        ]

        for i, loc1 in enumerate(prefix_locs):
            for j, loc2 in enumerate(prefix_locs):
                if i >= j:
                    continue

                if self._prefix_overlap(loc1, loc2):
                    conflicts.append(
                        Conflict(
                            conflict_type=ConflictType.OVERLAPPING_PREFIX,
                            severity="low",
                            rules=[loc1, loc2],
                            affected_paths=[
                                loc1.pattern + "example",
                                loc2.pattern + "test",
                            ],
                            explanation=(
                                f"前缀规则重叠: 第 {loc1.line_number} 行的 '{loc1.pattern}' "
                                f"与第 {loc2.line_number} 行的 '{loc2.pattern}' 存在重叠匹配区域"
                            ),
                            recommendation=(
                                "建议: 1) 确认是否预期这种重叠; "
                                "2) 考虑使用更精确的路径; 3) 添加 ^~ 修饰符给重要规则"
                            ),
                        )
                    )

        return conflicts

    def _detect_unreachable_regex(self, server: ServerBlock) -> List[Conflict]:
        conflicts = []
        regex_locs = [
            loc
            for loc in server.locations
            if loc.modifier
            in (LocationModifier.REGEX_CASE_SENSITIVE, LocationModifier.REGEX_CASE_INSENSITIVE)
        ]

        prefix_locs = [
            loc
            for loc in server.locations
            if loc.modifier == LocationModifier.PREFIX
        ]

        for regex_loc in regex_locs:
            unreachable_by = []
            for prefix_loc in prefix_locs:
                test_path = self._generate_regex_test_path(regex_loc)
                if test_path and test_path.startswith(prefix_loc.pattern):
                    result = self.matcher.match_path(
                        test_path, server.locations
                    )
                    if result.matched_rule == prefix_loc:
                        unreachable_by.append(prefix_loc)

            if unreachable_by:
                conflicts.append(
                    Conflict(
                        conflict_type=ConflictType.UNREACHABLE_REGEX,
                        severity="high",
                        rules=[regex_loc] + unreachable_by,
                        affected_paths=[
                            self._generate_regex_test_path(regex_loc)
                        ],
                        explanation=(
                            f"正则规则不可达: 第 {regex_loc.line_number} 行的 '{regex_loc.pattern}' "
                            f"被 ^~ 前缀规则永远覆盖"
                        ),
                        recommendation=(
                            "建议: 1) 移除不必要的 ^~ 修饰符; "
                            "2) 调整正则表达式使其不与前缀重叠; "
                            "3) 确认业务逻辑是否需要正则匹配"
                        ),
                    )
                )

        return conflicts

    def _detect_ambiguous_matches(self, server: ServerBlock) -> List[Conflict]:
        conflicts = []
        test_paths = self._generate_ambiguity_test_paths(server)

        for path in test_paths:
            matching_rules = []
            for loc in server.locations:
                if self._rule_can_match(loc, path):
                    matching_rules.append(loc)

            if len(matching_rules) >= 2:
                result = self.matcher.match_path(path, server.locations)
                if result.matched_rule:
                    other_rules = [
                        r for r in matching_rules if r != result.matched_rule
                    ]
                    conflicts.append(
                        Conflict(
                            conflict_type=ConflictType.AMBIGUOUS_MATCH,
                            severity="medium",
                            rules=[result.matched_rule] + other_rules,
                            affected_paths=[path],
                            explanation=(
                                f"路径 '{path}' 存在歧义匹配，可命中多条规则，"
                                f"实际命中第 {result.matched_rule.line_number} 行的 "
                                f"'{result.matched_rule.pattern}'"
                            ),
                            recommendation=(
                                "建议: 1) 使用精确匹配避免歧义; "
                                "2) 为重要规则添加 ^~ 修饰符; "
                                "3) 重写重叠的规则路径"
                            ),
                        )
                    )

        return conflicts

    def _regex_overlap(self, loc1: LocationRule, loc2: LocationRule) -> bool:
        try:
            test_strings = ["test", "path", "file.html", "image.jpg"]
            loc1_matches = any(
                re.search(loc1.pattern, s) for s in test_strings
            )
            loc2_matches = any(
                re.search(loc2.pattern, s) for s in test_strings
            )
            return loc1_matches and loc2_matches
        except re.error:
            return False

    def _prefix_overlap(self, loc1: LocationRule, loc2: LocationRule) -> bool:
        return loc1.pattern.startswith(
            loc2.pattern
        ) or loc2.pattern.startswith(loc1.pattern)

    def _generate_test_paths(self, pattern: str) -> List[str]:
        return [
            pattern,
            pattern + "/",
            pattern + "/test",
            pattern + ".html",
            pattern + "123",
        ]

    def _generate_overlap_test_path(
        self, loc1: LocationRule, loc2: LocationRule
    ) -> str:
        return "/test/overlap/path"

    def _generate_regex_test_path(self, loc: LocationRule) -> str:
        return "/test/path/file.html"

    def _generate_ambiguity_test_paths(self, server: ServerBlock) -> List[str]:
        paths = set()
        for loc in server.locations:
            if loc.modifier == LocationModifier.NONE:
                paths.add(loc.pattern + "/example")
                paths.add(loc.pattern + "/test/file.html")
            elif loc.modifier == LocationModifier.PREFIX:
                paths.add(loc.pattern + "/anything")
        return list(paths)

    def _rule_can_match(self, loc: LocationRule, path: str) -> bool:
        if loc.modifier == LocationModifier.EXACT:
            return loc.pattern == path
        elif loc.modifier in (LocationModifier.PREFIX, LocationModifier.NONE):
            return path.startswith(loc.pattern)
        else:
            try:
                flags = (
                    re.IGNORECASE
                    if loc.modifier == LocationModifier.REGEX_CASE_INSENSITIVE
                    else 0
                )
                return bool(re.search(loc.pattern, path, flags))
            except re.error:
                return False

    def explain_conflict(self, conflict: Conflict) -> Dict[str, Any]:
        return {
            "type": conflict.conflict_type.value,
            "severity": conflict.severity,
            "rules": [
                {
                    "line": r.line_number,
                    "pattern": r.pattern,
                    "modifier": r.modifier.value,
                    "raw": r.raw_line,
                }
                for r in conflict.rules
            ],
            "affected_paths": conflict.affected_paths,
            "explanation": conflict.explanation,
            "recommendation": conflict.recommendation,
        }
