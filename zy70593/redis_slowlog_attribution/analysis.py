from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from collections import defaultdict

from .parser import SlowlogEntry, ParseResult
from .pattern import KeyAnalyzer


@dataclass
class DurationBucket:
    name: str
    min_us: int
    max_us: Optional[int]
    count: int = 0
    total_duration_us: int = 0

    @property
    def avg_duration_ms(self) -> float:
        if self.count == 0:
            return 0.0
        return (self.total_duration_us / self.count) / 1000.0


class DurationAnalyzer:
    def __init__(self):
        self.buckets: List[DurationBucket] = [
            DurationBucket("0-1ms", 0, 1000),
            DurationBucket("1-5ms", 1000, 5000),
            DurationBucket("5-10ms", 5000, 10000),
            DurationBucket("10-50ms", 10000, 50000),
            DurationBucket("50-100ms", 50000, 100000),
            DurationBucket("100ms-1s", 100000, 1000000),
            DurationBucket(">1s", 1000000, None),
        ]

    def add_entry(self, duration_us: int):
        for bucket in self.buckets:
            if bucket.max_us is None:
                if duration_us >= bucket.min_us:
                    bucket.count += 1
                    bucket.total_duration_us += duration_us
                    break
            else:
                if bucket.min_us <= duration_us < bucket.max_us:
                    bucket.count += 1
                    bucket.total_duration_us += duration_us
                    break

    def get_distribution(self) -> List[DurationBucket]:
        return self.buckets


@dataclass
class CallerStats:
    label: str
    count: int = 0
    total_duration_us: int = 0
    commands: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    key_patterns: Dict[str, int] = field(default_factory=lambda: defaultdict(int))

    @property
    def avg_duration_ms(self) -> float:
        if self.count == 0:
            return 0.0
        return (self.total_duration_us / self.count) / 1000.0


class CallerTagger:
    def __init__(self):
        self.ip_to_label: Dict[str, str] = {}
        self.client_name_rules: Dict[str, str] = {}
        self.command_rules: Dict[str, str] = {}
        self.key_prefix_rules: Dict[str, str] = {}

    def add_ip_mapping(self, ip: str, label: str):
        self.ip_to_label[ip] = label

    def add_client_name_rule(self, pattern: str, label: str):
        self.client_name_rules[pattern] = label

    def add_command_rule(self, command: str, label: str):
        self.command_rules[command.upper()] = label

    def add_key_prefix_rule(self, prefix: str, label: str):
        self.key_prefix_rules[prefix] = label

    def get_caller_label(self, entry: SlowlogEntry) -> str:
        if entry.client_ip and entry.client_ip in self.ip_to_label:
            return self.ip_to_label[entry.client_ip]

        if entry.client_name:
            for pattern, label in self.client_name_rules.items():
                if pattern in entry.client_name:
                    return label

        cmd_upper = entry.command.upper()
        if cmd_upper in self.command_rules:
            return self.command_rules[cmd_upper]

        for key in entry.keys:
            for prefix, label in self.key_prefix_rules.items():
                if key.startswith(prefix):
                    return label

        if entry.client_ip:
            return f"ip:{entry.client_ip}"
        
        if entry.client_name:
            return f"client:{entry.client_name}"

        return "unknown"


class CallerAnalyzer:
    def __init__(self):
        self.tagger = CallerTagger()
        self.stats: Dict[str, CallerStats] = {}

    def add_entry(self, entry: SlowlogEntry):
        label = self.tagger.get_caller_label(entry)
        
        if label not in self.stats:
            self.stats[label] = CallerStats(label=label)
        
        stats = self.stats[label]
        stats.count += 1
        stats.total_duration_us += entry.duration_us
        stats.commands[entry.command.upper()] += 1
        
        for key in entry.keys:
            stats.key_patterns[key] += 1

    def get_callers(self, min_count: int = 1) -> List[CallerStats]:
        result = [
            s for s in self.stats.values()
            if s.count >= min_count
        ]
        result.sort(key=lambda x: (-x.count, -x.total_duration_us))
        return result


@dataclass
class CommandStats:
    command: str
    count: int = 0
    total_duration_us: int = 0
    slowest_entry: Optional[SlowlogEntry] = None

    @property
    def avg_duration_ms(self) -> float:
        if self.count == 0:
            return 0.0
        return (self.total_duration_us / self.count) / 1000.0

    @property
    def max_duration_ms(self) -> float:
        if self.slowest_entry:
            return self.slowest_entry.duration_ms
        return 0.0


class CommandAnalyzer:
    def __init__(self):
        self.stats: Dict[str, CommandStats] = {}

    def add_entry(self, entry: SlowlogEntry):
        cmd = entry.command.upper()
        if cmd not in self.stats:
            self.stats[cmd] = CommandStats(command=cmd)
        
        stats = self.stats[cmd]
        stats.count += 1
        stats.total_duration_us += entry.duration_us
        
        if stats.slowest_entry is None or entry.duration_us > stats.slowest_entry.duration_us:
            stats.slowest_entry = entry

    def get_commands(self, min_count: int = 1) -> List[CommandStats]:
        result = [
            s for s in self.stats.values()
            if s.count >= min_count
        ]
        result.sort(key=lambda x: (-x.count, -x.total_duration_us))
        return result


@dataclass
class AnalysisResult:
    total_entries: int
    total_errors: int
    total_duration_us: int
    avg_duration_ms: float
    max_duration_ms: float
    min_duration_ms: float
    
    duration_distribution: List[DurationBucket]
    command_stats: List[CommandStats]
    key_patterns: List[Any]
    caller_stats: List[CallerStats]
    
    slowest_entries: List[SlowlogEntry]
    errors: List[Any]


class SlowlogAnalyzer:
    def __init__(self, parse_result: ParseResult):
        self.parse_result = parse_result
        self.entries = parse_result.entries
        self.errors = parse_result.errors
        
        self.duration_analyzer = DurationAnalyzer()
        self.command_analyzer = CommandAnalyzer()
        self.key_analyzer = KeyAnalyzer(self.entries)
        self.caller_analyzer = CallerAnalyzer()

    def analyze(self) -> AnalysisResult:
        total_duration = 0
        max_duration = 0
        min_duration = float('inf')

        for entry in self.entries:
            self.duration_analyzer.add_entry(entry.duration_us)
            self.command_analyzer.add_entry(entry)
            self.caller_analyzer.add_entry(entry)
            
            total_duration += entry.duration_us
            if entry.duration_us > max_duration:
                max_duration = entry.duration_us
            if entry.duration_us < min_duration:
                min_duration = entry.duration_us

        self.key_analyzer.analyze()

        sorted_entries = sorted(self.entries, key=lambda e: -e.duration_us)
        
        avg_ms = (total_duration / len(self.entries)) / 1000.0 if self.entries else 0.0

        return AnalysisResult(
            total_entries=len(self.entries),
            total_errors=len(self.errors),
            total_duration_us=total_duration,
            avg_duration_ms=avg_ms,
            max_duration_ms=max_duration / 1000.0,
            min_duration_ms=min_duration / 1000.0 if min_duration != float('inf') else 0.0,
            duration_distribution=self.duration_analyzer.get_distribution(),
            command_stats=self.command_analyzer.get_commands(),
            key_patterns=self.key_analyzer.get_pattern_summary(),
            caller_stats=self.caller_analyzer.get_callers(),
            slowest_entries=sorted_entries[:10],
            errors=self.errors
        )
