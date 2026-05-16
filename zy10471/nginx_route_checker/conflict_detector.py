from typing import List, Dict, Any
from .matcher import RouteMatcher


class ConflictDetector:
    def __init__(self, strict: bool = False, verbose: bool = False):
        self.strict = strict
        self.verbose = verbose
        self.matcher = RouteMatcher(verbose=verbose)

    def detect_conflicts(self, servers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        all_conflicts = []

        for server in servers:
            server_conflicts = self._detect_server_conflicts(server)
            all_conflicts.extend(server_conflicts)

        if self.verbose:
            print(f"  检测到 {len(all_conflicts)} 个冲突")

        return all_conflicts

    def _detect_server_conflicts(self, server: Dict[str, Any]) -> List[Dict[str, Any]]:
        conflicts = []
        locations = server["locations"]
        n = len(locations)

        for i in range(n):
            for j in range(i + 1, n):
                loc1 = locations[i]
                loc2 = locations[j]

                overlap = self.matcher.calculate_overlap(loc1, loc2)

                if overlap["overlap_type"] != "none":
                    if overlap["severity"] == "error" or \
                       (self.strict and overlap["severity"] == "warning"):
                        severity = "error"
                    else:
                        severity = overlap["severity"]

                    conflict = {
                        "server_name": server["name"],
                        "server_file": server["file"],
                        "location1": {
                            "raw": loc1["raw"],
                            "file": loc1["file"],
                            "line": loc1["start_line"],
                            "match_type": loc1["match_type"],
                            "priority": loc1["priority"]
                        },
                        "location2": {
                            "raw": loc2["raw"],
                            "file": loc2["file"],
                            "line": loc2["start_line"],
                            "match_type": loc2["match_type"],
                            "priority": loc2["priority"]
                        },
                        "overlap_type": overlap["overlap_type"],
                        "severity": severity,
                        "description": overlap["description"],
                        "impact": self._calculate_impact(loc1, loc2, overlap)
                    }
                    conflicts.append(conflict)

        return conflicts

    def _calculate_impact(self, loc1: Dict[str, Any], loc2: Dict[str, Any], overlap: Dict[str, Any]) -> str:
        if overlap["severity"] == "error":
            return "高 - 某些路径规则永远不会被匹配"
        elif overlap["severity"] == "warning":
            return "中 - 可能导致意外的路由行为"
        else:
            return "低 - 潜在的配置冗余"
