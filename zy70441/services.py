from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid
import json

from models import (
    WorkOrder, RuleVersion, OperationLog, CleanCandidate,
    RiskType, OperationType, SourceSystem
)
from schemas import WorkOrderCreate, WorkOrderJudge, CleanCandidateCreate
import pytz


class RuleService:
    @staticmethod
    def get_active_rule(db: Session, at_time: datetime = None) -> Optional[RuleVersion]:
        if at_time is None:
            at_time = datetime.now()
        return db.query(RuleVersion).filter(
            and_(
                RuleVersion.is_active == True,
                RuleVersion.effective_time <= at_time,
                or_(RuleVersion.expire_time == None, RuleVersion.expire_time > at_time)
            )
        ).order_by(RuleVersion.effective_time.desc()).first()

    @staticmethod
    def create_rule(db: Session, rule_data: Dict[str, Any]) -> RuleVersion:
        rule = RuleVersion(**rule_data)
        db.add(rule)
        db.commit()
        db.refresh(rule)
        return rule


class TimezoneService:
    @staticmethod
    def is_timezone_abnormal(offset_minutes: int, rule: Dict[str, Any]) -> bool:
        normal_range = rule.get("timezone_normal_range", [-480, 480])
        return not (normal_range[0] <= offset_minutes <= normal_range[1])


class JudgmentService:
    @staticmethod
    def judge_work_order(db: Session, work_order: WorkOrder, rule: RuleVersion = None):
        if rule is None:
            rule = RuleService.get_active_rule(db, at_time=work_order.created_at)
        
        if rule:
            work_order.rule_version_id = rule.id
            work_order.rule_snapshot = rule.rule_content
        
        original_input = work_order.original_input
        
        risk_score = 0.0
        is_abnormal = False
        risk_type = RiskType.NORMAL
        timezone_abnormal = False
        timezone_offset = None
        
        if "timezone_offset" in original_input:
            try:
                timezone_offset = int(original_input["timezone_offset"])
                rule_content = rule.rule_content if rule else {}
                timezone_abnormal = TimezoneService.is_timezone_abnormal(timezone_offset, rule_content)
                
                if timezone_abnormal:
                    risk_score += 50
                    is_abnormal = True
                    risk_type = RiskType.TIMEZONE_OFFSET
            except (ValueError, TypeError):
                pass
        
        if risk_score >= 80:
            risk_type = RiskType.HIGH_RISK
        elif risk_score >= 30 and not timezone_abnormal:
            risk_type = RiskType.SUSPICIOUS
        
        work_order.risk_type = risk_type
        work_order.risk_score = risk_score
        work_order.is_abnormal = is_abnormal
        work_order.timezone_offset = timezone_offset
        work_order.timezone_abnormal = timezone_abnormal
        
        if timezone_abnormal:
            work_order.system_judgment = f"时区偏移异常: {timezone_offset}分钟"
        elif is_abnormal:
            work_order.system_judgment = "存在其他风险因素"
        else:
            work_order.system_judgment = "正常工单"
        
        work_order.final_judgment = work_order.system_judgment
        work_order.status = "judged"
        
        db.commit()
        return work_order


class WorkOrderService:
    @staticmethod
    def create_work_order(db: Session, order_data: WorkOrderCreate) -> WorkOrder:
        work_order = WorkOrder(**order_data.model_dump())
        db.add(work_order)
        db.commit()
        db.refresh(work_order)
        
        JudgmentService.judge_work_order(db, work_order)
        
        OperationLogService.create_log(
            db,
            work_order_id=work_order.id,
            batch_no=work_order.batch_no,
            operation_type=OperationType.CREATE,
            operator=order_data.created_by or "system",
            operation_remark="创建工单",
            after_data={"order_no": work_order.order_no, "status": work_order.status},
            source_system=work_order.source_system
        )
        
        return work_order

    @staticmethod
    def manual_correct(db: Session, order_id: int, judge_data: WorkOrderJudge) -> WorkOrder:
        work_order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
        if not work_order:
            raise ValueError("工单不存在")
        
        before_data = {
            "manual_judgment": work_order.manual_judgment,
            "final_judgment": work_order.final_judgment,
            "judgment_remark": work_order.judgment_remark,
            "judged_by": work_order.judged_by
        }
        
        work_order.manual_judgment = judge_data.manual_judgment
        work_order.judgment_remark = judge_data.judgment_remark
        work_order.final_judgment = judge_data.manual_judgment
        work_order.judged_by = judge_data.judged_by
        work_order.judged_at = datetime.now()
        work_order.status = "manual_corrected"
        
        db.commit()
        db.refresh(work_order)
        
        OperationLogService.create_log(
            db,
            work_order_id=work_order.id,
            batch_no=work_order.batch_no,
            operation_type=OperationType.MANUAL_CORRECT,
            operator=judge_data.judged_by,
            operation_remark="人工修正判断",
            before_data=before_data,
            after_data={
                "manual_judgment": work_order.manual_judgment,
                "final_judgment": work_order.final_judgment
            },
            source_system=SourceSystem.ADMIN_PORTAL
        )
        
        return work_order

    @staticmethod
    def query_work_orders(db: Session, query_params: Dict[str, Any]):
        query = db.query(WorkOrder)
        
        if query_params.get("batch_no"):
            query = query.filter(WorkOrder.batch_no == query_params["batch_no"])
        if query_params.get("risk_type"):
            query = query.filter(WorkOrder.risk_type == query_params["risk_type"])
        if query_params.get("source_system"):
            query = query.filter(WorkOrder.source_system == query_params["source_system"])
        if query_params.get("status"):
            query = query.filter(WorkOrder.status == query_params["status"])
        if query_params.get("is_abnormal") is not None:
            query = query.filter(WorkOrder.is_abnormal == query_params["is_abnormal"])
        if query_params.get("start_time"):
            query = query.filter(WorkOrder.created_at >= query_params["start_time"])
        if query_params.get("end_time"):
            query = query.filter(WorkOrder.created_at <= query_params["end_time"])
        
        if query_params.get("operator"):
            log_subquery = db.query(OperationLog.work_order_id).filter(
                OperationLog.operator == query_params["operator"]
            ).distinct()
            query = query.filter(WorkOrder.id.in_(log_subquery))
        
        total = query.count()
        
        page = query_params.get("page", 1)
        page_size = query_params.get("page_size", 20)
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": query.all()
        }

    @staticmethod
    def get_by_id(db: Session, order_id: int) -> Optional[WorkOrder]:
        return db.query(WorkOrder).filter(WorkOrder.id == order_id).first()


class OperationLogService:
    @staticmethod
    def create_log(db: Session, **kwargs) -> OperationLog:
        log = OperationLog(**kwargs)
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def query_logs(db: Session, work_order_id: int = None, batch_no: str = None,
                   operator: str = None, source_system: str = None,
                   page: int = 1, page_size: int = 20):
        query = db.query(OperationLog)
        
        if work_order_id:
            query = query.filter(OperationLog.work_order_id == work_order_id)
        if batch_no:
            query = query.filter(OperationLog.batch_no == batch_no)
        if operator:
            query = query.filter(OperationLog.operator == operator)
        if source_system:
            query = query.filter(OperationLog.source_system == source_system)
        
        total = query.count()
        query = query.order_by(OperationLog.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": query.all()
        }


class CleanService:
    @staticmethod
    def generate_candidates(db: Session, filters: Dict[str, Any], generated_by: str) -> CleanCandidate:
        query = db.query(WorkOrder.id)
        
        if filters.get("batch_no"):
            query = query.filter(WorkOrder.batch_no == filters["batch_no"])
        if filters.get("risk_type"):
            query = query.filter(WorkOrder.risk_type == filters["risk_type"])
        if filters.get("is_abnormal") is not None:
            query = query.filter(WorkOrder.is_abnormal == filters["is_abnormal"])
        if filters.get("days_old"):
            cutoff = datetime.now() - timedelta(days=filters["days_old"])
            query = query.filter(WorkOrder.created_at < cutoff)
        
        candidate_ids = [id for (id,) in query.all()]
        
        batch_no = f"CLEAN-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"
        
        candidate = CleanCandidate(
            batch_no=batch_no,
            candidate_ids=candidate_ids,
            filters=filters,
            total_count=len(candidate_ids),
            generated_by=generated_by
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        
        return candidate

    @staticmethod
    def execute_clean(db: Session, candidate_id: int, operator: str) -> Dict[str, Any]:
        candidate = db.query(CleanCandidate).filter(CleanCandidate.id == candidate_id).first()
        if not candidate:
            raise ValueError("候选清单不存在")
        if candidate.is_executed:
            raise ValueError("该候选清单已执行")
        
        work_orders = db.query(WorkOrder).filter(WorkOrder.id.in_(candidate.candidate_ids)).all()
        
        for wo in work_orders:
            wo.status = "deleted"
        
        candidate.is_executed = True
        candidate.executed_at = datetime.now()
        
        OperationLogService.create_log(
            db,
            batch_no=candidate.batch_no,
            operation_type=OperationType.BATCH_CLEAN,
            operator=operator,
            operation_remark=f"批量清理工单 {len(work_orders)} 条",
            after_data={"cleaned_count": len(work_orders)},
            source_system=SourceSystem.ADMIN_PORTAL
        )
        
        db.commit()
        
        return {
            "batch_no": candidate.batch_no,
            "cleaned_count": len(work_orders),
            "executed_at": candidate.executed_at
        }
