from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Tuple
from collections import defaultdict
from .parser import DNSRecord, ZoneParseResult, SourceLocation, BadLine


@dataclass
class TTLDiff:
    name: str
    record_type: str
    value: str
    env_ttls: Dict[str, Optional[int]]
    envs: List[str]

    def has_diff(self) -> bool:
        ttls = [t for t in self.env_ttls.values() if t is not None]
        return len(set(ttls)) > 1


@dataclass
class MissingRecordValue:
    name: str
    record_type: str
    value: str
    present_envs: Set[str]
    missing_envs: Set[str]
    sample_record: Optional[DNSRecord] = None


@dataclass
class ValueDiff:
    name: str
    record_type: str
    env_values: Dict[str, List[str]]


@dataclass
class DiffResult:
    envs: List[str]
    ttl_diffs: List[TTLDiff] = field(default_factory=list)
    missing_records: List[MissingRecordValue] = field(default_factory=list)
    value_diffs: List[ValueDiff] = field(default_factory=list)
    bad_lines: List[BadLine] = field(default_factory=list)
    common_records: int = 0
    total_records_by_env: Dict[str, int] = field(default_factory=dict)

    def has_issues(self) -> bool:
        return bool(self.ttl_diffs or self.missing_records or self.value_diffs)


class ZoneComparator:
    def __init__(self, parse_results: List[ZoneParseResult]):
        self.parse_results = parse_results
        self.envs = sorted([pr.env for pr in parse_results])
        self.name_type_value_map: Dict[Tuple[str, str], Dict[str, Dict[str, DNSRecord]]] = defaultdict(lambda: defaultdict(dict))
        self._build_maps()

    def _build_maps(self):
        for pr in self.parse_results:
            for record in pr.records:
                name_type_key = (record.normalized_name(), record.record_type)
                normalized_value = record.normalized_value()
                self.name_type_value_map[name_type_key][normalized_value][pr.env] = record

    def get_all_name_type_keys(self) -> List[Tuple[str, str]]:
        keys = list(self.name_type_value_map.keys())
        keys.sort(key=lambda k: (k[0], k[1]))
        return keys

    def compare(self) -> DiffResult:
        result = DiffResult(envs=self.envs)
        
        for pr in self.parse_results:
            result.total_records_by_env[pr.env] = len(pr.records)
            result.bad_lines.extend(pr.bad_lines)

        all_name_type_keys = self.get_all_name_type_keys()
        common_count = 0

        for name_type_key in all_name_type_keys:
            name, record_type = name_type_key
            value_env_map = self.name_type_value_map[name_type_key]
            
            all_values = set(value_env_map.keys())
            
            for value in all_values:
                env_records = value_env_map[value]
                present_envs = set(env_records.keys())
                missing_envs = set(self.envs) - present_envs
                
                if missing_envs:
                    sample_record = next(iter(env_records.values()))
                    result.missing_records.append(MissingRecordValue(
                        name=name,
                        record_type=record_type,
                        value=value,
                        present_envs=present_envs,
                        missing_envs=missing_envs,
                        sample_record=sample_record,
                    ))
                else:
                    common_count += 1
                
                if len(present_envs) > 1:
                    ttl_diff = self._check_ttl_diff(name, record_type, value, env_records)
                    if ttl_diff:
                        result.ttl_diffs.append(ttl_diff)
            
            env_values = defaultdict(list)
            for env in self.envs:
                for value, env_records in value_env_map.items():
                    if env in env_records:
                        env_values[env].append(value)
            
            for env in env_values:
                env_values[env].sort()
            
            value_sets = [tuple(vals) for vals in env_values.values()]
            if len(set(value_sets)) > 1:
                result.value_diffs.append(ValueDiff(
                    name=name,
                    record_type=record_type,
                    env_values=dict(env_values),
                ))

        result.common_records = common_count

        result.missing_records.sort(key=lambda x: (x.name, x.record_type, x.value))
        result.ttl_diffs.sort(key=lambda x: (x.name, x.record_type, x.value))
        result.value_diffs.sort(key=lambda x: (x.name, x.record_type))
        result.bad_lines.sort(key=lambda x: (x.source.env, x.source.line_number))

        return result

    def _check_ttl_diff(self, name: str, record_type: str, value: str, env_records: Dict[str, DNSRecord]) -> Optional[TTLDiff]:
        env_ttls: Dict[str, Optional[int]] = {}
        for env in self.envs:
            if env in env_records:
                env_ttls[env] = env_records[env].ttl
            else:
                env_ttls[env] = None

        ttls = [t for t in env_ttls.values() if t is not None]
        if len(set(ttls)) > 1:
            return TTLDiff(
                name=name,
                record_type=record_type,
                value=value,
                env_ttls=env_ttls,
                envs=self.envs,
            )
        return None


def compare_zones(parse_results: List[ZoneParseResult]) -> DiffResult:
    comparator = ZoneComparator(parse_results)
    return comparator.compare()
