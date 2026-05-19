from typing import List, Dict, Any, Optional
from collections import defaultdict
from .parser import HarEntry


class BucketConfig:
    DEFAULT_TIME_BUCKETS = [
        ("fast", 0, 100),
        ("normal", 100, 500),
        ("slow", 500, 1000),
        ("very_slow", 1000, 3000),
        ("extreme", 3000, float("inf")),
    ]

    DEFAULT_STATUS_BUCKETS = [
        ("success_2xx", 200, 300),
        ("redirect_3xx", 300, 400),
        ("client_error_4xx", 400, 500),
        ("server_error_5xx", 500, 600),
        ("other", 0, 200),
    ]

    def __init__(
        self,
        time_buckets: Optional[List[tuple]] = None,
        status_buckets: Optional[List[tuple]] = None,
        anomaly_threshold_p95: float = 1.5,
        max_anomaly_samples: int = 20,
    ):
        self.time_buckets = time_buckets or self.DEFAULT_TIME_BUCKETS
        self.status_buckets = status_buckets or self.DEFAULT_STATUS_BUCKETS
        self.anomaly_threshold_p95 = anomaly_threshold_p95
        self.max_anomaly_samples = max_anomaly_samples


class HarAnalyzer:
    def __init__(self, config: Optional[BucketConfig] = None):
        self.config = config or BucketConfig()
        self.entries: List[HarEntry] = []

    def set_entries(self, entries: List[HarEntry]):
        self.entries = sorted(entries, key=lambda x: x.raw_index)

    def get_time_bucket(self, time_ms: float) -> str:
        for bucket_name, min_time, max_time in self.config.time_buckets:
            if min_time <= time_ms < max_time:
                return bucket_name
        return "unknown"

    def get_status_bucket(self, status: int) -> str:
        if status == 0:
            return "unknown"
        for bucket_name, min_status, max_status in self.config.status_buckets:
            if min_status <= status < max_status:
                return bucket_name
        return "other"

    def aggregate_by_domain(self) -> Dict[str, Any]:
        domain_stats = defaultdict(lambda: {
            "count": 0,
            "total_time": 0.0,
            "avg_time": 0.0,
            "min_time": float("inf"),
            "max_time": 0.0,
            "time_buckets": defaultdict(int),
            "status_buckets": defaultdict(int),
            "resource_types": defaultdict(int),
            "entries": [],
        })

        for entry in self.entries:
            if entry.is_bad:
                continue
            domain = entry.domain or "unknown"
            stats = domain_stats[domain]
            stats["count"] += 1
            stats["total_time"] += entry.time
            stats["min_time"] = min(stats["min_time"], entry.time)
            stats["max_time"] = max(stats["max_time"], entry.time)
            stats["time_buckets"][self.get_time_bucket(entry.time)] += 1
            stats["status_buckets"][self.get_status_bucket(entry.status)] += 1
            stats["resource_types"][entry.resource_type] += 1
            stats["entries"].append(entry)

        for domain, stats in domain_stats.items():
            if stats["count"] > 0:
                stats["avg_time"] = stats["total_time"] / stats["count"]
            stats["entries"] = sorted(stats["entries"], key=lambda x: x.raw_index)

        return dict(sorted(domain_stats.items()))

    def aggregate_by_resource_type(self) -> Dict[str, Any]:
        type_stats = defaultdict(lambda: {
            "count": 0,
            "total_time": 0.0,
            "avg_time": 0.0,
            "min_time": float("inf"),
            "max_time": 0.0,
            "time_buckets": defaultdict(int),
            "status_buckets": defaultdict(int),
            "domains": defaultdict(int),
            "entries": [],
        })

        for entry in self.entries:
            if entry.is_bad:
                continue
            resource_type = entry.resource_type or "unknown"
            stats = type_stats[resource_type]
            stats["count"] += 1
            stats["total_time"] += entry.time
            stats["min_time"] = min(stats["min_time"], entry.time)
            stats["max_time"] = max(stats["max_time"], entry.time)
            stats["time_buckets"][self.get_time_bucket(entry.time)] += 1
            stats["status_buckets"][self.get_status_bucket(entry.status)] += 1
            stats["domains"][entry.domain] += 1
            stats["entries"].append(entry)

        for resource_type, stats in type_stats.items():
            if stats["count"] > 0:
                stats["avg_time"] = stats["total_time"] / stats["count"]
            stats["entries"] = sorted(stats["entries"], key=lambda x: x.raw_index)

        return dict(sorted(type_stats.items()))

    def aggregate_by_status_code(self) -> Dict[str, Any]:
        status_stats = defaultdict(lambda: {
            "count": 0,
            "total_time": 0.0,
            "avg_time": 0.0,
            "time_buckets": defaultdict(int),
            "resource_types": defaultdict(int),
            "domains": defaultdict(int),
            "entries": [],
        })

        for entry in self.entries:
            if entry.is_bad:
                continue
            status_bucket = self.get_status_bucket(entry.status)
            stats = status_stats[status_bucket]
            stats["count"] += 1
            stats["total_time"] += entry.time
            stats["time_buckets"][self.get_time_bucket(entry.time)] += 1
            stats["resource_types"][entry.resource_type] += 1
            stats["domains"][entry.domain] += 1
            stats["entries"].append(entry)

        for status_bucket, stats in status_stats.items():
            if stats["count"] > 0:
                stats["avg_time"] = stats["total_time"] / stats["count"]
            stats["entries"] = sorted(stats["entries"], key=lambda x: x.raw_index)

        return dict(sorted(status_stats.items()))

    def aggregate_by_time_bucket(self) -> Dict[str, Any]:
        bucket_stats = defaultdict(lambda: {
            "count": 0,
            "resource_types": defaultdict(int),
            "domains": defaultdict(int),
            "status_buckets": defaultdict(int),
            "entries": [],
        })

        for entry in self.entries:
            if entry.is_bad:
                continue
            time_bucket = self.get_time_bucket(entry.time)
            stats = bucket_stats[time_bucket]
            stats["count"] += 1
            stats["resource_types"][entry.resource_type] += 1
            stats["domains"][entry.domain] += 1
            stats["status_buckets"][self.get_status_bucket(entry.status)] += 1
            stats["entries"].append(entry)

        for bucket_name, stats in bucket_stats.items():
            stats["entries"] = sorted(stats["entries"], key=lambda x: x.raw_index)

        ordered_stats = {}
        for bucket_name, _, _ in self.config.time_buckets:
            if bucket_name in bucket_stats:
                ordered_stats[bucket_name] = bucket_stats[bucket_name]
        for bucket_name in bucket_stats:
            if bucket_name not in ordered_stats:
                ordered_stats[bucket_name] = bucket_stats[bucket_name]

        return ordered_stats

    def calculate_percentiles(self, times: List[float]) -> Dict[str, float]:
        if not times:
            return {"p50": 0.0, "p90": 0.0, "p95": 0.0, "p99": 0.0}

        sorted_times = sorted(times)
        n = len(sorted_times)

        def get_percentile(p):
            k = (n - 1) * p / 100
            f = int(k)
            c = min(f + 1, n - 1)
            if f == c:
                return sorted_times[f]
            return sorted_times[f] + (k - f) * (sorted_times[c] - sorted_times[f])

        return {
            "p50": get_percentile(50),
            "p90": get_percentile(90),
            "p95": get_percentile(95),
            "p99": get_percentile(99),
        }

    def detect_anomalies(self) -> Dict[str, Any]:
        valid_entries = [e for e in self.entries if not e.is_bad]
        if not valid_entries:
            return {
                "global_percentiles": {},
                "domain_anomalies": {},
                "type_anomalies": {},
                "slowest_entries": [],
            }

        times = [e.time for e in valid_entries]
        global_percentiles = self.calculate_percentiles(times)
        p95_threshold = global_percentiles["p95"] * self.config.anomaly_threshold_p95

        domain_anomalies = self._detect_group_anomalies(
            valid_entries, "domain", p95_threshold
        )
        type_anomalies = self._detect_group_anomalies(
            valid_entries, "resource_type", p95_threshold
        )

        slowest_entries = sorted(
            valid_entries, key=lambda x: x.time, reverse=True
        )[: self.config.max_anomaly_samples]

        return {
            "global_percentiles": global_percentiles,
            "anomaly_threshold_ms": p95_threshold,
            "domain_anomalies": domain_anomalies,
            "type_anomalies": type_anomalies,
            "slowest_entries": slowest_entries,
        }

    def _detect_group_anomalies(
        self, entries: List[HarEntry], group_key: str, threshold: float
    ) -> Dict[str, Any]:
        groups = defaultdict(list)
        for entry in entries:
            key = getattr(entry, group_key) or "unknown"
            groups[key].append(entry)

        anomalies = {}
        for group_name, group_entries in groups.items():
            slow_entries = [e for e in group_entries if e.time >= threshold]
            if slow_entries:
                group_times = [e.time for e in group_entries]
                percentiles = self.calculate_percentiles(group_times)
                anomalies[group_name] = {
                    "total_count": len(group_entries),
                    "anomaly_count": len(slow_entries),
                    "anomaly_ratio": len(slow_entries) / len(group_entries),
                    "percentiles": percentiles,
                    "samples": sorted(
                        slow_entries, key=lambda x: x.time, reverse=True
                    )[: self.config.max_anomaly_samples],
                }

        return dict(
            sorted(
                anomalies.items(),
                key=lambda x: x[1]["anomaly_ratio"],
                reverse=True,
            )
        )

    def get_full_analysis(self) -> Dict[str, Any]:
        return {
            "by_domain": self.aggregate_by_domain(),
            "by_resource_type": self.aggregate_by_resource_type(),
            "by_status_code": self.aggregate_by_status_code(),
            "by_time_bucket": self.aggregate_by_time_bucket(),
            "anomalies": self.detect_anomalies(),
            "bad_entries": [e for e in self.entries if e.is_bad],
            "summary": self._get_summary(),
        }

    def _get_summary(self) -> Dict[str, Any]:
        valid_entries = [e for e in self.entries if not e.is_bad]
        bad_entries = [e for e in self.entries if e.is_bad]
        times = [e.time for e in valid_entries]

        return {
            "total_entries": len(self.entries),
            "valid_entries": len(valid_entries),
            "bad_entries": len(bad_entries),
            "total_time_sum": sum(times),
            "percentiles": self.calculate_percentiles(times),
            "unique_domains": len(set(e.domain for e in valid_entries)),
            "unique_resource_types": len(set(e.resource_type for e in valid_entries)),
        }
