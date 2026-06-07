import pandas as pd
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

from .models import VerificationStatus, ConflictType
from . import storage, engine


def get_batch_results(
    batch_id: str,
    status_filter: Optional[List[VerificationStatus]] = None,
    conflict_filter: Optional[List[ConflictType]] = None
) -> List[Dict[str, Any]]:
    records = storage.list_verification_records(batch_id=batch_id)

    if status_filter:
        records = [r for r in records if r.status in status_filter]
    if conflict_filter:
        records = [r for r in records if r.conflict_type in conflict_filter]

    results = []
    for record in records:
        results.append(engine.get_record_for_review(record.id))
    return results


def export_to_excel(
    batch_id: str,
    output_path: str,
    status_filter: Optional[List[VerificationStatus]] = None,
    conflict_filter: Optional[List[ConflictType]] = None
) -> str:
    results = get_batch_results(batch_id, status_filter, conflict_filter)

    rows = []
    for r in results:
        row = {
            "样本编号": r["sample_id"],
            "原始行号(模型输出)": r["original_row_number"],
            "当前模型版本": r["current_model_version"],
            "上一模型版本": r["previous_model_version"] or "",
            "冲突类型": r["conflict_display"],
            "当前状态": r["status_display"],
            "卡在哪一步": r["blocked_step"] or "",
            "阻塞原因": r["blocked_reason"] or "",
            "模型输出": r["model_output"],
            "标准答案": r["expected_summary"],
            "事实校验结果": r["fact_check_result"],
        }

        if r["manual_judgement"]:
            row.update({
                "人工改判行号": r["manual_judgement"]["judge_row_number"],
                "人工判罚是否正确": "是" if r["manual_judgement"]["is_correct"] else "否",
                "人工修正摘要": r["manual_judgement"]["corrected_summary"] or "",
                "改判说明": r["manual_judgement"]["judge_comment"] or "",
                "改判人": r["manual_judgement"]["judged_by"],
            })
        else:
            row.update({
                "人工改判行号": "",
                "人工判罚是否正确": "",
                "人工修正摘要": "",
                "改判说明": "",
                "改判人": "",
            })

        row.update({
            "AI产品经理复核意见": r["ai_pm_review"]["comment"] or "",
            "AI产品经理": r["ai_pm_review"]["reviewed_by"] or "",
            "AI产品经理复核时间": r["ai_pm_review"]["reviewed_at"] or "",
            "运营复核意见": r["operation_review"]["comment"] or "",
            "运营复核人": r["operation_review"]["reviewed_by"] or "",
            "运营复核时间": r["operation_review"]["reviewed_at"] or "",
            "记录创建时间": r["created_at"],
            "最后更新时间": r["updated_at"],
            "记录ID": r["record_id"],
        })
        rows.append(row)

    df = pd.DataFrame(rows)

    out_path = Path(output_path)
    if out_path.suffix.lower() not in [".xlsx", ".xls"]:
        out_path = out_path.with_suffix(".xlsx")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_excel(str(out_path), index=False, sheet_name="校验明细")

    return str(out_path)


def get_batch_summary(batch_id: str) -> Dict[str, Any]:
    batch = storage.get_batch(batch_id)
    if not batch:
        return {}

    stats = storage.get_batch_statistics(batch_id)
    records = storage.list_verification_records(batch_id=batch_id)

    by_step = {
        "第一步_模型输出导入": 0,
        "第二步_AI产品经理复核": 0,
        "第二步后_运营复核": 0,
        "第三步_复盘页更新": 0,
        "已完成": 0,
        "已回滚": 0,
    }

    for r in records:
        if r.status in [VerificationStatus.MODEL_VERSION_CONFLICT, VerificationStatus.IMPORTED]:
            by_step["第一步_模型输出导入"] += 1
        elif r.status in [VerificationStatus.PENDING_AI_PM_REVIEW]:
            by_step["第二步_AI产品经理复核"] += 1
        elif r.status in [VerificationStatus.PENDING_OPERATION_REVIEW]:
            by_step["第二步后_运营复核"] += 1
        elif r.status in [VerificationStatus.AI_PM_REVIEWED, VerificationStatus.OPERATION_APPROVED, VerificationStatus.OPERATION_REJECTED]:
            by_step["第三步_复盘页更新"] += 1
        elif r.status == VerificationStatus.COMPLETED:
            by_step["已完成"] += 1
        elif r.status == VerificationStatus.ROLLBACKED:
            by_step["已回滚"] += 1

    return {
        "batch_id": batch.batch_id,
        "batch_name": batch.name,
        "model_version": batch.model_version,
        "created_by": batch.created_by,
        "created_at": batch.created_at.isoformat() if hasattr(batch.created_at, 'isoformat') else str(batch.created_at),
        "description": batch.description,
        "total_samples": stats["total"],
        "by_status": {engine.get_status_display(VerificationStatus(k)): v for k, v in stats["by_status"].items()},
        "by_conflict": {engine.get_conflict_display(ConflictType(k)): v for k, v in stats["by_conflict"].items()},
        "by_step": by_step,
    }


def get_operation_log_view(batch_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    logs = storage.list_operation_logs(batch_id=batch_id, limit=limit)
    result = []
    for log in logs:
        result.append({
            "时间": log.timestamp.isoformat() if hasattr(log.timestamp, 'isoformat') else str(log.timestamp),
            "操作": log.operation,
            "操作人": log.operator,
            "样本编号": log.sample_id or "",
            "详情": log.details
        })
    return result
