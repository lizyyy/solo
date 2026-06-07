from typing import List, Dict, Any
from io import BytesIO
from sqlalchemy.orm import Session
from app.models import EvalSlice, ExpandResult, SelfCheckRecord
import pandas as pd


def export_results(
    db: Session,
    eval_slice_id: int,
    include_abnormal_only: bool = False
) -> BytesIO:
    query = db.query(ExpandResult).filter(ExpandResult.eval_slice_id == eval_slice_id)
    
    if include_abnormal_only:
        query = query.filter(ExpandResult.is_abnormal == True)
    
    results = query.order_by(ExpandResult.similarity_score.desc()).all()
    
    data = []
    for r in results:
        data.append({
            "用户ID": r.user_id,
            "种子用户ID": r.seed_user_id,
            "相似度得分": r.similarity_score,
            "是否异常": "是" if r.is_abnormal else "否",
            "异常类型": _get_abnormal_type_name(r.abnormal_type),
            "异常原因": r.abnormal_reason or "",
            "是否待复核": "是" if r.need_review else "否",
            "复核状态": _get_review_status_name(r.review_status),
            "复核人": r.reviewed_by or "",
            "复核时间": r.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if r.reviewed_at else "",
        })
    
    df = pd.DataFrame(data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="扩展结果", index=False)
        _write_summary_sheet(db, eval_slice_id, writer)
    
    output.seek(0)
    return output


def _write_summary_sheet(db: Session, eval_slice_id: int, writer: pd.ExcelWriter):
    eval_slice = db.query(EvalSlice).filter(EvalSlice.id == eval_slice_id).first()
    
    results = db.query(ExpandResult).filter(ExpandResult.eval_slice_id == eval_slice_id).all()
    total_count = len(results)
    abnormal_count = sum(1 for r in results if r.is_abnormal)
    need_review_count = sum(1 for r in results if r.need_review)
    time_leakage_count = sum(1 for r in results if r.abnormal_type == "TIME_WINDOW_LEAKAGE")
    
    summary_data = [
        {"项目": "评测切片ID", "值": eval_slice.slice_id if eval_slice else ""},
        {"项目": "评测切片名称", "值": eval_slice.slice_name if eval_slice else ""},
        {"项目": "特征快照编号", "值": eval_slice.feature_snapshot_id if eval_slice else ""},
        {"项目": "时间窗起始", "值": eval_slice.time_window_start.strftime("%Y-%m-%d") if eval_slice and eval_slice.time_window_start else ""},
        {"项目": "时间窗截止", "值": eval_slice.time_window_end.strftime("%Y-%m-%d") if eval_slice and eval_slice.time_window_end else ""},
        {"项目": "种子用户数", "值": eval_slice.total_users if eval_slice else 0},
        {"项目": "扩展结果总数", "值": total_count},
        {"项目": "异常样本数", "值": abnormal_count},
        {"项目": "待复核样本数", "值": need_review_count},
        {"项目": "时间窗穿越样本数", "值": time_leakage_count},
    ]
    
    df_summary = pd.DataFrame(summary_data)
    df_summary.to_excel(writer, sheet_name="汇总信息", index=False)
    
    from app.services.self_checker import get_latest_checks
    checks = get_latest_checks(db, eval_slice_id)
    check_data = []
    for c in checks:
        check_data.append({
            "检查项": c.check_name,
            "是否通过": "是" if c.passed else "否",
            "错误数": c.error_count,
            "详情": str(c.details)[:200] if c.details else "",
            "检查时间": c.checked_at.strftime("%Y-%m-%d %H:%M:%S"),
        })
    
    if check_data:
        df_checks = pd.DataFrame(check_data)
        df_checks.to_excel(writer, sheet_name="自检报告", index=False)


def _get_abnormal_type_name(abnormal_type: str) -> str:
    type_map = {
        "TIME_WINDOW_LEAKAGE": "时间窗穿越",
        "OTHER": "其他异常",
    }
    return type_map.get(abnormal_type, abnormal_type or "")


def _get_review_status_name(status: str) -> str:
    status_map = {
        "pending": "待复核",
        "confirmed_normal": "已确认正常",
        "confirmed_abnormal": "已确认异常",
    }
    return status_map.get(status, status or "")
