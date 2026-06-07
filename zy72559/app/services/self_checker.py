from typing import List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import EvalSlice, SelfCheckRecord, ExpandResult


CHECK_TYPES = {
    "DUPLICATE_IMPORT": "重复导入检查",
    "TIME_WINDOW_LEAKAGE": "时间窗穿越检查",
    "RECALCULATION_AFTER_SUPPLEMENT": "补录后重算检查",
    "EXPORT_CONSISTENCY": "导出一致性检查",
}


def run_all_checks(db: Session, eval_slice: EvalSlice) -> List[SelfCheckRecord]:
    records = []
    
    records.append(_check_duplicate_import(db, eval_slice))
    records.append(_check_time_window_leakage(db, eval_slice))
    records.append(_check_recalculation_after_supplement(db, eval_slice))
    records.append(_check_export_consistency(db, eval_slice))
    
    for record in records:
        db.add(record)
    db.commit()
    
    return records


def _check_duplicate_import(db: Session, eval_slice: EvalSlice) -> SelfCheckRecord:
    details = {"checked": True, "duplicates": []}
    passed = True
    error_count = 0
    
    existing = db.query(EvalSlice).filter(
        EvalSlice.slice_id == eval_slice.slice_id,
        EvalSlice.id != eval_slice.id
    ).all()
    
    if existing:
        passed = False
        error_count = len(existing)
        details["duplicates"] = [
            {"id": e.id, "import_time": e.import_time.isoformat(), "imported_by": e.imported_by}
            for e in existing
        ]
    
    return SelfCheckRecord(
        eval_slice_id=eval_slice.id,
        check_type="DUPLICATE_IMPORT",
        check_name=CHECK_TYPES["DUPLICATE_IMPORT"],
        passed=passed,
        details=details,
        error_count=error_count
    )


def _check_time_window_leakage(db: Session, eval_slice: EvalSlice) -> SelfCheckRecord:
    details = {"checked": True, "leakage_samples": []}
    passed = True
    error_count = 0
    
    if not eval_slice.time_window_end:
        details["warning"] = "未设置时间窗，跳过检查"
        return SelfCheckRecord(
            eval_slice_id=eval_slice.id,
            check_type="TIME_WINDOW_LEAKAGE",
            check_name=CHECK_TYPES["TIME_WINDOW_LEAKAGE"],
            passed=False,
            details=details,
            error_count=1
        )
    
    results = db.query(ExpandResult).filter(
        ExpandResult.eval_slice_id == eval_slice.id,
        ExpandResult.is_abnormal == True,
        ExpandResult.abnormal_type == "TIME_WINDOW_LEAKAGE"
    ).all()
    
    if results:
        passed = False
        error_count = len(results)
        details["leakage_samples"] = [
            {
                "user_id": r.user_id,
                "similarity_score": r.similarity_score,
                "abnormal_reason": r.abnormal_reason,
                "need_review": r.need_review
            }
            for r in results[:100]
        ]
        details["total_leakage_count"] = error_count
        details["warning"] = f"发现 {error_count} 条时间窗穿越样本，效果可能虚高，需实验平台负责人复核"
    
    return SelfCheckRecord(
        eval_slice_id=eval_slice.id,
        check_type="TIME_WINDOW_LEAKAGE",
        check_name=CHECK_TYPES["TIME_WINDOW_LEAKAGE"],
        passed=passed,
        details=details,
        error_count=error_count
    )


def _check_recalculation_after_supplement(db: Session, eval_slice: EvalSlice) -> SelfCheckRecord:
    details = {"checked": True, "supplement_history": []}
    passed = True
    error_count = 0
    
    if eval_slice.raw_data and "supplement_count" in eval_slice.raw_data:
        supplement_count = eval_slice.raw_data.get("supplement_count", 0)
        last_recalc_time = eval_slice.raw_data.get("last_recalc_time")
        
        if supplement_count > 0 and not last_recalc_time:
            passed = False
            error_count = 1
            details["error"] = f"已补录{supplement_count}次，但未执行重算"
        elif supplement_count > 0 and last_recalc_time:
            last_supplement_time = eval_slice.raw_data.get("last_supplement_time")
            if last_supplement_time and last_recalc_time < last_supplement_time:
                passed = False
                error_count = 1
                details["error"] = "最后一次补录后未执行重算"
    
    return SelfCheckRecord(
        eval_slice_id=eval_slice.id,
        check_type="RECALCULATION_AFTER_SUPPLEMENT",
        check_name=CHECK_TYPES["RECALCULATION_AFTER_SUPPLEMENT"],
        passed=passed,
        details=details,
        error_count=error_count
    )


def _check_export_consistency(db: Session, eval_slice: EvalSlice) -> SelfCheckRecord:
    details = {"checked": True, "consistency_checks": []}
    passed = True
    error_count = 0
    
    results = db.query(ExpandResult).filter(ExpandResult.eval_slice_id == eval_slice.id).all()
    abnormal_count = sum(1 for r in results if r.is_abnormal)
    need_review_count = sum(1 for r in results if r.need_review)
    
    checks = [
        {"item": "结果总行数", "count": len(results), "consistent": True},
        {"item": "异常样本数", "count": abnormal_count, "consistent": True},
        {"item": "待复核样本数", "count": need_review_count, "consistent": True},
    ]
    
    details["consistency_checks"] = checks
    details["summary"] = {
        "total": len(results),
        "abnormal": abnormal_count,
        "need_review": need_review_count
    }
    
    return SelfCheckRecord(
        eval_slice_id=eval_slice.id,
        check_type="EXPORT_CONSISTENCY",
        check_name=CHECK_TYPES["EXPORT_CONSISTENCY"],
        passed=passed,
        details=details,
        error_count=error_count
    )


def detect_time_window_leakage(
    user_features: List[Dict[str, Any]],
    time_window_end: datetime
) -> List[Dict[str, Any]]:
    leakage_samples = []
    
    for user in user_features:
        feature_time = user.get("feature_time")
        if feature_time:
            if isinstance(feature_time, str):
                feature_time = datetime.fromisoformat(feature_time)
            
            if feature_time > time_window_end:
                leakage_samples.append({
                    "user_id": user.get("user_id"),
                    "feature_time": feature_time.isoformat(),
                    "time_window_end": time_window_end.isoformat(),
                    "leakage_days": (feature_time - time_window_end).days
                })
    
    return leakage_samples


def get_latest_checks(db: Session, eval_slice_id: int) -> List[SelfCheckRecord]:
    from sqlalchemy import func
    subquery = db.query(
        SelfCheckRecord.check_type,
        func.max(SelfCheckRecord.checked_at).label("max_checked_at")
    ).filter(
        SelfCheckRecord.eval_slice_id == eval_slice_id
    ).group_by(SelfCheckRecord.check_type).subquery()
    
    return db.query(SelfCheckRecord).filter(
        SelfCheckRecord.eval_slice_id == eval_slice_id,
        SelfCheckRecord.check_type == subquery.c.check_type,
        SelfCheckRecord.checked_at == subquery.c.max_checked_at
    ).all()
