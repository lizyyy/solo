import re
from typing import List, Dict, Any, Tuple


class RouteMatcher:
    def __init__(self, verbose: bool = False):
        self.verbose = verbose

    def analyze_server(self, server: Dict[str, Any]) -> None:
        locations = server["locations"]
        for loc in locations:
            if loc["match_type"] in ["regex", "regex_case_sensitive", "regex_case_insensitive"]:
                try:
                    flags = 0
                    if loc["match_type"] == "regex_case_insensitive":
                        flags = re.IGNORECASE
                    loc["compiled_regex"] = re.compile(loc["pattern"], flags)
                except re.error as e:
                    loc["regex_error"] = str(e)

        sorted_locations = sorted(
            locations,
            key=lambda x: (-x["priority"], -len(x["pattern"]))
        )
        server["sorted_locations"] = sorted_locations

        if self.verbose:
            print(f"  Server {server['name']}: {len(locations)} 个 location，已排序")

    def test_path(self, server: Dict[str, Any], path: str) -> List[Dict[str, Any]]:
        matches = []
        locations = server.get("sorted_locations", server["locations"])

        for loc in locations:
            match_result = self._match_location(loc, path)
            if match_result["matched"]:
                matches.append({
                    "location": loc,
                    "match_type": loc["match_type"],
                    "priority": loc["priority"],
                    "match_detail": match_result
                })

        return matches

    def _match_location(self, location: Dict[str, Any], path: str) -> Dict[str, Any]:
        pattern = location["pattern"]
        match_type = location["match_type"]

        if match_type == "exact":
            return {
                "matched": path == pattern,
                "method": "exact",
                "pattern": pattern
            }

        elif match_type in ["prefix", "prefix_no_regex"]:
            return {
                "matched": path.startswith(pattern),
                "method": "prefix",
                "pattern": pattern,
                "prefix_length": len(pattern)
            }

        elif match_type in ["regex", "regex_case_sensitive", "regex_case_insensitive"]:
            if "compiled_regex" in location:
                regex_match = location["compiled_regex"].search(path)
                return {
                    "matched": regex_match is not None,
                    "method": "regex",
                    "pattern": pattern,
                    "match_groups": regex_match.groups() if regex_match else None
                }
            else:
                return {
                    "matched": False,
                    "method": "regex",
                    "error": location.get("regex_error", "编译失败")
                }

        return {"matched": False, "method": "unknown"}

    def calculate_overlap(self, loc1: Dict[str, Any], loc2: Dict[str, Any]) -> Dict[str, Any]:
        pattern1 = loc1["pattern"]
        pattern2 = loc2["pattern"]

        if loc1["match_type"] in ["exact", "prefix", "prefix_no_regex"] and \
           loc2["match_type"] in ["exact", "prefix", "prefix_no_regex"]:
            return self._calculate_prefix_overlap(loc1, loc2)

        elif loc1["match_type"] in ["regex", "regex_case_sensitive", "regex_case_insensitive"] or \
             loc2["match_type"] in ["regex", "regex_case_sensitive", "regex_case_insensitive"]:
            return self._calculate_regex_overlap(loc1, loc2)

        return {"overlap_type": "unknown", "severity": "info"}

    def _calculate_prefix_overlap(self, loc1: Dict[str, Any], loc2: Dict[str, Any]) -> Dict[str, Any]:
        p1 = loc1["pattern"]
        p2 = loc2["pattern"]

        if p1 == p2:
            if loc1["priority"] == loc2["priority"]:
                return {
                    "overlap_type": "identical",
                    "severity": "error",
                    "description": "完全相同的路径模式，Nginx 将按配置顺序匹配"
                }
            else:
                higher = loc1 if loc1["priority"] > loc2["priority"] else loc2
                return {
                    "overlap_type": "shadowed",
                    "severity": "warning",
                    "description": f"{higher['raw']} 优先级更高，将覆盖另一个规则"
                }

        elif p1.startswith(p2):
            if loc1["priority"] > loc2["priority"]:
                return {
                    "overlap_type": "shadowed",
                    "severity": "warning",
                    "description": f"{loc1['raw']} 是 {loc2['raw']} 的子集但优先级更高，不会被覆盖"
                }
            elif loc1["priority"] == loc2["priority"]:
                return {
                    "overlap_type": "subset",
                    "severity": "warning",
                    "description": f"{loc1['raw']} 是 {loc2['raw']} 的子集，请求时按配置顺序匹配"
                }
            else:
                return {
                    "overlap_type": "shadowed",
                    "severity": "error",
                    "description": f"{loc1['raw']} 是 {loc2['raw']} 的子集但优先级更低，永远不会被匹配"
                }

        elif p2.startswith(p1):
            if loc2["priority"] > loc1["priority"]:
                return {
                    "overlap_type": "shadowed",
                    "severity": "warning",
                    "description": f"{loc2['raw']} 是 {loc1['raw']} 的子集但优先级更高，不会被覆盖"
                }
            elif loc1["priority"] == loc2["priority"]:
                return {
                    "overlap_type": "subset",
                    "severity": "warning",
                    "description": f"{loc2['raw']} 是 {loc1['raw']} 的子集，请求时按配置顺序匹配"
                }
            else:
                return {
                    "overlap_type": "shadowed",
                    "severity": "error",
                    "description": f"{loc2['raw']} 是 {loc1['raw']} 的子集但优先级更低，永远不会被匹配"
                }

        return {"overlap_type": "none", "severity": "info"}

    def _calculate_regex_overlap(self, loc1: Dict[str, Any], loc2: Dict[str, Any]) -> Dict[str, Any]:
        test_paths = [
            "/", "/api", "/api/v1", "/api/v1/users", "/static",
            "/static/index.html", "/admin", "/admin/login",
            "/health", "/healthz", "/v1/users", "/v2/users"
        ]

        common_matches = 0
        for path in test_paths:
            m1 = self._match_location(loc1, path)
            m2 = self._match_location(loc2, path)
            if m1["matched"] and m2["matched"]:
                common_matches += 1

        if common_matches > 0:
            if loc1["priority"] > loc2["priority"]:
                return {
                    "overlap_type": "regex_overlap",
                    "severity": "warning",
                    "description": f"正则表达式存在重叠，{loc1['raw']} 优先级更高，{common_matches}/{len(test_paths)} 个测试路径同时匹配"
                }
            elif loc1["priority"] == loc2["priority"]:
                return {
                    "overlap_type": "regex_overlap",
                    "severity": "warning",
                    "description": f"正则表达式存在重叠，优先级相同，按配置顺序匹配，{common_matches}/{len(test_paths)} 个测试路径同时匹配"
                }
            else:
                return {
                    "overlap_type": "regex_shadowed",
                    "severity": "error",
                    "description": f"{loc1['raw']} 被 {loc2['raw']} 覆盖，永远不会被匹配"
                }

        return {"overlap_type": "none", "severity": "info"}
