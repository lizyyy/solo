import hashlib
import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Set, Optional, Any, Tuple
from difflib import SequenceMatcher

from ua_parse import LogEntry, ParsedUA


@dataclass
class Cluster:
    cluster_id: str
    category: str
    samples: List[LogEntry] = field(default_factory=list)
    common_patterns: List[str] = field(default_factory=list)
    representative: str = ""
    ip_count: int = 0
    path_count: int = 0
    total_requests: int = 0


class UnknownSampleCluster:
    def __init__(self, min_cluster_size: int = 3, similarity_threshold: float = 0.7):
        self.min_cluster_size = min_cluster_size
        self.similarity_threshold = similarity_threshold
        self.clusters: Dict[str, Cluster] = {}
        self.ua_to_cluster: Dict[str, str] = {}
        self.ip_to_cluster: Dict[str, str] = {}
    
    def _get_ua_features(self, ua: str, parsed_ua: Optional[ParsedUA]) -> List[str]:
        features = []
        
        if parsed_ua:
            features.append(f"fam:{parsed_ua.family}")
            features.append(f"os:{parsed_ua.os_family}")
            features.append(f"dev:{parsed_ua.device_family}")
            if parsed_ua.is_bot:
                features.append("bot:true")
            if parsed_ua.is_mobile:
                features.append("mobile:true")
        
        if ua:
            tokens = re.findall(r'[a-zA-Z]{2,}', ua.lower())
            features.extend([f"tok:{t}" for t in set(tokens) if len(t) > 2])
        
        return features
    
    def _hash_features(self, features: List[str]) -> str:
        sorted_features = sorted(features)
        feature_str = "|".join(sorted_features[:20])
        return hashlib.md5(feature_str.encode("utf-8")).hexdigest()[:8]
    
    def _similarity(self, s1: str, s2: str) -> float:
        if not s1 or not s2:
            return 0.0
        return SequenceMatcher(None, s1.lower(), s2.lower()).ratio()
    
    def add_entries(self, entries: List[LogEntry], category: str = "unknown"):
        ua_groups: Dict[str, List[LogEntry]] = defaultdict(list)
        ip_groups: Dict[str, List[LogEntry]] = defaultdict(list)
        
        for entry in entries:
            if entry.user_agent:
                ua_groups[entry.user_agent].append(entry)
            if entry.ip:
                ip_groups[entry.ip].append(entry)
        
        feature_groups: Dict[str, List[LogEntry]] = defaultdict(list)
        
        for ua, ua_entries in ua_groups.items():
            parsed_ua = ua_entries[0].parsed_ua if ua_entries else None
            features = self._get_ua_features(ua, parsed_ua)
            feature_hash = self._hash_features(features)
            feature_groups[feature_hash].extend(ua_entries)
        
        similar_groups: Dict[str, List[LogEntry]] = defaultdict(list)
        processed_hashes: Set[str] = set()
        
        all_hashes = list(feature_groups.keys())
        for i, hash1 in enumerate(all_hashes):
            if hash1 in processed_hashes:
                continue
            
            group_key = hash1
            entries1 = feature_groups[hash1]
            ua1 = entries1[0].user_agent if entries1 else ""
            
            similar_groups[group_key].extend(entries1)
            processed_hashes.add(hash1)
            
            for j in range(i + 1, len(all_hashes)):
                hash2 = all_hashes[j]
                if hash2 in processed_hashes:
                    continue
                
                entries2 = feature_groups[hash2]
                ua2 = entries2[0].user_agent if entries2 else ""
                
                if self._similarity(ua1, ua2) >= self.similarity_threshold:
                    similar_groups[group_key].extend(entries2)
                    processed_hashes.add(hash2)
        
        for group_key, group_entries in similar_groups.items():
            if len(group_entries) >= self.min_cluster_size:
                cluster_id = f"CLS-{category.upper()}-{group_key.upper()}"
                cluster = Cluster(
                    cluster_id=cluster_id,
                    category=category,
                    samples=group_entries,
                )
                
                unique_ips = set()
                unique_paths = set()
                ua_samples = []
                
                for entry in group_entries:
                    unique_ips.add(entry.ip)
                    unique_paths.add(entry.path_signature)
                    ua_samples.append(entry.user_agent)
                    entry.cluster_id = cluster_id
                
                cluster.ip_count = len(unique_ips)
                cluster.path_count = len(unique_paths)
                cluster.total_requests = len(group_entries)
                
                if ua_samples:
                    cluster.representative = max(set(ua_samples), key=ua_samples.count)
                
                cluster.common_patterns = self._extract_common_patterns(ua_samples)
                
                self.clusters[cluster_id] = cluster
    
    def _extract_common_patterns(self, ua_samples: List[str]) -> List[str]:
        if not ua_samples:
            return []
        
        token_counts: Dict[str, int] = defaultdict(int)
        for ua in ua_samples:
            tokens = re.findall(r'[a-zA-Z0-9]{3,}', ua.lower())
            for token in set(tokens):
                token_counts[token] += 1
        
        total = len(ua_samples)
        common = [
            token for token, count in token_counts.items()
            if count / total >= 0.5
        ]
        
        return sorted(common, key=lambda t: -token_counts[t])[:10]
    
    def get_clusters(self, sort_by: str = "size") -> List[Cluster]:
        clusters = list(self.clusters.values())
        if sort_by == "size":
            clusters.sort(key=lambda c: -c.total_requests)
        elif sort_by == "ips":
            clusters.sort(key=lambda c: -c.ip_count)
        elif sort_by == "id":
            clusters.sort(key=lambda c: c.cluster_id)
        return clusters
    
    def get_cluster_by_id(self, cluster_id: str) -> Optional[Cluster]:
        return self.clusters.get(cluster_id)
    
    def summarize(self) -> Dict[str, Any]:
        return {
            "total_clusters": len(self.clusters),
            "total_samples_clustered": sum(c.total_requests for c in self.clusters.values()),
            "clusters": [
                {
                    "id": c.cluster_id,
                    "category": c.category,
                    "size": c.total_requests,
                    "unique_ips": c.ip_count,
                    "unique_paths": c.path_count,
                    "representative": c.representative[:100] if c.representative else "",
                    "common_patterns": c.common_patterns[:5]
                }
                for c in self.get_clusters()
            ]
        }


class IPTracker:
    def __init__(self):
        self.ip_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "count": 0,
            "categories": defaultdict(int),
            "user_agents": set(),
            "paths": set(),
            "status_codes": defaultdict(int)
        })
        self.ip_ranges: Dict[str, str] = {}
    
    def add_entry(self, entry: LogEntry):
        if not entry.ip:
            return
        
        stats = self.ip_stats[entry.ip]
        stats["count"] += 1
        stats["categories"][entry.category] += 1
        if entry.user_agent:
            stats["user_agents"].add(entry.user_agent)
        if entry.path_signature:
            stats["paths"].add(entry.path_signature)
        if entry.status:
            stats["status_codes"][entry.status] += 1
    
    def get_suspicious_ips(self, min_count: int = 100, risk_ratio: float = 0.3) -> List[Dict[str, Any]]:
        suspicious = []
        for ip, stats in self.ip_stats.items():
            total = stats["count"]
            if total < min_count:
                continue
            
            risk_count = stats["categories"].get("risk", 0)
            unknown_count = stats["categories"].get("unknown", 0)
            ratio = (risk_count + unknown_count) / total
            
            if ratio >= risk_ratio:
                suspicious.append({
                    "ip": ip,
                    "total_requests": total,
                    "risk_count": risk_count,
                    "unknown_count": unknown_count,
                    "risk_ratio": round(ratio, 3),
                    "ua_count": len(stats["user_agents"]),
                    "path_count": len(stats["paths"])
                })
        
        return sorted(suspicious, key=lambda x: -x["risk_ratio"])
    
    def summarize(self) -> Dict[str, Any]:
        return {
            "unique_ips": len(self.ip_stats),
            "top_ips": [
                {
                    "ip": ip,
                    "count": stats["count"],
                    "top_category": max(stats["categories"].items(), key=lambda x: x[1])[0] if stats["categories"] else "unknown"
                }
                for ip, stats in sorted(
                    self.ip_stats.items(),
                    key=lambda x: -x[1]["count"]
                )[:20]
            ]
        }