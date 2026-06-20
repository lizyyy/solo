from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import EvalSlice, FeatureSnapshot, ConflictRecord, ExpandResult, OperationLog


CONFLICT_TYPES = {
    "SNAPSHOT_ID_MISMATCH": "特征快照编号不匹配",
    "TIME_WINDOW_MISMATCH": "时间窗不匹配",
    "USER_COUNT_MISMATCH": "用户数不匹配",
    "EMPTY_SNAPSHOT_ID": "特征快照编号为空",
    "INVALID_SNAPSHOT_ID": "特征快照编号不存在",
}


def detect_conflicts(db: Session, eval_slice: EvalSlice) -> List[ConflictRecord]:
    conflicts = []
    
    if not eval_slice.feature_snapshot_id:
        conflicts.append(_create_conflict(
            eval_slice.id,
            "EMPTY_SNAPSHOT_ID",
            "评测切片未关联特征快照编号",
            {"slice_id": eval_slice.slice_id, "slice_name": eval_slice.slice_name}
        ))
    
    if eval_slice.feature_snapshot_id:
        snapshot = db.query(FeatureSnapshot).filter(
            FeatureSnapshot.snapshot_id == eval_slice.feature_snapshot_id
        ).first()
        
        if not snapshot:
            conflicts.append(_create_conflict(
                eval_slice.id,
                "INVALID_SNAPSHOT_ID",
                f"特征快照编号 {eval_slice.feature_snapshot_id} 不存在",
                {
                    "slice_id": eval_slice.slice_id,
                    "snapshot_id_provided": eval_slice.feature_snapshot_id,
                    "available_snapshots": [s.snapshot_id for s in db.query(FeatureSnapshot).all()]
                }
            ))
        else:
            if eval_slice.time_window_start and eval_slice.time_window_end:
                snapshot_to_window_gap = abs((snapshot.snapshot_time - eval_slice.time_window_end).days)
                
                if snapshot_to_window_gap > 7:
                    conflicts.append(_create_conflict(
                        eval_slice.id,
                        "TIME_WINDOW_MISMATCH",
                        f"特征快照时间与评测切片时间窗相差 {snapshot_to_window_gap} 天，超过阈值7天",
                        {
                            "slice_id": eval_slice.slice_id,
                            "snapshot_id": snapshot.snapshot_id,
                            "snapshot_time": snapshot.snapshot_time.isoformat(),
                            "time_window_start": eval_slice.time_window_start.isoformat(),
                            "time_window_end": eval_slice.time_window_end.isoformat(),
                            "gap_days": snapshot_to_window_gap,
                            "threshold_days": 7
                        }
                    ))
            
            if eval_slice.total_users > 0 and snapshot.total_users > 0:
                diff_ratio = abs(eval_slice.total_users - snapshot.total_users) / snapshot.total_users
                if diff_ratio > 0.1:
                    conflicts.append(_create_conflict(
                        eval_slice.id,
                        "USER_COUNT_MISMATCH",
                        f"评测切片用户数({eval_slice.total_users})与特征快照用户数({snapshot.total_users})差异超过10%",
                        {
                            "slice_id": eval_slice.slice_id,
                            "snapshot_id": snapshot.snapshot_id,
                            "slice_user_count": eval_slice.total_users,
                            "snapshot_user_count": snapshot.total_users,
                            "diff_ratio": round(diff_ratio * 100, 2)
                        }
                    ))
    
    for conflict in conflicts:
        db.add(conflict)
    db.commit()
    for conflict in conflicts:
        db.refresh(conflict)
    
    return conflicts


def _create_conflict(
    eval_slice_id: int,
    conflict_type: str,
    description: str,
    evidence: Dict[str, Any]
) -> ConflictRecord:
    return ConflictRecord(
        eval_slice_id=eval_slice_id,
        conflict_type=conflict_type,
        description=description,
        evidence=evidence,
        status="pending"
    )


def resolve_conflict(
    db: Session,
    conflict_id: int,
    resolution: str,
    operator: str
) -> Optional[ConflictRecord]:
    conflict = db.query(ConflictRecord).filter(ConflictRecord.id == conflict_id).first()
    if not conflict:
        return None
    
    conflict.status = "resolved"
    conflict.resolution = resolution
    conflict.resolved_by = operator
    conflict.resolved_at = datetime.now()
    
    eval_slice = db.query(EvalSlice).filter(EvalSlice.id == conflict.eval_slice_id).first()
    slice_id_str = eval_slice.slice_id if eval_slice else str(conflict.eval_slice_id)
    
    log = OperationLog(
        operator=operator,
        operation=f"处理冲突-{('确认' if resolution == 'confirmed' else '驳回')}",
        target_type="conflict",
        target_id=slice_id_str,
        details={
            "conflict_id": conflict_id,
            "conflict_type": conflict.conflict_type,
            "resolution": resolution,
            "description": conflict.description
        }
    )
    db.add(log)
    
    db.commit()
    db.refresh(conflict)
    
    return conflict


def get_pending_conflicts(db: Session, eval_slice_id: Optional[int] = None) -> List[ConflictRecord]:
    query = db.query(ConflictRecord).filter(ConflictRecord.status == "pending")
    if eval_slice_id:
        query = query.filter(ConflictRecord.eval_slice_id == eval_slice_id)
    return query.order_by(ConflictRecord.created_at.desc()).all()


def get_all_conflicts(db: Session, eval_slice_id: int) -> List[ConflictRecord]:
    return db.query(ConflictRecord).filter(
        ConflictRecord.eval_slice_id == eval_slice_id
    ).order_by(ConflictRecord.created_at.desc()).all()
    ).order_by(ConflictRecord.created_at.desc()).all()
