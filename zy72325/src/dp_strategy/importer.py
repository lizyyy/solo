import hashlib
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from sqlalchemy.orm import Session

from .models import (
    SessionLocal,
    FormulaScreenshot,
    FormulaHistory,
    BatchImport,
    RecordStatus,
    ChangeType,
    AbnormalType,
)


def calculate_file_hash(file_path: str) -> str:
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def generate_batch_id() -> str:
    return f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"


def check_duplicate_import(session: Session, file_hash: str) -> Optional[BatchImport]:
    return (
        session.query(BatchImport)
        .filter_by(file_hash=file_hash, is_rollbacked=False)
        .first()
    )


def record_to_dict(record: FormulaScreenshot) -> Dict[str, Any]:
    return {
        "sku_code": record.sku_code,
        "product_name": record.product_name,
        "formula_expression": record.formula_expression,
        "denominator_value": record.denominator_value,
        "numerator_value": record.numerator_value,
        "result_value": record.result_value,
        "original_result": record.original_result,
        "status": record.status,
        "abnormal_type": record.abnormal_type,
        "abnormal_note": record.abnormal_note,
    }


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
        if before_data.get(key) != after_data.get(key):
            diff_fields.append(key)

    history = FormulaHistory(
        screenshot_id=screenshot.id,
        version=screenshot.current_version,
        change_type=change_type.value,
        changed_by=changed_by,
        change_reason=change_reason,
        before_data=before_data,
        after_data=after_data,
        diff_fields=diff_fields,
    )
    session.add(history)
    return history


def import_formula_screenshots(
    file_path: str,
    imported_by: str = "阿兰",
    sheet_name: Optional[str] = None,
) -> Dict[str, Any]:
    session = SessionLocal()
    try:
        file_hash = calculate_file_hash(file_path)
        duplicate = check_duplicate_import(session, file_hash)
        if duplicate:
            return {
                "success": False,
                "message": f"文件已存在，重复导入被阻止。原导入批次: {duplicate.batch_id}",
                "existing_batch": duplicate.batch_id,
            }

        batch_id = generate_batch_id()

        if file_path.endswith(".csv"):
            df = pd.read_csv(file_path)
        elif file_path.endswith((".xlsx", ".xls")):
            df = pd.read_excel(file_path, sheet_name=sheet_name)
        else:
            raise ValueError(f"不支持的文件格式: {file_path}")

        total_records = len(df)
        success_count = 0
        abnormal_count = 0

        for idx, row in df.iterrows():
            original_row_number = idx + 2

            denominator_value = row.get("分母", 0)
            if pd.isna(denominator_value):
                denominator_value = 0
            else:
                denominator_value = float(denominator_value)

            numerator_value = row.get("分子", 0)
            if pd.isna(numerator_value):
                numerator_value = 0
            else:
                numerator_value = float(numerator_value)

            result_value = str(row.get("结果", "")).strip()
            original_result = result_value

            status = RecordStatus.PENDING.value
            abnormal_type = None
            abnormal_note = ""

            if denominator_value == 0:
                if result_value == "" or result_value == "nan":
                    status = RecordStatus.ABNORMAL.value
                    abnormal_type = AbnormalType.ZERO_DENOMINATOR.value
                    abnormal_note = f"分母为0但结果被填空字符串，原始行号: {original_row_number}"
                    abnormal_count += 1
                elif result_value == "0" or result_value == "0.0":
                    status = RecordStatus.ABNORMAL.value
                    abnormal_type = AbnormalType.ZERO_DENOMINATOR.value
                    abnormal_note = f"分母为0但结果被填0，原始行号: {original_row_number}"
                    abnormal_count += 1
            elif result_value == "" or result_value == "nan":
                status = RecordStatus.ABNORMAL.value
                abnormal_type = AbnormalType.EMPTY_STRING.value
                abnormal_note = f"结果为空字符串，原始行号: {original_row_number}"
                abnormal_count += 1

            screenshot = FormulaScreenshot(
                batch_id=batch_id,
                original_row_number=original_row_number,
                source_file=file_path,
                imported_by=imported_by,
                sku_code=str(row.get("SKU编码", "")),
                product_name=str(row.get("商品名称", "")),
                formula_expression=str(row.get("公式表达式", "")),
                denominator_value=denominator_value,
                numerator_value=numerator_value,
                result_value=result_value,
                original_result=original_result,
                status=status,
                abnormal_type=abnormal_type,
                abnormal_note=abnormal_note,
                current_version=1,
                is_latest=True,
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
            success_count += 1

        batch_import = BatchImport(
            batch_id=batch_id,
            source_file=file_path,
            file_hash=file_hash,
            imported_by=imported_by,
            total_records=total_records,
            success_count=success_count,
            abnormal_count=abnormal_count,
        )
        session.add(batch_import)
        session.commit()

        return {
            "success": True,
            "batch_id": batch_id,
            "total_records": total_records,
            "success_count": success_count,
            "abnormal_count": abnormal_count,
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

        if old_value == new_value:
            return {
                "success": False,
                "message": "值未变化，无需更新",
                "old_value": old_value,
                "new_value": new_value,
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

        session.commit()

        return {
            "success": True,
            "screenshot_id": screenshot_id,
            "field": field_name,
            "old_value": old_value,
            "new_value": new_value,
            "new_version": screenshot.current_version,
            "message": "更新成功",
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
        all_keys = set(h1.after_data.keys()) | set(h2.after_data.keys())
        for key in all_keys:
            v1 = h1.after_data.get(key)
            v2 = h2.after_data.get(key)
            if v1 != v2:
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
