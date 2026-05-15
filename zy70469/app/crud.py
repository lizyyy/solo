from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
from typing import List, Optional, Dict, Any
from .models import RuleVersion, Batch, BusReservation, ComparisonResult, CandidateList, OperationLog
from . import schemas


def create_rule_version(db: Session, rule_data: Dict[str, Any]) -> RuleVersion:
    db_rule = RuleVersion(**rule_data)
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


def get_rule_version(db: Session, version: str) -> Optional[RuleVersion]:
    return db.query(RuleVersion).filter(RuleVersion.version == version).first()


def get_all_rule_versions(db: Session) -> List[RuleVersion]:
    return db.query(RuleVersion).order_by(RuleVersion.created_at.desc()).all()


def create_batch(db: Session, batch_data: schemas.BatchCreate) -> Batch:
    db_batch = Batch(
        **batch_data.model_dump(),
        status="processing",
        total_count=0,
        abnormal_count=0
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


def get_batch(db: Session, batch_no: str) -> Optional[Batch]:
    return db.query(Batch).filter(Batch.batch_no == batch_no).first()


def get_all_batches(db: Session) -> List[Batch]:
    return db.query(Batch).order_by(Batch.created_at.desc()).all()


def update_batch_summary(db: Session, batch_no: str, summary: str, total_count: int, abnormal_count: int):
    batch = get_batch(db, batch_no)
    if batch:
        batch.summary = summary
        batch.total_count = total_count
        batch.abnormal_count = abnormal_count
        batch.status = "completed"
        db.commit()
        db.refresh(batch)
    return batch


def get_bus_reservations(db: Session, batch_no: str) -> List[BusReservation]:
    return db.query(BusReservation).filter(BusReservation.batch_no == batch_no).all()


def create_comparison_result(db: Session, result_data: schemas.ComparisonResultCreate) -> ComparisonResult:
    db_result = ComparisonResult(**result_data.model_dump())
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    return db_result


def query_comparison_results(
    db: Session,
    batch_no: Optional[str] = None,
    operator: Optional[str] = None,
    risk_type: Optional[str] = None,
    is_abnormal: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20
):
    query = db.query(ComparisonResult)
    
    filters = []
    if batch_no:
        filters.append(ComparisonResult.batch_no == batch_no)
    if operator:
        filters.append(ComparisonResult.operator == operator)
    if risk_type:
        filters.append(ComparisonResult.risk_type == risk_type)
    if is_abnormal is not None:
        filters.append(ComparisonResult.is_abnormal == is_abnormal)
    
    if filters:
        query = query.filter(and_(*filters))
    
    total = query.count()
    results = query.order_by(ComparisonResult.created_at.desc())\
        .offset((page - 1) * page_size)\
        .limit(page_size)\
        .all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": results
    }


def get_comparison_result(db: Session, result_id: int) -> Optional[ComparisonResult]:
    return db.query(ComparisonResult).filter(ComparisonResult.id == result_id).first()


def generate_diff_report(db: Session, result_id: int) -> Optional[Dict[str, Any]]:
    result = get_comparison_result(db, result_id)
    if not result:
        return None
    
    key_fields_original = {}
    key_fields_replay = {}
    
    if result.original_response:
        key_fields_original = {
            "code": result.original_response.get("code"),
            "message": result.original_response.get("message"),
            "status": result.original_response.get("data", {}).get("status")
        }
    
    if result.replay_response:
        key_fields_replay = {
            "code": result.replay_response.get("code"),
            "message": result.replay_response.get("message"),
            "status": result.replay_response.get("data", {}).get("status"),
            "rule_version": result.replay_response.get("data", {}).get("rule_version")
        }
    
    summary_parts = []
    if result.before_value and result.after_value:
        summary_parts.append(f"变更前: {result.before_value}")
        summary_parts.append(f"变更后: {result.after_value}")
    if result.correction:
        summary_parts.append(f"修正措施: {result.correction}")
    if result.conclusion:
        summary_parts.append(f"结论: {result.conclusion}")
    
    return {
        "batch_no": result.batch_no,
        "record_id": result.record_id,
        "risk_type": result.risk_type,
        "is_abnormal": result.is_abnormal,
        "key_fields_original": key_fields_original,
        "key_fields_replay": key_fields_replay,
        "diff_fields": result.diff_fields or [],
        "summary": " | ".join(summary_parts)
    }


def create_candidate_list(db: Session, candidate_data: schemas.CandidateListCreate) -> CandidateList:
    db_candidate = CandidateList(**candidate_data.model_dump())
    db.add(db_candidate)
    db.commit()
    db.refresh(db_candidate)
    
    log_operation(db, db_candidate.batch_no, "create_candidate_list", db_candidate.operator, {
        "candidate_id": db_candidate.id,
        "candidate_type": db_candidate.candidate_type,
        "record_count": len(db_candidate.record_ids)
    })
    
    return db_candidate


def get_candidate_lists(db: Session, batch_no: Optional[str] = None) -> List[CandidateList]:
    query = db.query(CandidateList)
    if batch_no:
        query = query.filter(CandidateList.batch_no == batch_no)
    return query.order_by(CandidateList.created_at.desc()).all()


def approve_candidate_list(db: Session, candidate_id: int, operator: str) -> Optional[CandidateList]:
    candidate = db.query(CandidateList).filter(CandidateList.id == candidate_id).first()
    if candidate:
        candidate.status = "approved"
        db.commit()
        db.refresh(candidate)
        
        log_operation(db, candidate.batch_no, "approve_candidate_list", operator, {
            "candidate_id": candidate_id,
            "record_ids": candidate.record_ids
        })
    
    return candidate


def execute_cleanup(db: Session, candidate_id: int, operator: str) -> Dict[str, Any]:
    candidate = db.query(CandidateList).filter(CandidateList.id == candidate_id).first()
    if not candidate or candidate.status != "approved":
        return {"success": False, "message": "候选清单未批准或不存在"}
    
    deleted_count = 0
    for record_id in candidate.record_ids:
        result = db.query(ComparisonResult).filter(
            and_(
                ComparisonResult.batch_no == candidate.batch_no,
                ComparisonResult.record_id == record_id
            )
        ).first()
        if result:
            db.delete(result)
            deleted_count += 1
    
    db.commit()
    
    log_operation(db, candidate.batch_no, "execute_cleanup", operator, {
        "candidate_id": candidate_id,
        "deleted_count": deleted_count
    })
    
    return {"success": True, "deleted_count": deleted_count}


def execute_rollback(db: Session, candidate_id: int, operator: str) -> Dict[str, Any]:
    candidate = db.query(CandidateList).filter(CandidateList.id == candidate_id).first()
    if not candidate or candidate.status != "approved":
        return {"success": False, "message": "候选清单未批准或不存在"}
    
    rolled_back_count = 0
    for record_id in candidate.record_ids:
        result = db.query(ComparisonResult).filter(
            and_(
                ComparisonResult.batch_no == candidate.batch_no,
                ComparisonResult.record_id == record_id
            )
        ).first()
        if result:
            result.is_abnormal = False
            result.risk_type = "正常"
            result.conclusion = "已回滚"
            rolled_back_count += 1
    
    db.commit()
    
    log_operation(db, candidate.batch_no, "execute_rollback", operator, {
        "candidate_id": candidate_id,
        "rolled_back_count": rolled_back_count
    })
    
    return {"success": True, "rolled_back_count": rolled_back_count}


def log_operation(
    db: Session,
    batch_no: str,
    operation_type: str,
    operator: str,
    detail: Dict[str, Any]
):
    log = OperationLog(
        batch_no=batch_no,
        operation_type=operation_type,
        operator=operator,
        detail=detail
    )
    db.add(log)
    db.commit()


def get_operation_logs(db: Session, batch_no: Optional[str] = None) -> List[OperationLog]:
    query = db.query(OperationLog)
    if batch_no:
        query = query.filter(OperationLog.batch_no == batch_no)
    return query.order_by(OperationLog.created_at.desc()).all()


def get_unique_operators(db: Session) -> List[str]:
    results = db.query(ComparisonResult.operator).distinct().all()
    return [r[0] for r in results if r[0]]


def get_unique_risk_types(db: Session) -> List[str]:
    results = db.query(ComparisonResult.risk_type).distinct().all()
    return [r[0] for r in results if r[0]]
