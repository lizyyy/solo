from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import random
from sqlalchemy.orm import Session
from app.models import EvalSlice, ExpandResult, FeatureSnapshot, OperationLog, ConflictRecord, SelfCheckRecord
from app.services.conflict_detector import detect_conflicts
from app.services.self_checker import run_all_checks, detect_time_window_leakage


def import_eval_slice(
    db: Session,
    slice_id: str,
    slice_name: str,
    total_users: int,
    time_window_start: Optional[str] = None,
    time_window_end: Optional[str] = None,
    feature_snapshot_id: Optional[str] = None,
    operator: str = "小孟"
) -> Tuple[EvalSlice, List[Dict[str, Any]]]:
    existing = db.query(EvalSlice).filter(EvalSlice.slice_id == slice_id).first()
    if existing:
        raise ValueError(f"评测切片 {slice_id} 已存在，请检查是否重复导入")
    
    eval_slice = EvalSlice(
        slice_id=slice_id,
        slice_name=slice_name,
        feature_snapshot_id=feature_snapshot_id,
        total_users=total_users,
        status="imported",
        imported_by=operator,
    )
    
    if time_window_start:
        eval_slice.time_window_start = datetime.fromisoformat(time_window_start)
    if time_window_end:
        eval_slice.time_window_end = datetime.fromisoformat(time_window_end)
    
    db.add(eval_slice)
    db.commit()
    db.refresh(eval_slice)
    
    _log_operation(db, operator, "导入评测切片", "eval_slice", slice_id, {
        "slice_name": slice_name,
        "total_users": total_users
    })
    
    conflicts = detect_conflicts(db, eval_slice)
    
    return eval_slice, [_conflict_to_dict(c) for c in conflicts]


def supplement_feature_snapshot(
    db: Session,
    eval_slice_id: int,
    feature_snapshot_id: str,
    operator: str = "小孟"
) -> Tuple[EvalSlice, List[Dict[str, Any]]]:
    eval_slice = db.query(EvalSlice).filter(EvalSlice.id == eval_slice_id).first()
    if not eval_slice:
        raise ValueError(f"评测切片不存在")
    
    eval_slice.feature_snapshot_id = feature_snapshot_id
    eval_slice.status = "snapshot_supplemented"
    
    if not eval_slice.raw_data:
        eval_slice.raw_data = {}
    if "supplement_count" not in eval_slice.raw_data:
        eval_slice.raw_data["supplement_count"] = 0
    eval_slice.raw_data["supplement_count"] += 1
    eval_slice.raw_data["last_supplement_time"] = datetime.now().isoformat()
    
    db.commit()
    db.refresh(eval_slice)
    
    _log_operation(db, operator, "补录特征快照编号", "eval_slice", eval_slice.slice_id, {
        "feature_snapshot_id": feature_snapshot_id
    })
    
    conflicts = detect_conflicts(db, eval_slice)
    
    return eval_slice, [_conflict_to_dict(c) for c in conflicts]


def run_expand(
    db: Session,
    eval_slice_id: int,
    operator: str = "小孟"
) -> Dict[str, Any]:
    eval_slice = db.query(EvalSlice).filter(EvalSlice.id == eval_slice_id).first()
    if not eval_slice:
        raise ValueError(f"评测切片不存在")
    
    pending_conflict_records = db.query(ConflictRecord).filter(
        ConflictRecord.eval_slice_id == eval_slice_id,
        ConflictRecord.status == "pending"
    ).count()
    
    if pending_conflict_records > 0:
        raise ValueError(
            f"存在 {pending_conflict_records} 条未确认的冲突记录，"
            f"请评测运营小孟先确认或驳回冲突后再执行扩展"
        )
    
    pending_review_results = db.query(ExpandResult).filter(
        ExpandResult.eval_slice_id == eval_slice_id,
        ExpandResult.need_review == True,
        ExpandResult.review_status == "pending"
    ).count()
    
    if pending_review_results > 0:
        raise ValueError(f"存在 {pending_review_results} 条待复核记录，请先处理后再执行扩展")
    
    db.query(ExpandResult).filter(ExpandResult.eval_slice_id == eval_slice_id).delete()
    
    expand_results = _generate_mock_expand_results(eval_slice)
    
    leakage_samples = []
    if eval_slice.time_window_end:
        mock_features = [
            {"user_id": r.user_id, "feature_time": _get_mock_feature_time(eval_slice.time_window_end)}
            for r in expand_results
        ]
        leakage_samples = detect_time_window_leakage(mock_features, eval_slice.time_window_end)
    
    leakage_user_ids = {s["user_id"] for s in leakage_samples}
    
    for result in expand_results:
        if result.user_id in leakage_user_ids:
            leakage_info = next(s for s in leakage_samples if s["user_id"] == result.user_id)
            result.is_abnormal = True
            result.abnormal_type = "TIME_WINDOW_LEAKAGE"
            result.abnormal_reason = f"时间窗穿越：特征时间({leakage_info['feature_time']})晚于时间窗截止({leakage_info['time_window_end']})，穿越{leakage_info['leakage_days']}天，效果可能虚高"
            result.need_review = True
        
        db.add(result)
    
    eval_slice.status = "expand_completed"
    if not eval_slice.raw_data:
        eval_slice.raw_data = {}
    eval_slice.raw_data["last_recalc_time"] = datetime.now().isoformat()
    
    db.commit()
    db.refresh(eval_slice)
    
    self_check_records = run_all_checks(db, eval_slice)
    
    _log_operation(db, operator, "执行相似用户扩展", "eval_slice", eval_slice.slice_id, {
        "result_count": len(expand_results),
        "abnormal_count": sum(1 for r in expand_results if r.is_abnormal)
    })
    
    results = db.query(ExpandResult).filter(ExpandResult.eval_slice_id == eval_slice_id).all()
    
    return {
        "eval_slice": _eval_slice_to_dict(eval_slice),
        "total_results": len(results),
        "abnormal_count": sum(1 for r in results if r.is_abnormal),
        "need_review_count": sum(1 for r in results if r.need_review),
        "self_checks": [_self_check_to_dict(s) for s in self_check_records]
    }


def get_abnormal_samples(
    db: Session,
    eval_slice_id: int,
    only_need_review: bool = False,
    page: int = 1,
    page_size: int = 50
) -> Dict[str, Any]:
    query = db.query(ExpandResult).filter(
        ExpandResult.eval_slice_id == eval_slice_id,
        ExpandResult.is_abnormal == True
    )
    
    if only_need_review:
        query = query.filter(ExpandResult.need_review == True)
    
    total = query.count()
    results = query.order_by(ExpandResult.created_at.desc()) \
        .offset((page - 1) * page_size) \
        .limit(page_size) \
        .all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "samples": [_expand_result_to_dict(r) for r in results]
    }


def get_all_results(
    db: Session,
    eval_slice_id: int,
    page: int = 1,
    page_size: int = 100
) -> Dict[str, Any]:
    query = db.query(ExpandResult).filter(ExpandResult.eval_slice_id == eval_slice_id)
    
    total = query.count()
    results = query.order_by(ExpandResult.similarity_score.desc()) \
        .offset((page - 1) * page_size) \
        .limit(page_size) \
        .all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": [_expand_result_to_dict(r) for r in results]
    }


def review_abnormal_sample(
    db: Session,
    result_id: int,
    review_status: str,
    operator: str
) -> Optional[ExpandResult]:
    result = db.query(ExpandResult).filter(ExpandResult.id == result_id).first()
    if not result:
        return None
    
    result.review_status = review_status
    result.reviewed_by = operator
    result.reviewed_at = datetime.now()
    
    if review_status == "confirmed_normal":
        result.is_abnormal = False
        result.need_review = False
    elif review_status == "confirmed_abnormal":
        result.need_review = False
    
    db.commit()
    db.refresh(result)
    
    _log_operation(db, operator, f"复核异常样本-{review_status}", "expand_result", str(result_id), {
        "user_id": result.user_id,
        "abnormal_type": result.abnormal_type
    })
    
    return result


def _generate_mock_expand_results(eval_slice: EvalSlice) -> List[ExpandResult]:
    count = min(eval_slice.total_users * 5, 1000)
    results = []
    
    seed_users = [f"seed_{i:06d}" for i in range(min(eval_slice.total_users, 100))]
    
    for i in range(count):
        seed_user = random.choice(seed_users)
        score = round(random.uniform(0.5, 0.99), 4)
        
        result = ExpandResult(
            eval_slice_id=eval_slice.id,
            user_id=f"expand_{i:06d}",
            seed_user_id=seed_user,
            similarity_score=score,
            is_abnormal=False,
            need_review=False,
            review_status="pending"
        )
        results.append(result)
    
    return results


def _get_mock_feature_time(time_window_end: datetime) -> str:
    base_time = time_window_end
    if random.random() < 0.05:
        delta_days = random.randint(1, 30)
        feature_time = base_time + timedelta(days=delta_days)
    else:
        delta_days = random.randint(-30, 0)
        feature_time = base_time + timedelta(days=delta_days)
    return feature_time.isoformat()


def _log_operation(db: Session, operator: str, operation: str, target_type: str, target_id: str, details: Dict[str, Any]):
    log = OperationLog(
        operator=operator,
        operation=operation,
        target_type=target_type,
        target_id=target_id,
        details=details
    )
    db.add(log)
    db.commit()


def _eval_slice_to_dict(slice_obj: EvalSlice) -> Dict[str, Any]:
    return {
        "id": slice_obj.id,
        "slice_id": slice_obj.slice_id,
        "slice_name": slice_obj.slice_name,
        "feature_snapshot_id": slice_obj.feature_snapshot_id,
        "status": slice_obj.status,
        "total_users": slice_obj.total_users,
        "time_window_start": slice_obj.time_window_start.isoformat() if slice_obj.time_window_start else None,
        "time_window_end": slice_obj.time_window_end.isoformat() if slice_obj.time_window_end else None,
        "imported_by": slice_obj.imported_by,
        "import_time": slice_obj.import_time.isoformat()
    }


def _conflict_to_dict(conflict: ConflictRecord) -> Dict[str, Any]:
    return {
        "id": conflict.id,
        "conflict_type": conflict.conflict_type,
        "description": conflict.description,
        "evidence": conflict.evidence,
        "status": conflict.status,
        "created_at": conflict.created_at.isoformat()
    }


def _expand_result_to_dict(result: ExpandResult) -> Dict[str, Any]:
    return {
        "id": result.id,
        "user_id": result.user_id,
        "seed_user_id": result.seed_user_id,
        "similarity_score": result.similarity_score,
        "is_abnormal": result.is_abnormal,
        "abnormal_type": result.abnormal_type,
        "abnormal_reason": result.abnormal_reason,
        "need_review": result.need_review,
        "review_status": result.review_status,
        "reviewed_by": result.reviewed_by,
        "reviewed_at": result.reviewed_at.isoformat() if result.reviewed_at else None,
        "created_at": result.created_at.isoformat()
    }


def _self_check_to_dict(check: SelfCheckRecord) -> Dict[str, Any]:
    return {
        "id": check.id,
        "check_type": check.check_type,
        "check_name": check.check_name,
        "passed": check.passed,
        "error_count": check.error_count,
        "details": check.details,
        "checked_at": check.checked_at.isoformat()
    }
