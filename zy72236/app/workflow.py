from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd
import io

from . import models, schemas
from .crud import (
    create_clearing_batch, create_commission_record, check_duplicates,
    get_batch, get_batch_records, recalculate_after_update
)
from .utils import parse_date, safe_str, safe_float


class WorkflowSteps:
    STEP_1_IMPORT = "导入清算批次号"
    STEP_2_HOLIDAY_REVIEW = "风控补看节假日顺延说明"
    STEP_3_BALANCE_UPDATE = "余额变化表更新"
    TOTAL_STEPS = 3


def import_clearing_batch(
    db: Session,
    batch_number: str,
    excel_content: bytes,
    imported_by: str = "system"
) -> schemas.ImportResult:
    batch_create = schemas.ClearingBatchCreate(
        batch_number=batch_number,
        imported_by=imported_by
    )
    batch = create_clearing_batch(db, batch_create)

    df = pd.read_excel(io.BytesIO(excel_content))

    pinyin_count = 0
    total_amount = 0.0

    for idx, row in df.iterrows():
        original_line_number = idx + 2
        record_data = {
            'fund_code': safe_str(row.get('基金代码') or row.get('fund_code')),
            'fund_name': safe_str(row.get('基金名称') or row.get('fund_name')),
            'customer_account': safe_str(row.get('客户账号') or row.get('customer_account')),
            'customer_name': safe_str(row.get('客户姓名') or row.get('customer_name')),
            'manager_name': safe_str(row.get('客户经理') or row.get('manager_name')),
            'manager_code': safe_str(row.get('客户经理代码') or row.get('manager_code')),
            'approval_name': safe_str(row.get('审批人') or row.get('approval_name')),
            'transaction_date': parse_date(row.get('交易日期') or row.get('transaction_date')),
            'settlement_date': parse_date(row.get('清算日期') or row.get('settlement_date')),
            'transaction_amount': safe_float(row.get('交易金额') or row.get('transaction_amount')),
            'commission_rate': safe_float(row.get('佣金率') or row.get('commission_rate', 0.005)),
            'commission_amount': safe_float(row.get('佣金金额') or row.get('commission_amount')),
            'trail_commission_amount': safe_float(row.get('尾佣金额') or row.get('trail_commission_amount')),
            'split_ratio': safe_float(row.get('拆分比例') or row.get('split_ratio', 1.0)),
            'final_amount': safe_float(row.get('最终金额') or row.get('final_amount'))
        }

        record = create_commission_record(
            db, batch.id, record_data, original_line_number, imported_by
        )

        if record.approval_name_is_pinyin:
            pinyin_count += 1
        if not record.is_duplicate:
            total_amount += record.final_amount

    duplicates = check_duplicates(db, batch.id)

    batch.record_count = len(df)
    batch.total_amount = total_amount
    batch.status = models.ProcessingStatus.IMPORTED
    db.commit()
    db.refresh(batch)

    needs_review_count = pinyin_count + len(duplicates)

    return schemas.ImportResult(
        batch_id=batch.id,
        batch_number=batch_number,
        total_records=len(df),
        duplicate_count=len(duplicates),
        pinyin_approval_count=pinyin_count,
        needs_review_count=needs_review_count,
        message=f"成功导入 {len(df)} 条记录。"
                f"检测到 {len(duplicates)} 条重复，"
                f"{pinyin_count} 条审批人拼音待复核，"
                f"共 {needs_review_count} 条需处理。"
    )


def review_holiday_adjustment(
    db: Session,
    batch_id: int,
    reviewed_by: str = "老秦",
    adjustments: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    batch = get_batch(db, batch_id)
    if not batch:
        return {"success": False, "message": "批次不存在"}

    records = get_batch_records(db, batch_id)
    adjusted_count = 0

    if adjustments:
        for adj in adjustments:
            original_date = parse_date(adj.get('original_date'))
            adjusted_date = parse_date(adj.get('adjusted_date'))
            reason = safe_str(adj.get('reason'))

            if original_date and adjusted_date:
                for record in records:
                    if record.settlement_date and record.settlement_date.date() == original_date.date():
                        old_date = record.settlement_date
                        record.settlement_date = adjusted_date
                        record.source_type = models.SourceType.HOLIDAY_ADJUSTMENT
                        record.manually_modified = True
                        adjusted_count += 1

                        db_audit = models.AuditLog(
                            batch_id=batch_id,
                            record_id=record.id,
                            action="holiday_adjustment",
                            field_name="settlement_date",
                            old_value=str(old_date),
                            new_value=str(adjusted_date),
                            performed_by=reviewed_by,
                            notes=f"节假日顺延调整: {reason}"
                        )
                        db.add(db_audit)

                db_holiday = models.HolidayAdjustment(
                    original_date=original_date,
                    adjusted_date=adjusted_date,
                    reason=reason,
                    reviewed_by=reviewed_by,
                    affected_batch_numbers=batch.batch_number
                )
                db.add(db_holiday)

    recalc_result = recalculate_after_update(db, batch_id, reviewed_by)

    batch.holiday_reviewed = True
    batch.holiday_reviewed_by = reviewed_by
    batch.holiday_reviewed_at = datetime.now()
    batch.status = models.ProcessingStatus.HOLIDAY_ADJUSTED
    batch.notes = f"节假日顺延审核已完成，调整 {adjusted_count} 条记录日期"

    db_audit_batch = models.AuditLog(
        batch_id=batch_id,
        action="holiday_review_completed",
        performed_by=reviewed_by,
        notes=f"风控{reviewed_by}已补看节假日顺延说明，调整{adjusted_count}条记录"
    )
    db.add(db_audit_batch)
    db.commit()
    db.refresh(batch)

    return {
        "success": True,
        "batch_id": batch_id,
        "batch_number": batch.batch_number,
        "adjusted_count": adjusted_count,
        "recalculated_count": recalc_result.get("recalculated_count", 0),
        "new_total": recalc_result.get("new_total", 0),
        "message": f"节假日顺延审核完成，调整 {adjusted_count} 条记录，重算 {recalc_result.get('recalculated_count', 0)} 条金额"
    }


def get_workflow_status(db: Session, batch_id: int) -> schemas.WorkflowStatus:
    batch = get_batch(db, batch_id)
    if not batch:
        return schemas.WorkflowStatus(
            batch_id=batch_id,
            batch_number="未知",
            current_step=0,
            total_steps=WorkflowSteps.TOTAL_STEPS,
            steps=[],
            overall_status="not_found"
        )

    steps = []
    current_step = 0

    step1_completed = batch.import_date is not None
    if step1_completed:
        current_step = 1

    steps.append(schemas.WorkflowStep(
        step_name=WorkflowSteps.STEP_1_IMPORT,
        status="completed" if step1_completed else "pending",
        completed_at=batch.import_date if step1_completed else None,
        performed_by=batch.imported_by if step1_completed else None,
        notes=f"导入 {batch.record_count} 条记录" if step1_completed else None
    ))

    step2_completed = batch.holiday_reviewed
    if step2_completed and current_step == 1:
        current_step = 2

    steps.append(schemas.WorkflowStep(
        step_name=WorkflowSteps.STEP_2_HOLIDAY_REVIEW,
        status="completed" if step2_completed else "pending",
        completed_at=batch.holiday_reviewed_at if step2_completed else None,
        performed_by=batch.holiday_reviewed_by if step2_completed else None,
        notes=batch.notes if step2_completed else None
    ))

    records = get_batch_records(db, batch_id)
    balance_updated_count = sum(1 for r in records if r.balance_updated)
    step3_completed = balance_updated_count > 0 and all(
        not r.needs_manager_review for r in records if not r.is_duplicate
    )
    if step3_completed and current_step == 2:
        current_step = 3

    steps.append(schemas.WorkflowStep(
        step_name=WorkflowSteps.STEP_3_BALANCE_UPDATE,
        status="completed" if step3_completed else ("in_progress" if balance_updated_count > 0 else "pending"),
        completed_at=None,
        performed_by=None,
        notes=f"已更新 {balance_updated_count}/{len(records)} 条记录余额" if balance_updated_count > 0 else None
    ))

    overall_status = "pending"
    if current_step == 3 and step3_completed:
        overall_status = "completed"
    elif current_step > 0:
        overall_status = "in_progress"

    pending_review = sum(1 for r in records if r.needs_manager_review)
    if pending_review > 0:
        overall_status = "needs_manager_review"

    return schemas.WorkflowStatus(
        batch_id=batch_id,
        batch_number=batch.batch_number,
        current_step=current_step,
        total_steps=WorkflowSteps.TOTAL_STEPS,
        steps=steps,
        overall_status=overall_status
    )


def can_proceed_to_balance_update(db: Session, batch_id: int) -> Dict[str, Any]:
    batch = get_batch(db, batch_id)
    if not batch:
        return {"can_proceed": False, "reason": "批次不存在"}

    if not batch.holiday_reviewed:
        return {"can_proceed": False, "reason": "节假日顺延说明未审核，请先完成第二步"}

    records = get_batch_records(db, batch_id)
    pending_review = [r for r in records if r.needs_manager_review and not r.is_duplicate]
    unresolved_duplicates = [r for r in records if r.is_duplicate and not r.duplicate_resolved]

    issues = []
    if pending_review:
        issues.append(f"{len(pending_review)} 条记录待客户经理复核（审批人拼音）")
    if unresolved_duplicates:
        issues.append(f"{len(unresolved_duplicates)} 条重复记录待处理")

    can_proceed = len(issues) == 0

    return {
        "can_proceed": can_proceed,
        "issues": issues,
        "pending_review_count": len(pending_review),
        "duplicate_count": len(unresolved_duplicates)
    }
