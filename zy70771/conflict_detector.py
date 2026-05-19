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
    DUPLICATE_RULE = "duplicate_rule"


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

        conflicts.extend(self._detect_regex_order_issues(server))
        conflicts.extend(self._detect_shadowed_rules(server))
        conflicts.extend(self._detect_overlapping_prefixes(server))
        conflicts.extend(self._detect_unreachable_regex(server))
        conflicts.extend(self._detect_ambiguous_matches(server))
        conflicts.extend(self._detect_duplicate_rules(server))

        rule_pairs_seen = {}
        severity_order = {"high": 0, "medium": 1, "low": 2}
        type_precedence = {
            ConflictType.REGEX_ORDER_ISSUE: 0,
            ConflictType.DUPLICATE_RULE: 1,
            ConflictType.UNREACHABLE_REGEX: 2,
            ConflictType.SHADOWED_RULE: 3,
            ConflictType.AMBIGUOUS_MATCH: 4,
            ConflictType.OVERLAPPING_PREFIX: 5,
        }
        final_conflicts = []

        for conflict in sorted(
                conflicts,
                key=lambda c: (
                    severity_order.get(c.severity, 99),
                    type_precedence.get(c.conflict_type, 99)
                )
        ):
            rule_pair = tuple(sorted([r.line_number for r in conflict.rules]))

            if rule_pair in rule_pairs_seen:
                existing_type = rule_pairs_seen[rule_pair]
                if (type_precedence.get(conflict.conflict_type, 99) >=
                        type_precedence.get(existing_type, 99)):
                    continue

            is_duplicate = False
            for existing in list(rule_pairs_seen.keys()):
                if set(existing) == set(rule_pair):
                    is_duplicate = True
                    break

            if not is_duplicate or conflict.conflict_type in [
                ConflictType.AMBIGUOUS_MATCH,
                ConflictType.OVERLAPPING_PREFIX
            ]:
                rule_pairs_seen[rule_pair] = conflict.conflict_type
                final_conflicts.append(conflict)

        return final_conflicts

    def _detect_shadowed_rules(self, server: ServerBlock) -> List[Conflict]:
        conflicts = []
        locations = server.locations

        for i, loc in enumerate(locations):
            if loc.modifier == LocationModifier.EXACT:
                continue

            shadowed_by = []
            test_paths = self._generate_realistic_test_paths(loc)

            for j, other_loc in enumerate(locations):
                if i == j:
                    continue

                shadow_count = 0
                for path in test_paths:
                    result = self.matcher.match_path(path, locations)
                    if result.matched_rule and result.matched_rule == other_loc:
                        shadow_count += 1

                if shadow_count == len(test_paths) and shadow_count > 0:
                    shadowed_by.append(other_loc)

            if shadowed_by:
                conflicts.append(
                    Conflict(
                        conflict_type=ConflictType.SHADOWED_RULE,
                        severity="high",
                        rules=[loc] + shadowed_by,
                        affected_paths=test_paths[:3],
                        explanation=(
                            f"第 {loc.line_number} 行的规则 '{loc.pattern}' "
                            f"被完全覆盖，永远不会被匹配。覆盖它的规则: "
                            f"{', '.join([f'第 {r.line_number} 行: {r.pattern}' for r in shadowed_by])}"
                        ),
                        recommendation=(
                            "建议: 1) 调整规则顺序; 2) 使用更具体的修饰符; "
                            "3) 移除或合并被覆盖的规则"
                        ),
                    )
                )

        return conflicts

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

                if loc1.pattern == loc2.pattern and loc1.line_number < loc2.line_number:
                    conflicts.append(
                        Conflict(
                            conflict_type=ConflictType.REGEX_ORDER_ISSUE,
                            severity="high",
                            rules=[loc1, loc2],
                            affected_paths=["/test/file" + loc1.pattern.replace("\\", "")],
                            explanation=(
                                f"正则完全相同的正则表达式: 第 {loc1.line_number} 行的 '{loc1.pattern}' "
                                f"与第 {loc2.line_number} 行完全相同，后者永远不会被匹配"
                            ),
                            recommendation=(
                                "建议: 1) 删除重复的规则; 2) 合并重复规则的配置内容"
                            ),
                        )
                    )
                    continue

                if self._regex_has_overlap(loc1.pattern, loc2.pattern):
                    test_paths = self._generate_regex_overlap_paths(loc1.pattern, loc2.pattern)
                    if test_paths:
                        all_match_loc1 = True
                        for path in test_paths:
                            result = self.matcher.match_path(path, server.locations)
                            if result.matched_rule != loc1:
                                all_match_loc1 = False
                                break

                        if all_match_loc1:
                            conflicts.append(
                                Conflict(
                                    conflict_type=ConflictType.REGEX_ORDER_ISSUE,
                                    severity="medium",
                                    rules=[loc1, loc2],
                                    affected_paths=test_paths[:2],
                                    explanation=(
                                        f"正则表达式顺序问题: 第 {loc1.line_number} 行的 '{loc1.pattern}' "
                                        f"在第 {loc2.line_number} 行的 '{loc2.pattern}' 之前，"
                                        f"导致后者永远不会匹配重叠的路径"
                                    ),
                                    recommendation=(
                                        "建议: 1) 将更具体的正则放在前面; "
                                        "2) 合并正则表达式; 3) 调整正则避免重叠"
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

        root_prefix = None
        for loc in prefix_locs:
            if loc.pattern == "/":
                root_prefix = loc
                break

        meaningful_prefixes = [
            loc for loc in prefix_locs
            if loc.pattern != "/" and len(loc.pattern) > 1
        ]

        for i, loc1 in enumerate(meaningful_prefixes):
            for j, loc2 in enumerate(meaningful_prefixes):
                if i >= j:
                    continue

                if loc1.pattern.startswith(loc2.pattern) or loc2.pattern.startswith(loc1.pattern):
                    shorter = loc1 if len(loc1.pattern) < len(loc2.pattern) else loc2
                    longer = loc2 if len(loc1.pattern) < len(loc2.pattern) else loc1

                    test_path = longer.pattern + "test"
                    result = self.matcher.match_path(test_path, server.locations)

                    if result.matched_rule == longer:
                        continue

                    if longer.modifier == LocationModifier.PREFIX and shorter.modifier == LocationModifier.NONE:
                        severity = "low"
                    elif longer.modifier == LocationModifier.NONE and shorter.modifier == LocationModifier.NONE:
                            continue
                    else:
                        severity = "medium"

                    conflicts.append(
                        Conflict(
                            conflict_type=ConflictType.OVERLAPPING_PREFIX,
                            severity=severity,
                            rules=[shorter, longer],
                            affected_paths=[test_path],
                            explanation=(
                                f"前缀规则重叠: 第 {shorter.line_number} 行的 '{shorter.pattern}' "
                                f"与第 {longer.line_number} 行的 '{longer.pattern}' 存在重叠"
                            ),
                            recommendation=(
                                "建议: 1) 确认是否预期这种重叠; "
                                "2) 为更长的前缀添加 ^~ 修饰符确保优先匹配"
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
            regex_test_paths = self._generate_regex_overlap_paths(regex_loc.pattern, regex_loc.pattern)

            for prefix_loc in prefix_locs:
                all_covered = True
                for test_path in regex_test_paths:
                    if test_path.startswith(prefix_loc.pattern):
                        result = self.matcher.match_path(test_path, server.locations)
                        if result.matched_rule != prefix_loc:
                            all_covered = False
                            break
                    else:
                        all_covered = False
                        break

                if all_covered and regex_test_paths:
                    unreachable_by.append(prefix_loc)

            if unreachable_by:
                conflicts.append(
                    Conflict(
                        conflict_type=ConflictType.UNREACHABLE_REGEX,
                        severity="high",
                        rules=[regex_loc] + unreachable_by,
                        affected_paths=regex_test_paths[:2],
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

                    has_regex_involved = any(
                        r.modifier in (
                            LocationModifier.REGEX_CASE_SENSITIVE,
                            LocationModifier.REGEX_CASE_INSENSITIVE
                        )
                        for r in matching_rules
                    )

                    has_exact_involved = any(
                        r.modifier == LocationModifier.EXACT
                        for r in matching_rules
                    )

                    is_all_prefix = all(
                        r.modifier in (LocationModifier.NONE, LocationModifier.PREFIX)
                        for r in matching_rules
                    )

                    if has_exact_involved:
                        continue

                    if is_all_prefix:
                        continue

                    if has_regex_involved:
                        if result.matched_rule.modifier in (
                            LocationModifier.REGEX_CASE_SENSITIVE,
                            LocationModifier.REGEX_CASE_INSENSITIVE
                        ):
                            continue

                        if result.matched_rule.modifier == LocationModifier.PREFIX:
                            continue

                        longest_prefix = max(
                            [r for r in matching_rules
                                if r.modifier in (LocationModifier.PREFIX, LocationModifier.NONE)],
                            key=lambda x: len(x.pattern),
                            default=None
                        )
                        if longest_prefix == result.matched_rule:
                            continue

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

    def _detect_duplicate_rules(self, server: ServerBlock) -> List[Conflict]:
        conflicts = []
        locations = server.locations

        for i, loc1 in enumerate(locations):
            for j, loc2 in enumerate(locations):
                if i >= j:
                    continue

                if (loc1.modifier == loc2.modifier and
                        loc1.pattern == loc2.pattern):
                    conflicts.append(
                        Conflict(
                            conflict_type=ConflictType.DUPLICATE_RULE,
                            severity="medium",
                            rules=[loc1, loc2],
                            affected_paths=[loc1.pattern + "test"],
                            explanation=(
                                f"重复规则: 第 {loc1.line_number} 行与第 {loc2.line_number} 行 "
                                f"的规则完全相同 (修饰符: {loc1.modifier.value}, 模式: {loc1.pattern})"
                            ),
                            recommendation=(
                                "建议: 1) 删除重复的规则; 2) 合并重复规则的配置内容"
                            ),
                        )
                    )

        return conflicts

    def _regex_has_overlap(self, pattern1: str, pattern2: str) -> bool:
        try:
            test_strings = [
                "/test/file.html", "/images/photo.jpg",
                "/api/v1/test", "/static/css/style.css",
                "/admin/index.php", "/test.php"
            ]
            for s in test_strings:
                if re.search(pattern1, s) and re.search(pattern2, s):
                    return True
            return False
        except re.error:
            return False

    def _generate_regex_overlap_paths(self, pattern1: str, pattern2: str) -> List[str]:
        paths = []
        test_strings = [
            "/test/file.html", "/images/photo.jpg",
            "/api/v1/test", "/static/css/style.css",
            "/admin/index.php", "/test.php"
        ]
        try:
            for s in test_strings:
                if re.search(pattern1, s) and re.search(pattern2, s):
                    paths.append(s)
        except re.error:
            pass
        return paths[:3]

    def _generate_realistic_test_paths(self, loc: LocationRule) -> List[str]:
        paths = []
        if loc.modifier in (LocationModifier.NONE, LocationModifier.PREFIX):
            paths.extend([
                loc.pattern,
                loc.pattern + "index.html",
                loc.pattern + "subdir/file.jpg",
                loc.pattern + "test.php",
            ])
        else:
            paths = self._generate_regex_overlap_paths(loc.pattern, loc.pattern)
            if not paths:
                paths = ["/test/file.html", "/test.jpg", "/test.php"]
        return paths[:4]

    def _generate_ambiguity_test_paths(self, server: ServerBlock) -> List[str]:
        paths = set()
        for loc in server.locations:
            if loc.modifier in (LocationModifier.NONE, LocationModifier.PREFIX):
                if len(loc.pattern) > 2:
                    paths.add(loc.pattern + "test/file.html")
                    paths.add(loc.pattern + "image.jpg")
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
