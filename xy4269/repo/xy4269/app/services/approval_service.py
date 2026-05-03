from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models import (
    ConstructionPlan, ApprovalRecord, ConflictCheck,
    ApprovalStatus, AuditLog
)
from app.services.conflict_checker import ConflictCheckService
from app.services.import_service import log_audit


class ApprovalService:
    """审签服务"""
    
    @staticmethod
    def submit_for_approval(
        db: Session,
        plan_id: int,
        submitter: str,
        comments: str = None
    ) -> Dict[str, Any]:
        """提交计划到待审核状态
        
        提交前会执行冲突检查，如存在严重或高风险冲突则禁止提交
        """
        plan = db.query(ConstructionPlan).filter(
            ConstructionPlan.id == plan_id
        ).first()
        
        if not plan:
            raise ValueError(f"施工计划不存在: {plan_id}")
        
        if plan.status not in [ApprovalStatus.DRAFT, ApprovalStatus.REJECTED]:
            raise ValueError(
                f"计划状态 [{plan.status.value}] 不允许提交审核，"
                f"仅草稿或已驳回状态可提交"
            )
        
        check_result = ConflictCheckService.run_full_check(
            db, plan, submitter, auto_save=True
        )
        
        if not check_result["can_approve"]:
            raise ValueError(
                f"计划存在未解决的高风险冲突，无法提交审核。\n"
                f"风险汇总: {check_result['risk_summary']}\n"
                f"请先解决冲突后再提交。"
            )
        
        previous_status = plan.status
        plan.status = ApprovalStatus.PENDING
        plan.current_approver = None
        
        approval_record = ApprovalRecord(
            plan_id=plan.id,
            approval_order=1,
            approver=submitter,
            action="提交审核",
            comments=comments or "提交到待审核状态",
            previous_status=previous_status,
            new_status=ApprovalStatus.PENDING
        )
        
        db.add(approval_record)
        db.commit()
        db.refresh(plan)
        db.refresh(approval_record)
        
        log_audit(
            db, "提交审核", submitter, "plan", plan.id,
            {
                "plan_no": plan.plan_no,
                "plan_name": plan.plan_name,
                "previous_status": previous_status.value,
                "new_status": ApprovalStatus.PENDING.value,
                "comments": comments
            }
        )
        
        return {
            "plan_id": plan.id,
            "plan_no": plan.plan_no,
            "status": plan.status.value,
            "approval_record_id": approval_record.id,
            "message": "已成功提交到待审核状态"
        }
    
    @staticmethod
    def approve(
        db: Session,
        plan_id: int,
        approver: str,
        comments: str = None,
        force_approve: bool = False
    ) -> Dict[str, Any]:
        """审签通过
        
        Args:
            db: 数据库会话
            plan_id: 计划 ID
            approver: 审批人
            comments: 审批意见
            force_approve: 是否强制审签（跳过冲突检查）
        """
        plan = db.query(ConstructionPlan).filter(
            ConstructionPlan.id == plan_id
        ).first()
        
        if not plan:
            raise ValueError(f"施工计划不存在: {plan_id}")
        
        if plan.status != ApprovalStatus.PENDING:
            raise ValueError(
                f"计划状态 [{plan.status.value}] 不是待审核状态，无法审签"
            )
        
        if not force_approve:
            check_result = ConflictCheckService.run_full_check(
                db, plan, approver, auto_save=True
            )
            
            if not check_result["can_approve"]:
                raise ValueError(
                    f"计划存在未解决的高风险冲突，无法审签。\n"
                    f"风险汇总: {check_result['risk_summary']}\n"
                    f"如需强制审签，请设置 force_approve=true"
                )
        
        previous_status = plan.status
        plan.status = ApprovalStatus.APPROVED
        plan.current_approver = approver
        
        approval_order = db.query(ApprovalRecord).filter(
            ApprovalRecord.plan_id == plan.id
        ).count() + 1
        
        approval_record = ApprovalRecord(
            plan_id=plan.id,
            approval_order=approval_order,
            approver=approver,
            action="审签通过",
            comments=comments or "审签通过",
            previous_status=previous_status,
            new_status=ApprovalStatus.APPROVED
        )
        
        db.add(approval_record)
        db.commit()
        db.refresh(plan)
        db.refresh(approval_record)
        
        log_audit(
            db, "审签通过", approver, "plan", plan.id,
            {
                "plan_no": plan.plan_no,
                "plan_name": plan.plan_name,
                "previous_status": previous_status.value,
                "new_status": ApprovalStatus.APPROVED.value,
                "comments": comments,
                "force_approve": force_approve
            }
        )
        
        return {
            "plan_id": plan.id,
            "plan_no": plan.plan_no,
            "status": plan.status.value,
            "approval_record_id": approval_record.id,
            "message": "审签通过成功"
        }
    
    @staticmethod
    def reject(
        db: Session,
        plan_id: int,
        approver: str,
        comments: str
    ) -> Dict[str, Any]:
        """驳回计划"""
        plan = db.query(ConstructionPlan).filter(
            ConstructionPlan.id == plan_id
        ).first()
        
        if not plan:
            raise ValueError(f"施工计划不存在: {plan_id}")
        
        if plan.status != ApprovalStatus.PENDING:
            raise ValueError(
                f"计划状态 [{plan.status.value}] 不是待审核状态，无法驳回"
            )
        
        if not comments or not comments.strip():
            raise ValueError("驳回必须提供原因说明")
        
        previous_status = plan.status
        plan.status = ApprovalStatus.REJECTED
        plan.current_approver = approver
        
        approval_order = db.query(ApprovalRecord).filter(
            ApprovalRecord.plan_id == plan.id
        ).count() + 1
        
        approval_record = ApprovalRecord(
            plan_id=plan.id,
            approval_order=approval_order,
            approver=approver,
            action="驳回",
            comments=comments,
            previous_status=previous_status,
            new_status=ApprovalStatus.REJECTED
        )
        
        db.add(approval_record)
        db.commit()
        db.refresh(plan)
        db.refresh(approval_record)
        
        log_audit(
            db, "驳回", approver, "plan", plan.id,
            {
                "plan_no": plan.plan_no,
                "plan_name": plan.plan_name,
                "previous_status": previous_status.value,
                "new_status": ApprovalStatus.REJECTED.value,
                "comments": comments
            }
        )
        
        return {
            "plan_id": plan.id,
            "plan_no": plan.plan_no,
            "status": plan.status.value,
            "approval_record_id": approval_record.id,
            "message": "计划已驳回"
        }
    
    @staticmethod
    def cancel(
        db: Session,
        plan_id: int,
        operator: str,
        reason: str
    ) -> Dict[str, Any]:
        """撤销已审签的计划"""
        plan = db.query(ConstructionPlan).filter(
            ConstructionPlan.id == plan_id
        ).first()
        
        if not plan:
            raise ValueError(f"施工计划不存在: {plan_id}")
        
        if plan.status == ApprovalStatus.CANCELLED:
            raise ValueError("计划已处于撤销状态")
        
        if not reason or not reason.strip():
            raise ValueError("撤销必须提供原因说明")
        
        previous_status = plan.status
        plan.status = ApprovalStatus.CANCELLED
        plan.current_approver = operator
        
        approval_order = db.query(ApprovalRecord).filter(
            ApprovalRecord.plan_id == plan.id
        ).count() + 1
        
        approval_record = ApprovalRecord(
            plan_id=plan.id,
            approval_order=approval_order,
            approver=operator,
            action="撤销",
            comments=reason,
            previous_status=previous_status,
            new_status=ApprovalStatus.CANCELLED
        )
        
        db.add(approval_record)
        db.commit()
        db.refresh(plan)
        db.refresh(approval_record)
        
        log_audit(
            db, "撤销", operator, "plan", plan.id,
            {
                "plan_no": plan.plan_no,
                "plan_name": plan.plan_name,
                "previous_status": previous_status.value,
                "new_status": ApprovalStatus.CANCELLED.value,
                "reason": reason
            }
        )
        
        return {
            "plan_id": plan.id,
            "plan_no": plan.plan_no,
            "status": plan.status.value,
            "approval_record_id": approval_record.id,
            "previous_status": previous_status.value,
            "message": "计划已撤销"
        }
    
    @staticmethod
    def get_approval_history(
        db: Session,
        plan_id: int
    ) -> List[Dict[str, Any]]:
        """获取计划的审签历史"""
        records = db.query(ApprovalRecord).filter(
            ApprovalRecord.plan_id == plan_id
        ).order_by(
            ApprovalRecord.approval_order.asc()
        ).all()
        
        return [
            {
                "id": r.id,
                "approval_order": r.approval_order,
                "approver": r.approver,
                "action": r.action,
                "comments": r.comments,
                "previous_status": r.previous_status.value if r.previous_status else None,
                "new_status": r.new_status.value if r.new_status else None,
                "approval_time": r.approval_time.isoformat() if r.approval_time else None
            }
            for r in records
        ]
    
    @staticmethod
    def get_plans_by_status(
        db: Session,
        status: str = None,
        line: str = None,
        start_date: datetime = None,
        end_date: datetime = None,
        offset: int = 0,
        limit: int = 100
    ) -> Dict[str, Any]:
        """按状态查询计划列表"""
        query = db.query(ConstructionPlan)
        
        if status:
            try:
                status_enum = ApprovalStatus(status)
                query = query.filter(ConstructionPlan.status == status_enum)
            except ValueError:
                valid_statuses = [s.value for s in ApprovalStatus]
                raise ValueError(f"无效的状态: {status}，有效状态: {valid_statuses}")
        
        if line:
            query = query.filter(ConstructionPlan.line == line)
        
        if start_date:
            query = query.filter(ConstructionPlan.start_time >= start_date)
        
        if end_date:
            query = query.filter(ConstructionPlan.start_time <= end_date)
        
        total = query.count()
        
        plans = query.order_by(
            ConstructionPlan.start_time.asc()
        ).offset(offset).limit(limit).all()
        
        return {
            "total": total,
            "offset": offset,
            "limit": limit,
            "plans": [
                {
                    "id": p.id,
                    "plan_no": p.plan_no,
                    "plan_name": p.plan_name,
                    "line": p.line,
                    "track_section": p.track_section,
                    "start_time": p.start_time.isoformat() if p.start_time else None,
                    "end_time": p.end_time.isoformat() if p.end_time else None,
                    "status": p.status.value,
                    "work_train_required": p.work_train_required,
                    "power_requirement": p.power_requirement
                }
                for p in plans
            ]
        }
    
    @staticmethod
    def get_plan_detail(
        db: Session,
        plan_id: int,
        include_conflicts: bool = True,
        include_approval_history: bool = True
    ) -> Dict[str, Any]:
        """获取计划详情"""
        plan = db.query(ConstructionPlan).filter(
            ConstructionPlan.id == plan_id
        ).first()
        
        if not plan:
            raise ValueError(f"施工计划不存在: {plan_id}")
        
        result = {
            "id": plan.id,
            "plan_no": plan.plan_no,
            "plan_name": plan.plan_name,
            "line": plan.line,
            "track_section": plan.track_section,
            "start_time": plan.start_time.isoformat() if plan.start_time else None,
            "end_time": plan.end_time.isoformat() if plan.end_time else None,
            "work_type": plan.work_type,
            "work_content": plan.work_content,
            "construction_unit": plan.construction_unit,
            "responsible_person": plan.responsible_person,
            "contact_phone": plan.contact_phone,
            "power_requirement": plan.power_requirement,
            "work_train_required": plan.work_train_required,
            "status": plan.status.value,
            "current_approver": plan.current_approver,
            "created_at": plan.created_at.isoformat() if plan.created_at else None,
            "updated_at": plan.updated_at.isoformat() if plan.updated_at else None
        }
        
        if include_conflicts:
            conflicts = ConflictCheckService.get_conflicts_by_plan(db, plan_id)
            result["conflicts"] = [
                {
                    "id": c.id,
                    "conflict_type": c.conflict_type.value,
                    "description": c.description,
                    "risk_level": c.risk_level,
                    "is_resolved": c.is_resolved,
                    "check_time": c.check_time.isoformat() if c.check_time else None
                }
                for c in conflicts
            ]
            result["conflict_count"] = len(conflicts)
        
        if include_approval_history:
            result["approval_history"] = ApprovalService.get_approval_history(db, plan_id)
        
        return result
