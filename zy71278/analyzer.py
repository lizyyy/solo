from datetime import datetime
from typing import Any, Optional

from models import (
    ActivityLabel,
    AuditAction,
    AuditTrail,
    EntropyResult,
    HotZone,
    PathBucket,
    TrajectoryReport,
    VisitorTrajectory,
    Zone,
)
from entropy import compute_entropy, EntropyError
from bucket import bucket_trajectories, BucketError
from hotzone import compute_hot_zones, HotZoneError
from activity import compare_activities, ActivityError
from report import export_report, export_report_json


class PipelineError(Exception):
    def __init__(self, message: str, step: str, diagnostics: dict[str, Any]):
        super().__init__(message)
        self.step = step
        self.diagnostics = diagnostics


def run_analysis(
    trajectories: list[VisitorTrajectory],
    zones: list[Zone],
    activities: list[ActivityLabel],
    noise_threshold_seconds: float = 30.0,
    interference_threshold: float = 0.3,
    actor: str = "pipeline",
) -> TrajectoryReport:
    audit = AuditTrail()
    audit.record(AuditAction.CREATED, actor, "动线分析流水线启动")

    report = TrajectoryReport(
        report_id=f"RPT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        generated_at=datetime.now().isoformat(),
        audit=audit,
    )

    intermediates: dict[str, Any] = {}

    for t in trajectories:
        t.audit.record(AuditAction.CREATED, "ingest", f"轨迹录入: visitor={t.visitor_id}, 路径={'->'.join(t.path_sequence)}")

    audit.record(AuditAction.ENRICHED, actor, f"接收到 {len(trajectories)} 条轨迹, {len(zones)} 个区域, {len(activities)} 个活动标签")

    try:
        entropy_result = compute_entropy(trajectories, actor=actor)
        report.entropy_result = entropy_result
        intermediates["entropy"] = entropy_result.intermediate
        audit.record(AuditAction.ENTROPY_COMPUTED, actor, f"熵值: H={entropy_result.raw_entropy:.4f}, H_norm={entropy_result.normalized_entropy:.4f}")
    except EntropyError as e:
        intermediates["entropy_error"] = e.diagnostics
        audit.record(AuditAction.ENTROPY_COMPUTED, actor, f"熵值计算失败: {e}")
        raise PipelineError(
            f"熵值计算步骤失败: {e}",
            step="entropy_computation",
            diagnostics=e.diagnostics,
        )

    try:
        path_buckets, bucket_intermediate = bucket_trajectories(
            trajectories, deduplicate=True, actor=actor,
        )
        report.path_buckets = path_buckets
        intermediates["bucketing"] = bucket_intermediate
        audit.record(AuditAction.BUCKETED, actor, f"路径分桶完成: {len(path_buckets)} 个分桶")
    except BucketError as e:
        intermediates["bucketing_error"] = e.diagnostics
        audit.record(AuditAction.BUCKETED, actor, f"路径分桶失败: {e}")
        raise PipelineError(
            f"路径分桶步骤失败: {e}",
            step="path_bucketing",
            diagnostics=e.diagnostics,
        )

    try:
        hot_zones, hotzone_intermediate = compute_hot_zones(
            trajectories, zones,
            noise_threshold_seconds=noise_threshold_seconds,
            actor=actor,
        )
        report.hot_zones = hot_zones
        intermediates["hotzone"] = hotzone_intermediate
        audit.record(AuditAction.HOTZONE_IDENTIFIED, actor, f"热区识别完成: {len(hot_zones)} 个热区")
    except HotZoneError as e:
        intermediates["hotzone_error"] = e.diagnostics
        audit.record(AuditAction.HOTZONE_IDENTIFIED, actor, f"热区识别失败: {e}")
        raise PipelineError(
            f"热区解释步骤失败: {e}",
            step="hotzone_identification",
            diagnostics=e.diagnostics,
        )

    try:
        comparisons, activity_intermediate = compare_activities(
            trajectories, activities,
            baseline_entropy=entropy_result.normalized_entropy,
            actor=actor,
        )
        report.activity_comparisons = comparisons
        intermediates["activity"] = activity_intermediate
        audit.record(AuditAction.ACTIVITY_COMPARED, actor, f"活动对比完成: {len(comparisons)} 个活动")
    except ActivityError as e:
        intermediates["activity_error"] = e.diagnostics
        audit.record(AuditAction.ACTIVITY_COMPARED, actor, f"活动对比失败: {e}")
        raise PipelineError(
            f"活动对比步骤失败: {e}",
            step="activity_comparison",
            diagnostics=e.diagnostics,
        )

    report.intermediates = intermediates
    audit.record(AuditAction.REPORT_GENERATED, actor, f"动线报告生成: {report.report_id}")

    return report


def query_audit_trail(trajectories: list[VisitorTrajectory]) -> dict[str, Any]:
    result: dict[str, Any] = {
        "trajectory_audit": [],
    }

    for t in trajectories:
        entries = []
        entries.extend(t.audit.history())
        for d in t.dwells:
            entries.extend(d.audit.history())
        result["trajectory_audit"].append({
            "trajectory_id": t.trajectory_id,
            "visitor_id": t.visitor_id,
            "history": entries,
        })

    return result
