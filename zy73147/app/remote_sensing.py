from typing import Tuple, Optional, List
from dataclasses import dataclass

from app.models import RecordStatus


CLOUD_COVER_THRESHOLD = 0.15


@dataclass
class CloudDetectionResult:
    has_cloud: bool
    cloud_ratio: float
    should_suspend: bool
    affected_judgments: List[str]


def detect_cloud_cover(cloud_ratio: float) -> CloudDetectionResult:
    has_cloud = cloud_ratio > 0
    should_suspend = cloud_ratio >= CLOUD_COVER_THRESHOLD

    affected = []
    if should_suspend:
        affected.append("淤积等级判定（因云遮挡导致遥感数据不可信）")
        affected.append("时序对比结果（该时间点数据被挂起，不参与趋势计算）")
        affected.append("导出报表（该记录标记为待补材料，不进入正式导出）")

    return CloudDetectionResult(
        has_cloud=has_cloud,
        cloud_ratio=cloud_ratio,
        should_suspend=should_suspend,
        affected_judgments=affected,
    )


def build_gray_release_note(
    changed_fields: List[str],
    before_judgment: Optional[str],
    after_judgment: Optional[str],
) -> str:
    parts = ["【灰度发布临时备注】遥感截图补录说明："]
    if changed_fields:
        parts.append(f"本次补录更新了字段: {', '.join(changed_fields)}。")
    if before_judgment and after_judgment and before_judgment != after_judgment:
        parts.append(f"判定结果由「{before_judgment}」改为「{after_judgment}」。")
    else:
        parts.append("判定结果未发生变化。")
    return " ".join(parts)


def build_post_run_note(
    supplement_count: int,
    judgment_changed: bool,
    export_diffs: List[dict],
) -> str:
    parts = ["【运行后补录备注】"]
    parts.append(f"本次共补录 {supplement_count} 条材料。")
    if judgment_changed:
        parts.append("该记录判定结果被改判。")
    else:
        parts.append("该记录判定结果保持不变。")
    if export_diffs:
        diff_desc = "; ".join(
            f"{d.get('field_name')}: {d.get('old_value')} → {d.get('new_value')}"
            for d in export_diffs
        )
        parts.append(f"导出数据变化: {diff_desc}")
    else:
        parts.append("导出数据无变化。")
    return " ".join(parts)


def get_cloud_suspend_explanation(cloud_ratio: float) -> str:
    return (
        f"遥感截图云遮挡比例 {cloud_ratio:.1%}，"
        f"超过阈值 {CLOUD_COVER_THRESHOLD:.1%}，"
        "该记录已挂起并放入待补材料队列。"
        "受影响的结论包括：淤积等级判定、时序趋势分析、正式报表导出。"
    )
