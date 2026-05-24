from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


@dataclass
class PartitionSample:
    partition_path: str
    partition_values: Dict[str, str]
    file_count: int
    total_size_bytes: int
    schema_hash: str


class PartitionSampler:
    def __init__(self, seed: int = 42):
        self.seed = seed

    def discover_partitions(
        self,
        root_path: str,
        max_partitions: int = 100,
        include_partitions: Optional[List[str]] = None,
        exclude_partitions: Optional[List[str]] = None,
    ) -> List[Dict[str, str]]:
        root = Path(root_path)
        if not root.is_dir():
            raise ValueError(f"Not a directory: {root_path}")

        partitions = []
        parquet_files = list(root.rglob("*.parquet"))

        for file_path in parquet_files:
            rel_path = file_path.relative_to(root)
            parts = rel_path.parts[:-1]

            partition_values = {}
            for part in parts:
                if "=" in part:
                    col, val = part.split("=", 1)
                    partition_values[col] = val

            if partition_values and partition_values not in partitions:
                partitions.append(partition_values)

        if include_partitions:
            partitions = [
                p for p in partitions
                if any(self._matches_partition(p, f) for f in include_partitions)
            ]

        if exclude_partitions:
            partitions = [
                p for p in partitions
                if not any(self._matches_partition(p, e) for e in exclude_partitions)
            ]

        partitions.sort(key=lambda x: tuple(sorted(x.items())))

        return partitions[:max_partitions]

    def _matches_partition(
        self, partition: Dict[str, str], pattern: str
    ) -> bool:
        if "=" in pattern:
            col, val = pattern.split("=", 1)
            return partition.get(col) == val
        else:
            return pattern in partition

    def sample_partitions(
        self,
        root_path: str,
        sample_count: int = 5,
        sample_per_partition: int = 3,
        include_partitions: Optional[List[str]] = None,
    ) -> List[Tuple[Dict[str, str], List[str]]]:
        import random
        random.seed(self.seed)

        root = Path(root_path)
        
        all_files = list(root.rglob("*.parquet"))
        
        partition_files: Dict[str, Tuple[Dict[str, str], List[str]]] = {}
        
        for file_path in all_files:
            rel_path = file_path.relative_to(root)
            parts = rel_path.parts[:-1]
            
            partition_values = {}
            partition_key_parts = []
            for part in parts:
                if "=" in part:
                    col, val = part.split("=", 1)
                    partition_values[col] = val
                    partition_key_parts.append(f"{col}={val}")
            
            if partition_values:
                partition_key = "/".join(partition_key_parts)
                if partition_key not in partition_files:
                    partition_files[partition_key] = (partition_values, [])
                partition_files[partition_key][1].append(str(file_path))

        if not partition_files:
            return []

        partition_list = list(partition_files.values())
        
        if include_partitions:
            partition_list = [
                (p, f) for p, f in partition_list
                if any(self._matches_partition(p, f) for f in include_partitions)
            ]

        if len(partition_list) > sample_count:
            partition_list = random.sample(partition_list, sample_count)

        results = []
        for partition, files in partition_list:
            if len(files) > sample_per_partition:
                files = random.sample(files, sample_per_partition)
            results.append((partition, files))

        return results

    def get_partition_stats(
        self, root_path: str
    ) -> Dict[str, PartitionSample]:
        import hashlib

        root = Path(root_path)
        partitions = self.discover_partitions(root_path)
        stats = {}

        for partition in partitions:
            partition_path = self._build_partition_path(root, partition)
            files = list(Path(partition_path).rglob("*.parquet"))

            total_size = sum(f.stat().st_size for f in files)

            schema_hashes = []
            for f in files[:min(5, len(files))]:
                try:
                    import pyarrow.parquet as pq
                    pf = pq.ParquetFile(f)
                    schema_str = str(pf.schema_arrow)
                    schema_hashes.append(hashlib.md5(schema_str.encode()).hexdigest())
                except Exception:
                    pass

            schema_hash = schema_hashes[0] if schema_hashes else "unknown"

            key = "/".join([f"{k}={v}" for k, v in sorted(partition.items())])
            stats[key] = PartitionSample(
                partition_path=partition_path,
                partition_values=partition,
                file_count=len(files),
                total_size_bytes=total_size,
                schema_hash=schema_hash,
            )

        return stats
