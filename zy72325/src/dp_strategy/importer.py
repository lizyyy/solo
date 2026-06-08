import hashlib
import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from sqlalchemy.orm import Session

from .models import (
    SessionLocal,
    FormulaScreenshot,
    FormulaHistory,
    ReviewRecord,
    BatchImport,
    RecordStatus,
    ChangeType,
    AbnormalType,
)
from .normalizer import (
    detect_columns,
    normalize_row,
    record_to_dict,
    record_summary,
    record_detail,
    batch_summary,
    record_export_row,
)
from .boundary_rules import BoundaryRuleEngine


def calculate_file_hash(file_path: str) -> str:
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def generate_batch_id() -> str:
    import uuid
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    suffix = uuid.uuid4().hex[:6]
    return f"batch_{ts}_{suffix}"


def check_duplicate_import(session: Session, file_hash: str) -> Optional[BatchImport]:
    return (
        session.query(BatchImport)
        .filter_by(file_hash=file_hash, is_rollbacked=False)
        .first()
    )


def create_history_record(
    session: Session,
    screenshot: FormulaScreenshot,
    change_type: ChangeType,
    before_data: Dict[str, Any],
    after_data: Dict[str, Any],
    changed_by: str = "system",
    change_reason: str = "",
) -> FormulaHistory:
    diff_fields = []
    for key in set(before_data.keys()) | set(after_data.keys()):
        bv = before_data.get(key)
        av = after_data.get(key)
        if isinstance(bv, float) and isinstance(av, float):
            if abs(bv - av) > 1e-9:
                diff_fields.append(key)
        elif bv != av:
            diff_fields.append(key)

    history = FormulaHistory(
        screenshot_id=screenshot.id,
        version=screenshot.current_version,
        change_type=change_type.value,
        changed_by=changed_by,
        change_reason=change_reason,
        before_data=before_data,
        after_data=after_data,
        diff_fields=sorted(diff_fields),
    )
    session.add(history)
    return history


def _apply_boundary_rules(
    engine: BoundaryRuleEngine,
    screenshot: FormulaScreenshot,
    original_row_number: int,
) -> Tuple[str, str, str, List[Dict[str, Any]]]:
    status = RecordStatus.PENDING.value
    abnormal_type: Optional[str] = None
    abnormal_note_parts: List[str] = []
    triggered_rules: List[Dict[str, Any]] = []

    applied = engine.process_record(screenshot)
    triggered_rules.extend(applied)

    denom = screenshot.denominator_value if screenshot.denominator_value is not None else 0.0
    numer = screenshot.numerator_value if screenshot.numerator_value is not None else 0.0
    res = screenshot.result_value if screenshot.result_value is not None else ""
    res_clean = res.strip() if isinstance(res, str) else ""

    is_zero_denom = abs(denom - 0.0) < 1e-9
    is_empty_result = res_clean == "" or res_clean.lower() == "nan"
    is_zero_result = res_clean in ("0", "0.0", "0.00")

    if is_zero_denom and is_empty_result:
        status = RecordStatus.ABNORMAL.value
        abnormal_type = AbnormalType.ZERO_DENOMINATOR_EMPTY_RESULT.value
        abnormal_note_parts.append(
            f"分母为0但结果被填空字符串，原始行号: {original_row_number}"
        )
    elif is_zero_denom and is_zero_result:
        status = RecordStatus.ABNORMAL.value
        abnormal_type = AbnormalType.ZERO_DENOMINATOR.value
        abnormal_note_parts.append(
            f"分母为0但结果被填0，原始行号: {original_row_number}"
        )
    elif is_zero_denom:
        status = RecordStatus.ABNORMAL.value
        abnormal_type = AbnormalType.ZERO_DENOMINATOR.value
        abnormal_note_parts.append(
            f"分母为0，原始行号: {original_row_number}"
        )
    elif is_empty_result:
        status = RecordStatus.ABNORMAL.value
        abnormal_type = AbnormalType.EMPTY_STRING.value
        abnormal_note_parts.append(
            f"结果为空字符串，原始行号: {original_row_number}"
        )

    return (
        status,
        abnormal_type or screenshot.abnormal_type,
        " | ".join(filter(None, [screenshot.abnormal_note or ""] + abnormal_note_parts)),
        triggered_rules,
    )


def _refresh_batch_counts(session: Session, batch_id: str) -> BatchImport:
    batch = session.query(BatchImport).filter_by(batch_id=batch_id).first()
    if not batch:
        raise ValueError(f"批次不存在: {batch_id}")

    q = session.query(FormulaScreenshot).filter_by(batch_id=batch_id)
    all_records = q.all()

    batch.total_records = len(all_records)
    batch.success_count = sum(
        1 for r in all_records if r.status != RecordStatus.ROLLBACKED.value
    )
    batch.abnormal_count = sum(
        1 for r in all_records if r.status == RecordStatus.ABNORMAL.value
    )
    batch.pending_count = sum(
        1 for r in all_records if r.status == RecordStatus.PENDING.value
    )
    batch.reviewing_count = sum(
        1 for r in all_records if r.status == RecordStatus.REVIEWING.value
    )
    batch.approved_count = sum(
        1 for r in all_records if r.status == RecordStatus.APPROVED.value
    )
    batch.rejected_count = sum(
        1 for r in all_records if r.status == RecordStatus.REJECTED.value
    )
    batch.rollbacked_count = sum(
        1 for r in all_records if r.status == RecordStatus.ROLLBACKED.value
    )

    session.add(batch)
    session.flush()
    return batch


def import_formula_screenshots(
    file_path: str,
    imported_by: str = "阿兰",
    sheet_name: Optional[str] = None,
) -> Dict[str, Any]:
    session = SessionLocal()
    try:
        if not os.path.exists(file_path):
            return {"success": False, "message": f"文件不存在: {file_path}"}

        file_hash = calculate_file_hash(file_path)
        duplicate = check_duplicate_import(session, file_hash)
        if duplicate:
            return {
                "success": False,
                "message": f"文件已存在，重复导入被阻止。原导入批次: {duplicate.batch_id}",
                "existing_batch": duplicate.batch_id,
                "batch_summary": batch_summary(duplicate),
            }

        source_format = "csv"
        if file_path.endswith(".csv"):
            df = pd.read_csv(file_path, dtype=str, keep_default_na=False, na_values=[""])
            source_format = "csv"
        elif file_path.endswith((".xlsx", ".xls")):
            df = pd.read_excel(file_path, sheet_name=sheet_name, dtype=str)
            source_format = "excel"
        else:
            raise ValueError(f"不支持的文件格式: {file_path}")

        batch_id = generate_batch_id()
        col_mapping = detect_columns(list(df.columns))

        total_records = len(df)
        success_count = 0
        abnormal_count = 0

        rule_engine = BoundaryRuleEngine()

        screenshot_objs: List[FormulaScreenshot] = []
        for idx, row in df.iterrows():
            original_row_number = idx + 2
            norm = normalize_row(row, col_mapping)

            screenshot = FormulaScreenshot(
                batch_id=batch_id,
                original_row_number=original_row_number,
                source_file=file_path,
                source_format=source_format,
                imported_by=imported_by,
                sku_code=norm["sku_code"],
                product_name=norm["product_name"],
                formula_expression=norm["formula_expression"],
                denominator_value=float(norm["denominator_value"]),
                numerator_value=float(norm["numerator_value"]),
                result_value=norm["result_value"],
                original_result=norm["result_value"],
                current_version=1,
                is_latest=True,
            )

            (
                status,
                abnormal_type,
                abnormal_note,
                triggered_rules,
            ) = _apply_boundary_rules(rule_engine, screenshot, original_row_number)
            screenshot.status = status
            screenshot.abnormal_type = abnormal_type
            screenshot.abnormal_note = abnormal_note
            screenshot.boundary_rules_triggered = triggered_rules or None

            if screenshot.original_statement is None and status == RecordStatus.ABNORMAL.value:
                original_result_display = screenshot.original_result or "(空字符串)"
                denom_display = screenshot.denominator_value
                screenshot.original_statement = (
                    f"原始说法(行号{original_row_number}): "
                    f"分母={denom_display}, 结果='{original_result_display}'"
                )

            session.add(screenshot)
            session.flush()

            before_data = {}
            after_data = record_to_dict(screenshot)
            create_history_record(
                session,
                screenshot,
                ChangeType.IMPORT,
                before_data,
                after_data,
                changed_by=imported_by,
                change_reason="首次导入旧公式截图",
            )
            screenshot_objs.append(screenshot)
            success_count += 1
            if screenshot.status == RecordStatus.ABNORMAL.value:
                abnormal_count += 1

        batch_import = BatchImport(
            batch_id=batch_id,
            source_file=file_path,
            source_format=source_format,
            file_hash=file_hash,
            imported_by=imported_by,
            total_records=total_records,
            success_count=success_count,
            abnormal_count=abnormal_count,
        )
        session.add(batch_import)
        session.flush()
        batch_import = _refresh_batch_counts(session, batch_id)
        session.commit()

        return {
            "success": True,
            "batch_id": batch_id,
            "total_records": total_records,
            "success_count": success_count,
            "abnormal_count": abnormal_count,
            "batch_summary": batch_summary(batch_import),
            "abnormal_records": [record_summary(r) for r in screenshot_objs if r.status == RecordStatus.ABNORMAL.value],
            "message": f"导入成功: {success_count}条, 异常: {abnormal_count}条",
        }

    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def manual_edit_record(
    screenshot_id: int,
    field_name: str,
    new_value: Any,
    edited_by: str,
    change_reason: str,
) -> Dict[str, Any]:
    session = SessionLocal()
    try:
        screenshot = (
            session.query(FormulaScreenshot).filter_by(id=screenshot_id).first()
        )
        if not screenshot:
            return {"success": False, "message": f"记录不存在: {screenshot_id}"}

        before_data = record_to_dict(screenshot)
        old_value = getattr(screenshot, field_name, None)

        if isinstance(old_value, float) and isinstance(new_value, (int, float)):
            no_change = abs(float(old_value) - float(new_value)) < 1e-9
        else:
            no_change = old_value == new_value

        if no_change:
            return {
                "success": False,
                "message": "值未变化，无需更新",
                "old_value": old_value,
                "new_value": new_value,
                "latest_record": record_summary(screenshot),
            }

        setattr(screenshot, field_name, new_value)
        screenshot.current_version += 1

        after_data = record_to_dict(screenshot)

        create_history_record(
            session,
            screenshot,
            ChangeType.MANUAL_EDIT,
            before_data,
            after_data,
            changed_by=edited_by,
            change_reason=change_reason,
        )

        batch = _refresh_batch_counts(session, screenshot.batch_id)
        session.commit()

        return {
            "success": True,
            "screenshot_id": screenshot_id,
            "field": field_name,
            "old_value": old_value,
            "new_value": new_value,
            "new_version": screenshot.current_version,
            "latest_record": record_summary(screenshot),
            "batch_summary": batch_summary(batch),
            "message": "更新成功",
        }

    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def submit_review(
    screenshot_id: int,
    reviewer: str,
    review_decision: str,
    review_comment: str = "",
    original_statement: Optional[str] = None,
    corrected_value: Optional[str] = None,
    review_reason: Optional[str] = None,
    next_handler: Optional[str] = None,
) -> Dict[str, Any]:
    session = SessionLocal()
    try:
        screenshot = (
            session.query(FormulaScreenshot).filter_by(id=screenshot_id).first()
        )
        if not screenshot:
            return {"success": False, "message": f"记录不存在: {screenshot_id}"}

        before_data = record_to_dict(screenshot)

        review = ReviewRecord(
            screenshot_id=screenshot_id,
            reviewer=reviewer,
            review_comment=review_comment,
            review_decision=review_decision,
            original_statement=original_statement or screenshot.original_statement,
            corrected_value=corrected_value,
            review_reason=review_reason,
            next_handler=next_handler,
        )
        session.add(review)

        screenshot.reviewed_by = reviewer
        screenshot.reviewed_at = datetime.now()
        screenshot.review_decision = review_decision
        screenshot.review_decision_detail = review_comment

        if original_statement is not None:
            screenshot.original_statement = original_statement
        if corrected_value is not None:
            screenshot.corrected_value = corrected_value
        if review_reason is not None:
            screenshot.review_reason = review_reason
        if next_handler is not None:
            screenshot.next_handler = next_handler

        if review_decision == "approve_as_is":
            new_status = RecordStatus.APPROVED.value
        elif review_decision == "approve_with_correction":
            new_status = RecordStatus.APPROVED.value
            if corrected_value is not None:
                screenshot.result_value = corrected_value
        elif review_decision == "reject_need_rework":
            new_status = RecordStatus.REJECTED.value
        elif review_decision == "escalate":
            new_status = RecordStatus.REVIEWING.value
        else:
            new_status = RecordStatus.REVIEWING.value

        screenshot.status = new_status
        screenshot.current_version += 1

        after_data = record_to_dict(screenshot)

        create_history_record(
            session,
            screenshot,
            ChangeType.REVIEW_ACTION,
            before_data,
            after_data,
            changed_by=reviewer,
            change_reason=review_comment or f"复核操作: {review_decision}",
        )

        batch = _refresh_batch_counts(session, screenshot.batch_id)
        session.commit()

        return {
            "success": True,
            "screenshot_id": screenshot_id,
            "review_decision": review_decision,
            "new_status": new_status,
            "latest_record": record_summary(screenshot),
            "record_detail": record_detail(screenshot),
            "batch_summary": batch_summary(batch),
            "message": "复核提交成功",
        }

    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def get_record_history(screenshot_id: int) -> List[Dict[str, Any]]:
    session = SessionLocal()
    try:
        histories = (
            session.query(FormulaHistory)
            .filter_by(screenshot_id=screenshot_id)
            .order_by(FormulaHistory.version)
            .all()
        )
        return [
            {
                "version": h.version,
                "change_type": h.change_type,
                "change_time": h.change_time.isoformat(),
                "changed_by": h.changed_by,
                "change_reason": h.change_reason,
                "diff_fields": h.diff_fields,
                "before_data": h.before_data,
                "after_data": h.after_data,
            }
            for h in histories
        ]
    finally:
        session.close()


def compare_versions(
    screenshot_id: int, version1: int, version2: int
) -> Dict[str, Any]:
    session = SessionLocal()
    try:
        h1 = (
            session.query(FormulaHistory)
            .filter_by(screenshot_id=screenshot_id, version=version1)
            .first()
        )
        h2 = (
            session.query(FormulaHistory)
            .filter_by(screenshot_id=screenshot_id, version=version2)
            .first()
        )

        if not h1 or not h2:
            return {"success": False, "message": "版本不存在"}

        diff = {}
        all_keys = sorted(set((h1.after_data or {}).keys()) | set((h2.after_data or {}).keys()))
        for key in all_keys:
            v1 = (h1.after_data or {}).get(key)
            v2 = (h2.after_data or {}).get(key)
            if isinstance(v1, float) and isinstance(v2, float):
                if abs(v1 - v2) > 1e-9:
                    diff[key] = {"version1": v1, "version2": v2}
            elif v1 != v2:
                diff[key] = {"version1": v1, "version2": v2}

        return {
            "success": True,
            "screenshot_id": screenshot_id,
            "version1": version1,
            "version2": version2,
            "diff": diff,
        }
    finally:
        session.close()


def get_record_detail(screenshot_id: int) -> Dict[str, Any]:
    session = SessionLocal()
    try:
        screenshot = (
            session.query(FormulaScreenshot).filter_by(id=screenshot_id).first()
        )
        if not screenshot:
            return {"success": False, "message": f"记录不存在: {screenshot_id}"}
        return {
            "success": True,
            "screenshot": record_detail(screenshot),
        }
    finally:
        session.close()


def get_abnormal_records(batch_id: Optional[str] = None) -> List[Dict[str, Any]]:
    session = SessionLocal()
    try:
        query = session.query(FormulaScreenshot).filter_by(
            status=RecordStatus.ABNORMAL.value
        )
        if batch_id:
            query = query.filter_by(batch_id=batch_id)

        records = query.order_by(FormulaScreenshot.original_row_number).all()
        return [record_detail(r) for r in records]
    finally:
        session.close()


def list_records(
    batch_id: Optional[str] = None,
    status: Optional[str] = None,
    abnormal_type: Optional[str] = None,
) -> Dict[str, Any]:
    session = SessionLocal()
    try:
        query = session.query(FormulaScreenshot)
        if batch_id:
            query = query.filter_by(batch_id=batch_id)
        if status:
            query = query.filter_by(status=status)
        if abnormal_type:
            query = query.filter_by(abnormal_type=abnormal_type)

        records = query.order_by(FormulaScreenshot.original_row_number).all()

        batches = set(r.batch_id for r in records)
        batch_summaries = []
        for bid in batches:
            b = session.query(BatchImport).filter_by(batch_id=bid).first()
            if b:
                batch_summaries.append(batch_summary(b))

        return {
            "total": len(records),
            "records": [record_summary(r) for r in records],
            "batch_summaries": batch_summaries,
        }
    finally:
        session.close()


def export_records(
    output_path: str,
    batch_id: Optional[str] = None,
    status: Optional[str] = None,
    format: str = "xlsx",
) -> Dict[str, Any]:
    session = SessionLocal()
    try:
        query = session.query(FormulaScreenshot)
        if batch_id:
            query = query.filter_by(batch_id=batch_id)
        if status:
            query = query.filter_by(status=status)

        records = query.order_by(
            FormulaScreenshot.batch_id, FormulaScreenshot.original_row_number
        ).all()

        rows = [record_export_row(r) for r in records]
        df = pd.DataFrame(rows)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        if format == "csv":
            if not output_path.endswith(".csv"):
                output_path += ".csv"
            df.to_csv(output_path, index=False, encoding="utf-8-sig")
        elif format in ("xlsx", "excel"):
            if not output_path.endswith(".xlsx"):
                output_path += ".xlsx"
            df.to_excel(output_path, index=False)
        else:
            return {"success": False, "message": f"不支持的导出格式: {format}"}

        return {
            "success": True,
            "output_path": output_path,
            "records_exported": len(rows),
            "message": f"导出成功，共 {len(rows)} 条记录",
        }
    finally:
        session.close()


def generate_report(batch_id: str, output_path: Optional[str] = None) -> Dict[str, Any]:
    session = SessionLocal()
    try:
        batch = session.query(BatchImport).filter_by(batch_id=batch_id).first()
        if not batch:
            return {"success": False, "message": f"批次不存在: {batch_id}"}

        batch = _refresh_batch_counts(session, batch_id)
        session.commit()

        records = (
            session.query(FormulaScreenshot)
            .filter_by(batch_id=batch_id)
            .order_by(FormulaScreenshot.original_row_number)
            .all()
        )

        abnormal_records = [r for r in records if r.status == RecordStatus.ABNORMAL.value]
        reviewing_records = [r for r in records if r.status == RecordStatus.REVIEWING.value]
        approved_records = [r for r in records if r.status == RecordStatus.APPROVED.value]

        lines = []
        lines.append("=" * 70)
        lines.append("  动态规划补货策略 - 批次复核报告")
        lines.append("=" * 70)
        lines.append("")
        lines.append(f"批次ID:         {batch.batch_id}")
        lines.append(f"源文件:         {batch.source_file}")
        lines.append(f"文件格式:       {batch.source_format}")
        lines.append(f"导入人:         {batch.imported_by}")
        lines.append(f"导入时间:       {batch.import_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"总记录数:       {batch.total_records}")
        lines.append("")
        lines.append("--- 状态统计 ---")
        lines.append(f"  正常待处理:   {batch.pending_count}")
        lines.append(f"  异常待复核:   {batch.abnormal_count}")
        lines.append(f"  复核中:       {batch.reviewing_count}")
        lines.append(f"  已通过:       {batch.approved_count}")
        lines.append(f"  已驳回:       {batch.rejected_count}")
        lines.append(f"  已回滚:       {batch.rollbacked_count}")
        lines.append("")

        if abnormal_records:
            lines.append("--- 异常记录明细（待数据复核人处理）---")
            for r in abnormal_records:
                lines.append("")
                lines.append(f"  记录 #{r.id} (原始行号 {r.original_row_number})")
                lines.append(f"    SKU/商品:   {r.sku_code} / {r.product_name}")
                lines.append(f"    分母/分子:  {r.denominator_value} / {r.numerator_value}")
                lines.append(f"    原始结果:   '{r.original_result or '(空字符串)'}'")
                lines.append(f"    当前结果:   '{r.result_value or '(空字符串)'}'")
                lines.append(f"    异常类型:   {r.abnormal_type}")
                lines.append(f"    异常说明:   {r.abnormal_note}")
                if r.original_statement:
                    lines.append(f"    原始说法:   {r.original_statement}")
                if r.corrected_value is not None:
                    lines.append(f"    建议修正值: {r.corrected_value}")
                if r.review_reason:
                    lines.append(f"    处理原因:   {r.review_reason}")
                if r.next_handler:
                    lines.append(f"    下一步找谁:  {r.next_handler}")
                if r.current_version > 1:
                    lines.append(f"    变更次数:   {r.current_version - 1}")

        if reviewing_records:
            lines.append("")
            lines.append("--- 复核中记录（等待复核人处理）---")
            for r in reviewing_records:
                lines.append("")
                lines.append(f"  记录 #{r.id} (原始行号 {r.original_row_number})")
                lines.append(f"    SKU/商品:   {r.sku_code} / {r.product_name}")
                lines.append(f"    分母/分子:  {r.denominator_value} / {r.numerator_value}")
                lines.append(f"    原始结果:   '{r.original_result or '(空字符串)'}'")
                lines.append(f"    当前结果:   '{r.result_value or '(空字符串)'}'")
                lines.append(f"    异常说明:   {r.abnormal_note}")
                if r.original_statement:
                    lines.append(f"    原始说法:   {r.original_statement}")
                if r.corrected_value is not None:
                    lines.append(f"    建议修正值: {r.corrected_value}")
                if r.review_reason:
                    lines.append(f"    处理原因:   {r.review_reason}")
                if r.next_handler:
                    lines.append(f"    下一步找谁:  {r.next_handler}")
                if r.current_version > 1:
                    lines.append(f"    变更次数:   {r.current_version - 1}")

        if approved_records:
            lines.append("")
            lines.append("--- 已通过记录（含人工修正痕迹）---")
            for r in approved_records:
                lines.append("")
                lines.append(f"  记录 #{r.id} (原始行号 {r.original_row_number})")
                lines.append(f"    SKU/商品:   {r.sku_code} / {r.product_name}")
                lines.append(f"    分母/分子:  {r.denominator_value} / {r.numerator_value}")
                lines.append(f"    原始结果:   '{r.original_result or '(空字符串)'}'")
                lines.append(f"    当前结果:   '{r.result_value or '(空字符串)'}'")
                if r.original_statement:
                    lines.append(f"    原始说法:   {r.original_statement}")
                if r.corrected_value is not None:
                    lines.append(f"    改后的值:   {r.corrected_value}")
                if r.review_reason:
                    lines.append(f"    处理原因:   {r.review_reason}")
                if r.next_handler:
                    lines.append(f"    下一步找谁:  {r.next_handler}")
                if r.current_version > 1:
                    lines.append(f"    变更次数:   {r.current_version - 1}")

        lines.append("")
        lines.append("=" * 70)
        lines.append("  生成时间: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        lines.append("=" * 70)
        lines.append("")

        report_text = "\n".join(lines)

        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(report_text)

        return {
            "success": True,
            "batch_id": batch_id,
            "batch_summary": batch_summary(batch),
            "abnormal_count": len(abnormal_records),
            "report_text": report_text,
            "output_path": output_path,
            "message": f"报告生成成功，异常记录 {len(abnormal_records)} 条",
        }

    finally:
        session.close()
