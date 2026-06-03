from typing import Dict, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from src.models.database import (
    SampleList, TeacherComment, AdmissionRecord, BorderlineCase,
    WorkflowStep, ImportBatch, get_db
)
from src.utils.border_rules import resolve_negative_score


class ThreeStepWorkflow:
    """
    三步工作流管理器
    
    步骤1: 老师批注第一次导入
    步骤2: 运营规划阿岚补看抽样名单
    步骤3: 边界样本报告更新
    """
    
    def __init__(self, db: Session, batch_id: str):
        self.db = db
        self.batch_id = batch_id
        self.steps = [
            {"order": 1, "name": "teacher_import", "label": "老师批注导入"},
            {"order": 2, "name": "operation_review", "label": "运营补看抽样名单"},
            {"order": 3, "name": "borderline_update", "label": "边界样本报告更新"}
        ]

    def start_step(self, step_order: int, operator: str, note: str = "") -> bool:
        """
        开始一个工作流步骤
        """
        step_info = next((s for s in self.steps if s["order"] == step_order), None)
        if not step_info:
            return False
        
        step = WorkflowStep(
            step_name=step_info["name"],
            step_order=step_order,
            status="in_progress",
            batch_id=self.batch_id,
            started_at=datetime.utcnow(),
            operator=operator,
            note=note
        )
        self.db.add(step)
        self.db.commit()
        return True

    def complete_step(self, step_order: int, operator: str, note: str = "") -> Dict:
        """
        完成一个工作流步骤
        """
        step = self.db.query(WorkflowStep).filter(
            WorkflowStep.batch_id == self.batch_id,
            WorkflowStep.step_order == step_order
        ).order_by(WorkflowStep.created_at.desc()).first()
        
        if step:
            step.status = "completed"
            step.completed_at = datetime.utcnow()
            if note:
                step.note = (step.note or "") + "\n" + note
            self.db.commit()
        
        return self.get_workflow_status()

    def get_workflow_status(self) -> Dict:
        """
        获取当前工作流状态
        """
        steps = self.db.query(WorkflowStep).filter(
            WorkflowStep.batch_id == self.batch_id
        ).order_by(WorkflowStep.step_order).all()
        
        return {
            "batch_id": self.batch_id,
            "steps": [{
                "order": s.step_order,
                "name": s.step_name,
                "status": s.status,
                "operator": s.operator,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None
            } for s in steps],
            "current_step": self._get_current_step(steps)
        }

    def _get_current_step(self, steps) -> int:
        completed = [s.step_order for s in steps if s.status == "completed"]
        return max(completed) + 1 if completed else 1


class BorderlineReviewManager:
    """
    边界样本复核管理器
    
    处理:
    - 负数样本被旧表当成缺失的情况
    - 分配给学生助教复核
    - 支持回滚操作
    """
    
    def __init__(self, db: Session):
        self.db = db

    def get_pending_cases(self, assignee: str = None) -> List[Dict]:
        """
        获取待复核的边界案例
        """
        query = self.db.query(BorderlineCase).filter(
            BorderlineCase.status == "pending"
        )
        
        if assignee:
            query = query.filter(BorderlineCase.assigned_to == assignee)
        
        cases = query.all()
        
        result = []
        for case in cases:
            sample = case.sample
            if not sample:
                continue
            result.append({
                "case_id": case.id,
                "student_id": sample.student_id,
                "student_name": sample.student_name,
                "case_type": case.case_type,
                "original_value": case.original_value,
                "description": case.description,
                "assigned_to": case.assigned_to,
                "created_at": case.created_at.isoformat(),
                "raw_score": sample.raw_score,
                "remark": sample.remark,
                "teacher_comments": [{
                    "teacher": c.teacher_name,
                    "comment": c.comment
                } for c in sample.comments]
            })
        
        return result

    def resolve_case(self, case_id: int, resolution: str, 
                    resolved_by: str, custom_value: str = None) -> Dict:
        """
        处理边界案例
        
        Args:
            case_id: 案例ID
            resolution: 处理方式
                - keep_negative: 保留负数
                - convert_positive: 转为正数
                - mark_missing: 标记为缺失
                - custom_value: 使用自定义值
            resolved_by: 处理人
            custom_value: 自定义值（当resolution为custom_value时）
        """
        case = self.db.query(BorderlineCase).filter(
            BorderlineCase.id == case_id
        ).first()
        
        if not case:
            return {"success": False, "error": "案例不存在"}
        
        sample = case.sample
        
        result = resolve_negative_score(
            case.original_value, resolution, resolved_by
        )
        
        if resolution == "custom_value" and custom_value:
            try:
                result["score_value"] = float(custom_value)
            except ValueError:
                result["score_value"] = None
        
        case.status = "resolved"
        case.resolution = f"{result['action']}: {result['description']}"
        case.resolved_at = datetime.utcnow()
        case.resolved_by = resolved_by
        
        sample.score = result["score_value"]
        sample.is_negative = (resolution == "keep_negative")
        sample.is_missing = (resolution == "mark_missing" and result["score_value"] is None)
        sample.needs_review = False
        sample.review_status = "resolved"
        sample.reviewer = resolved_by
        sample.review_time = datetime.utcnow()
        
        self.db.commit()
        
        return {
            "success": True,
            "case_id": case_id,
            "action_taken": result["action"],
            "final_score": result["score_value"],
            "resolved_by": resolved_by
        }

    def rollback_case(self, case_id: int, rolled_by: str) -> Dict:
        """
        回滚已处理的边界案例
        """
        case = self.db.query(BorderlineCase).filter(
            BorderlineCase.id == case_id
        ).first()
        
        if not case or case.status != "resolved":
            return {"success": False, "error": "案例不可回滚"}
        
        sample = case.sample
        
        case.status = "pending"
        case.resolution = None
        case.resolved_at = None
        case.resolved_by = None
        
        sample.score = None
        sample.is_negative = True
        sample.needs_review = True
        sample.review_status = "pending"
        
        self.db.commit()
        
        return {
            "success": True,
            "case_id": case_id,
            "rolled_by": rolled_by,
            "message": "案例已回滚到待复核状态"
        }

    def get_case_history(self, case_id: int) -> Dict:
        """
        获取案例的完整历史（改前改后）
        """
        case = self.db.query(BorderlineCase).filter(
            BorderlineCase.id == case_id
        ).first()
        
        if not case:
            return {}
        
        sample = case.sample
        
        return {
            "case_info": {
                "id": case.id,
                "type": case.case_type,
                "original_value": case.original_value,
                "status": case.status,
                "assigned_to": case.assigned_to
            },
            "resolution": {
                "resolution": case.resolution,
                "resolved_by": case.resolved_by,
                "resolved_at": case.resolved_at.isoformat() if case.resolved_at else None
            },
            "before": {
                "score": None,
                "is_negative": True,
                "needs_review": True
            },
            "after": {
                "score": sample.score,
                "is_negative": sample.is_negative,
                "needs_review": sample.needs_review
            } if case.status == "resolved" else None,
            "teacher_comments": [{
                "version": c.version,
                "is_latest": c.is_latest,
                "teacher": c.teacher_name,
                "comment": c.comment,
                "created_at": c.created_at.isoformat()
            } for c in sample.comments]
        }
