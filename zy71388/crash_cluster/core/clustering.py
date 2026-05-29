from typing import List, Dict
from datetime import datetime, timezone
from .models import CrashReport, CrashCluster
from .normalizer import StackNormalizer
from .version_device import VersionBucketer, DeviceNormalizer


class ClusteringEngine:
    def __init__(self, normalizer: StackNormalizer):
        self.normalizer = normalizer

    def process_report(self, report: CrashReport) -> CrashReport:
        if report.stack_trace:
            norm, is_obf, obf_frames = self.normalizer.normalize_stack(report.stack_trace)
            report.normalized_stack = norm
            report.is_obfuscated = is_obf
            report.obfuscated_frames = obf_frames
            report.stack_fingerprint = self.normalizer.fingerprint(norm)
        if report.app_version:
            report.version_bucket = VersionBucketer.bucket(report.app_version)
        if report.device_model:
            report.device_family = DeviceNormalizer.family(report.device_model)
        report.updated_at = datetime.now(timezone.utc).isoformat()
        return report

    def cluster(self, reports: List[CrashReport]) -> List[CrashCluster]:
        clusters: Dict[str, CrashCluster] = {}
        report_map: Dict[str, CrashReport] = {r.id: r for r in reports}

        for report in reports:
            if not report.stack_fingerprint:
                continue

            matched = False
            fp = report.stack_fingerprint

            if fp in clusters:
                cluster = clusters[fp]
                if self._should_merge(report, cluster, report_map):
                    self._merge_into(cluster, report)
                    report.cluster_id = cluster.id
                    matched = True

            if not matched:
                for cid, cluster in clusters.items():
                    if cid == fp:
                        continue
                    if self.normalizer.is_similar(report.normalized_stack or "", cluster.representative_stack):
                        if self._should_merge(report, cluster, report_map):
                            self._merge_into(cluster, report)
                            report.cluster_id = cluster.id
                            matched = True
                            break

            if not matched:
                cluster = CrashCluster(
                    fingerprint=fp,
                    version_bucket=report.version_bucket or "unknown",
                    representative_stack=report.normalized_stack or "",
                    crash_ids=[report.id],
                    first_seen=report.created_at,
                    last_seen=report.created_at,
                )
                self._update_distributions(cluster, report)
                clusters[fp] = cluster
                report.cluster_id = cluster.id

        return list(clusters.values())

    def _should_merge(self, report: CrashReport, cluster: CrashCluster,
                      report_map: Dict[str, CrashReport]) -> bool:
        if not self.normalizer.is_similar(report.normalized_stack or "", cluster.representative_stack):
            return False

        existing_reports = [report_map[rid] for rid in cluster.crash_ids if rid in report_map]
        version_buckets = {r.version_bucket for r in existing_reports if r.version_bucket}
        if report.version_bucket and version_buckets and report.version_bucket not in version_buckets:
            if report.version_bucket != "unknown":
                similar_count = sum(
                    1 for r in existing_reports
                    if r.version_bucket == report.version_bucket
                )
                if similar_count == 0:
                    return True

        return True

    def _merge_into(self, cluster: CrashCluster, report: CrashReport):
        cluster.crash_ids.append(report.id)
        self._update_distributions(cluster, report)
        if report.created_at < (cluster.first_seen or report.created_at):
            cluster.first_seen = report.created_at
        if report.created_at > (cluster.last_seen or report.created_at):
            cluster.last_seen = report.created_at
        cluster.updated_at = datetime.now(timezone.utc).isoformat()

    def _update_distributions(self, cluster: CrashCluster, report: CrashReport):
        dev = report.device_family or "Unknown"
        cluster.device_distribution[dev] = cluster.device_distribution.get(dev, 0) + 1

        vb = report.version_bucket or "unknown"
        cluster.version_distribution[vb] = cluster.version_distribution.get(vb, 0) + 1

        if report.is_obfuscated:
            cluster.obfuscated_count += 1

    def detect_version_misclassification(self, reports: List[CrashReport],
                                         clusters: List[CrashCluster]) -> List[Dict]:
        issues = []
        cluster_map = {c.id: c for c in clusters}
        for report in reports:
            if not report.cluster_id or report.cluster_id not in cluster_map:
                continue
            cluster = cluster_map[report.cluster_id]
            if VersionBucketer.is_misclassified(report.app_version, cluster.version_bucket):
                issues.append({
                    "crash_id": report.id,
                    "report_version": report.app_version,
                    "report_bucket": report.version_bucket,
                    "cluster_dominant_bucket": cluster.version_bucket,
                    "issue": "version_mismatch",
                    "suggestion": f"Crash version {report.app_version} bucketed as {report.version_bucket}, "
                                  f"but cluster dominant version is {cluster.version_bucket}"
                })
        return issues

    def detect_duplicates(self, reports: List[CrashReport]) -> List[Dict]:
        dupes = []
        seen: Dict[str, List[str]] = {}
        for report in reports:
            if not report.stack_fingerprint:
                continue
            fp = report.stack_fingerprint
            vb = report.version_bucket or "unknown"
            key = f"{fp}::{vb}"
            if key in seen:
                dupes.append({
                    "crash_id": report.id,
                    "duplicate_of": seen[key][0],
                    "fingerprint": fp,
                    "version_bucket": vb,
                    "issue": "duplicate_stack",
                    "same_group_ids": seen[key] + [report.id],
                })
                seen[key].append(report.id)
            else:
                seen[key] = [report.id]
        return dupes
