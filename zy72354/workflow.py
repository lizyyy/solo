from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum

from models import (
    SolarTrackingBracketError,
    ManualInspectionNote,
    SafetyThreshold,
    ErrorStatus,
    VersionHistory,
)
from boundary_rules import (
    BoundaryRuleEngine,
    BoundaryCheckResult,
    MIN_SAMPLING_DURATION_MINUTES,
)
from import_service import ImportService, ImportResult
from visualization_review import (
    VisualizationReviewService,
    ViewMode,
)


class WorkflowStep(str, Enum):
    STEP_1_IMPORT = "第一步：导入手写巡检备注"
    STEP_2_REVIEW_THRESHOLD = "第二步：质检员补看安全阈值表"
    STEP_3_UPDATE_CHART = "第三步：实验复盘图更新"


class HumanMessageCode(str, Enum):
    SAMPLING_DURATION_TOO_SHORT = "SAMPLING_DURATION_TOO_SHORT"
    SAMPLING_START_MISSING = "SAMPLING_START_MISSING"
    SAMPLING_END_MISSING = "SAMPLING_END_MISSING"
    AZIMUTH_EXCEEDS = "AZIMUTH_EXCEEDS"
    ELEVATION_EXCEEDS = "ELEVATION_EXCEEDS"
    TRACKING_ACCURACY_LOW = "TRACKING_ACCURACY_LOW"
    DUPLICATE_IMPORT = "DUPLICATE_IMPORT"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    MODIFICATION_SUCCESS = "MODIFICATION_SUCCESS"
    ROLLBACK_SUCCESS = "ROLLBACK_SUCCESS"


ERROR_CODE_TO_HUMAN = {
    "SAMPLING_DURATION_TOO_SHORT": "采样时间缺了半小时",
    "SAMPLING_START_MISSING": "没填采样开始时间",
    "SAMPLING_END_MISSING": "没填采样结束时间",
    "SAMPLING_TIME_MISSING_BOTH": "采样开始和结束时间都没填",
    "AZIMUTH_EXCEEDS": "方位角误差超过安全阈值",
    "ELEVATION_EXCEEDS": "俯仰角误差超过安全阈值",
    "TRACKING_ACCURACY_LOW": "跟踪准确率低于要求",
}


@dataclass
class WorkflowActionResult:
    success: bool
    step: WorkflowStep
    human_messages: List[str]
    error_codes: List[str]
    data: Optional[Dict[str, Any]] = None
    next_actions: List[str] = field(default_factory=list)
    pending_review_count: int = 0


class QualityInspectionWorkflow:
    def __init__(
        self,
        rule_engine: BoundaryRuleEngine,
        import_service: ImportService,
        viz_service: VisualizationReviewService,
    ):
        self.rule_engine = rule_engine
        self.import_service = import_service
        self.viz_service = viz_service
        self.current_step: WorkflowStep = WorkflowStep.STEP_1_IMPORT
        self.step_history: List[Tuple[WorkflowStep, datetime]] = []

    def _translate_to_human(self, error_codes: List[str]) -> List[str]:
        messages: List[str] = []
        for code in error_codes:
            base_code = code.split("_")[0] if "_" in code else code
            if base_code in ["SAMPLING", "AZIMUTH", "ELEVATION", "TRACKING"]:
                for key, human_msg in ERROR_CODE_TO_HUMAN.items():
                    if code.startswith(key):
                        duration_part = ""
                        if code.startswith("SAMPLING_DURATION_TOO_SHORT_"):
                            try:
                                actual = float(code.split("_")[-1].replace("min", ""))
                                missing = MIN_SAMPLING_DURATION_MINUTES - actual
                                duration_part = (
                                    f"（只有{actual:.0f}分钟，"
                                    f"缺{missing:.0f}分钟，要求≥30分钟）"
                                )
                            except ValueError:
                                pass
                        messages.append(human_msg + duration_part)
                        break
        return messages if messages else error_codes

    def step_1_import_notes(
        self, notes: List[ManualInspectionNote]
    ) -> WorkflowActionResult:
        self._record_step(WorkflowStep.STEP_1_IMPORT)

        import_result = self.import_service.import_notes(notes)

        human_messages: List[str] = []
        error_codes: List[str] = []

        human_messages.append(
            f"导入完成：共{import_result.total_notes}条备注，"
            f"新增{import_result.new_notes}条，"
            f"重复{import_result.duplicate_notes}条（已跳过），"
            f"更新{import_result.updated_notes}条"
        )

        if import_result.duplicate_errors_skipped > 0:
            human_messages.append(
                f"温馨提示：{import_result.duplicate_errors_skipped}条"
                f"\"太阳跟踪支架误差\"因内容完全相同未重复生成，数量不会翻倍"
            )
            error_codes.append("DUPLICATE_IMPORT")

        pending_errors = self.import_service.get_pending_review_errors()
        if pending_errors:
            duration_issues = [
                e for e in pending_errors
                if any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in e.boundary_violations)
            ]
            if duration_issues:
                human_messages.append(
                    f"⚠️  有{len(duration_issues)}条采样时间缺了半小时，"
                    f"别急着归正常，留给质检员复核"
                )
                for e in duration_issues[:3]:
                    human_messages.append(
                        f"  • 支架{e.bracket_id}："
                        + "；".join(e.human_readable_issues)
                    )

        for error in import_result.errors:
            error_codes.extend(error.boundary_violations)
            if error.human_readable_issues:
                human_messages.extend(
                    [f"  • {msg}" for msg in error.human_readable_issues[:2]]
                )

        next_actions = ["查看待复核列表", "进入第二步：补看安全阈值表"]

        if import_result.created_errors > 0:
            next_actions.append("查看图表/3D展示")

        self.current_step = WorkflowStep.STEP_2_REVIEW_THRESHOLD

        return WorkflowActionResult(
            success=True,
            step=WorkflowStep.STEP_1_IMPORT,
            human_messages=human_messages,
            error_codes=list(set(error_codes)),
            data={
                "import_result": {
                    "batch_id": import_result.batch_id,
                    "total": import_result.total_notes,
                    "new": import_result.new_notes,
                    "duplicate": import_result.duplicate_notes,
                    "updated": import_result.updated_notes,
                    "created_errors": import_result.created_errors,
                },
                "errors": [e.to_dict() for e in import_result.errors],
            },
            next_actions=next_actions,
            pending_review_count=len(pending_errors),
        )

    def step_2_review_threshold(
        self, error_id: Optional[str] = None
    ) -> WorkflowActionResult:
        self._record_step(WorkflowStep.STEP_2_REVIEW_THRESHOLD)

        human_messages: List[str] = []
        error_codes: List[str] = []

        threshold_data = self.viz_service.navigate_to_source(
            error_id or "any", "safety_threshold"
        )

        human_messages.append("【安全阈值表】")
        human_messages.append(threshold_data.human_message)

        pending_errors = self.import_service.get_pending_review_errors()
        duration_issues = [
            e for e in pending_errors
            if any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in e.boundary_violations)
        ]

        if error_id:
            error = self.import_service.get_error(error_id)
            if error:
                human_messages.append("")
                human_messages.append(
                    f"【当前记录对比】支架{error.bracket_id}"
                )
                if error.azimuth_error is not None:
                    status = (
                        "✅ 正常"
                        if error.azimuth_error <= self.rule_engine.threshold.azimuth_max
                        else "❌ 超限"
                    )
                    human_messages.append(
                        f"  方位角误差：{error.azimuth_error}° "
                        f"(阈值≤{self.rule_engine.threshold.azimuth_max}°) {status}"
                    )
                if error.elevation_error is not None:
                    status = (
                        "✅ 正常"
                        if error.elevation_error <= self.rule_engine.threshold.elevation_max
                        else "❌ 超限"
                    )
                    human_messages.append(
                        f"  俯仰角误差：{error.elevation_error}° "
                        f"(阈值≤{self.rule_engine.threshold.elevation_max}°) {status}"
                    )
                if error.tracking_accuracy is not None:
                    status = (
                        "✅ 正常"
                        if error.tracking_accuracy >= self.rule_engine.threshold.tracking_accuracy_min
                        else "❌ 不足"
                    )
                    human_messages.append(
                        f"  跟踪准确率：{error.tracking_accuracy}% "
                        f"(阈值≥{self.rule_engine.threshold.tracking_accuracy_min}%) {status}"
                    )
                if error.sampling_duration_minutes is not None:
                    status = (
                        "✅ 正常"
                        if error.sampling_duration_minutes >= MIN_SAMPLING_DURATION_MINUTES
                        else "⚠️  缺半小时，待复核"
                    )
                    human_messages.append(
                        f"  采样时长：{error.sampling_duration_minutes:.0f}分钟 "
                        f"(阈值≥30分钟) {status}"
                    )

                error_codes.extend(error.boundary_violations)

        if duration_issues:
            human_messages.append("")
            human_messages.append(
                f"⚠️  仍有{len(duration_issues)}条采样时间缺半小时未复核："
            )
            for e in duration_issues[:5]:
                human_messages.append(
                    f"  • 支架{e.bracket_id} - "
                    f"采样{e.sampling_duration_minutes:.0f}分钟，"
                    f"缺{30 - e.sampling_duration_minutes:.0f}分钟"
                )

        next_actions = [
            "返回待复核列表",
            "修改数据补全采样时间",
            "复核确认标记状态",
            "进入第三步：更新实验复盘图",
        ]

        self.current_step = WorkflowStep.STEP_3_UPDATE_CHART

        return WorkflowActionResult(
            success=True,
            step=WorkflowStep.STEP_2_REVIEW_THRESHOLD,
            human_messages=human_messages,
            error_codes=list(set(error_codes)),
            data={
                "threshold": self.rule_engine.threshold.to_dict(),
                "min_sampling_duration": MIN_SAMPLING_DURATION_MINUTES,
            },
            next_actions=next_actions,
            pending_review_count=len(pending_errors),
        )

    def step_3_update_chart(
        self, view_mode: ViewMode = ViewMode.CHART_2D
    ) -> WorkflowActionResult:
        self._record_step(WorkflowStep.STEP_3_UPDATE_CHART)

        chart_data = self.viz_service.prepare_chart_data(view_mode)
        summary = self.viz_service.get_visualization_summary()

        human_messages: List[str] = []
        error_codes: List[str] = []

        human_messages.append(
            f"【{view_mode.value}复盘图已更新】"
        )
        human_messages.append(summary["human_summary"])

        if summary["duration_issues_count"] > 0:
            human_messages.append(
                f"⚠️  图中{summary['duration_issues_count']}个红点"
                f"表示采样时间缺半小时，点击可跳回原始备注或阈值表"
            )
            error_codes.append("SAMPLING_DURATION_TOO_SHORT")

        if summary["by_status"]["pending_review"] > 0:
            human_messages.append(
                "💡 温馨提示：点击图表中的数据点不会直接改状态，"
                "必须先回手写巡检备注或安全阈值表核对"
            )
            error_codes.append("NEEDS_REVIEW")

        human_messages.append("")
        human_messages.append("【图表交互说明】")
        human_messages.append("  • 点击任意数据点 → 查看详情 + 快捷复核链接")
        human_messages.append("  • 选\"跳转手写巡检备注\" → 看原始记录")
        human_messages.append("  • 选\"查看安全阈值表\" → 核对判定标准")
        human_messages.append("  • 采样时间缺半小时的记录 → 强制先复核再改状态")

        next_actions = [
            "点击数据点查看详情",
            "跳转到原始备注核对",
            "完成复核后刷新图表",
            "导出复盘报告",
        ]

        return WorkflowActionResult(
            success=True,
            step=WorkflowStep.STEP_3_UPDATE_CHART,
            human_messages=human_messages,
            error_codes=list(set(error_codes)),
            data={
                "chart_data": chart_data,
                "summary": summary,
            },
            next_actions=next_actions,
            pending_review_count=summary["by_status"]["pending_review"],
        )

    def reviewer_fix_duration_issue(
        self,
        error_id: str,
        new_sampling_start: datetime,
        new_sampling_end: datetime,
        reviewer: str,
        review_comment: str,
    ) -> WorkflowActionResult:
        error = self.import_service.get_error(error_id)
        if not error:
            return WorkflowActionResult(
                success=False,
                step=self.current_step,
                human_messages=["找不到这条误差记录"],
                error_codes=["NOT_FOUND"],
            )

        note = self.import_service.get_note(error.note_id)
        if not note:
            return WorkflowActionResult(
                success=False,
                step=self.current_step,
                human_messages=["找不到对应的手写巡检备注"],
                error_codes=["NOTE_NOT_FOUND"],
            )

        updated_note = ManualInspectionNote(
            note_id=note.note_id,
            inspection_date=note.inspection_date,
            inspector=note.inspector,
            bracket_id=note.bracket_id,
            azimuth_error=note.azimuth_error,
            elevation_error=note.elevation_error,
            sampling_start_time=new_sampling_start,
            sampling_end_time=new_sampling_end,
            tracking_accuracy=note.tracking_accuracy,
            raw_content=note.raw_content + f"\n[质检员{reviewer}补全采样时间]",
            version=note.version,
        )

        new_error, history, old_error = self.import_service.update_single_note(
            error.note_id,
            updated_note,
            modified_by=reviewer,
            modification_reason=review_comment or "补全采样时间",
        )

        rechecked_error = self.rule_engine.re_evaluate(new_error)
        final_error = self.rule_engine.reviewer_confirm(
            rechecked_error,
            reviewer=reviewer,
            comment=review_comment,
            mark_as_normal=not rechecked_error.boundary_violations,
        )

        human_messages = [
            f"✅ 修改成功：支架{final_error.bracket_id}",
        ]

        if final_error.sampling_duration_minutes:
            human_messages.append(
                f"   采样时长：{final_error.sampling_duration_minutes:.0f}分钟"
            )

        if final_error.status == ErrorStatus.NORMAL:
            human_messages.append("   状态：已复核通过，标记为正常")
        else:
            human_messages.append(
                f"   状态：{final_error.status.value}"
            )
            if final_error.human_readable_issues:
                human_messages.append(
                    "   仍有问题：" + "；".join(final_error.human_readable_issues)
                )

        diff_messages = self.import_service.get_version_diff_for_humans(
            error_id, history.version - 1, history.version
        )
        if diff_messages:
            human_messages.append("")
            human_messages.append("【改前改后对比】")
            human_messages.extend([f"   {m}" for m in diff_messages])

        pending_errors = self.import_service.get_pending_review_errors()

        return WorkflowActionResult(
            success=True,
            step=self.current_step,
            human_messages=human_messages,
            error_codes=["MODIFICATION_SUCCESS"],
            data={
                "error_before": old_error.to_dict() if old_error else None,
                "error_after": final_error.to_dict(),
                "history": history.to_dict(),
            },
            next_actions=["查看历史版本对比", "继续处理下一条待复核", "刷新图表"],
            pending_review_count=len(pending_errors),
        )

    def reviewer_confirm_status(
        self,
        error_id: str,
        reviewer: str,
        comment: str,
        mark_as_normal: bool = False,
    ) -> WorkflowActionResult:
        error = self.import_service.get_error(error_id)
        if not error:
            return WorkflowActionResult(
                success=False,
                step=self.current_step,
                human_messages=["找不到这条误差记录"],
                error_codes=["NOT_FOUND"],
            )

        has_duration_issue = any(
            v.startswith("SAMPLING_DURATION_TOO_SHORT")
            for v in error.boundary_violations
        )

        if has_duration_issue and mark_as_normal and not comment.strip():
            return WorkflowActionResult(
                success=False,
                step=self.current_step,
                human_messages=[
                    "❌ 采样时间缺半小时的记录不能直接标记为正常",
                    "   请先补全采样时间，或填写复核说明解释为何缺时仍可通过",
                ],
                error_codes=["SAMPLING_DURATION_TOO_SHORT"],
            )

        final_error = self.rule_engine.reviewer_confirm(
            error,
            reviewer=reviewer,
            comment=comment,
            mark_as_normal=mark_as_normal,
        )

        human_messages = [
            f"✅ 复核完成：支架{final_error.bracket_id}",
            f"   复核人：{reviewer}",
            f"   状态：{final_error.status.value}",
        ]
        if comment:
            human_messages.append(f"   复核说明：{comment}")

        pending_errors = self.import_service.get_pending_review_errors()

        return WorkflowActionResult(
            success=True,
            step=self.current_step,
            human_messages=human_messages,
            error_codes=[],
            data={
                "error": final_error.to_dict(),
            },
            next_actions=["继续处理下一条", "刷新图表"],
            pending_review_count=len(pending_errors),
        )

    def rollback_modification(
        self, error_id: str, reviewer: str
    ) -> WorkflowActionResult:
        error = self.import_service.get_error(error_id)
        if not error:
            return WorkflowActionResult(
                success=False,
                step=self.current_step,
                human_messages=["找不到这条误差记录"],
                error_codes=["NOT_FOUND"],
            )

        history_list = self.import_service.get_error_history(error_id)
        if not history_list:
            return WorkflowActionResult(
                success=False,
                step=self.current_step,
                human_messages=["这条记录没有修改历史，无法回滚"],
                error_codes=["NO_HISTORY"],
            )

        last_history = history_list[-1]

        rolled_back_error, rollback_history = self.rule_engine.rollback(
            error, last_history, modified_by=reviewer
        )

        self.import_service._error_store[error_id] = rolled_back_error
        self.import_service._history_store[error_id].append(rollback_history)

        human_messages = [
            f"✅ 已回滚到版本 {last_history.version}",
            f"   支架：{rolled_back_error.bracket_id}",
            f"   当前状态：{rolled_back_error.status.value}",
        ]

        if last_history.fields_changed:
            field_names = {
                "sampling_start_time": "采样开始时间",
                "sampling_end_time": "采样结束时间",
                "sampling_duration_minutes": "采样时长",
                "azimuth_error": "方位角误差",
                "elevation_error": "俯仰角误差",
            }
            fields_str = "、".join(
                [field_names.get(f, f) for f in last_history.fields_changed]
            )
            human_messages.append(f"   回滚字段：{fields_str}")

        pending_errors = self.import_service.get_pending_review_errors()

        return WorkflowActionResult(
            success=True,
            step=self.current_step,
            human_messages=human_messages,
            error_codes=["ROLLBACK_SUCCESS"],
            data={
                "rolled_back_error": rolled_back_error.to_dict(),
                "rollback_history": rollback_history.to_dict(),
            },
            next_actions=["查看历史版本", "重新修改", "刷新图表"],
            pending_review_count=len(pending_errors),
        )

    def get_quick_pending_summary(self) -> str:
        pending = self.import_service.get_pending_review_errors()
        if not pending:
            return "✅ 所有记录已处理完毕，没有待复核项"

        duration_count = sum(
            1 for e in pending
            if any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in e.boundary_violations)
        )

        lines = [
            f"⏰ 共{len(pending)}条待复核（开会前只剩10分钟，速看！）",
            f"  • 采样时间缺半小时：{duration_count}条（优先级最高）",
            f"  • 其他待复核：{len(pending) - duration_count}条",
        ]

        if duration_count > 0:
            lines.append("")
            lines.append("【采样缺时的记录，点我直接看】")
            for e in pending[:5]:
                if any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in e.boundary_violations):
                    lines.append(
                        f"  → 支架{e.bracket_id}："
                        + "；".join(e.human_readable_issues)
                    )

        return "\n".join(lines)

    def _record_step(self, step: WorkflowStep):
        self.step_history.append((step, datetime.now()))

    def get_workflow_progress(self) -> Dict[str, Any]:
        steps_completed = [s[0].value for s in self.step_history]
        return {
            "current_step": self.current_step.value,
            "steps_completed": steps_completed,
            "total_steps": 3,
            "completed_count": len(self.step_history),
            "human_progress": (
                f"当前进度：{len(self.step_history)}/3 步已完成，"
                f"下一步：{self.current_step.value}"
            ),
        }

    def get_full_error_detail(self, error_id: str) -> Dict[str, Any]:
        error = self.import_service.get_error(error_id)
        if not error:
            return {"success": False, "message": "找不到误差记录"}

        note = self.import_service.get_note(error.note_id)
        history = self.import_service.get_error_history(error_id)
        human_diff = []
        if len(history) >= 1:
            human_diff = self.import_service.get_version_diff_for_humans(
                error_id, history[-1].version - 1, history[-1].version
            )

        has_duration_issue = any(
            v.startswith("SAMPLING_DURATION_TOO_SHORT")
            for v in error.boundary_violations
        )

        original_issue_statement = ""
        if error.human_readable_issues:
            original_issue_statement = error.human_readable_issues[0]

        modified_value_summary = {}
        processing_reason = ""
        next_step_person = ""

        if history:
            latest = history[-1]
            processing_reason = latest.modification_reason
            for f in latest.fields_changed:
                if f in latest.after_data:
                    modified_value_summary[f] = {
                        "before": latest.before_data.get(f),
                        "after": latest.after_data.get(f),
                    }

        if error.status == ErrorStatus.PENDING_REVIEW:
            next_step_person = "质检员小白（请先核对采样开始/结束时间，填写复核说明或补全数据）"
        elif error.status == ErrorStatus.MODIFIED:
            next_step_person = "质检员主管（请确认修改后数据是否可归档）"
        elif error.status == ErrorStatus.ROLLED_BACK:
            next_step_person = "质检员小白（回滚完成，请确认是否需要重新处理）"
        elif error.status == ErrorStatus.NORMAL:
            next_step_person = "已归档，无需进一步处理"
        else:
            next_step_person = "设备维护组（请根据异常内容检查支架）"

        review_info = {
            "reviewer": error.review_by,
            "review_time": error.review_time.strftime("%Y-%m-%d %H:%M") if error.review_time else "",
            "comment": error.review_comment,
        }

        return {
            "success": True,
            "error": error.to_dict(),
            "note": note.to_dict() if note else None,
            "threshold": self.rule_engine.threshold.to_dict(),
            "history": [h.to_dict() for h in history],
            "history_count": len(history),
            "latest_human_diff": human_diff,
            "has_duration_issue": has_duration_issue,
            "manual_review_required": has_duration_issue or error.status == ErrorStatus.PENDING_REVIEW,
            "manual_review_packet": {
                "原始问题说法": original_issue_statement or "（无问题描述）",
                "改后的值": modified_value_summary,
                "处理原因": processing_reason or (review_info["comment"] if review_info["comment"] else "（未填写）"),
                "下一步找谁": next_step_person,
            },
            "review_info": review_info,
        }

    def render_error_detail_for_humans(self, error_id: str) -> List[str]:
        detail = self.get_full_error_detail(error_id)
        if not detail["success"]:
            return [detail["message"]]

        lines: List[str] = []
        error = detail["error"]
        packet = detail["manual_review_packet"]

        lines.append("=" * 50)
        lines.append(f"📋 太阳跟踪支架误差 · 全链路详情")
        lines.append("=" * 50)
        lines.append(f"  误差ID：{error['error_id']}（v{error['version']}）")
        lines.append(f"  支架号：{error['bracket_id']}    巡检日期：{error['inspection_date']}")
        lines.append(f"  关联备注：{error['note_id']}    来源：{error['data_source']}")
        lines.append(f"  当前状态：{error['status']}")
        lines.append("-" * 50)
        lines.append(f"  方位角误差：{error['azimuth_error']}°    俯仰角误差：{error['elevation_error']}°")
        lines.append(f"  跟踪准确率：{error['tracking_accuracy']}%    采样时长：{error['sampling_duration_minutes']}分钟")
        lines.append("-" * 50)
        lines.append("🔍 【问题判定结果】")
        if error["human_readable_issues"]:
            for msg in error["human_readable_issues"]:
                lines.append(f"   ⚠️  {msg}")
        else:
            lines.append("   ✅ 无边界规则问题")
        lines.append("-" * 50)
        lines.append("📝 【人工复核信息包】（别提前归正常！）")
        lines.append(f"   🗣️  原始问题说法：{packet['原始问题说法']}")
        lines.append(f"   🔧 改后的值：")
        if packet["改后的值"]:
            field_cn = {
                "sampling_start_time": "采样开始时间",
                "sampling_end_time": "采样结束时间",
                "sampling_duration_minutes": "采样时长",
                "azimuth_error": "方位角误差",
                "elevation_error": "俯仰角误差",
                "tracking_accuracy": "跟踪准确率",
                "status": "状态",
            }
            for f, v in packet["改后的值"].items():
                name = field_cn.get(f, f)
                lines.append(f"      · {name}：{v['before']} → {v['after']}")
        else:
            lines.append("      · （暂无修改记录）")
        lines.append(f"   💡 处理原因：{packet['处理原因']}")
        lines.append(f"   👤 下一步找谁：{packet['下一步找谁']}")
        lines.append("-" * 50)
        lines.append(f"📜 【版本历史】共 {detail['history_count']} 条")
        if detail["history"]:
            for h in detail["history"]:
                lines.append(
                    f"   v{h['version']} | {h['modified_time'][:16]} | "
                    f"{h['modified_by']} | 原因：{h['modification_reason']}"
                )
                if h["fields_changed"]:
                    lines.append(f"          修改字段：{', '.join(h['fields_changed'])}")
        else:
            lines.append("   （暂无修改/回滚记录）")
        lines.append("-" * 50)
        if detail["latest_human_diff"]:
            lines.append("🔄 【最近一次改前改后对比】")
            for d in detail["latest_human_diff"]:
                lines.append(f"   {d}")
        lines.append("=" * 50)
        return lines

    def export_report(self, error_ids: Optional[List[str]] = None, format: str = "text") -> Dict[str, Any]:
        if error_ids is None:
            all_errors = self.import_service.get_all_errors()
            error_ids = [e.error_id for e in all_errors]

        report_lines: List[str] = []
        report_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        report_lines.append("")
        report_lines.append("#" * 60)
        report_lines.append("#  太阳跟踪支架误差 · 质检报告")
        report_lines.append(f"#  导出时间：{report_time}")
        report_lines.append("#" * 60)
        report_lines.append("")

        summary = self.viz_service.get_visualization_summary()
        report_lines.append("📊 总览摘要")
        report_lines.append("-" * 40)
        report_lines.append(f"   总记录数：{summary['total']}")
        report_lines.append(
            f"   按状态分布："
            f"正常 {summary['by_status']['normal']} 条，"
            f"异常 {summary['by_status']['abnormal']} 条，"
            f"待复核 {summary['by_status']['pending_review']} 条，"
            f"已修改 {summary['by_status']['modified']} 条，"
            f"已回滚 {summary['by_status']['rolled_back']} 条"
        )
        report_lines.append(f"   采样时间缺半小时：{summary['duration_issues_count']} 条")
        report_lines.append(f"   需要关注：{summary['needs_attention']} 条")
        report_lines.append(f"   一句话总结：{summary['human_summary']}")
        report_lines.append("")
        report_lines.append("=" * 60)
        report_lines.append("")

        for idx, eid in enumerate(error_ids, 1):
            detail_lines = self.render_error_detail_for_humans(eid)
            report_lines.extend(detail_lines)
            report_lines.append("")

        report_lines.append("")
        report_lines.append("#" * 60)
        report_lines.append("#  报告结束 · 共导出 " + str(len(error_ids)) + " 条记录")
        report_lines.append("#" * 60)
        report_lines.append("")

        report_text = "\n".join(report_lines)

        return {
            "format": format,
            "generated_at": report_time,
            "record_count": len(error_ids),
            "error_ids": error_ids,
            "summary": summary,
            "text": report_text,
            "lines": report_lines,
        }

    def save_report_to_file(self, output_path: str, error_ids: Optional[List[str]] = None) -> str:
        report = self.export_report(error_ids=error_ids)
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(report["text"])
            return output_path
        except Exception as ex:
            raise IOError(f"报告保存失败：{ex}")
