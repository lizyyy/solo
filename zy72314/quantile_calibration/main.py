"""分位数薪酬校准系统 - 主入口

提供简洁的 API 接口，封装三步核心流程：
1. 评分权重表第一次导入
2. 运营规划阿岚补看旧公式截图
3. 边界样本报告更新

关键特性：
- 保留原始行号、人工改动、处理状态
- 重复导入不去重，不翻倍数量
- 历史版本对比，改前改后可查
- 负数被旧表当成缺失时不急着归正常，留给学生助教复核
- 边界规则写在代码里，不靠口头约定
"""

import os
from typing import Dict, Any, Optional

from .database import Database
from .boundary_engine import BoundaryRuleEngine
from .importer import RatingWeightImporter
from .workflow import WorkflowManager
from .models import BoundaryType, ProcessingStatus


class QuantileCalibrationSystem:
    """分位数薪酬校准系统主类"""

    def __init__(self, db_path: str = "data/quantile_calibration.db"):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.db = Database(db_path)
        self.boundary_engine = BoundaryRuleEngine(self.db)
        self.importer = RatingWeightImporter(self.db, self.boundary_engine)
        self.workflow = WorkflowManager(self.db, self.boundary_engine, self.importer)

    def run_complete_workflow(
        self,
        file_path: str,
        import_operator: str = "alan_ops",
        formula_reviewer: str = "alan_ops",
        formula_review_note: str = "已对照旧公式截图，确认边界样本判定规则",
        screenshot_reference: str = "",
        ta_assignee: str = "ta_student_01"
    ) -> Dict[str, Any]:
        """
        完整执行三步核心流程。

        碰到负数样本被旧表当成缺失时，不急着归正常，留给学生助教复核。
        """
        return self.workflow.run_full_workflow(
            file_path=file_path,
            import_operator=import_operator,
            formula_reviewer=formula_reviewer,
            review_note=formula_review_note,
            screenshot_reference=screenshot_reference,
            ta_assignee=ta_assignee
        )

    def step1_import(self, file_path: str, operator: str = "alan_ops") -> Dict[str, Any]:
        """Step 1: 第一次导入评分权重表"""
        return self.workflow.step1_import_rating_table(file_path, operator)

    def step2_review_formula(
        self,
        batch_id: int,
        reviewed_by: str = "alan_ops",
        review_note: str = "",
        screenshot_reference: str = ""
    ) -> Dict[str, Any]:
        """Step 2: 运营规划阿岚补看旧公式截图"""
        return self.workflow.step2_review_old_formula_screenshot(
            batch_id, reviewed_by, review_note, screenshot_reference
        )

    def step3_boundary_report(
        self,
        batch_id: int,
        operator: str = "alan_ops",
        ta_assignee: str = "ta_student_01"
    ) -> Dict[str, Any]:
        """Step 3: 边界样本报告更新"""
        return self.workflow.step3_update_boundary_report(batch_id, operator, ta_assignee)

    def ta_review_record(
        self,
        task_id: int,
        record_id: int,
        review_result: str,
        correction_decision: str,
        corrected_values: Optional[Dict[str, Any]] = None,
        ta_name: str = "ta_student"
    ) -> Dict[str, Any]:
        """学生助教复核边界样本"""
        return self.workflow.ta_review_negative_as_missing(
            task_id, record_id, review_result, correction_decision, corrected_values, ta_name
        )

    def get_evidence(self, record_id: int) -> Dict[str, Any]:
        """学生助教追问时，能回到证据"""
        return self.workflow.get_evidence_for_ta_query(record_id)

    def get_workflow_status(self, batch_id: int) -> Dict[str, Any]:
        """获取工作流当前状态"""
        return self.workflow.get_workflow_status(batch_id)

    def get_version_diff(self, record_id: int) -> Dict[str, Any]:
        """获取记录的版本对比，改前改后一目了然"""
        return {
            "record_id": record_id,
            "version_diffs": self.importer.get_version_diff(record_id)
        }

    def manual_edit(
        self,
        record_id: int,
        updates: Dict[str, Any],
        operator: str = "alan_ops",
        reason: str = ""
    ) -> Dict[str, Any]:
        """手动修改记录，历史留痕"""
        return self.workflow.manual_edit_record(record_id, updates, operator, reason)

    def rollback_to_history(
        self,
        record_id: int,
        history_id: int,
        operator: str = "alan_ops"
    ) -> Dict[str, Any]:
        """回滚到指定历史版本"""
        record = self.boundary_engine.rollback_to_history(record_id, history_id, operator)
        return {
            "record_id": record_id,
            "rolled_back_to_history": history_id,
            "current_status": record.status.value,
            "current_boundary_type": record.boundary_type.value,
            "note": "回滚操作已留痕，可在历史记录中查询"
        }

    def get_pending_review_tasks(self, ta_name: Optional[str] = None) -> Dict[str, Any]:
        """获取待复核任务列表"""
        tasks = self.db.get_pending_review_tasks(ta_name)
        return {
            "pending_count": len(tasks),
            "assigned_to": ta_name,
            "tasks": [
                {
                    "task_id": t.id,
                    "record_id": t.record_id,
                    "boundary_type": t.boundary_type.value,
                    "assigned_to": t.assigned_to,
                    "review_note": t.review_note,
                    "created_at": t.created_at.isoformat()
                }
                for t in tasks
            ]
        }

    def get_records_by_boundary_type(self, boundary_type: str) -> Dict[str, Any]:
        """按边界类型查询记录"""
        bt = BoundaryType(boundary_type)
        records = self.db.get_records_by_boundary(bt)
        return {
            "boundary_type": boundary_type,
            "count": len(records),
            "records": [
                {
                    "record_id": r.id,
                    "original_row_number": r.original_row_number,
                    "position": r.position,
                    "status": r.status.value,
                    "sample_count": r.sample_count,
                    "remark": r.remark
                }
                for r in records
            ]
        }


__all__ = [
    "QuantileCalibrationSystem",
    "BoundaryType",
    "ProcessingStatus",
    "Database",
    "BoundaryRuleEngine",
    "RatingWeightImporter",
    "WorkflowManager"
]
