import json
from datetime import datetime
from typing import Any, Optional

from models import (
    ActivityComparison,
    AuditAction,
    AuditTrail,
    EntropyResult,
    HotZone,
    PathBucket,
    TrajectoryReport,
)


def format_report_section(title: str, content: Any) -> str:
    sep = "=" * 60
    lines = [sep, "  " + title, sep]
    if isinstance(content, dict):
        for k, v in content.items():
            if isinstance(v, (dict, list)) and v:
                lines.append(f"  {k}:")
                lines.append(f"    {json.dumps(v, ensure_ascii=False, indent=4)}")
            else:
                lines.append(f"  {k}: {v}")
    elif isinstance(content, list):
        for item in content:
            lines.append(f"  - {item}")
    else:
        lines.append(f"  {content}")
    return "\n".join(lines)


def export_report(
    report: TrajectoryReport,
    include_intermediates: bool = True,
    include_audit: bool = True,
) -> str:
    sections: list[str] = []

    sections.append(format_report_section("展厅动线熵值分析报告", {
        "报告ID": report.report_id,
        "生成时间": report.generated_at,
    }))

    if report.entropy_result:
        er = report.entropy_result
        sections.append(format_report_section("一、熵值计算", {
            "Shannon熵 (H)": f"{er.raw_entropy:.4f}",
            "归一化熵 (H_norm)": f"{er.normalized_entropy:.4f}",
            "最大可能熵 (H_max)": f"{er.max_entropy:.4f}",
            "唯一路径数": er.unique_paths,
            "总轨迹数": er.total_trajectories,
            "集中度 (最大路径概率)": f"{er.intermediate.get('concentration_ratio', 'N/A')}",
        }))

        if include_intermediates and "p_log_contributions" in er.intermediate:
            sections.append(format_report_section("  熵值中间量: 路径概率与贡献", {
                k: f"p={er.path_distribution.get(k, 'N/A'):.4f}, 贡献={v:.4f}"
                for k, v in er.intermediate["p_log_contributions"].items()
            }))

    if report.path_buckets:
        bucket_data = [
            {
                "分桶ID": b.bucket_id,
                "路径": "->".join(b.path_pattern),
                "频次": b.count,
                "概率": f"{b.probability:.4f}",
            }
            for b in report.path_buckets
        ]
        sections.append(format_report_section("二、路径分桶", bucket_data))

    if report.hot_zones:
        hz_data = [
            {
                "排名": hz.heat_rank,
                "区域": hz.zone_name,
                "总停留(秒)": f"{hz.total_dwell_seconds:.1f}",
                "访问次数": hz.visit_count,
                "均停留(秒)": f"{hz.avg_dwell_seconds:.1f}",
                "解读": hz.interpretation,
            }
            for hz in report.hot_zones
        ]
        sections.append(format_report_section("三、热区解释", hz_data))

    if report.activity_comparisons:
        ac_data = [
            {
                "活动": ac.label,
                "熵值": f"{ac.entropy:.4f}",
                "归一化熵": f"{ac.normalized_entropy:.4f}",
                "轨迹数": ac.trajectory_count,
                "主导路径": ac.dominant_path or "无",
                "干扰标记": "⚠️ 是" if ac.interference_flag else "否",
                "干扰说明": ac.interference_reason,
            }
            for ac in report.activity_comparisons
        ]
        sections.append(format_report_section("四、活动对比", ac_data))

    if include_intermediates and report.intermediates:
        sections.append(format_report_section("五、关键中间量", report.intermediates))

    if include_audit and report.audit.entries:
        audit_lines = []
        for e in report.audit.history():
            audit_lines.append(f"[{e['timestamp']}] {e['actor']} > {e['action']}: {e['detail']}")
        sections.append(format_report_section("六、变更审计", audit_lines))

    return "\n\n".join(sections)


def export_report_json(report: TrajectoryReport) -> dict[str, Any]:
    result: dict[str, Any] = {
        "report_id": report.report_id,
        "generated_at": report.generated_at,
    }

    if report.entropy_result:
        er = report.entropy_result
        result["entropy"] = {
            "raw": er.raw_entropy,
            "normalized": er.normalized_entropy,
            "max": er.max_entropy,
            "unique_paths": er.unique_paths,
            "total_trajectories": er.total_trajectories,
            "path_distribution": er.path_distribution,
            "intermediate": er.intermediate,
        }

    if report.path_buckets:
        result["path_buckets"] = [
            {
                "bucket_id": b.bucket_id,
                "path_pattern": list(b.path_pattern),
                "count": b.count,
                "probability": b.probability,
            }
            for b in report.path_buckets
        ]

    if report.hot_zones:
        result["hot_zones"] = [
            {
                "zone_id": hz.zone_id,
                "zone_name": hz.zone_name,
                "total_dwell_seconds": hz.total_dwell_seconds,
                "visit_count": hz.visit_count,
                "avg_dwell_seconds": hz.avg_dwell_seconds,
                "heat_rank": hz.heat_rank,
                "interpretation": hz.interpretation,
            }
            for hz in report.hot_zones
        ]

    if report.activity_comparisons:
        result["activity_comparisons"] = [
            {
                "label": ac.label,
                "entropy": ac.entropy,
                "normalized_entropy": ac.normalized_entropy,
                "trajectory_count": ac.trajectory_count,
                "dominant_path": ac.dominant_path,
                "interference_flag": ac.interference_flag,
                "interference_reason": ac.interference_reason,
            }
            for ac in report.activity_comparisons
        ]

    result["intermediates"] = report.intermediates
    result["audit"] = report.audit.history()

    return result
