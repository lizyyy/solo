import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Any, Set, Optional

from ua_parse import LogEntry


@dataclass
class PathStats:
    path: str
    count: int = 0
    categories: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    status_codes: Dict[int, int] = field(default_factory=lambda: defaultdict(int))
    ips: Set[str] = field(default_factory=set)
    user_agents: Set[str] = field(default_factory=set)


class PathAnalyzer:
    def __init__(self):
        self.path_stats: Dict[str, PathStats] = defaultdict(lambda: PathStats(path=""))
        self.signature_stats: Dict[str, PathStats] = defaultdict(lambda: PathStats(path=""))
        self.suspicious_patterns = [
            r"\.\./", r"/etc/", r"/proc/", r"/windows/",
            r"wp-admin", r"wp-login", r"xmlrpc",
            r"\.env", r"\.git", r"\.bak", r"\.sql",
            r"phpmyadmin", r"admin", r"login",
            r"api/v", r"graphql", r"oauth"
        ]
        self.compiled_patterns = [re.compile(p, re.IGNORECASE) for p in self.suspicious_patterns]
    
    def add_entry(self, entry: LogEntry):
        if entry.path:
            stats = self.path_stats[entry.path]
            stats.path = entry.path
            stats.count += 1
            stats.categories[entry.category] += 1
            if entry.status:
                stats.status_codes[entry.status] += 1
            if entry.ip:
                stats.ips.add(entry.ip)
            if entry.user_agent:
                stats.user_agents.add(entry.user_agent)
        
        if entry.path_signature:
            sig_stats = self.signature_stats[entry.path_signature]
            sig_stats.path = entry.path_signature
            sig_stats.count += 1
            sig_stats.categories[entry.category] += 1
            if entry.status:
                sig_stats.status_codes[entry.status] += 1
            if entry.ip:
                sig_stats.ips.add(entry.ip)
            if entry.user_agent:
                sig_stats.user_agents.add(entry.user_agent)
    
    def get_top_paths(self, limit: int = 20, category: Optional[str] = None) -> List[Dict[str, Any]]:
        paths = list(self.path_stats.values())
        if category:
            paths = [p for p in paths if p.categories.get(category, 0) > 0]
            paths.sort(key=lambda p: -p.categories.get(category, 0))
        else:
            paths.sort(key=lambda p: -p.count)
        
        return [
            {
                "path": p.path,
                "count": p.count,
                "top_category": max(p.categories.items(), key=lambda x: x[1])[0] if p.categories else "unknown",
                "unique_ips": len(p.ips),
                "unique_uas": len(p.user_agents)
            }
            for p in paths[:limit]
        ]
    
    def get_top_signatures(self, limit: int = 20) -> List[Dict[str, Any]]:
        sigs = sorted(self.signature_stats.values(), key=lambda p: -p.count)
        return [
            {
                "signature": s.path,
                "count": s.count,
                "top_category": max(s.categories.items(), key=lambda x: x[1])[0] if s.categories else "unknown",
                "unique_ips": len(s.ips),
                "unique_uas": len(s.user_agents)
            }
            for s in sigs[:limit]
        ]
    
    def get_suspicious_paths(self, risk_threshold: int = 10) -> List[Dict[str, Any]]:
        suspicious = []
        for path, stats in self.path_stats.items():
            risk_count = stats.categories.get("risk", 0) + stats.categories.get("unknown", 0)
            if risk_count >= risk_threshold:
                suspicious.append({
                    "path": path,
                    "total": stats.count,
                    "risk_count": risk_count,
                    "risk_ratio": round(risk_count / stats.count, 3),
                    "status_distribution": dict(stats.status_codes)
                })
        
        return sorted(suspicious, key=lambda x: -x["risk_ratio"])
    
    def summarize(self) -> Dict[str, Any]:
        total_requests = sum(s.count for s in self.path_stats.values())
        return {
            "unique_paths": len(self.path_stats),
            "unique_signatures": len(self.signature_stats),
            "total_requests": total_requests,
            "top_paths": self.get_top_paths(10),
            "top_signatures": self.get_top_signatures(10),
            "category_distribution": self._get_category_distribution()
        }
    
    def _get_category_distribution(self) -> Dict[str, int]:
        dist: Dict[str, int] = defaultdict(int)
        for stats in self.path_stats.values():
            for cat, count in stats.categories.items():
                dist[cat] += count
        return dict(dist)