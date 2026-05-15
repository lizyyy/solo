import uuid
from typing import List
from sqlalchemy.orm import Session
from app.models import TaskBatch, TaskResult, RollbackCandidate, RiskType
from datetime import datetime


class RollbackService:
    def __init__(self, db: Session):
        self.db = db

    def generate_rollback_candidates(self, batch_id: str, created_by: str) -> List[RollbackCandidate]:
        batch = self.db.query(TaskBatch).filter(TaskBatch.batch_id == batch_id).first()
        if not batch:
            return []

        failed_tasks = self.db.query(TaskResult).filter(
            TaskResult.batch_id == batch_id,
            TaskResult.status != "success"
        ).all()

        candidates = []

        security_failed = [t for t in failed_tasks if t.error_message and ("认证" in t.error_message or "auth" in t.error_message.lower())]
        if security_failed:
            candidate = RollbackCandidate(
                candidate_id=f"RC_SEC_{uuid.uuid4().hex[:8]}",
                batch_id=batch_id,
                task_ids=",".join(t.task_id for t in security_failed),
                reason="安全类失败任务回滚建议：存在认证相关错误",
                risk_level="high",
                created_by=created_by
            )
            self.db.add(candidate)
            candidates.append(candidate)

        network_failed = [t for t in failed_tasks if t.error_message and (
            "网络" in t.error_message or "连接" in t.error_message or "network" in t.error_message.lower())]
        if network_failed:
            candidate = RollbackCandidate(
                candidate_id=f"RC_NET_{uuid.uuid4().hex[:8]}",
                batch_id=batch_id,
                task_ids=",".join(t.task_id for t in network_failed),
                reason="网络类失败任务回滚建议：连接或超时问题",
                risk_level="medium",
                created_by=created_by
            )
            self.db.add(candidate)
            candidates.append(candidate)

        early_terminated = [t for t in failed_tasks if t.is_early_terminated]
        if early_terminated:
            candidate = RollbackCandidate(
                candidate_id=f"RC_ET_{uuid.uuid4().hex[:8]}",
                batch_id=batch_id,
                task_ids=",".join(t.task_id for t in early_terminated),
                reason="提前终止任务回滚建议：任务被异常终止",
                risk_level="high",
                created_by=created_by
            )
            self.db.add(candidate)
            candidates.append(candidate)

        if failed_tasks and not candidates:
            candidate = RollbackCandidate(
                candidate_id=f"RC_ALL_{uuid.uuid4().hex[:8]}",
                batch_id=batch_id,
                task_ids=",".join(t.task_id for t in failed_tasks),
                reason="全部失败任务回滚建议",
                risk_level="medium",
                created_by=created_by
            )
            self.db.add(candidate)
            candidates.append(candidate)

        self.db.commit()
        return candidates

    def get_candidate_details(self, candidate_id: str) -> dict:
        candidate = self.db.query(RollbackCandidate).filter(
            RollbackCandidate.candidate_id == candidate_id
        ).first()

        if not candidate:
            return {"error": "Candidate not found"}

        task_ids = candidate.task_ids.split(",")

        return {
            "candidate_id": candidate.candidate_id,
            "batch_id": candidate.batch_id,
            "task_count": len(task_ids),
            "task_ids": task_ids,
            "reason": candidate.reason,
            "risk_level": candidate.risk_level,
            "is_approved": candidate.is_approved,
            "approved_by": candidate.approved_by,
            "approved_at": candidate.approved_at.isoformat() if candidate.approved_at else None,
            "created_by": candidate.created_by,
            "created_at": candidate.created_at.isoformat() if candidate.created_at else None
        }

    def approve_candidate(self, candidate_id: str, approved_by: str) -> bool:
        candidate = self.db.query(RollbackCandidate).filter(
            RollbackCandidate.candidate_id == candidate_id
        ).first()

        if not candidate:
            return False

        candidate.is_approved = True
        candidate.approved_by = approved_by
        candidate.approved_at = datetime.now()
        self.db.commit()
        return True

    def get_batch_candidates(self, batch_id: str) -> List[dict]:
        candidates = self.db.query(RollbackCandidate).filter(
            RollbackCandidate.batch_id == batch_id
        ).all()

        result = []
        for c in candidates:
            task_ids = c.task_ids.split(",")
            result.append({
                "candidate_id": c.candidate_id,
                "batch_id": c.batch_id,
                "task_count": len(task_ids),
                "task_ids": task_ids,
                "reason": c.reason,
                "risk_level": c.risk_level,
                "created_by": c.created_by,
                "created_at": c.created_at
            })

        return result
