"""工作流程管理器 - 三步核心流程 + 学生助教复核机制

三步核心流程（现场最常见的错口径和补录返工场景：
Step 1: 评分权重表第一次导入
Step 2: 运营规划阿岚补看旧公式截图
Step 3: 边界样本报告更新

关键约束：碰到负数样本被旧表当成缺失时，不急着归正常，留给学生助教复核。
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

from .models import (
    ProcessingStatus, BoundaryType, ChangeSource,
    WorkflowState, BoundaryReport, ReviewTask
)
from .database import Database
from .boundary_engine import BoundaryRuleEngine
from .importer import RatingWeightImporter

logger = logging.getLogger(__name__)


class WorkflowManager:
    """工作流程管理器"""

    def __init__(self, db: Database, boundary_engine: BoundaryRuleEngine, importer: RatingWeightImporter):
        self.db = db
        self.boundary_engine = boundary_engine
        self.importer = importer

    def step1_import_rating_table(
        self,
        file_path: str,
        operator: str = "operator"
    ) -> Dict[str, Any]:
        """
        Step 1: 第一次导入评分权重表
        自动进行边界检测，但 NEGATIVE_TREATED_AS_MISSING 不急着归正常。
        """
        result = self.importer.import_file(file_path, operator)
        batch_id = result["batch_id"]

        if not result["is_duplicate"]:
            self.boundary_engine.apply_boundary_detection(batch_id, operator)

        workflow = self.db.get_workflow(batch_id)
        if workflow:
            workflow.step_import_completed = True
            workflow.current_step = 2
            workflow.last_updated_at = datetime.now()
            self.db.update_workflow(workflow)

        boundary_stats = self._get_batch_boundary_stats(batch_id)
        pending_count = boundary_stats.get("negative_as_missing", 0)

        return {
            "step": 1,
            "step_name": "导入评分权重表",
            "completed": True,
            "next_step": 2,
            "batch_id": batch_id,
            "import_result": result,
            "boundary_detection_summary": boundary_stats,
            "action_required": (
                f"检测到 {pending_count} 条记录为【负数被旧表当成缺失，"
                f"请进入Step 2 对照旧公式截图后再处理"
            ),
            "note": "负数被旧表当成缺失的样本已标记为待复核，未自动归正常"
        }

    def step2_review_old_formula_screenshot(
        self,
        batch_id: int,
        reviewed_by: str,
        review_note: str,
        screenshot_reference: str = ""
    ) -> Dict[str, Any]:
        """
        Step 2: 运营规划阿岚补看旧公式截图
        复核结论写进历史，为 Step 3 时根据截图判定负数样本。
        """
        workflow = self.db.get_workflow(batch_id)
        if not workflow:
            self.db.init_workflow(batch_id)
            workflow = self.db.get_workflow(batch_id)

        workflow.step_formula_review_completed = True
        workflow.formula_screenshot_reviewed = True
        workflow.formula_review_note = (
            f"复核人: {reviewed_by}\n"
            f"截图参考: {screenshot_reference}\n"
            f"复核意见: {review_note}"
        )
        workflow.current_step = 3
        workflow.last_updated_at = datetime.now()
        self.db.update_workflow(workflow)

        boundary_stats = self._get_batch_boundary_stats(batch_id)

        records = self.db.get_records_by_batch(batch_id)
        boundary_records = [r for r in records if r.boundary_type != BoundaryType.NORMAL]

        return {
            "step": 2,
            "step_name": "旧公式截图复核",
            "completed": True,
            "next_step": 3,
            "batch_id": batch_id,
            "reviewed_by": reviewed_by,
            "review_note": review_note,
            "screenshot_reference": screenshot_reference,
            "boundary_summary": boundary_stats,
            "records_for_review": [
                {
                    "record_id": r.id,
                    "original_row_number": r.original_row_number,
                    "position": r.position,
                    "boundary_type": r.boundary_type.value,
                    "sample_count": r.sample_count,
                    "note": "需要结合截图判定"
                }
                for r in boundary_records
            ],
            "note": "已完成截图复核，请进入 Step 3 更新边界样本报告"
        }

    def step3_update_boundary_report(
        self,
        batch_id: int,
        operator: str = "operator",
        ta_assignee: str = "ta_default"
    ) -> Dict[str, Any]:
        """
        Step 3: 边界样本报告更新
        为 NEGATIVE_TREATED_AS_MISSING 创建复核任务，留给学生助教处理。
        """
        boundary_stats = self._get_batch_boundary_stats(batch_id)
        records = self.db.get_records_by_batch(batch_id)

        boundary_records = [r for r in records if r.boundary_type != BoundaryType.NORMAL]
        negative_as_missing_records = [
            r for r in boundary_records
            if r.boundary_type == BoundaryType.NEGATIVE_TREATED_AS_MISSING
        ]

        task_ids = self.boundary_engine.create_review_tasks(batch_id, ta_assignee)

        report_content = {
            "batch_id": batch_id,
            "generated_at": datetime.now().isoformat(),
            "boundary_types_found": {
                bt.value: len([r for r in boundary_records if r.boundary_type == bt])
                for bt in BoundaryType
            },
            "negative_treated_as_missing_details": [
                {
                    "record_id": r.id,
                    "original_row_number": r.original_row_number,
                    "position": r.position,
                    "weight_p50": r.weight_p50,
                    "sample_count": r.sample_count,
                    "raw_data": r.raw_data,
                    "note": "旧表将负数标记为缺失，需学生助教复核判定"
                }
                for r in negative_as_missing_records
            ],
            "review_tasks_created": len(task_ids),
            "review_task_ids": task_ids,
            "formula_screenshot_review_note": self.db.get_workflow(batch_id).formula_review_note if self.db.get_workflow(batch_id) else ""
        }

        report = BoundaryReport(
            batch_id=batch_id,
            generated_at=datetime.now(),
            total_records=len(records),
            boundary_records=len(boundary_records),
            negative_values=len([r for r in boundary_records if r.boundary_type == BoundaryType.NEGATIVE_VALUE]),
            missing_values=len([r for r in boundary_records if r.boundary_type == BoundaryType.MISSING_VALUE]),
            negative_as_missing=len(negative_as_missing_records),
            pending_review_count=len(task_ids),
            report_content=report_content
        )
        report_id = self.db.create_boundary_report(report)

        workflow = self.db.get_workflow(batch_id)
        if workflow:
            workflow.step_boundary_report_completed = True
            workflow.current_step = 3
            workflow.last_updated_at = datetime.now()
            self.db.update_workflow(workflow)

        return {
            "step": 3,
            "step_name": "边界样本报告更新",
            "completed": True,
            "next_step": None,
            "batch_id": batch_id,
            "report_id": report_id,
            "boundary_summary": boundary_stats,
            "review_tasks_created": task_ids,
            "report_content": report_content,
            "note": (
                f"已创建 {len(task_ids)} 条复核任务分配给 {ta_assignee}。"
                f"负数被旧表当成缺失的 {len(negative_as_missing_records)} 条样本"
                f"已留待学生助教复核，未自动归正常。"
            )
        }

    def run_full_workflow(
        self,
        file_path: str,
        import_operator: str = "alan_ops",
        formula_reviewer: str = "alan_ops",
        review_note: str = "",
        screenshot_reference: str = "",
        ta_assignee: str = "ta_student_01"
    ) -> Dict[str, Any]:
        """
        完整执行三步流程，中间碰到负数样本被旧表当成缺失时，
        不急着归正常，留给学生助教复核。
        """
        step1_result = self.step1_import_rating_table(file_path, import_operator)
        batch_id = step1_result["batch_id"]

        step2_result = self.step2_review_old_formula_screenshot(
            batch_id, formula_reviewer, review_note, screenshot_reference
        )

        step3_result = self.step3_update_boundary_report(batch_id, import_operator, ta_assignee)

        return {
            "workflow_completed": True,
            "step1": step1_result,
            "step2": step2_result,
            "step3": step3_result,
            "key_constraint_applied": (
                "负数被旧表当成缺失的样本未自动归正常，"
                "已创建复核任务待学生助教处理"
            )
        }

    def ta_review_negative_as_missing(
        self,
        task_id: int,
        record_id: int,
        review_result: str,
        correction_decision: str,
        corrected_values: Optional[Dict[str, Any]],
        ta_name: str
    ) -> Dict[str, Any]:
        """
        学生助教复核 NEGATIVE_TREATED_AS_MISSING 记录。

        correction_decision options:
        - "restore_negative": 恢复为负数值（原来就是负数，旧表错标为缺失
        - "keep_missing": 保持缺失，确认不是录入错误
        - "set_to_normal": 修改为正常值
        - "mark_outlier": 标记为异常值
        """
        task = next(
            (t for t in self.db.get_pending_review_tasks() if t.id == task_id),
            None
        )
        if not task:
            raise ValueError(f"复核任务不存在: {task_id}")

        record = self.db.get_rating_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        if record.boundary_type != BoundaryType.NEGATIVE_TREATED_AS_MISSING:
            return {
                "error": "该记录不是 NEGATIVE_TREATED_AS_MISSING 类型",
                "current_boundary_type": record.boundary_type.value
            }

        reason = f"TA复核结论: {correction_decision}; {review_result}"
        updated_record = self.boundary_engine.correct_boundary_issue(
            record_id, corrected_values, f"ta_{ta_name}", reason
        )

        task.review_result = review_result
        task.reviewed_at = datetime.now()
        task.is_completed = True
        task.review_note = (
            f"决策: {correction_decision}\n"
            f"修正值: {corrected_values}\n"
            f"备注: {review_result}"
        )
        self.db.update_review_task(task)

        version_diffs = self.importer.get_version_diff(record_id)

        return {
            "task_id": task_id,
            "record_id": record_id,
            "ta_name": ta_name,
            "review_result": review_result,
            "correction_decision": correction_decision,
            "corrected_values": corrected_values,
            "updated_status": updated_record.status.value,
            "updated_boundary_type": updated_record.boundary_type.value,
            "version_history_diff": version_diffs,
            "evidence_traced": True,
            "note": (
                "所有改动已留痕，学生助教追问时可查看历史版本对比，"
                "回到原始行号和证据"
            )
        }

    def get_workflow_status(self, batch_id: int) -> Dict[str, Any]:
        """获取工作流当前状态"""
        workflow = self.db.get_workflow(batch_id)
        if workflow:
            return {
                "batch_id": batch_id,
                "current_step": workflow.current_step,
                "step1_import_completed": workflow.step_import_completed,
                "step2_formula_review_completed": workflow.step_formula_review_completed,
                "step3_boundary_report_completed": workflow.step_boundary_report_completed,
                "formula_screenshot_reviewed": workflow.formula_screenshot_reviewed,
                "formula_review_note": workflow.formula_review_note,
                "last_updated_at": workflow.last_updated_at.isoformat()
            }
        return {"error": "工作流不存在"}

    def _get_batch_boundary_stats(self, batch_id: int) -> Dict[str, int]:
        """获取批次边界统计"""
        records = self.db.get_records_by_batch(batch_id)
        stats = {"total": len(records)}
        for bt in BoundaryType:
            stats[bt.value] = len([r for r in records if r.boundary_type == bt])
        for st in ProcessingStatus:
            stats[f"status_{st.value}"] = len([r for r in records if r.status == st])
        return stats

    def get_evidence_for_ta_query(
        self,
        record_id: int
    ) -> Dict[str, Any]:
        """
        学生助教追问时，能回到证据。
        返回：原始行号、原始数据、所有历史变更、边界检测理由。
        """
        record = self.db.get_rating_record(record_id)
        if not record:
            return {"error": f"记录不存在: {record_id}"}

        histories = self.db.get_record_histories(record_id)
        version_diffs = self.importer.get_version_diff(record_id)
        review_tasks = [
            t for t in self.db.get_pending_review_tasks()
            if t.record_id == record_id
        ]

        return {
            "record_id": record_id,
            "original_row_number": record.original_row_number,
            "import_batch_id": record.import_batch_id,
            "position": record.position,
            "raw_data": record.raw_data,
            "current_data": record.current_data,
            "boundary_type": record.boundary_type.value,
            "status": record.status.value,
            "weight_p10": record.weight_p10,
            "weight_p25": record.weight_p25,
            "weight_p50": record.weight_p50,
            "weight_p75": record.weight_p75,
            "weight_p90": record.weight_p90,
            "sample_count": record.sample_count,
            "remark": record.remark,
            "full_history": [
                {
                    "history_id": h.id,
                    "change_source": h.change_source.value,
                    "field_name": h.field_name,
                    "old_value": h.old_value,
                    "new_value": h.new_value,
                    "changed_by": h.changed_by,
                    "change_reason": h.change_reason,
                    "changed_at": h.changed_at.isoformat(),
                    "snapshot_before": h.snapshot_before,
                    "snapshot_after": h.snapshot_after
                }
                for h in histories
            ],
            "version_diffs": version_diffs,
            "review_tasks": [
                {
                    "task_id": t.id,
                    "assigned_to": t.assigned_to,
                    "review_note": t.review_note,
                    "is_completed": t.is_completed
                }
                for t in review_tasks
            ],
            "can_rollback": len(histories) > 1,
            "note": "所有改动可追溯，原始行号和历史快照均已保存"
        }

    def manual_edit_record(
        self,
        record_id: int,
        updates: Dict[str, Any],
        operator: str,
        reason: str
    ) -> Dict[str, Any]:
        """
        运营规划阿岚手动修改记录（如只改一条备注）。
        历史记录里能看出改前改后的差别。
        """
        record = self.db.get_rating_record(record_id)
        if not record:
            return {"error": f"记录不存在: {record_id}"}

        updated_record = self.boundary_engine.correct_boundary_issue(
            record_id, updates, operator, reason
        )

        version_diffs = self.importer.get_version_diff(record_id)

        return {
            "record_id": record_id,
            "updated_fields": list(updates.keys()),
            "updates": updates,
            "operator": operator,
            "reason": reason,
            "new_status": updated_record.status.value,
            "new_boundary_type": updated_record.boundary_type.value,
            "version_diffs": version_diffs[-1] if version_diffs else [],
            "evidence_saved": True,
            "note": "改动已留痕，可查看历史版本对比"
        }
