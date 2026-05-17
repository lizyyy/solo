import re
from dataclasses import dataclass, field
from typing import Dict, List, Set, Tuple, Optional
from collections import defaultdict


@dataclass
class KeyPattern:
    pattern: str
    count: int = 0
    total_duration_us: int = 0
    sample_keys: List[str] = field(default_factory=list)
    commands: Set[str] = field(default_factory=set)

    @property
    def avg_duration_ms(self) -> float:
        if self.count == 0:
            return 0.0
        return (self.total_duration_us / self.count) / 1000.0

    def add_sample(self, key: str, duration_us: int, command: str):
        self.count += 1
        self.total_duration_us += duration_us
        if len(self.sample_keys) < 5:
            if key not in self.sample_keys:
                self.sample_keys.append(key)
        self.commands.add(command)


class KeyPatternExtractor:
    def __init__(self):
        self.uuid_pattern = re.compile(
            r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
            re.IGNORECASE
        )
        self.number_pattern = re.compile(r'\b\d+\b')
        self.hex_pattern = re.compile(r'\b[0-9a-fA-F]{6,}\b', re.IGNORECASE)
        self.hash_pattern = re.compile(r'\b[0-9a-fA-F]{32}\b', re.IGNORECASE)

    def extract_pattern(self, key: str) -> str:
        pattern = key
        
        pattern = self.uuid_pattern.sub('*', pattern)
        
        pattern = self.hash_pattern.sub('*', pattern)
        
        pattern = self.hex_pattern.sub('*', pattern)
        
        pattern = self.number_pattern.sub('*', pattern)
        
        pattern = self._merge_adjacent_wildcards(pattern)
        
        return pattern

    def _merge_adjacent_wildcards(self, pattern: str) -> str:
        while '**' in pattern:
            pattern = pattern.replace('**', '*')
        
        pattern = re.sub(r':\*(:\*)+', ':*', pattern)
        pattern = re.sub(r'_\*(_\*)+', '_*', pattern)
        
        return pattern


class KeyPatternGrouper:
    def __init__(self):
        self.extractor = KeyPatternExtractor()
        self.patterns: Dict[str, KeyPattern] = {}
        self._raw_patterns: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    def add_key(self, key: str, duration_us: int, command: str):
        raw_pattern = self.extractor.extract_pattern(key)
        
        self._raw_patterns[raw_pattern][key] += 1
        
        if raw_pattern not in self.patterns:
            self.patterns[raw_pattern] = KeyPattern(pattern=raw_pattern)
        
        self.patterns[raw_pattern].add_sample(key, duration_us, command)

    def get_patterns(self, min_count: int = 1) -> List[KeyPattern]:
        result = [
            p for p in self.patterns.values()
            if p.count >= min_count
        ]
        result.sort(key=lambda x: (-x.count, -x.total_duration_us))
        return result

    def get_top_patterns(self, limit: int = 10) -> List[KeyPattern]:
        patterns = self.get_patterns()
        return patterns[:limit]


class KeyAnalyzer:
    def __init__(self, entries):
        self.entries = entries
        self.grouper = KeyPatternGrouper()
        self._analyzed = False

    def analyze(self):
        if self._analyzed:
            return
        
        for entry in self.entries:
            for key in entry.keys:
                self.grouper.add_key(key, entry.duration_us, entry.command)
        
        self._analyzed = True

    def get_pattern_summary(self, min_count: int = 1) -> List[KeyPattern]:
        self.analyze()
        return self.grouper.get_patterns(min_count)

    def get_top_patterns(self, limit: int = 10) -> List[KeyPattern]:
        self.analyze()
        return self.grouper.get_top_patterns(limit)
