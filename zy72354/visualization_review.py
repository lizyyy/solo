from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from enum import Enum
from models import (
    SolarTrackingBracketError,
    ManualInspectionNote,
    SafetyThreshold,
    ReviewLink,
    ErrorStatus,
)
from import_service import ImportService


class ViewMode(str, Enum):
    CHART_2D = "2D图表"
    CHART_3D = "3D展示"
    TABLE = "表格"


@dataclass
class DataPoint:
    error_id: str
    x: float
    y: float
    z: Optional[float] = None
    label: str = ""
    value: Optional[float] = None
    status: str = ""
    has_duration_issue: bool = False


@dataclass
class ReviewNavigationResult:
    success: bool
    target_type: str
    target_id: str
    target_data: Optional[Dict[str, Any]]
    link_context: str
    human_message: str
    review_links: List[ReviewLink] = field(default_factory=list)


class VisualizationReviewService:
    def __init__(self, import_service: ImportService, threshold: SafetyThreshold):
        self.import_service = import_service
        self.threshold = threshold
        self._links: Dict[str, List[ReviewLink]] = {}

    def prepare_chart_data(
        self,
        view_mode: ViewMode,
        errors: Optional[List[SolarTrackingBracketError]] = None,
    ) -> Dict[str, Any]:
        if errors is None:
            errors = self.import_service.get_all_errors()

        data_points: List[DataPoint] = []

        for idx, error in enumerate(errors):
            has_duration_issue = any(
                v.startswith("SAMPLING_DURATION_TOO_SHORT")
                for v in error.boundary_violations
            )

            if view_mode == ViewMode.CHART_3D:
                dp = DataPoint(
                    error_id=error.error_id,
                    x=error.azimuth_error or 0,
                    y=error.elevation_error or 0,
                    z=error.tracking_accuracy or 0,
                    label=f"{error.bracket_id}",
                    value=error.sampling_duration_minutes,
                    status=error.status.value,
                    has_duration_issue=has_duration_issue,
                )
            else:
                dp = DataPoint(
                    error_id=error.error_id,
                    x=idx,
                    y=error.azimuth_error or 0,
                    label=f"{error.bracket_id}",
                    value=error.sampling_duration_minutes,
                    status=error.status.value,
                    has_duration_issue=has_duration_issue,
                )

            data_points.append(dp)

        threshold_lines = {
            "azimuth_max": self.threshold.azimuth_max,
            "elevation_max": self.threshold.elevation_max,
            "tracking_accuracy_min": self.threshold.tracking_accuracy_min,
            "min_sampling_duration": 30.0,
        }

        return {
            "view_mode": view_mode.value,
            "data_points": [dp.__dict__ for dp in data_points],
            "threshold_lines": threshold_lines,
            "total_points": len(data_points),
            "pending_review_count": sum(
                1 for e in errors if e.status == ErrorStatus.PENDING_REVIEW
            ),
            "has_duration_issues_count": sum(
                1 for dp in data_points if dp.has_duration_issue
            ),
        }

    def click_data_point(
        self, error_id: str, current_view: ViewMode
    ) -> ReviewNavigationResult:
        error = self.import_service.get_error(error_id)
        if not error:
            return ReviewNavigationResult(
                success=False,
                target_type="error",
                target_id=error_id,
                target_data=None,
                link_context="",
                human_message="找不到这条误差记录，请检查是否已被删除",
            )

        has_duration_issue = any(
            v.startswith("SAMPLING_DURATION_TOO_SHORT")
            for v in error.boundary_violations
        )

        human_message = ""
        if has_duration_issue:
            human_message = (
                "这条记录采样时间缺了半小时，"
                "需要先回手写巡检备注核对，"
                "或查看安全阈值表确认判定标准"
            )
        else:
            human_message = (
                f"当前查看支架 {error.bracket_id} 的误差记录，"
                f"状态：{error.status.value}"
            )

        links = self._build_review_links(error)

        note = self.import_service.get_note(error.note_id)
        target_data = {
            "error": error.to_dict(),
            "note": note.to_dict() if note else None,
            "threshold": self.threshold.to_dict(),
        }

        result = ReviewNavigationResult(
            success=True,
            target_type="error",
            target_id=error_id,
            target_data=target_data,
            link_context=human_message,
            human_message=human_message,
            review_links=links,
        )

        if error_id not in self._links:
            self._links[error_id] = []
        self._links[error_id].extend(links)

        return result

    def _build_review_links(
        self, error: SolarTrackingBracketError
    ) -> List[ReviewLink]:
        links: List[ReviewLink] = []

        note = self.import_service.get_note(error.note_id)
        if note:
            context_parts = []
            if error.sampling_duration_minutes is not None:
                context_parts.append(
                    f"当前采样时长{error.sampling_duration_minutes:.0f}分钟"
                )
            context_parts.append("点击查看完整手写巡检备注原文")

            links.append(
                ReviewLink(
                    error_id=error.error_id,
                    target_type="manual_note",
                    target_id=error.note_id,
                    target_field="raw_content",
                    context=" | ".join(context_parts),
                )
            )

        links.append(
            ReviewLink(
                error_id=error.error_id,
                target_type="safety_threshold",
                target_id="threshold_main",
                target_field="azimuth_max,elevation_max,tracking_accuracy_min",
                context=(
                    "查看安全阈值表："
                    f"方位角≤{self.threshold.azimuth_max}°, "
                    f"俯仰角≤{self.threshold.elevation_max}°, "
                    f"准确率≥{self.threshold.tracking_accuracy_min}%, "
                    f"采样时长≥30分钟"
                ),
            )
        )

        has_duration_issue = any(
            v.startswith("SAMPLING_DURATION_TOO_SHORT")
            for v in error.boundary_violations
        )
        if has_duration_issue:
            links.append(
                ReviewLink(
                    error_id=error.error_id,
                    target_type="review_action",
                    target_id="duration_review",
                    target_field="sampling_duration_minutes",
                    context=(
                        "采样时间不足30分钟，"
                        "请先核对原始备注中的采样开始/结束时间，"
                        "确认后再标记为正常或修改数据"
                    ),
                )
            )

        return links

    def navigate_to_source(
        self, error_id: str, target_type: str
    ) -> ReviewNavigationResult:
        error = self.import_service.get_error(error_id)
        if not error:
            return ReviewNavigationResult(
                success=False,
                target_type=target_type,
                target_id="",
                target_data=None,
                link_context="",
                human_message="找不到对应的误差记录",
            )

        if target_type == "manual_note":
            note = self.import_service.get_note(error.note_id)
            if note:
                return ReviewNavigationResult(
                    success=True,
                    target_type="manual_note",
                    target_id=note.note_id,
                    target_data={"note": note.to_dict()},
                    link_context=f"支架 {note.bracket_id} 的手写巡检备注",
                    human_message=(
                        f"巡检员 {note.inspector} 于 {note.inspection_date} "
                        f"记录的支架 {note.bracket_id} 原始备注"
                    ),
                )
            else:
                return ReviewNavigationResult(
                    success=False,
                    target_type="manual_note",
                    target_id=error.note_id,
                    target_data=None,
                    link_context="",
                    human_message="找不到对应的手写巡检备注，可能已被删除",
                )

        elif target_type == "safety_threshold":
            return ReviewNavigationResult(
                success=True,
                target_type="safety_threshold",
                target_id="threshold_main",
                target_data={"threshold": self.threshold.to_dict()},
                link_context="太阳跟踪支架误差安全阈值表",
                human_message=(
                    "安全阈值判定标准：\n"
                    f"• 方位角误差 ≤ {self.threshold.azimuth_max}°\n"
                    f"• 俯仰角误差 ≤ {self.threshold.elevation_max}°\n"
                    f"• 跟踪准确率 ≥ {self.threshold.tracking_accuracy_min}%\n"
                    "• 单条记录采样时长 ≥ 30分钟\n"
                    "\n"
                    "最后更新时间："
                    f"{self.threshold.update_time.strftime('%Y-%m-%d %H:%M')}"
                ),
            )

        elif target_type == "review_action":
            pending_errors = self.import_service.get_pending_review_errors()
            return ReviewNavigationResult(
                success=True,
                target_type="review_action",
                target_id="pending_list",
                target_data={
                    "pending_count": len(pending_errors),
                    "errors": [e.to_dict() for e in pending_errors],
                },
                link_context="待质检员复核列表",
                human_message=(
                    f"当前共有 {len(pending_errors)} 条记录等待复核，"
                    "请优先处理采样时间不足的记录"
                ),
            )

        else:
            return ReviewNavigationResult(
                success=False,
                target_type=target_type,
                target_id="",
                target_data=None,
                link_context="",
                human_message=f"不支持跳转到类型：{target_type}",
            )

    def get_visualization_summary(
        self, errors: Optional[List[SolarTrackingBracketError]] = None
    ) -> Dict[str, Any]:
        if errors is None:
            errors = self.import_service.get_all_errors()

        total = len(errors)
        normal = sum(1 for e in errors if e.status == ErrorStatus.NORMAL)
        abnormal = sum(1 for e in errors if e.status == ErrorStatus.ABNORMAL)
        pending = sum(1 for e in errors if e.status == ErrorStatus.PENDING_REVIEW)
        modified = sum(1 for e in errors if e.status == ErrorStatus.MODIFIED)
        rolled_back = sum(1 for e in errors if e.status == ErrorStatus.ROLLED_BACK)

        duration_issues = sum(
            1 for e in errors
            if any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in e.boundary_violations)
        )

        return {
            "total": total,
            "by_status": {
                "normal": normal,
                "abnormal": abnormal,
                "pending_review": pending,
                "modified": modified,
                "rolled_back": rolled_back,
            },
            "duration_issues_count": duration_issues,
            "needs_attention": pending + abnormal,
            "human_summary": (
                f"共{total}条记录，"
                f"{pending}条待复核（含{duration_issues}条采样时间缺半小时），"
                f"{abnormal}条异常，{normal}条正常"
            ),
        }
