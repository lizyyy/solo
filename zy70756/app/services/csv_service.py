from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import os

from app.models.models import (
    CsvFile, ColumnMapping, NullRule, BadRow,
    ConversionSummary, AuditLog
)
from app.services.converter import (
    detect_encoding, compute_file_hash, parse_csv_with_encoding,
    convert_to_ndjson, normalize_column_name
)


def get_csv_file_by_hash(db: Session, file_hash: str) -> Optional[CsvFile]:
    return db.query(CsvFile).filter(CsvFile.file_hash == file_hash).first()


def create_csv_file(
    db: Session,
    file_name: str,
    file_content: bytes,
    file_hash: Optional[str] = None
) -> CsvFile:
    if file_hash is None:
        file_hash = compute_file_hash(file_content)

    existing = get_csv_file_by_hash(db, file_hash)
    if existing:
        return existing

    encoding, confidence = detect_encoding(file_content)

    db_file = CsvFile(
        file_name=file_name,
        file_hash=file_hash,
        file_size=len(file_content),
        detected_encoding=encoding,
        detected_confidence=str(confidence),
        status="uploaded"
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    try:
        content = file_content.decode(encoding)
        import csv
        from io import StringIO
        reader = csv.reader(StringIO(content))
        headers = next(reader)

        for header in headers:
            norm_header = normalize_column_name(header)
            db_mapping = ColumnMapping(
                csv_file_id=db_file.id,
                original_column=header,
                normalized_column=norm_header
            )
            db.add(db_mapping)

        db.commit()
    except Exception:
        pass

    return db_file


def get_csv_files(db: Session, skip: int = 0, limit: int = 100) -> List[CsvFile]:
    return db.query(CsvFile).order_by(CsvFile.created_at.desc()).offset(skip).limit(limit).all()


def get_csv_file(db: Session, file_id: int) -> Optional[CsvFile]:
    return db.query(CsvFile).filter(CsvFile.id == file_id).first()


def update_column_mapping(
    db: Session,
    mapping_id: int,
    normalized_column: Optional[str] = None,
    is_ignored: Optional[bool] = None
) -> Optional[ColumnMapping]:
    mapping = db.query(ColumnMapping).filter(ColumnMapping.id == mapping_id).first()
    if not mapping:
        return None

    if normalized_column is not None:
        mapping.normalized_column = normalized_column
    if is_ignored is not None:
        mapping.is_ignored = is_ignored

    db.commit()
    db.refresh(mapping)
    return mapping


def start_conversion(
    db: Session,
    file_id: int,
    file_content: bytes,
    handler: str,
    custom_encoding: Optional[str] = None
) -> Dict[str, Any]:
    db_file = get_csv_file(db, file_id)
    if not db_file:
        return {"success": False, "error": "File not found"}

    if db_file.status == "completed":
        return {
            "success": True,
            "message": "File already converted",
            "file_id": file_id
        }

    encoding = custom_encoding if custom_encoding else db_file.detected_encoding

    db_file.status = "converting"
    db.commit()

    null_rules = db.query(NullRule).filter(NullRule.csv_file_id == file_id).all()
    null_values_dict = {nr.column_name: nr.null_values for nr in null_rules}

    add_audit_log(
        db, file_id, "start_conversion", handler,
        {"encoding": encoding, "null_rules_count": len(null_rules)},
        "Conversion started"
    )

    summary = db.query(ConversionSummary).filter(ConversionSummary.csv_file_id == file_id).first()
    if not summary:
        summary = ConversionSummary(
            csv_file_id=file_id,
            total_rows=0,
            success_rows=0,
            failed_rows=0,
            skipped_rows=0,
            started_at=datetime.utcnow()
        )
        db.add(summary)
    else:
        summary.started_at = datetime.utcnow()
    db.commit()

    headers, rows, bad_rows_data = parse_csv_with_encoding(
        file_content, encoding, null_values_dict
    )

    db.query(BadRow).filter(BadRow.csv_file_id == file_id).delete()

    for row_num, raw_data, error_msg in bad_rows_data:
        db_bad_row = BadRow(
            csv_file_id=file_id,
            row_number=row_num,
            raw_data=raw_data,
            error_message=error_msg
        )
        db.add(db_bad_row)

    output_path = f"./output/{file_id}_output.ndjson"
    success_count = convert_to_ndjson(rows, output_path)

    summary.total_rows = len(rows) + len(bad_rows_data)
    summary.success_rows = success_count
    summary.failed_rows = len(bad_rows_data)
    summary.skipped_rows = 0
    summary.output_path = output_path
    summary.completed_at = datetime.utcnow()

    db_file.status = "completed"
    db.commit()
    db.refresh(db_file)
    db.refresh(summary)

    add_audit_log(
        db, file_id, "complete_conversion", handler,
        {"total_rows": summary.total_rows, "success_rows": summary.success_rows},
        "Conversion completed successfully"
    )

    return {
        "success": True,
        "file_id": file_id,
        "summary": {
            "total_rows": summary.total_rows,
            "success_rows": summary.success_rows,
            "failed_rows": summary.failed_rows
        }
    }


def fix_bad_row(
    db: Session,
    bad_row_id: int,
    fixed_data: Dict[str, Any],
    handler: str
) -> Optional[BadRow]:
    bad_row = db.query(BadRow).filter(BadRow.id == bad_row_id).first()
    if not bad_row:
        return None

    bad_row.is_fixed = True
    bad_row.fixed_data = fixed_data
    db.commit()
    db.refresh(bad_row)

    add_audit_log(
        db, bad_row.csv_file_id, "fix_bad_row", handler,
        {"bad_row_id": bad_row_id, "fixed_data": fixed_data},
        "Bad row fixed manually"
    )

    return bad_row


def update_file_status(
    db: Session,
    file_id: int,
    status: str,
    handler: str,
    conclusion: Optional[str] = None
) -> Optional[CsvFile]:
    db_file = get_csv_file(db, file_id)
    if not db_file:
        return None

    old_status = db_file.status
    db_file.status = status
    db.commit()
    db.refresh(db_file)

    add_audit_log(
        db, file_id, "status_update", handler,
        {"old_status": old_status, "new_status": status},
        conclusion or f"Status updated from {old_status} to {status}"
    )

    return db_file


def add_audit_log(
    db: Session,
    csv_file_id: int,
    action: str,
    handler: str,
    original_input: Dict[str, Any],
    conclusion: str
) -> AuditLog:
    log = AuditLog(
        csv_file_id=csv_file_id,
        action=action,
        handler=handler,
        original_input=original_input,
        conclusion=conclusion
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_ndjson_output(file_id: int) -> Optional[str]:
    output_path = f"./output/{file_id}_output.ndjson"
    if os.path.exists(output_path):
        return output_path
    return None
