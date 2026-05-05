import json
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from datetime import datetime


class RedisDataType(str, Enum):
    STRING = "string"
    HASH = "hash"
    LIST = "list"
    SET = "set"
    ZSET = "zset"
    STREAM = "stream"


class ScenarioType(str, Enum):
    COUNTER = "counter"
    LEADERBOARD = "leaderboard"
    QUEUE = "queue"
    DEDUPLICATION = "deduplication"
    TIMELINE = "timeline"
    CACHE = "cache"
    SESSION = "session"
    MESSAGING = "messaging"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class StructureRule:
    scenario: str
    recommended_types: List[str]
    anti_patterns: List[str]
    memory_considerations: str
    performance_notes: str


DEFAULT_STRUCTURE_RULES: Dict[str, StructureRule] = {
    ScenarioType.COUNTER.value: StructureRule(
        scenario=ScenarioType.COUNTER.value,
        recommended_types=[RedisDataType.STRING.value],
        anti_patterns=[RedisDataType.HASH.value, RedisDataType.SET.value],
        memory_considerations="String uses ~50 bytes overhead per key. Use INCR/DECR for atomic operations.",
        performance_notes="O(1) complexity for counter operations. Best choice for simple counters."
    ),
    ScenarioType.LEADERBOARD.value: StructureRule(
        scenario=ScenarioType.LEADERBOARD.value,
        recommended_types=[RedisDataType.ZSET.value],
        anti_patterns=[RedisDataType.LIST.value, RedisDataType.SET.value],
        memory_considerations="ZSet uses skiplist, memory grows with elements. Consider using ZREMRANGEBYSCORE.",
        performance_notes="O(log N) for inserts, O(log N + M) for range queries. Perfect for leaderboards."
    ),
    ScenarioType.QUEUE.value: StructureRule(
        scenario=ScenarioType.QUEUE.value,
        recommended_types=[RedisDataType.LIST.value, RedisDataType.STREAM.value],
        anti_patterns=[RedisDataType.SET.value, RedisDataType.ZSET.value],
        memory_considerations="List uses linked list, memory grows with elements. Stream uses radix tree internally.",
        performance_notes="List: O(1) for LPUSH/RPOP. Stream: O(log N) but with consumer groups and ACK."
    ),
    ScenarioType.DEDUPLICATION.value: StructureRule(
        scenario=ScenarioType.DEDUPLICATION.value,
        recommended_types=[RedisDataType.SET.value, RedisDataType.HASH.value, RedisDataType.ZSET.value],
        anti_patterns=[RedisDataType.LIST.value],
        memory_considerations="Set uses hash table. Consider HyperLogLog for large datasets with acceptable error.",
        performance_notes="O(1) for SISMEMBER checks. HyperLogLog uses constant 12KB regardless of elements."
    ),
    ScenarioType.TIMELINE.value: StructureRule(
        scenario=ScenarioType.TIMELINE.value,
        recommended_types=[RedisDataType.ZSET.value, RedisDataType.LIST.value, RedisDataType.STREAM.value],
        anti_patterns=[RedisDataType.SET.value],
        memory_considerations="ZSet uses score for timestamps. Stream is ideal for append-only time series.",
        performance_notes="ZSet: O(log N) insert, O(log N + M) range. Stream: O(log N) with efficient range queries."
    ),
    ScenarioType.CACHE.value: StructureRule(
        scenario=ScenarioType.CACHE.value,
        recommended_types=[RedisDataType.STRING.value, RedisDataType.HASH.value],
        anti_patterns=[],
        memory_considerations="String for simple values, Hash for grouped data with field access.",
        performance_notes="Both O(1). Hash reduces keyspace overhead when grouping related fields."
    ),
    ScenarioType.SESSION.value: StructureRule(
        scenario=ScenarioType.SESSION.value,
        recommended_types=[RedisDataType.HASH.value, RedisDataType.STRING.value],
        anti_patterns=[],
        memory_considerations="Hash allows partial field updates without full serialization.",
        performance_notes="O(1) for both. Hash better when you need to read/write individual fields."
    ),
    ScenarioType.MESSAGING.value: StructureRule(
        scenario=ScenarioType.MESSAGING.value,
        recommended_types=[RedisDataType.STREAM.value, RedisDataType.LIST.value],
        anti_patterns=[],
        memory_considerations="Stream offers persistence, consumer groups, and ACK. List is simpler but limited.",
        performance_notes="Stream: O(log N) but feature-rich. List: O(1) for push/pop."
    ),
}


BIG_KEY_THRESHOLDS = {
    RedisDataType.STRING.value: 10 * 1024,
    RedisDataType.HASH.value: 1000,
    RedisDataType.LIST.value: 10000,
    RedisDataType.SET.value: 1000,
    RedisDataType.ZSET.value: 1000,
    RedisDataType.STREAM.value: 10000,
}


HOT_KEY_THRESHOLD_OPS_PER_MINUTE = 1000


class RedisStructureAnalyzer:
    def __init__(self, custom_rules: Optional[Dict[str, StructureRule]] = None):
        self.rules = custom_rules or DEFAULT_STRUCTURE_RULES
    
    def detect_scenario(self, key_name: str, commands: List[str], tags: Optional[str] = None) -> Optional[str]:
        key_lower = key_name.lower()
        tag_list = [t.strip().lower() for t in (tags or "").split(",") if t.strip()]
        
        scenario_indicators = {
            ScenarioType.COUNTER.value: ["count", "counter", "stats", "metric", "clicks", "views", "incr"],
            ScenarioType.LEADERBOARD.value: ["leader", "rank", "score", "top", "leaderboard"],
            ScenarioType.QUEUE.value: ["queue", "task", "job", "pending", "worker"],
            ScenarioType.DEDUPLICATION.value: ["dedup", "unique", "seen", "exists", "visited"],
            ScenarioType.TIMELINE.value: ["timeline", "feed", "history", "log", "events", "time"],
            ScenarioType.CACHE.value: ["cache", "cached", "temp", "tmp"],
            ScenarioType.SESSION.value: ["session", "token", "auth", "login"],
            ScenarioType.MESSAGING.value: ["message", "msg", "stream", "pubsub", "channel"],
        }
        
        if commands:
            cmd_set = set(c.upper() for c in commands)
            if {"INCR", "INCRBY", "DECR", "DECRBY"} & cmd_set:
                return ScenarioType.COUNTER.value
            if {"ZADD", "ZRANK", "ZREVRANK", "ZRANGE", "ZREVRANGE"} & cmd_set:
                return ScenarioType.LEADERBOARD.value
            if {"LPUSH", "RPUSH", "LPOP", "RPOP", "BLPOP", "BRPOP"} & cmd_set:
                return ScenarioType.QUEUE.value
            if {"SADD", "SISMEMBER", "SCARD"} & cmd_set:
                return ScenarioType.DEDUPLICATION.value
            if {"XADD", "XREAD", "XRANGE"} & cmd_set:
                return ScenarioType.MESSAGING.value
        
        for scenario, indicators in scenario_indicators.items():
            for indicator in indicators:
                if indicator in key_lower or indicator in tag_list:
                    return scenario
        
        if not commands:
            return ScenarioType.CACHE.value
        
        return None
    
    def evaluate_suitability(self, current_type: str, scenario: str) -> Tuple[float, List[str], List[str]]:
        if scenario not in self.rules:
            return 50.0, ["Unknown scenario, using neutral score"], []
        
        rule = self.rules[scenario]
        issues = []
        suggestions = []
        
        if current_type in rule.recommended_types:
            base_score = 90.0
            suggestions.append(f"Current type '{current_type}' is recommended for {scenario} scenario")
        elif current_type in rule.anti_patterns:
            base_score = 20.0
            issues.append(f"Type '{current_type}' is an anti-pattern for {scenario} scenario")
            suggestions.append(f"Consider switching to one of: {', '.join(rule.recommended_types)}")
        else:
            base_score = 50.0
            suggestions.append(f"Type '{current_type}' is neutral for {scenario} scenario")
            suggestions.append(f"Recommended types: {', '.join(rule.recommended_types)}")
        
        suitability_adjustments = self._get_type_scenario_adjustments(current_type, scenario)
        for adj in suitability_adjustments:
            base_score += adj["score_delta"]
            if adj["score_delta"] < 0:
                issues.append(adj["reason"])
            elif adj["score_delta"] > 0:
                suggestions.append(adj["reason"])
        
        final_score = max(0.0, min(100.0, base_score))
        return final_score, issues, suggestions
    
    def _get_type_scenario_adjustments(self, data_type: str, scenario: str) -> List[Dict[str, Any]]:
        adjustments = []
        
        type_characteristics = {
            RedisDataType.STRING.value: {
                "pros": ["Simple", "Atomic ops", "Low overhead for small values"],
                "cons": ["No partial updates", "Inefficient for grouped data"]
            },
            RedisDataType.HASH.value: {
                "pros": ["Partial field updates", "Grouped data efficient", "Reduces key count"],
                "cons": ["No sorted operations", "Larger overhead for single field"]
            },
            RedisDataType.LIST.value: {
                "pros": ["FIFO/LIFO operations", "Fast push/pop", "Simple queue"],
                "cons": ["No random access", "Inefficient for large size", "No uniqueness"]
            },
            RedisDataType.SET.value: {
                "pros": ["Uniqueness guarantee", "Set operations", "Fast membership check"],
                "cons": ["No ordering", "Memory overhead"]
            },
            RedisDataType.ZSET.value: {
                "pros": ["Ordered by score", "Range queries", "Rank operations"],
                "cons": ["Higher memory", "Slower writes than Set"]
            },
            RedisDataType.STREAM.value: {
                "pros": ["Consumer groups", "Persistence", "ACK support", "Time-based range"],
                "cons": ["Complex API", "Higher overhead", "Not for simple queues"]
            }
        }
        
        if scenario == ScenarioType.COUNTER.value:
            if data_type == RedisDataType.STRING.value:
                adjustments.append({"score_delta": 10, "reason": "String is optimal for atomic INCR/DECR operations"})
            elif data_type == RedisDataType.HASH.value:
                adjustments.append({"score_delta": -20, "reason": "Hash requires HINCRBY and has higher overhead per counter"})
        
        elif scenario == ScenarioType.LEADERBOARD.value:
            if data_type == RedisDataType.ZSET.value:
                adjustments.append({"score_delta": 10, "reason": "ZSet natively supports ranking and range queries by score"})
            elif data_type == RedisDataType.LIST.value:
                adjustments.append({"score_delta": -30, "reason": "List requires manual sorting, not suitable for dynamic leaderboards"})
        
        elif scenario == ScenarioType.QUEUE.value:
            if data_type == RedisDataType.LIST.value:
                adjustments.append({"score_delta": 5, "reason": "List provides simple FIFO/LIFO operations"})
            elif data_type == RedisDataType.STREAM.value:
                adjustments.append({"score_delta": 5, "reason": "Stream provides consumer groups, ACK, and persistence"})
        
        elif scenario == ScenarioType.DEDUPLICATION.value:
            if data_type == RedisDataType.SET.value:
                adjustments.append({"score_delta": 10, "reason": "Set guarantees uniqueness with O(1) membership checks"})
            elif data_type == RedisDataType.LIST.value:
                adjustments.append({"score_delta": -30, "reason": "List requires O(N) scan for deduplication checks"})
        
        return adjustments
    
    def estimate_memory(self, data_type: str, **kwargs) -> int:
        base_overhead = 50
        
        if data_type == RedisDataType.STRING.value:
            value_size = kwargs.get("value_size", 100)
            return base_overhead + value_size
        
        elif data_type == RedisDataType.HASH.value:
            field_count = kwargs.get("field_count", 10)
            avg_field_size = kwargs.get("avg_field_size", 30)
            avg_value_size = kwargs.get("avg_value_size", 50)
            hash_overhead = 80
            return base_overhead + hash_overhead + field_count * (avg_field_size + avg_value_size + 8)
        
        elif data_type == RedisDataType.LIST.value:
            list_length = kwargs.get("list_length", 100)
            avg_element_size = kwargs.get("avg_element_size", 100)
            list_overhead = 60
            return base_overhead + list_overhead + list_length * (avg_element_size + 16)
        
        elif data_type == RedisDataType.SET.value:
            cardinality = kwargs.get("set_cardinality", 100)
            avg_member_size = kwargs.get("avg_member_size", 50)
            set_overhead = 70
            return base_overhead + set_overhead + cardinality * (avg_member_size + 24)
        
        elif data_type == RedisDataType.ZSET.value:
            cardinality = kwargs.get("zset_cardinality", 100)
            avg_member_size = kwargs.get("avg_member_size", 50)
            zset_overhead = 100
            return base_overhead + zset_overhead + cardinality * (avg_member_size + 32)
        
        elif data_type == RedisDataType.STREAM.value:
            stream_length = kwargs.get("stream_length", 100)
            avg_entry_size = kwargs.get("avg_entry_size", 200)
            stream_overhead = 120
            return base_overhead + stream_overhead + stream_length * (avg_entry_size + 40)
        
        return base_overhead
    
    def analyze_big_key(self, data_type: str, **kwargs) -> Tuple[bool, float, List[str]]:
        threshold = BIG_KEY_THRESHOLDS.get(data_type, 1000)
        issues = []
        
        size_value = 0
        size_type = ""
        
        if data_type == RedisDataType.STRING.value:
            size_value = kwargs.get("value_size", 0) or 0
            size_type = "bytes"
        elif data_type == RedisDataType.HASH.value:
            size_value = kwargs.get("field_count", 0) or 0
            size_type = "fields"
        elif data_type == RedisDataType.LIST.value:
            size_value = kwargs.get("list_length", 0) or 0
            size_type = "elements"
        elif data_type == RedisDataType.SET.value:
            size_value = kwargs.get("set_cardinality", 0) or 0
            size_type = "members"
        elif data_type == RedisDataType.ZSET.value:
            size_value = kwargs.get("zset_cardinality", 0) or 0
            size_type = "members"
        elif data_type == RedisDataType.STREAM.value:
            size_value = kwargs.get("stream_length", 0) or 0
            size_type = "entries"
        
        ratio = size_value / threshold if threshold > 0 else 0
        is_big = ratio >= 1.0
        
        if is_big:
            issues.append(f"Key exceeds {data_type} size threshold ({threshold} {size_type})")
            issues.append(f"Current size: {size_value} {size_type} ({ratio:.1f}x threshold)")
            issues.append("Big keys can cause: memory fragmentation, slow replication, command latency spikes")
        
        score = min(100.0, ratio * 50) if ratio > 0 else 0.0
        
        return is_big, score, issues
    
    def analyze_hot_key(self, commands_count: int, time_window_minutes: float = 60.0) -> Tuple[bool, float, List[str]]:
        if time_window_minutes <= 0:
            time_window_minutes = 60.0
        
        ops_per_minute = commands_count / time_window_minutes
        issues = []
        
        is_hot = ops_per_minute >= HOT_KEY_THRESHOLD_OPS_PER_MINUTE
        ratio = ops_per_minute / HOT_KEY_THRESHOLD_OPS_PER_MINUTE
        score = min(100.0, ratio * 50) if ratio > 0 else 0.0
        
        if is_hot:
            issues.append(f"Key is accessed {ops_per_minute:.0f} times/minute (threshold: {HOT_KEY_THRESHOLD_OPS_PER_MINUTE})")
            issues.append("Hot key risk: cache stampede, single point of failure, performance bottleneck")
            issues.append("Consider: key sharding, local cache, read replicas")
        
        return is_hot, score, issues
    
    def analyze_ttl_risk(self, ttl_seconds: Optional[int], data_type: str, scenario: str) -> Tuple[str, List[str]]:
        issues = []
        
        if ttl_seconds is None or ttl_seconds == -1:
            if scenario in [ScenarioType.CACHE.value, ScenarioType.SESSION.value]:
                issues.append("No TTL set for cache/session data - risk of memory exhaustion")
                return RiskLevel.HIGH.value, issues
            elif scenario == ScenarioType.QUEUE.value:
                issues.append("No TTL set for queue - stale items may accumulate")
                return RiskLevel.MEDIUM.value, issues
            else:
                return RiskLevel.LOW.value, ["No TTL set (acceptable for this scenario)"]
        
        if ttl_seconds == -2:
            issues.append("Key is already expired")
            return RiskLevel.HIGH.value, issues
        
        if scenario == ScenarioType.SESSION.value:
            if ttl_seconds < 300:
                issues.append(f"Session TTL ({ttl_seconds}s) may be too short for user experience")
                return RiskLevel.MEDIUM.value, issues
            elif ttl_seconds > 86400 * 7:
                issues.append(f"Session TTL ({ttl_seconds}s) may be too long - security concern")
                return RiskLevel.MEDIUM.value, issues
        
        if scenario == ScenarioType.CACHE.value:
            if ttl_seconds < 60:
                issues.append(f"Cache TTL ({ttl_seconds}s) may be too short - low cache hit ratio expected")
                return RiskLevel.MEDIUM.value, issues
        
        return RiskLevel.LOW.value, [f"TTL set to {ttl_seconds} seconds"]
    
    def analyze_migration_risk(
        self, 
        data_type: str, 
        is_big_key: bool, 
        is_hot_key: bool,
        field_count: Optional[int] = None,
        list_length: Optional[int] = None,
        scenario: Optional[str] = None
    ) -> Tuple[str, List[str]]:
        issues = []
        risk_score = 0
        
        if is_big_key:
            risk_score += 40
            issues.append("Big key migration: high impact on network, potential blocking operations")
            issues.append("Recommendation: use SCAN-based incremental migration, avoid KEYS command")
        
        if is_hot_key:
            risk_score += 30
            issues.append("Hot key migration: risk of performance impact during switchover")
            issues.append("Recommendation: double-write pattern, read-through cache during migration")
        
        if data_type == RedisDataType.STREAM.value:
            risk_score += 20
            issues.append("Stream migration: need to handle consumer group offsets and pending entries")
            issues.append("Recommendation: use XINFO GROUPS, consider dual-write during transition")
        
        if data_type == RedisDataType.ZSET.value:
            if field_count and field_count > 10000:
                risk_score += 15
                issues.append("Large ZSet: score precision may affect migration accuracy")
        
        if risk_score >= 60:
            return RiskLevel.HIGH.value, issues
        elif risk_score >= 30:
            return RiskLevel.MEDIUM.value, issues
        else:
            if not issues:
                issues.append("Low migration risk - standard migration approach should work")
            return RiskLevel.LOW.value, issues
    
    def analyze_key(
        self,
        key_data: Dict[str, Any],
        usage_events: List[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        key_name = key_data.get("key_name", "")
        data_type = key_data.get("data_type", "string")
        tags = key_data.get("tags")
        
        commands = []
        if usage_events:
            commands = [e.get("command", "") for e in usage_events]
        
        scenario = self.detect_scenario(key_name, commands, tags)
        
        suitability_score = 50.0
        issues = []
        suggestions = []
        warnings = []
        
        if scenario:
            suitability_score, type_issues, type_suggestions = self.evaluate_suitability(data_type, scenario)
            issues.extend(type_issues)
            suggestions.extend(type_suggestions)
        else:
            warnings.append("Could not detect scenario automatically")
        
        estimated_memory = self.estimate_memory(
            data_type,
            value_size=key_data.get("value_size"),
            field_count=key_data.get("field_count"),
            list_length=key_data.get("list_length"),
            set_cardinality=key_data.get("set_cardinality"),
            zset_cardinality=key_data.get("zset_cardinality"),
            stream_length=key_data.get("stream_length"),
        )
        
        provided_memory = key_data.get("memory_bytes")
        memory_optimization = 0.0
        if provided_memory and provided_memory > 0:
            if estimated_memory < provided_memory:
                memory_optimization = ((provided_memory - estimated_memory) / provided_memory) * 100
        
        is_big_key, big_key_score, big_key_issues = self.analyze_big_key(
            data_type,
            value_size=key_data.get("value_size"),
            field_count=key_data.get("field_count"),
            list_length=key_data.get("list_length"),
            set_cardinality=key_data.get("set_cardinality"),
            zset_cardinality=key_data.get("zset_cardinality"),
            stream_length=key_data.get("stream_length"),
        )
        issues.extend(big_key_issues)
        
        commands_count = len(usage_events) if usage_events else 0
        is_hot_key, hot_key_score, hot_key_issues = self.analyze_hot_key(commands_count)
        issues.extend(hot_key_issues)
        
        ttl_risk_level, ttl_issues = self.analyze_ttl_risk(
            key_data.get("ttl"),
            data_type,
            scenario or ""
        )
        issues.extend(ttl_issues)
        
        migration_risk_level, migration_issues = self.analyze_migration_risk(
            data_type,
            is_big_key,
            is_hot_key,
            field_count=key_data.get("field_count"),
            list_length=key_data.get("list_length"),
            scenario=scenario
        )
        issues.extend(migration_issues)
        
        recommended_type = None
        if scenario and scenario in self.rules:
            recommended_types = self.rules[scenario].recommended_types
            if recommended_types:
                recommended_type = recommended_types[0]
        
        if suitability_score < 70 and recommended_type and recommended_type != data_type:
            alt_memory = self.estimate_memory(recommended_type, **key_data)
            if alt_memory < estimated_memory:
                mem_saving = ((estimated_memory - alt_memory) / estimated_memory) * 100
                suggestions.append(f"Switching to {recommended_type} could save ~{mem_saving:.0f}% memory")
        
        return {
            "scenario": scenario,
            "recommended_type": recommended_type,
            "current_type_suitability": suitability_score,
            "estimated_memory_bytes": estimated_memory,
            "memory_optimization_potential": memory_optimization if memory_optimization > 0 else None,
            "is_hot_key": is_hot_key,
            "hot_key_score": hot_key_score,
            "is_big_key": is_big_key,
            "big_key_score": big_key_score,
            "ttl_risk_level": ttl_risk_level,
            "migration_risk_level": migration_risk_level,
            "issues": issues,
            "warnings": warnings,
            "suggestions": suggestions,
        }
    
    def get_alternatives_comparison(
        self,
        current_type: str,
        scenario: str,
        **kwargs
    ) -> List[Dict[str, Any]]:
        all_types = [
            RedisDataType.STRING.value,
            RedisDataType.HASH.value,
            RedisDataType.LIST.value,
            RedisDataType.SET.value,
            RedisDataType.ZSET.value,
            RedisDataType.STREAM.value,
        ]
        
        alternatives = []
        
        for alt_type in all_types:
            if alt_type == current_type:
                continue
            
            suitability_score, alt_issues, alt_suggestions = self.evaluate_suitability(alt_type, scenario)
            estimated_memory = self.estimate_memory(alt_type, **kwargs)
            
            migration_complexity = "low"
            if alt_type == RedisDataType.STREAM.value and current_type != RedisDataType.STREAM.value:
                migration_complexity = "high"
            elif alt_type in [RedisDataType.ZSET.value, RedisDataType.SET.value]:
                migration_complexity = "medium"
            
            code_changes = "minimal"
            if alt_type == RedisDataType.STREAM.value:
                code_changes = "major"
            elif alt_type in [RedisDataType.ZSET.value, RedisDataType.SET.value]:
                if current_type not in [RedisDataType.ZSET.value, RedisDataType.SET.value]:
                    code_changes = "moderate"
            
            alternatives.append({
                "data_type": alt_type,
                "suitability_score": suitability_score,
                "memory_estimate": estimated_memory,
                "migration_complexity": migration_complexity,
                "code_changes": code_changes,
                "issues": alt_issues,
                "suggestions": alt_suggestions,
            })
        
        alternatives.sort(key=lambda x: x["suitability_score"], reverse=True)
        return alternatives
    
    def generate_summary(self, key_analyses: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not key_analyses:
            return {
                "overall_score": 0.0,
                "total_keys": 0,
                "issues_found": 0,
                "warnings_found": 0,
                "summary": "No keys analyzed",
            }
        
        total_keys = len(key_analyses)
        total_issues = sum(len(ka.get("issues", [])) for ka in key_analyses)
        total_warnings = sum(len(ka.get("warnings", [])) for ka in key_analyses)
        
        avg_suitability = sum(
            ka.get("current_type_suitability", 50.0) 
            for ka in key_analyses
        ) / total_keys
        
        hot_key_count = sum(1 for ka in key_analyses if ka.get("is_hot_key", False))
        big_key_count = sum(1 for ka in key_analyses if ka.get("is_big_key", False))
        
        high_ttl_risk = sum(1 for ka in key_analyses if ka.get("ttl_risk_level") == RiskLevel.HIGH.value)
        high_migration_risk = sum(1 for ka in key_analyses if ka.get("migration_risk_level") == RiskLevel.HIGH.value)
        
        penalty = 0
        if hot_key_count > 0:
            penalty += hot_key_count * 5
        if big_key_count > 0:
            penalty += big_key_count * 3
        if high_ttl_risk > 0:
            penalty += high_ttl_risk * 4
        if high_migration_risk > 0:
            penalty += high_migration_risk * 2
        
        overall_score = max(0.0, min(100.0, avg_suitability - penalty))
        
        summary_parts = []
        if hot_key_count > 0:
            summary_parts.append(f"{hot_key_count} hot key{'s' if hot_key_count > 1 else ''} detected")
        if big_key_count > 0:
            summary_parts.append(f"{big_key_count} big key{'s' if big_key_count > 1 else ''} detected")
        if high_ttl_risk > 0:
            summary_parts.append(f"{high_ttl_risk} high TTL risk{'s' if high_ttl_risk > 1 else ''}")
        if high_migration_risk > 0:
            summary_parts.append(f"{high_migration_risk} high migration risk{'s' if high_migration_risk > 1 else ''}")
        
        if not summary_parts:
            summary_parts.append("No critical issues detected")
        
        return {
            "overall_score": round(overall_score, 2),
            "total_keys": total_keys,
            "issues_found": total_issues,
            "warnings_found": total_warnings,
            "hot_key_count": hot_key_count,
            "big_key_count": big_key_count,
            "high_ttl_risk_count": high_ttl_risk,
            "high_migration_risk_count": high_migration_risk,
            "summary": " | ".join(summary_parts),
            "avg_suitability": round(avg_suitability, 2),
        }
