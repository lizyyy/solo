import os

base = 'redis_key_analyzer'

# analyzer.py
analyzer = '''from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime
import pandas as pd
import json
import logging

from .scanner import KeyInfo, BadRecord

logger = logging.getLogger(__name__)


@dataclass
class PrefixAnalysis:
    prefix: str
    total_keys: int
    permanent_keys: int
    total_memory_bytes: int
    permanent_memory_bytes: int
    avg_ttl_seconds: float
    ttl_distribution: Dict[str, int]
    key_type_distribution: Dict[str, int]
    owner: str = "unassigned"


@dataclass
class AnalysisResult:
    total_keys: int
    total_memory_bytes: int
    permanent_keys: int
    permanent_memory_bytes: int
    prefix_analysis: List[PrefixAnalysis]
    scan_timestamp: str
    bad_records: List[BadRecord]
    overall_ttl_distribution: Dict[str, int]
    overall_key_type_distribution: Dict[str, int]


class KeyAnalyzer:
    def __init__(self, owner_mapping: Dict[str, str] = None):
        self.owner_mapping = owner_mapping or {}
        self._default_owner = "unassigned"

    def analyze(self, keys_info: List[KeyInfo], bad_records: List[BadRecord] = None) -> AnalysisResult:
        logger.info(f"Starting analysis of {len(keys_info)} keys")

        total_memory = sum(k.memory_bytes for k in keys_info)
        permanent_keys = [k for k in keys_info if not k.has_expiry]
        permanent_memory = sum(k.memory_bytes for k in permanent_keys)

        overall_ttl = defaultdict(int)
        overall_key_type = defaultdict(int)
        for k in keys_info:
            overall_ttl[k.ttl] += 1
            overall_key_type[k.key_type] += 1

        prefix_groups = self._analyze_by_prefix(keys_info)
        prefix_analysis_list = []

        for prefix, group in prefix_groups.items():
            analysis = self._analyze_prefix_group(prefix, group)
            analysis.owner = self._find_owner(prefix)
            prefix_analysis_list.append(analysis)

        prefix_analysis_list.sort(key=lambda x: x.total_memory_bytes, reverse=True)

        result = AnalysisResult(
            total_keys=len(keys_info),
            total_memory_bytes=total_memory,
            permanent_keys=len(permanent_keys),
            permanent_memory_bytes=permanent_memory,
            prefix_analysis=prefix_analysis_list,
            scan_timestamp=datetime.now().isoformat(),
            bad_records=bad_records or [],
            overall_ttl_distribution=dict(overall_ttl),
            overall_key_type_distribution=dict(overall_key_type)
        )

        logger.info(f"Analysis completed. Found {len(prefix_analysis_list)} prefix groups.")
        return result

    def _analyze_by_prefix(self, keys_info: List[KeyInfo]) -> Dict[str, List[KeyInfo]]:
        groups = defaultdict(list)
        for key_info in keys_info:
            groups[key_info.prefix].append(key_info)
        return groups

    def _analyze_prefix_group(self, prefix: str, group: List[KeyInfo]) -> PrefixAnalysis:
        total_keys = len(group)
        total_memory = sum(k.memory_bytes for k in group)
        permanent_keys = [k for k in group if not k.has_expiry]
        permanent_memory = sum(k.memory_bytes for k in permanent_keys)

        ttl_with_values = [k.ttl_seconds for k in group if k.ttl_seconds and k.ttl_seconds > 0]
        avg_ttl = sum(ttl_with_values) / len(ttl_with_values) if ttl_with_values else 0.0

        ttl_dist = defaultdict(int)
        key_type_dist = defaultdict(int)
        for k in group:
            ttl_dist[k.ttl] += 1
            key_type_dist[k.key_type] += 1

        return PrefixAnalysis(
            prefix=prefix,
            total_keys=total_keys,
            permanent_keys=len(permanent_keys),
            total_memory_bytes=total_memory,
            permanent_memory_bytes=permanent_memory,
            avg_ttl_seconds=avg_ttl,
            ttl_distribution=dict(ttl_dist),
            key_type_distribution=dict(key_type_dist)
        )

    def _find_owner(self, prefix: str) -> str:
        if not self.owner_mapping:
            return self._default_owner
        
        for pattern, owner in self.owner_mapping.items():
            if prefix.startswith(pattern) or pattern in prefix:
                return owner
        return self._default_owner

    def export_to_dataframe(self, result: AnalysisResult) -> Tuple[pd.DataFrame, pd.DataFrame]:
        summary_data = {
            "metric": [
                "total_keys",
                "total_memory_bytes",
                "permanent_keys",
                "permanent_memory_bytes",
                "scan_timestamp"
            ],
            "value": [
                result.total_keys,
                result.total_memory_bytes,
                result.permanent_keys,
                result.permanent_memory_bytes,
                result.scan_timestamp
            ]
        }
        summary_df = pd.DataFrame(summary_data)

        prefix_data = []
        for pa in result.prefix_analysis:
            prefix_data.append({
                "prefix": pa.prefix,
                "owner": pa.owner,
                "total_keys": pa.total_keys,
                "permanent_keys": pa.permanent_keys,
                "total_memory_bytes": pa.total_memory_bytes,
                "permanent_memory_bytes": pa.permanent_memory_bytes,
                "avg_ttl_seconds": pa.avg_ttl_seconds,
                "ttl_distribution": json.dumps(pa.ttl_distribution),
                "key_type_distribution": json.dumps(pa.key_type_distribution)
            })
        prefix_df = pd.DataFrame(prefix_data)

        return summary_df, prefix_df

    @staticmethod
    def load_owner_mapping(file_path: str) -> Dict[str, str]:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                mapping = json.load(f)
            logger.info(f"Loaded owner mapping with {len(mapping)} entries")
            return mapping
        except Exception as e:
            logger.error(f"Failed to load owner mapping: {e}")
            return {}
'''

with open(os.path.join(base, 'analyzer.py'), 'w') as f:
    f.write(analyzer)
print("analyzer.py done")
