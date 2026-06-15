from typing import List, Dict, Any
from io import BytesIO
from sqlalchemy.orm import Session
from app.models import EvalSlice, ExpandResult, SelfCheckRecord, ConflictRecord, OperationLog
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
        row = {
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
        }
        if r.abnormal_type == "TIME_WINDOW_LEAKAGE":
            row["风险说明"] = "时间窗穿越导致效果虚高，需实验平台负责人复核后方可归入正常"
        else:
            row["风险说明"] = ""
        data.append(row)
    
    df = pd.DataFrame(data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="扩展结果明细", index=False)
        _write_summary_sheet(db, eval_slice_id, writer)
        _write_conflict_sheet(db, eval_slice_id, writer)
        _write_operation_log_sheet(db, eval_slice_id, writer)
        _write_self_check_sheet(db, eval_slice_id, writer)
    
    output.seek(0)
    return output


def _write_summary_sheet(db: Session, eval_slice_id: int, writer: pd.ExcelWriter):
    eval_slice = db.query(EvalSlice).filter(EvalSlice.id == eval_slice_id).first()
    
    results = db.query(ExpandResult).filter(ExpandResult.eval_slice_id == eval_slice_id).all()
    total_count = len(results)
    abnormal_count = sum(1 for r in results if r.is_abnormal)
    need_review_count = sum(1 for r in results if r.need_review)
    time_leakage_count = sum(1 for r in results if r.abnormal_type == "TIME_WINDOW_LEAKAGE")
    confirmed_normal_count = sum(1 for r in results if r.review_status == "confirmed_normal")
    confirmed_abnormal_count = sum(1 for r in results if r.review_status == "confirmed_abnormal")
    
    all_conflicts = db.query(ConflictRecord).filter(
        ConflictRecord.eval_slice_id == eval_slice_id
    ).all()
    pending_conflict_count = sum(1 for c in all_conflicts if c.status == "pending")
    resolved_conflict_count = sum(1 for c in all_conflicts if c.status == "resolved")
    
    summary_data = [
        {"项目": "评测切片ID", "值": eval_slice.slice_id if eval_slice else ""},
        {"项目": "评测切片名称", "值": eval_slice.slice_name if eval_slice else ""},
        {"项目": "特征快照编号", "值": eval_slice.feature_snapshot_id if eval_slice else ""},
        {"项目": "时间窗起始", "值": eval_slice.time_window_start.strftime("%Y-%m-%d") if eval_slice and eval_slice.time_window_start else ""},
        {"项目": "时间窗截止", "值": eval_slice.time_window_end.strftime("%Y-%m-%d") if eval_slice and eval_slice.time_window_end else ""},
        {"项目": "种子用户数", "值": eval_slice.total_users if eval_slice else 0},
        {"项目": "当前状态", "值": eval_slice.status if eval_slice else ""},
        {"项目": "扩展结果总数", "值": total_count},
        {"项目": "异常样本数", "值": abnormal_count},
        {"项目": "待复核样本数", "值": need_review_count},
        {"项目": "时间窗穿越样本数", "值": time_leakage_count},
        {"项目": "已确认正常数", "值": confirmed_normal_count},
        {"项目": "已确认异常数", "值": confirmed_abnormal_count},
        {"项目": "未确认冲突数", "值": pending_conflict_count},
        {"项目": "已处理冲突数", "值": resolved_conflict_count},
    ]
    
    df_summary = pd.DataFrame(summary_data)
    df_summary.to_excel(writer, sheet_name="汇总信息", index=False)


def _write_conflict_sheet(db: Session, eval_slice_id: int, writer: pd.ExcelWriter):
    conflicts = db.query(ConflictRecord).filter(
        ConflictRecord.eval_slice_id == eval_slice_id
    ).order_by(ConflictRecord.created_at.desc()).all()
    
    if not conflicts:
        return
    
    data = []
    for c in conflicts:
        evidence_str = ""
        if c.evidence:
            parts = []
            for k, v in c.evidence.items():
                parts.append(f"{k}={v}")
            evidence_str = "; ".join(parts)
        
        data.append({
            "冲突ID": c.id,
            "冲突类型": _get_conflict_type_name(c.conflict_type),
            "冲突描述": c.description,
            "冲突证据": evidence_str,
            "状态": "待确认" if c.status == "pending" else "已处理",
            "处理结果": _get_resolution_name(c.resolution) if c.resolution else "",
            "处理人": c.resolved_by or "",
            "处理时间": c.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if c.resolved_at else "",
            "发现时间": c.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        })
    
    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="冲突处理记录", index=False)


def _write_operation_log_sheet(db: Session, eval_slice_id: int, writer: pd.ExcelWriter):
    eval_slice = db.query(EvalSlice).filter(EvalSlice.id == eval_slice_id).first()
    if not eval_slice:
        return
    
    logs = db.query(OperationLog).filter(
        OperationLog.target_id == str(eval_slice.slice_id)
    ).order_by(OperationLog.created_at.desc()).limit(200).all()
    
    if not logs:
        return
    
    data = []
    for log in logs:
        detail_str = ""
        if log.details:
            parts = []
            for k, v in log.details.items():
                parts.append(f"{k}={v}")
            detail_str = "; ".join(parts)
        
        data.append({
            "操作人": log.operator,
            "操作": log.operation,
            "操作对象类型": log.target_type or "",
            "操作对象ID": log.target_id or "",
            "操作详情": detail_str,
            "操作时间": log.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        })
    
    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="操作日志", index=False)


def _write_self_check_sheet(db: Session, eval_slice_id: int, writer: pd.ExcelWriter):
    from app.services.self_checker import get_latest_checks
    checks = get_latest_checks(db, eval_slice_id)
    if not checks:
        return
    
    data = []
    for c in checks:
        detail_str = ""
        if c.details:
            if c.details.get("warning"):
                detail_str = c.details["warning"]
            elif c.details.get("error"):
                detail_str = c.details["error"]
            elif c.details.get("leakage_samples"):
                detail_str = f"时间窗穿越样本{c.details.get('total_leakage_count', len(c.details['leakage_samples']))}条，效果可能虚高"
        
        data.append({
            "检查项": c.check_name,
            "是否通过": "是" if c.passed else "否",
            "错误数": c.error_count,
            "详情": detail_str,
            "检查时间": c.checked_at.strftime("%Y-%m-%d %H:%M:%S"),
        })
    
    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="自检报告", index=False)


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


def _get_conflict_type_name(conflict_type: str) -> str:
    type_map = {
        "SNAPSHOT_ID_MISMATCH": "特征快照编号不匹配",
        "TIME_WINDOW_MISMATCH": "时间窗不匹配",
        "USER_COUNT_MISMATCH": "用户数不匹配",
        "EMPTY_SNAPSHOT_ID": "特征快照编号为空",
        "INVALID_SNAPSHOT_ID": "特征快照编号不存在",
    }
    return type_map.get(conflict_type, conflict_type or "")


def _get_resolution_name(resolution: str) -> str:
    resolution_map = {
        "confirmed": "确认（按此执行）",
        "rejected": "驳回（重新设置）",
    }
    return resolution_map.get(resolution, resolution or "")
