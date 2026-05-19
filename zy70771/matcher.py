import re
from typing import List, Optional, Tuple, Dict, Any
from dataclasses import dataclass
from nginx_parser import LocationRule, LocationModifier, ServerBlock


@dataclass
class MatchResult:
    request_path: str
    matched_rule: Optional[LocationRule]
    matched_order: int
    all_candidates: List[LocationRule]
    match_process: List[str]
    is_match: bool


class NginxMatcher:
    def __init__(self):
        pass

    def match_path(
        self, request_path: str, locations: List[LocationRule]
    ) -> MatchResult:
        match_process = []
        all_candidates = []

        match_process.append(f"开始匹配路径: {request_path}")
        match_process.append(f"共有 {len(locations)} 条 location 规则")

        exact_match = self._find_exact_match(request_path, locations, match_process)
        if exact_match:
            all_candidates.append(exact_match)
            return MatchResult(
                request_path=request_path,
                matched_rule=exact_match,
                matched_order=0,
                all_candidates=all_candidates,
                match_process=match_process + ["精确匹配成功，终止匹配"],
                is_match=True,
            )

        prefix_matches = self._find_prefix_matches(
            request_path, locations, match_process
        )
        if prefix_matches:
            all_candidates.extend(prefix_matches)
            best_prefix = self._get_longest_prefix_match(prefix_matches)
            if best_prefix.modifier == LocationModifier.PREFIX:
                match_process.append(
                    f"最长前缀匹配使用 ^~ 修饰符，终止匹配: {best_prefix.pattern}"
                )
                return MatchResult(
                    request_path=request_path,
                    matched_rule=best_prefix,
                    matched_order=0,
                    all_candidates=all_candidates,
                    match_process=match_process,
                    is_match=True,
                )

        regex_match = self._find_regex_match(
            request_path, locations, match_process, all_candidates
        )
        if regex_match:
            return MatchResult(
                request_path=request_path,
                matched_rule=regex_match,
                matched_order=0,
                all_candidates=all_candidates,
                match_process=match_process,
                is_match=True,
            )

        if prefix_matches:
            best_prefix = self._get_longest_prefix_match(prefix_matches)
            match_process.append(f"使用最长前缀匹配: {best_prefix.pattern}")
            return MatchResult(
                request_path=request_path,
                matched_rule=best_prefix,
                matched_order=0,
                all_candidates=all_candidates,
                match_process=match_process,
                is_match=True,
            )

        match_process.append("没有找到任何匹配规则")
        return MatchResult(
            request_path=request_path,
            matched_rule=None,
            matched_order=-1,
            all_candidates=[],
            match_process=match_process,
            is_match=False,
        )

    def _find_exact_match(
        self,
        request_path: str,
        locations: List[LocationRule],
        match_process: List[str],
    ) -> Optional[LocationRule]:
        exact_locations = [
            loc for loc in locations if loc.modifier == LocationModifier.EXACT
        ]
        match_process.append(
            f"步骤1: 检查精确匹配 (=)，共 {len(exact_locations)} 条规则"
        )

        for loc in exact_locations:
            if loc.pattern == request_path:
                match_process.append(
                    f"  精确匹配成功: {loc.pattern} (第 {loc.line_number} 行)"
                )
                return loc
            match_process.append(f"  精确匹配失败: {loc.pattern}")

        match_process.append("  无精确匹配")
        return None

    def _find_prefix_matches(
        self,
        request_path: str,
        locations: List[LocationRule],
        match_process: List[str],
    ) -> List[LocationRule]:
        prefix_locations = [
            loc
            for loc in locations
            if loc.modifier in (LocationModifier.PREFIX, LocationModifier.NONE)
        ]
        match_process.append(
            f"步骤2: 检查前缀匹配 (^~ 和普通)，共 {len(prefix_locations)} 条规则"
        )

        matches = []
        for loc in prefix_locations:
            if request_path.startswith(loc.pattern):
                modifier_str = (
                    "^~" if loc.modifier == LocationModifier.PREFIX else "普通"
                )
                match_process.append(
                    f"  前缀匹配成功 ({modifier_str}): {loc.pattern} "
                    f"(长度: {len(loc.pattern)}) (第 {loc.line_number} 行)"
                )
                matches.append(loc)

        if not matches:
            match_process.append("  无前缀匹配")
        return matches

    def _get_longest_prefix_match(
        self, prefix_matches: List[LocationRule]
    ) -> LocationRule:
        return max(prefix_matches, key=lambda x: len(x.pattern))

    def _find_regex_match(
        self,
        request_path: str,
        locations: List[LocationRule],
        match_process: List[str],
        all_candidates: List[LocationRule],
    ) -> Optional[LocationRule]:
        regex_locations = [
            loc
            for loc in locations
            if loc.modifier
            in (LocationModifier.REGEX_CASE_SENSITIVE, LocationModifier.REGEX_CASE_INSENSITIVE)
        ]
        match_process.append(
            f"步骤3: 检查正则匹配 (~ 和 ~*)，按配置顺序，共 {len(regex_locations)} 条规则"
        )

        for idx, loc in enumerate(regex_locations):
            try:
                flags = 0
                if loc.modifier == LocationModifier.REGEX_CASE_INSENSITIVE:
                    flags = re.IGNORECASE

                if re.search(loc.pattern, request_path, flags):
                    modifier_str = (
                        "~*"
                        if loc.modifier == LocationModifier.REGEX_CASE_INSENSITIVE
                        else "~"
                    )
                    match_process.append(
                        f"  正则匹配成功 ({modifier_str}): {loc.pattern} "
                        f"(配置顺序第 {idx + 1} 个) (第 {loc.line_number} 行)"
                    )
                    all_candidates.append(loc)
                    return loc
                else:
                    match_process.append(f"  正则匹配失败: {loc.pattern}")
            except re.error as e:
                match_process.append(f"  正则表达式错误 {loc.pattern}: {str(e)}")

        match_process.append("  无正则匹配")
        return None

    def sort_locations_by_priority(
        self, locations: List[LocationRule]
    ) -> List[LocationRule]:
        def sort_key(loc: LocationRule) -> Tuple[int, int, str]:
            priority_order = {
                LocationModifier.EXACT: 4,
                LocationModifier.PREFIX: 3,
                LocationModifier.REGEX_CASE_SENSITIVE: 2,
                LocationModifier.REGEX_CASE_INSENSITIVE: 1,
                LocationModifier.NONE: 0,
            }
            return (
                -priority_order[loc.modifier],
                -len(loc.pattern),
                loc.line_number,
            )

        return sorted(locations, key=sort_key)

    def batch_test_paths(
        self, paths: List[str], server: ServerBlock
    ) -> List[Dict[str, Any]]:
        results = []
        for path in paths:
            result = self.match_path(path, server.locations)
            results.append(
                {
                    "path": path,
                    "matched": result.is_match,
                    "rule_pattern": result.matched_rule.pattern
                    if result.matched_rule
                    else None,
                    "rule_line": result.matched_rule.line_number
                    if result.matched_rule
                    else None,
                    "modifier": result.matched_rule.modifier.value
                    if result.matched_rule
                    else None,
                    "match_process": result.match_process,
                }
            )
        return results
