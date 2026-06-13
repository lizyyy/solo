import uuid
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any
from .models import (
    VerificationRecord, VerificationStatus, ConflictType,
    SampleRecord, ManualJudgement, BatchInfo
)
from . import storage


def detect_conflict(
    sample: SampleRecord,
    existing_record: Optional[VerificationRecord]
) -> Tuple[ConflictType, Optional[str]]:
    if not existing_record:
        return ConflictType.NO_CONFLICT, None

    prev_version = existing_record.current_model_version
    curr_version = sample.model_version

    version_changed = prev_version != curr_version
    same_sample = existing_record.sample_id == sample.sample_id

    if version_changed and same_sample:
        return ConflictType.MODEL_VERSION_CHANGED_SAME_SAMPLE, prev_version

    return ConflictType.NO_CONFLICT, None


def create_verification_record(
    batch_id: str,
    sample: SampleRecord,
    operator: str
) -> VerificationRecord:
    existing = storage.find_existing_sample(sample.sample_id)
    conflict_type, prev_version = detect_conflict(sample, existing)

    if conflict_type == ConflictType.MODEL_VERSION_CHANGED_SAME_SAMPLE:
        status = VerificationStatus.MODEL_VERSION_CONFLICT
        comment = f"检测到模型版本变更: {prev_version} -> {sample.model_version}, 样本编号不变: {sample.sample_id}"
    else:
        status = VerificationStatus.IMPORTED
        comment = "样本导入成功"

    record = VerificationRecord(
        id=str(uuid.uuid4()),
        batch_id=batch_id,
        sample_id=sample.sample_id,
        status=status,
        conflict_type=conflict_type,
        current_model_version=sample.model_version,
        previous_model_version=prev_version,
        sample=sample
    )
    record.add_status_history(
        VerificationStatus.PENDING_IMPORT,
        status,
        operator,
        comment
    )

    storage.save_verification_record(record)
    storage.add_operation_log(
        batch_id, "create_record", operator,
        sample_id=sample.sample_id,
        details={"conflict_type": conflict_type, "status": status, "comment": comment}
    )

    return record


def ai_pm_review(
    record_id: str,
    operator: str,
    comment: str = "",
    approve: bool = True
) -> VerificationRecord:
    record = storage.get_verification_record_by_id(record_id)
    if not record:
        raise ValueError(f"Record not found: {record_id}")

    old_status = record.status

    if record.conflict_type == ConflictType.MODEL_VERSION_CHANGED_SAME_SAMPLE:
        if approve:
            new_status = VerificationStatus.PENDING_OPERATION_REVIEW
            status_comment = f"AI产品经理确认版本冲突，提交运营复核: {comment}"
        else:
            new_status = VerificationStatus.AI_PM_REVIEWED
            status_comment = f"AI产品经理驳回，无需运营复核: {comment}"
    else:
        new_status = VerificationStatus.AI_PM_REVIEWED
        status_comment = f"AI产品经理复核完成: {comment}"

    record.status = new_status
    record.ai_pm_review_comment = comment
    record.ai_pm_reviewed_by = operator
    record.ai_pm_reviewed_at = datetime.now()
    record.add_status_history(old_status, new_status, operator, status_comment)

    storage.save_verification_record(record)
    storage.add_operation_log(
        record.batch_id, "ai_pm_review", operator,
        sample_id=record.sample_id,
        details={"old_status": old_status, "new_status": new_status, "approve": approve, "comment": comment}
    )

    return record


def operation_review(
    record_id: str,
    operator: str,
    approve: bool,
    comment: str = ""
) -> VerificationRecord:
    record = storage.get_verification_record_by_id(record_id)
    if not record:
        raise ValueError(f"Record not found: {record_id}")

    if record.status != VerificationStatus.PENDING_OPERATION_REVIEW:
        raise ValueError(f"Invalid status for operation review: {record.status}")

    old_status = record.status

    if approve:
        new_status = VerificationStatus.OPERATION_APPROVED
        status_comment = f"运营复核通过: {comment}"
    else:
        new_status = VerificationStatus.OPERATION_REJECTED
        status_comment = f"运营复核驳回: {comment}"

    record.status = new_status
    record.operation_review_comment = comment
    record.operation_reviewed_by = operator
    record.operation_reviewed_at = datetime.now()
    record.add_status_history(old_status, new_status, operator, status_comment)

    storage.save_verification_record(record)
    storage.add_operation_log(
        record.batch_id, "operation_review", operator,
        sample_id=record.sample_id,
        details={"old_status": old_status, "new_status": new_status, "approve": approve, "comment": comment}
    )

    return record


def attach_manual_judgement(
    record_id: str,
    judgement: ManualJudgement,
    operator: str
) -> VerificationRecord:
    record = storage.get_verification_record_by_id(record_id)
    if not record:
        raise ValueError(f"Record not found: {record_id}")

    old_status = record.status
    record.manual_judgement = judgement

    if record.conflict_type == ConflictType.MODEL_VERSION_CHANGED_SAME_SAMPLE:
        if record.status in [VerificationStatus.IMPORTED, VerificationStatus.MODEL_VERSION_CONFLICT]:
            new_status = VerificationStatus.PENDING_AI_PM_REVIEW
            comment = "已关联人工改判表，等待AI产品经理阿宁补看"
            record.add_status_history(old_status, new_status, operator, comment)
            record.status = new_status
    elif record.status == VerificationStatus.IMPORTED:
        new_status = VerificationStatus.PENDING_AI_PM_REVIEW
        comment = "已关联人工改判表，等待AI产品经理复核"
        record.add_status_history(old_status, new_status, operator, comment)
        record.status = new_status

    storage.save_verification_record(record)
    storage.add_operation_log(
        record.batch_id, "attach_manual_judgement", operator,
        sample_id=record.sample_id,
        details={"judge_row_number": judgement.judge_row_number, "is_correct": judgement.is_correct}
    )

    return record


def mark_review_page_updated(
    record_id: str,
    operator: str,
    comment: str = ""
) -> VerificationRecord:
    record = storage.get_verification_record_by_id(record_id)
    if not record:
        raise ValueError(f"Record not found: {record_id}")

    valid_statuses = [
        VerificationStatus.AI_PM_REVIEWED,
        VerificationStatus.OPERATION_APPROVED,
        VerificationStatus.OPERATION_REJECTED
    ]
    if record.status not in valid_statuses:
        raise ValueError(f"Invalid status for review page update: {record.status}")

    old_status = record.status
    new_status = VerificationStatus.COMPLETED
    status_comment = f"产品复盘页已更新: {comment}"

    record.status = new_status
    record.add_status_history(old_status, new_status, operator, status_comment)

    storage.save_verification_record(record)
    storage.add_operation_log(
        record.batch_id, "review_page_updated", operator,
        sample_id=record.sample_id,
        details={"comment": comment}
    )

    return record


def rollback_record(
    record_id: str,
    operator: str,
    reason: str = "",
    rollback_to_step: Optional[int] = None
) -> VerificationRecord:
    record = storage.get_verification_record_by_id(record_id)
    if not record:
        raise ValueError(f"Record not found: {record_id}")

    old_status = record.status
    history = record.status_history

    restored_fields = {}
    if rollback_to_step is not None and rollback_to_step > 0 and rollback_to_step <= len(history):
        target_snapshot = history[rollback_to_step - 1].get("snapshot", {})
        if target_snapshot:
            record.status = VerificationStatus(target_snapshot.get("status", old_status))
            record.conflict_type = ConflictType(target_snapshot.get("conflict_type", record.conflict_type))
            record.current_model_version = target_snapshot.get("current_model_version", record.current_model_version)
            record.previous_model_version = target_snapshot.get("previous_model_version", record.previous_model_version)
            record.ai_pm_review_comment = target_snapshot.get("ai_pm_review_comment")
            record.ai_pm_reviewed_by = target_snapshot.get("ai_pm_reviewed_by")
            record.ai_pm_reviewed_at = None
            record.operation_review_comment = target_snapshot.get("operation_review_comment")
            record.operation_reviewed_by = target_snapshot.get("operation_reviewed_by")
            record.operation_reviewed_at = None
            if not target_snapshot.get("has_manual_judgement"):
                record.manual_judgement = None
            restored_fields = target_snapshot
        new_status = record.status
    else:
        new_status = VerificationStatus.ROLLBACKED
        record.status = new_status

    record.add_status_history(
        old_status, new_status, operator,
        f"回滚到步骤{rollback_to_step if rollback_to_step else '已标记'}: {reason}",
        snapshot=record._make_snapshot()
    )

    storage.save_verification_record(record)
    storage.add_operation_log(
        record.batch_id, "rollback", operator,
        sample_id=record.sample_id,
        details={"old_status": old_status, "reason": reason, "rollback_to_step": rollback_to_step,
                 "restored_fields": restored_fields}
    )

    return record


def get_processing_explanation(record_id: str) -> Dict[str, Any]:
    record = storage.get_verification_record_by_id(record_id)
    if not record:
        return {}

    reasons = []
    decisions = []

    if record.conflict_type == ConflictType.MODEL_VERSION_CHANGED_SAME_SAMPLE:
        reasons.append(f"样本 {record.sample_id} 在历史记录中存在，模型版本从 {record.previous_model_version} 变更为 {record.current_model_version}，但样本编号未变")
        decisions.append("根据边界规则 §1.1：自动标记为 MODEL_VERSION_CONFLICT，不自动归正常，必须走人工复核流程")

    if record.manual_judgement:
        reasons.append(f"人工改判表第 {record.manual_judgement.judge_row_number} 行标记为 {'正确' if record.manual_judgement.is_correct else '不正确'}")
        if record.manual_judgement.judge_comment:
            reasons.append(f"人工改判说明: {record.manual_judgement.judge_comment}")
        decisions.append("根据边界规则 §1.2：关联人工改判表后，流转至 PENDING_AI_PM_REVIEW，等待阿宁补看")

    if record.ai_pm_reviewed_by:
        reasons.append(f"AI产品经理 {record.ai_pm_reviewed_by} 于 {record.ai_pm_reviewed_at} 给出意见: {record.ai_pm_review_comment or '无'}")
        if record.conflict_type == ConflictType.MODEL_VERSION_CHANGED_SAME_SAMPLE:
            decisions.append("AI PM 批准版本冲突 → 流转至 PENDING_OPERATION_REVIEW，增加运营复核环节")
        else:
            decisions.append("AI PM 复核通过 → 流转至第三步待产品复盘页更新")

    if record.operation_reviewed_by:
        reasons.append(f"运营复核人 {record.operation_reviewed_by} 于 {record.operation_reviewed_at} 给出意见: {record.operation_review_comment or '无'}")
        decisions.append(f"运营复核{'通过' if record.status == VerificationStatus.OPERATION_APPROVED else '驳回'} → 进入第三步")

    if record.status == VerificationStatus.COMPLETED:
        decisions.append("产品复盘页已更新 → 流程完成")
    elif record.status == VerificationStatus.ROLLBACKED:
        decisions.append("记录已被回滚")

    if record.status_history:
        last_snapshot = record.status_history[-1].get("snapshot", {})
        reasons.append(f"当前状态快照: status={last_snapshot.get('status')}, conflict={last_snapshot.get('conflict_type')}")

    return {
        "sample_id": record.sample_id,
        "record_id": record.id,
        "current_status": record.status,
        "current_status_display": get_status_display(record.status),
        "reasons": reasons,
        "decisions": decisions,
        "boundary_rules_applied": [
            "§1.1 冲突检测规则：模型版本换了但样本编号没变 → 自动标记冲突，不自动归正常",
            "§1.2 三步流程状态机：版本冲突必须经过 AI PM + 运营双重复核",
            "§1.3 回滚规则：任意状态可回滚，保留完整历史和快照"
        ] if record.conflict_type != ConflictType.NO_CONFLICT else [
            "§1.2 三步流程状态机：无冲突记录 AI PM 复核后直接进入第三步"
        ],
        "status_history_count": len(record.status_history),
        "export_consistency_note": "导出明细、页面展示、API接口均从 SQLite + engine.get_record_for_review() 读取，保证三端一致"
    }


def get_record_for_review(record_id: str) -> dict:
    record = storage.get_verification_record_by_id(record_id)
    if not record:
        return {}

    blocked_step = None
    blocked_reason = None

    if record.status == VerificationStatus.MODEL_VERSION_CONFLICT:
        blocked_step = "第一步：模型输出导入"
        blocked_reason = f"模型版本从 {record.previous_model_version} 变更为 {record.current_model_version}，但样本编号 {record.sample_id} 未变，等待AI产品经理确认"
    elif record.status == VerificationStatus.PENDING_AI_PM_REVIEW:
        blocked_step = "第二步：AI产品经理补看人工改判表"
        blocked_reason = "已导入人工改判表，等待AI产品经理阿宁复核"
    elif record.status == VerificationStatus.PENDING_OPERATION_REVIEW:
        blocked_step = "第二步后：运营复核"
        blocked_reason = f"AI产品经理已确认模型版本变更（{record.previous_model_version} → {record.current_model_version}），等待运营复核人确认"
    elif record.status == VerificationStatus.AI_PM_REVIEWED or record.status in [VerificationStatus.OPERATION_APPROVED, VerificationStatus.OPERATION_REJECTED]:
        blocked_step = "第三步：产品复盘页更新"
        blocked_reason = "复核已完成，等待产品复盘页更新"
    elif record.status == VerificationStatus.COMPLETED:
        blocked_step = None
        blocked_reason = "全部流程已完成"

    return {
        "record_id": record.id,
        "sample_id": record.sample_id,
        "batch_id": record.batch_id,
        "status": record.status,
        "status_display": get_status_display(record.status),
        "conflict_type": record.conflict_type,
        "conflict_display": get_conflict_display(record.conflict_type),
        "current_model_version": record.current_model_version,
        "previous_model_version": record.previous_model_version,
        "blocked_step": blocked_step,
        "blocked_reason": blocked_reason,
        "original_row_number": record.sample.original_row_number,
        "model_output": record.sample.model_output,
        "expected_summary": record.sample.expected_summary,
        "fact_check_result": record.sample.fact_check_result,
        "manual_judgement": record.manual_judgement.model_dump() if record.manual_judgement else None,
        "ai_pm_review": {
            "comment": record.ai_pm_review_comment,
            "reviewed_by": record.ai_pm_reviewed_by,
            "reviewed_at": record.ai_pm_reviewed_at.isoformat() if record.ai_pm_reviewed_at else None
        },
        "operation_review": {
            "comment": record.operation_review_comment,
            "reviewed_by": record.operation_reviewed_by,
            "reviewed_at": record.operation_reviewed_at.isoformat() if record.operation_reviewed_at else None
        },
        "status_history": record.status_history,
        "created_at": record.created_at.isoformat(),
        "updated_at": record.updated_at.isoformat()
    }


def get_status_display(status: VerificationStatus) -> str:
    display_map = {
        VerificationStatus.PENDING_IMPORT: "待导入",
        VerificationStatus.IMPORTED: "已导入",
        VerificationStatus.MODEL_VERSION_CONFLICT: "模型版本冲突",
        VerificationStatus.PENDING_AI_PM_REVIEW: "待AI产品经理复核",
        VerificationStatus.AI_PM_REVIEWED: "AI产品经理已复核",
        VerificationStatus.PENDING_OPERATION_REVIEW: "待运营复核",
        VerificationStatus.OPERATION_APPROVED: "运营复核通过",
        VerificationStatus.OPERATION_REJECTED: "运营复核驳回",
        VerificationStatus.PENDING_REVIEW_PAGE_UPDATE: "待复盘页更新",
        VerificationStatus.COMPLETED: "已完成",
        VerificationStatus.ROLLBACKED: "已回滚",
    }
    return display_map.get(status, status)


def get_conflict_display(conflict: ConflictType) -> str:
    display_map = {
        ConflictType.NO_CONFLICT: "无冲突",
        ConflictType.MODEL_VERSION_CHANGED_SAME_SAMPLE: "模型版本变更但样本编号不变",
        ConflictType.MANUAL_JUDGEMENT_DIFFERS: "人工改判有差异",
        ConflictType.BOTH_CONFLICT: "版本冲突+人工改判差异",
    }
    return display_map.get(conflict, conflict)
