from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Any
import json

from . import models, schemas
from .crud import get_batch_records, get_unified_record_data
from .utils import format_date


class CheckType:
    DATA_INTEGRITY = "data_integrity"
    WORKFLOW = "workflow"
    CONSISTENCY = "consistency"


def run_self_check(db: Session, batch_id: int) -> schemas.SelfCheckReport:
    results = []

    results.append(check_duplicate_imports(db, batch_id))
    results.append(check_pinyin_approvals(db, batch_id))
    results.append(check_recalculation_after_update(db, batch_id))
    results.append(check_export_consistency(db, batch_id))
    results.append(check_audit_trail(db, batch_id))
    results.append(check_settlement_date_consistency(db, batch_id))

    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed

    report = schemas.SelfCheckReport(
        batch_id=batch_id,
        total_checks=len(results),
        passed_checks=passed,
        failed_checks=failed,
        results=results,
        generated_at=datetime.now()
    )

    return report


def check_duplicate_imports(db: Session, batch_id: int) -> schemas.SelfCheckResult:
    records = get_batch_records(db, batch_id)
    duplicates = [r for r in records if r.is_duplicate]

    affected_ids = [str(r.id) for r in duplicates]
    details = []
    for dup in duplicates:
        details.append(
            f"记录ID {dup.id} (行号 {dup.original_line_number}) "
            f"与记录ID {dup.duplicate_of_id} 重复"
        )

    result_base = schemas.SelfCheckResultBase(
        check_type=CheckType.DATA_INTEGRITY,
        check_name="重复导入检测",
        passed=len(duplicates) == 0,
        message=f"检测到 {len(duplicates)} 条重复记录" if duplicates else "无重复记录",
        details="\n".join(details) if details else None,
        affected_record_ids=",".join(affected_ids) if affected_ids else None
    )

    db_result = save_check_result(db, result_base, batch_id)
    return schemas.SelfCheckResult.model_validate(db_result)


def check_pinyin_approvals(db: Session, batch_id: int) -> schemas.SelfCheckResult:
    records = get_batch_records(db, batch_id)
    pinyin_records = [r for r in records if r.approval_name_is_pinyin]

    affected_ids = [str(r.id) for r in pinyin_records]
    details = []
    for r in pinyin_records:
        status = "待客户经理复核" if r.needs_manager_review else "已复核" if r.manager_reviewed else "待处理"
        details.append(
            f"记录ID {r.id} (行号 {r.original_line_number}) "
            f"审批人: '{r.approval_name}' - {status}"
        )

    unreviewed = [r for r in pinyin_records if r.needs_manager_review]

    result_base = schemas.SelfCheckResultBase(
        check_type=CheckType.DATA_INTEGRITY,
        check_name="审批人拼音检测",
        passed=len(unreviewed) == 0,
        message=f"检测到 {len(pinyin_records)} 条审批人疑似拼音记录，"
                f"其中 {len(unreviewed)} 条待客户经理复核" if pinyin_records else "无审批人拼音问题",
        details="\n".join(details) if details else None,
        affected_record_ids=",".join(affected_ids) if affected_ids else None
    )

    db_result = save_check_result(db, result_base, batch_id)
    return schemas.SelfCheckResult.model_validate(db_result)


def check_recalculation_after_update(db: Session, batch_id: int) -> schemas.SelfCheckResult:
    records = get_batch_records(db, batch_id)
    modified_records = [r for r in records if r.manually_modified]

    issues = []
    affected_ids = []

    for r in modified_records:
        expected_final = r.trail_commission_amount * r.split_ratio
        if abs(r.final_amount - expected_final) > 0.01:
            issues.append(
                f"记录ID {r.id} (行号 {r.original_line_number}) "
                f"金额不一致: 实际 {r.final_amount:.2f}, 应为 {expected_final:.2f}"
            )
            affected_ids.append(str(r.id))

    result_base = schemas.SelfCheckResultBase(
        check_type=CheckType.CONSISTENCY,
        check_name="补录后重算验证",
        passed=len(issues) == 0,
        message=f"检测到 {len(issues)} 条补录后未正确重算的记录" if issues else "所有补录记录均已正确重算",
        details="\n".join(issues) if issues else None,
        affected_record_ids=",".join(affected_ids) if affected_ids else None
    )

    db_result = save_check_result(db, result_base, batch_id)
    return schemas.SelfCheckResult.model_validate(db_result)


def check_export_consistency(db: Session, batch_id: int) -> schemas.SelfCheckResult:
    unified_data = get_unified_record_data(db, batch_id)

    issues = []
    affected_ids = []

    for record_dict in unified_data:
        record_id = record_dict["id"]
        has_pinyin = record_dict["approval_name_is_pinyin"]
        needs_review = record_dict["needs_manager_review"]

        if has_pinyin and not record_dict["approval_name"]:
            issues.append(
                f"记录ID {record_id}: 审批人拼音标记但名称丢失"
            )
            affected_ids.append(str(record_id))

        if needs_review and record_dict["status"] != models.ProcessingStatus.NEEDS_MANAGER_REVIEW:
            issues.append(
                f"记录ID {record_id}: 待复核状态不一致: 标记待复核但状态为 {record_dict['status']}"
            )
            affected_ids.append(str(record_id))

    result_base = schemas.SelfCheckResultBase(
        check_type=CheckType.CONSISTENCY,
        check_name="导出一致性检查",
        passed=len(issues) == 0,
        message=f"检测到 {len(issues)} 处数据不一致问题" if issues else "数据导出、页面、接口数据一致",
        details="\n".join(issues) if issues else None,
        affected_record_ids=",".join(affected_ids) if affected_ids else None
    )

    db_result = save_check_result(db, result_base, batch_id)
    return schemas.SelfCheckResult.model_validate(db_result)


def check_audit_trail(db: Session, batch_id: int) -> schemas.SelfCheckResult:
    records = get_batch_records(db, batch_id)
    issues = []
    affected_ids = []

    for r in records:
        if r.manually_modified and not r.audit_logs:
            issues.append(
                f"记录ID {r.id} (行号 {r.original_line_number}) "
                f"有修改但无审计日志"
            )
            affected_ids.append(str(r.id))

        if r.approval_name_is_pinyin:
            has_pinyin_log = any(
                log.action == "pinyin_detected" for log in r.audit_logs
            )
            if not has_pinyin_log:
                issues.append(
                    f"记录ID {r.id} (行号 {r.original_line_number}) "
                    f"审批人为拼音但无检测日志"
                )
                affected_ids.append(str(r.id))

    result_base = schemas.SelfCheckResultBase(
        check_type=CheckType.DATA_INTEGRITY,
        check_name="审计追踪完整性",
        passed=len(issues) == 0,
        message=f"检测到 {len(issues)} 条审计追踪缺失问题" if issues else "所有记录审计追踪完整",
        details="\n".join(issues) if issues else None,
        affected_record_ids=",".join(affected_ids) if affected_ids else None
    )

    db_result = save_check_result(db, result_base, batch_id)
    return schemas.SelfCheckResult.model_validate(db_result)


def check_settlement_date_consistency(db: Session, batch_id: int) -> schemas.SelfCheckResult:
    records = get_batch_records(db, batch_id)
    batch = db.query(models.ClearingBatch).filter(
        models.ClearingBatch.id == batch_id
    ).first()

    issues = []
    affected_ids = []

    for r in records:
        if r.settlement_date != r.original_settlement_date:
            if not batch or not batch.holiday_reviewed:
                issues.append(
                    f"记录ID {r.id} (行号 {r.original_line_number}) "
                    f"清算日期已调整但节假日顺延说明未补看"
                )
                affected_ids.append(str(r.id))

    result_base = schemas.SelfCheckResultBase(
        check_type=CheckType.WORKFLOW,
        check_name="节假日顺延审核",
        passed=len(issues) == 0,
        message=f"检测到 {len(issues)} 条日期调整未经过风控审核" if issues else "所有日期调整均已审核",
        details="\n".join(issues) if issues else None,
        affected_record_ids=",".join(affected_ids) if affected_ids else None
    )

    db_result = save_check_result(db, result_base, batch_id)
    return schemas.SelfCheckResult.model_validate(db_result)


def save_check_result(
    db: Session,
    result: schemas.SelfCheckResultBase,
    batch_id: int
) -> models.SelfCheckResult:
    db_result = models.SelfCheckResult(
        check_type=result.check_type,
        check_name=result.check_name,
        passed=result.passed,
        message=result.message,
        details=result.details,
        affected_record_ids=result.affected_record_ids,
        batch_id=batch_id
    )
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    return db_result


def get_check_history(db: Session, batch_id: int) -> List[models.SelfCheckResult]:
    return db.query(models.SelfCheckResult).filter(
        models.SelfCheckResult.batch_id == batch_id
    ).order_by(models.SelfCheckResult.checked_at.desc()).all()
