#!/usr/bin/env python3
import os

files = {
    "redis_key_analyzer/__init__.py": '__version__ = "0.1.0"\n',
    
    "redis_key_analyzer/scanner.py": """import redis
import json
import csv
from typing import List, Dict, Any, Tuple, Optional
from tqdm import tqdm
from dataclasses import dataclass, asdict
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class KeyInfo:
    key: str
    ttl: str
    ttl_seconds: Optional[int]
    memory_bytes: int
    key_type: str
    prefix: str
    has_expiry: bool
    scan_timestamp: str


@dataclass
class BadRecord:
    row_number: int
    raw_data: str
    error_reason: str
    timestamp: str


class RedisScanner:
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0, password: str = None):
        self.host = host
        self.port = port
        self.db = db
        self.password = password
        self.client = None

    def connect(self) -> bool:
        try:
            self.client = redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                password=self.password,
                decode_responses=True,
                socket_timeout=5
            )
            self.client.ping()
            logger.info("Successfully connected to Redis")
            return True
        except Exception as e:
            logger.error("Failed to connect to Redis: %s", e)
            return False

    def scan_keys(self, pattern: str = "*", batch_size: int = 1000, max_keys: int = None):
        if not self.client:
            raise ConnectionError("Not connected to Redis")

        keys_info = []
        bad_records = []
        count = 0

        logger.info("Starting key scan with pattern: %s", pattern)
        
        try:
            for key in tqdm(self.client.scan_iter(match=pattern, count=batch_size), desc="Scanning keys"):
                if max_keys and count >= max_keys:
                    break

                try:
                    key_info = self._get_key_info(key)
                    if key_info:
                        keys_info.append(key_info)
                    count += 1
                except Exception as e:
                    bad_records.append(BadRecord(
                        row_number=count + 1,
                        raw_data=key,
                        error_reason=str(e),
                        timestamp=datetime.now().isoformat()
                    ))
                    logger.warning("Error processing key %s: %s", key, e)

        except Exception as e:
            logger.error("Scan failed: %s", e)

        logger.info("Scan completed. Processed %d keys", count)
        return keys_info, bad_records

    def _get_key_info(self, key: str):
        ttl_seconds = self.client.ttl(key)
        memory_bytes = self.client.memory_usage(key) or 0
        key_type = self.client.type(key)
        
        prefix = self._extract_prefix(key)
        has_expiry = ttl_seconds != -1

        if ttl_seconds == -1:
            ttl_category = "PERMANENT"
        elif ttl_seconds == -2:
            ttl_category = "NOT_FOUND"
        elif ttl_seconds < 3600:
            ttl_category = "TTL_1H"
        elif ttl_seconds < 86400:
            ttl_category = "TTL_1D"
        elif ttl_seconds < 604800:
            ttl_category = "TTL_1W"
        elif ttl_seconds < 2592000:
            ttl_category = "TTL_1M"
        else:
            ttl_category = "TTL_LONG"

        return KeyInfo(
            key=key,
            ttl=ttl_category,
            ttl_seconds=ttl_seconds if ttl_seconds > 0 else None,
            memory_bytes=memory_bytes,
            key_type=key_type,
            prefix=prefix,
            has_expiry=has_expiry,
            scan_timestamp=datetime.now().isoformat()
        )

    def _extract_prefix(self, key: str, delimiter: str = ":", max_depth: int = 2) -> str:
        parts = key.split(delimiter)
        if len(parts) <= max_depth:
            return delimiter.join(parts[:-1]) if len(parts) > 1 else parts[0]
        return delimiter.join(parts[:max_depth])

    def load_from_file(self, file_path: str):
        keys_info = []
        bad_records = []

        logger.info("Loading keys from file: %s", file_path)
        
        try:
            if file_path.endswith(".json"):
                with open(file_path, "r") as f:
                    data = json.load(f)
                    for idx, item in enumerate(tqdm(data, desc="Loading JSON")):
                        try:
                            key_info = KeyInfo(
                                key=item.get("key", ""),
                                ttl=item.get("ttl", "UNKNOWN"),
                                ttl_seconds=item.get("ttl_seconds"),
                                memory_bytes=item.get("memory_bytes", 0),
                                key_type=item.get("key_type", "unknown"),
                                prefix=item.get("prefix", self._extract_prefix(item.get("key", ""))),
                                has_expiry=item.get("has_expiry", False),
                                scan_timestamp=item.get("scan_timestamp", datetime.now().isoformat())
                            )
                            keys_info.append(key_info)
                        except Exception as e:
                            bad_records.append(BadRecord(
                                row_number=idx + 1,
                                raw_data=str(item),
                                error_reason=str(e),
                                timestamp=datetime.now().isoformat()
                            ))
            elif file_path.endswith(".csv"):
                with open(file_path, "r", newline="", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for idx, row in enumerate(tqdm(reader, desc="Loading CSV")):
                        try:
                            ttl_sec = int(row["ttl_seconds"]) if row.get("ttl_seconds") and row["ttl_seconds"] else None
                            key_info = KeyInfo(
                                key=row.get("key", ""),
                                ttl=row.get("ttl", "UNKNOWN"),
                                ttl_seconds=ttl_sec,
                                memory_bytes=int(row.get("memory_bytes", 0)),
                                key_type=row.get("key_type", "unknown"),
                                prefix=row.get("prefix", self._extract_prefix(row.get("key", ""))),
                                has_expiry=row.get("has_expiry", "False").lower() == "true",
                                scan_timestamp=row.get("scan_timestamp", datetime.now().isoformat())
                            )
                            keys_info.append(key_info)
                        except Exception as e:
                            bad_records.append(BadRecord(
                                row_number=idx + 2,
                                raw_data=str(row),
                                error_reason=str(e),
                                timestamp=datetime.now().isoformat()
                            ))
            else:
                raise ValueError("Unsupported file format")

        except Exception as e:
            logger.error("Failed to load file: %s", e)
            raise

        logger.info("Loaded %d keys", len(keys_info))
        return keys_info, bad_records
""",
    
    "redis_key_analyzer/analyzer.py": """from typing import List, Dict, Any, Tuple
from collections import defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime
import pandas as pd
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
    prefix_analysis: Dict[str, PrefixAnalysis]
    ttl_overview: Dict[str, int]
    top_prefixes_by_memory: List[Tuple[str, int]]
    top_prefixes_by_permanent_keys: List[Tuple[str, int]]
    analysis_timestamp: str


class KeyAnalyzer:
    def __init__(self, owner_mapping: Dict[str, str] = None):
        self.owner_mapping = owner_mapping or {}

    def analyze(self, keys_info: List[KeyInfo]) -> AnalysisResult:
        logger.info("Starting key analysis...")

        total_keys = len(keys_info)
        total_memory = sum(k.memory_bytes for k in keys_info)
        permanent_keys = sum(1 for k in keys_info if k.ttl == "PERMANENT")
        permanent_memory = sum(k.memory_bytes for k in keys_info if k.ttl == "PERMANENT")

        ttl_overview = defaultdict(int)
        for key_info in keys_info:
            ttl_overview[key_info.ttl] += 1

        prefix_data = self._analyze_by_prefix(keys_info)

        top_by_memory = sorted(
            [(prefix, pa.total_memory_bytes) for prefix, pa in prefix_data.items()],
            key=lambda x: x[1],
            reverse=True
        )[:20]

        top_by_permanent = sorted(
            [(prefix, pa.permanent_keys) for prefix, pa in prefix_data.items()],
            key=lambda x: x[1],
            reverse=True
        )[:20]

        result = AnalysisResult(
            total_keys=total_keys,
            total_memory_bytes=total_memory,
            permanent_keys=permanent_keys,
            permanent_memory_bytes=permanent_memory,
            prefix_analysis=prefix_data,
            ttl_overview=dict(ttl_overview),
            top_prefixes_by_memory=top_by_memory,
            top_prefixes_by_permanent_keys=top_by_permanent,
            analysis_timestamp=datetime.now().isoformat()
        )

        logger.info("Analysis completed. %d keys analyzed.", total_keys)
        return result

    def _analyze_by_prefix(self, keys_info: List[KeyInfo]) -> Dict[str, PrefixAnalysis]:
        prefix_groups = defaultdict(list)
        for key_info in keys_info:
            prefix_groups[key_info.prefix].append(key_info)

        prefix_analysis = {}
        for prefix, group in prefix_groups.items():
            prefix_analysis[prefix] = self._analyze_prefix_group(prefix, group)

        return prefix_analysis

    def _analyze_prefix_group(self, prefix: str, group: List[KeyInfo]) -> PrefixAnalysis:
        total_keys = len(group)
        total_memory = sum(k.memory_bytes for k in group)
        permanent_keys = sum(1 for k in group if k.ttl == "PERMANENT")
        permanent_memory = sum(k.memory_bytes for k in group if k.ttl == "PERMANENT")

        ttl_values = [k.ttl_seconds for k in group if k.ttl_seconds is not None]
        avg_ttl = sum(ttl_values) / len(ttl_values) if ttl_values else 0

        ttl_dist = defaultdict(int)
        key_type_dist = defaultdict(int)
        for key_info in group:
            ttl_dist[key_info.ttl] += 1
            key_type_dist[key_info.key_type] += 1

        owner = self._find_owner(prefix)

        return PrefixAnalysis(
            prefix=prefix,
            total_keys=total_keys,
            permanent_keys=permanent_keys,
            total_memory_bytes=total_memory,
            permanent_memory_bytes=permanent_memory,
            avg_ttl_seconds=avg_ttl,
            ttl_distribution=dict(ttl_dist),
            key_type_distribution=dict(key_type_dist),
            owner=owner
        )

    def _find_owner(self, prefix: str) -> str:
        for pattern, owner in self.owner_mapping.items():
            if prefix.startswith(pattern) or pattern in prefix:
                return owner
        return "unassigned"

    def export_to_dataframe(self, analysis: AnalysisResult) -> pd.DataFrame:
        rows = []
        for prefix, pa in analysis.prefix_analysis.items():
            rows.append({
                "prefix": prefix,
                "owner": pa.owner,
                "total_keys": pa.total_keys,
                "permanent_keys": pa.permanent_keys,
                "permanent_ratio": pa.permanent_keys / pa.total_keys if pa.total_keys > 0 else 0,
                "total_memory_mb": round(pa.total_memory_bytes / 1024 / 1024, 2),
                "permanent_memory_mb": round(pa.permanent_memory_bytes / 1024 / 1024, 2),
                "avg_ttl_hours": round(pa.avg_ttl_seconds / 3600, 2) if pa.avg_ttl_seconds > 0 else 0,
            })
        return pd.DataFrame(rows)
""",
}

for filepath, content in files.items():
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Created {filepath}")

print("Done!")
