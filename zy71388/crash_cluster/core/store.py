from typing import List, Dict, Optional
from .models import CrashReport, CrashCluster
from datetime import datetime, timezone


class Store:
    def __init__(self):
        self.crashes: Dict[str, CrashReport] = {}
        self.clusters: Dict[str, CrashCluster] = {}

    def add_crash(self, report: CrashReport) -> CrashReport:
        self.crashes[report.id] = report
        return report

    def update_crash(self, crash_id: str, **kwargs) -> Optional[CrashReport]:
        if crash_id not in self.crashes:
            return None
        report = self.crashes[crash_id]
        for k, v in kwargs.items():
            if v is not None and hasattr(report, k):
                setattr(report, k, v)
        report.updated_at = datetime.now(timezone.utc).isoformat()
        return report

    def get_crash(self, crash_id: str) -> Optional[CrashReport]:
        return self.crashes.get(crash_id)

    def list_crashes(self, cluster_id: Optional[str] = None,
                     version_bucket: Optional[str] = None,
                     device_family: Optional[str] = None,
                     limit: int = 100) -> List[CrashReport]:
        results = list(self.crashes.values())
        if cluster_id:
            results = [r for r in results if r.cluster_id == cluster_id]
        if version_bucket:
            results = [r for r in results if r.version_bucket == version_bucket]
        if device_family:
            results = [r for r in results if r.device_family == device_family]
        results.sort(key=lambda r: r.created_at, reverse=True)
        return results[:limit]

    def add_cluster(self, cluster: CrashCluster) -> CrashCluster:
        self.clusters[cluster.id] = cluster
        return cluster

    def get_cluster(self, cluster_id: str) -> Optional[CrashCluster]:
        return self.clusters.get(cluster_id)

    def list_clusters(self, min_count: int = 0,
                      version_bucket: Optional[str] = None,
                      limit: int = 50) -> List[CrashCluster]:
        results = list(self.clusters.values())
        if min_count > 0:
            results = [c for c in results if len(c.crash_ids) >= min_count]
        if version_bucket:
            results = [c for c in results if c.version_bucket == version_bucket]
        results.sort(key=lambda c: len(c.crash_ids), reverse=True)
        return results[:limit]

    def replace_clusters(self, clusters: List[CrashCluster]):
        self.clusters = {c.id: c for c in clusters}

    def clear(self):
        self.crashes.clear()
        self.clusters.clear()
