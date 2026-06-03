import pandas as pd
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from .models import (
    SettlementBatch, SettlementRecord, HolidayNote, SupplementaryRecord,
    RecordStatus, NextOwner
)
from .validator import validate_batch, get_standard_org_name


def import_settlement_batch(
    db: Session,
    csv_path: str,
    batch_no: str,
    imported_by: str = "system",
    remark: str = ""
) -> Dict[str, Any]:
    df = pd.read_csv(csv_path, dtype=str).fillna("")
    issues = validate_batch(df)

    batch = SettlementBatch(
        batch_no=batch_no,
        import_date=datetime.now(),
        imported_by=imported_by,
        total_records=len(df),
        remark=remark,
    )
    db.add(batch)
    db.flush()

    inconsistent_count = 0

    for idx, row in df.iterrows():
        org_name = str(row.get("机构简称", "")).strip()
        card_no = str(row.get("卡号", "")).strip()
        serial_no = str(row.get("流水号", "")).strip()
        amount = str(row.get("金额", "")).strip()
        settlement_date = str(row.get("清算日期", "")).strip()
        original_org_name = str(row.get("原始机构名", "")).strip() or org_name

        std_name = get_standard_org_name(org_name)

        has_issue = any(i["serial_no"] == serial_no for i in issues)

        status = RecordStatus.ABNEED_REVIEW if has_issue else RecordStatus.PENDING_FUND_ACCOUNTING
        if has_issue:
            inconsistent_count += 1

        issue_item = next((i for i in issues if i["serial_no"] == serial_no), None)
        expected_org = issue_item["expected_org"] if issue_item else ""

        record = SettlementRecord(
            batch_id=batch.id,
            serial_no=serial_no,
            org_name=org_name,
            org_name_std=std_name,
            card_no=card_no,
            amount=amount,
            settlement_date=settlement_date,
            original_org_name=original_org_name,
            status=status,
            org_name_consistent=not has_issue,
            org_name_expected=expected_org,
        )
        db.add(record)
        db.flush()

        reason_kept = (
            f"机构简称'{org_name}'与标准库不一致，期望应为'{expected_org}'。"
            f"需财务复核人确认是否调整。暂不做自动修正，保留原始记录供核对。"
        ) if has_issue else "数据校验通过，等待基金会计确认节假日顺延情况。"

        missing_materials = "" if has_issue else "待补充节假日顺延说明"

        next_owner = NextOwner.FINANCIAL_REVIEWER if has_issue else NextOwner.FUND_ACCOUNTING_LIN

        supplementary = SupplementaryRecord(
            record_id=record.id,
            reason_kept=reason_kept,
            missing_materials=missing_materials,
            next_owner=next_owner,
            source_batch_no=batch_no,
            trace_info=f"批次[{batch_no}]导入，流水号[{serial_no}]",
            updated_by=imported_by,
        )
        db.add(supplementary)

    db.commit()

    return {
        "batch_no": batch_no,
        "total_records": len(df),
        "inconsistent_count": inconsistent_count,
        "issues": issues,
    }


def add_holiday_note(
    db: Session,
    record_id: int,
    note: str,
    reviewed_by: str = "fund_accounting_lin"
) -> Dict[str, Any]:
    record = db.query(SettlementRecord).filter(SettlementRecord.id == record_id).first()
    if not record:
        raise ValueError(f"记录不存在: {record_id}")

    existing_note = db.query(HolidayNote).filter(HolidayNote.record_id == record_id).first()
    if existing_note:
        existing_note.note = note
        existing_note.reviewed_by = reviewed_by
        existing_note.reviewed_at = datetime.now()
    else:
        holiday_note = HolidayNote(
            record_id=record_id,
            note=note,
            reviewed_by=reviewed_by,
        )
        db.add(holiday_note)

    supplementary = db.query(SupplementaryRecord).filter(
        SupplementaryRecord.record_id == record_id
    ).first()

    batch = db.query(SettlementBatch).filter(SettlementBatch.id == record.batch_id).first()

    if record.org_name_consistent:
        record.status = RecordStatus.PENDING_REVIEW
        if supplementary:
            supplementary.reason_kept = (
                f"节假日顺延说明已补录：{note}。记录完整，等待财务复核人做最终确认。"
            )
            supplementary.missing_materials = "无"
            supplementary.next_owner = NextOwner.FINANCIAL_REVIEWER
            supplementary.trace_info = (
                f"批次[{batch.batch_no if batch else ''}] → 基金会计林姐补录节假日说明 → 待财务复核"
            )
            supplementary.updated_by = reviewed_by
    else:
        record.status = RecordStatus.PENDING_REVIEW
        if supplementary:
            supplementary.reason_kept = (
                f"机构简称仍需财务复核人确认。节假日说明已补录：{note}。"
                f"当前状态：机构简称不一致待复核，节假日说明已补充。"
            )
            supplementary.missing_materials = "待财务复核人确认机构简称差异"
            supplementary.next_owner = NextOwner.FINANCIAL_REVIEWER
            supplementary.trace_info = (
                f"批次[{batch.batch_no if batch else ''}] → 机构简称不一致 → "
                f"基金会计林姐补录节假日说明 → 待财务复核"
            )
            supplementary.updated_by = reviewed_by

    db.commit()

    return {
        "record_id": record_id,
        "serial_no": record.serial_no,
        "status": record.status,
        "holiday_note": note,
    }


def update_supplementary_record(
    db: Session,
    record_id: int,
    reason_kept: Optional[str] = None,
    missing_materials: Optional[str] = None,
    next_owner: Optional[str] = None,
    updated_by: str = "system",
) -> Dict[str, Any]:
    supplementary = db.query(SupplementaryRecord).filter(
        SupplementaryRecord.record_id == record_id
    ).first()
    if not supplementary:
        raise ValueError(f"补录记录不存在: {record_id}")

    if reason_kept is not None:
        supplementary.reason_kept = reason_kept
    if missing_materials is not None:
        supplementary.missing_materials = missing_materials
    if next_owner is not None:
        supplementary.next_owner = next_owner
    supplementary.updated_by = updated_by

    db.commit()

    return {
        "record_id": record_id,
        "reason_kept": supplementary.reason_kept,
        "missing_materials": supplementary.missing_materials,
        "next_owner": supplementary.next_owner,
    }


def review_by_finance(
    db: Session,
    record_id: int,
    approved: bool,
    comment: str,
    reviewed_by: str = "financial_reviewer"
) -> Dict[str, Any]:
    record = db.query(SettlementRecord).filter(SettlementRecord.id == record_id).first()
    if not record:
        raise ValueError(f"记录不存在: {record_id}")

    supplementary = db.query(SupplementaryRecord).filter(
        SupplementaryRecord.record_id == record_id
    ).first()

    batch = db.query(SettlementBatch).filter(SettlementBatch.id == record.batch_id).first()

    if approved:
        record.status = RecordStatus.REVIEWED
        record.org_name_consistent = True
        if supplementary:
            supplementary.reason_kept = (
                f"财务复核人已确认。{comment}。记录已通过复核。"
            )
            supplementary.missing_materials = "无"
            supplementary.next_owner = "已完成"
            supplementary.trace_info = (
                f"批次[{batch.batch_no if batch else ''}] → 财务复核通过 → 完成"
            )
            supplementary.updated_by = reviewed_by
    else:
        record.status = RecordStatus.PENDING_FUND_ACCOUNTING
        if supplementary:
            supplementary.reason_kept = (
                f"财务复核人退回。原因：{comment}。需基金会计林姐重新处理。"
            )
            supplementary.missing_materials = f"需补充：{comment}"
            supplementary.next_owner = NextOwner.FUND_ACCOUNTING_LIN
            supplementary.trace_info = (
                f"批次[{batch.batch_no if batch else ''}] → 财务复核退回 → 待基金会计处理"
            )
            supplementary.updated_by = reviewed_by

    db.commit()

    return {
        "record_id": record_id,
        "serial_no": record.serial_no,
        "status": record.status,
        "approved": approved,
    }
