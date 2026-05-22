import os
import hashlib
import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session

from .models import (
    ImportBatch, ColdChainRecord, DataSource,
    RecordIssue, IssueType, RecordStatus
)
from .database import generate_batch_no, log_operation


def calculate_file_hash(filepath):
    hash_sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()


def check_duplicate_import(session: Session, file_hash: str) -> bool:
    existing = session.query(ImportBatch).filter_by(file_hash=file_hash).first()
    return existing is not None


def import_wms_csv(session: Session, filepath: str, user) -> ImportBatch:
    file_hash = calculate_file_hash(filepath)
    
    if check_duplicate_import(session, file_hash):
        raise ValueError(f"文件已存在重复导入记录，哈希: {file_hash}")
    
    df = pd.read_csv(filepath)
    
    batch = ImportBatch(
        batch_no=generate_batch_no(),
        source=DataSource.WMS_CSV,
        filename=os.path.basename(filepath),
        file_hash=file_hash,
        total_rows=len(df),
        imported_by=user.id,
        status="completed"
    )
    session.add(batch)
    session.flush()
    
    for idx, row in df.iterrows():
        record = ColdChainRecord(
            batch_id=batch.id,
            original_line_no=idx + 1,
            source_type=DataSource.WMS_CSV,
            box_no=str(row.get("箱号", row.get("box_no", ""))),
            original_box_no=str(row.get("箱号", row.get("box_no", ""))),
            driver_name=str(row.get("司机", row.get("driver_name", ""))),
            vehicle_no=str(row.get("车牌号", row.get("vehicle_no", ""))),
            departure=str(row.get("出发地", row.get("departure", ""))),
            destination=str(row.get("目的地", row.get("destination", ""))),
            shipment_date=_parse_date(row.get("发货日期", row.get("shipment_date"))),
            receive_date=_parse_date(row.get("签收日期", row.get("receive_date"))),
            expected_date=_parse_date(row.get("预计日期", row.get("expected_date"))),
            quantity=_parse_int(row.get("数量", row.get("quantity"))),
            original_quantity=_parse_int(row.get("数量", row.get("quantity"))),
            unit_price=_parse_float(row.get("单价", row.get("unit_price"))),
            amount=_parse_float(row.get("金额", row.get("amount"))),
            original_amount=_parse_float(row.get("金额", row.get("amount"))),
            shift_no=str(row.get("班次", row.get("shift_no", ""))),
            signatory=str(row.get("签收人", row.get("signatory", ""))),
            raw_data=row.to_dict()
        )
        session.add(record)
    
    session.commit()
    
    log_operation(session, user, "import_wms_csv", "ImportBatch", batch.id, {
        "filename": os.path.basename(filepath),
        "rows": len(df),
        "batch_no": batch.batch_no
    })
    
    return batch


def import_temperature_log(session: Session, filepath: str, user) -> ImportBatch:
    file_hash = calculate_file_hash(filepath)
    
    if check_duplicate_import(session, file_hash):
        raise ValueError(f"文件已存在重复导入记录，哈希: {file_hash}")
    
    df = pd.read_csv(filepath)
    
    batch = ImportBatch(
        batch_no=generate_batch_no(),
        source=DataSource.TEMPERATURE_LOG,
        filename=os.path.basename(filepath),
        file_hash=file_hash,
        total_rows=len(df),
        imported_by=user.id,
        status="completed"
    )
    session.add(batch)
    session.flush()
    
    temp_stats = {}
    for idx, row in df.iterrows():
        box_no = str(row.get("箱号", row.get("box_no", "")))
        temp = _parse_float(row.get("温度", row.get("temperature", 0)))
        
        if box_no not in temp_stats:
            temp_stats[box_no] = {
                "temps": [],
                "exceed_count": 0,
                "first_row": idx + 1,
                "raw_data": row.to_dict()
            }
        temp_stats[box_no]["temps"].append(temp)
        if temp > 8 or temp < -18:
            temp_stats[box_no]["exceed_count"] += 1
    
    for box_no, stats in temp_stats.items():
        temps = stats["temps"]
        if temps:
            record = ColdChainRecord(
                batch_id=batch.id,
                original_line_no=stats["first_row"],
                source_type=DataSource.TEMPERATURE_LOG,
                box_no=box_no,
                original_box_no=box_no,
                min_temp=min(temps),
                max_temp=max(temps),
                avg_temp=sum(temps) / len(temps),
                temp_exceed_count=stats["exceed_count"],
                raw_data=stats["raw_data"]
            )
            session.add(record)
    
    session.commit()
    
    log_operation(session, user, "import_temperature_log", "ImportBatch", batch.id, {
        "filename": os.path.basename(filepath),
        "boxes": len(temp_stats),
        "batch_no": batch.batch_no
    })
    
    return batch


def import_shift_record(session: Session, filepath: str, user) -> ImportBatch:
    file_hash = calculate_file_hash(filepath)
    
    if check_duplicate_import(session, file_hash):
        raise ValueError(f"文件已存在重复导入记录，哈希: {file_hash}")
    
    df = pd.read_csv(filepath)
    
    batch = ImportBatch(
        batch_no=generate_batch_no(),
        source=DataSource.SHIFT_RECORD,
        filename=os.path.basename(filepath),
        file_hash=file_hash,
        total_rows=len(df),
        imported_by=user.id,
        status="completed"
    )
    session.add(batch)
    session.flush()
    
    for idx, row in df.iterrows():
        record = ColdChainRecord(
            batch_id=batch.id,
            original_line_no=idx + 1,
            source_type=DataSource.SHIFT_RECORD,
            shift_no=str(row.get("班次号", row.get("shift_no", ""))),
            driver_name=str(row.get("司机", row.get("driver_name", ""))),
            vehicle_no=str(row.get("车辆", row.get("vehicle_no", ""))),
            shipment_date=_parse_date(row.get("日期", row.get("shipment_date"))),
            raw_data=row.to_dict()
        )
        session.add(record)
    
    session.commit()
    
    log_operation(session, user, "import_shift_record", "ImportBatch", batch.id, {
        "filename": os.path.basename(filepath),
        "rows": len(df),
        "batch_no": batch.batch_no
    })
    
    return batch


def import_driver_photo_metadata(session: Session, filepath: str, user) -> ImportBatch:
    file_hash = calculate_file_hash(filepath)
    
    if check_duplicate_import(session, file_hash):
        raise ValueError(f"文件已存在重复导入记录，哈希: {file_hash}")
    
    df = pd.read_csv(filepath)
    
    batch = ImportBatch(
        batch_no=generate_batch_no(),
        source=DataSource.DRIVER_PHOTO,
        filename=os.path.basename(filepath),
        file_hash=file_hash,
        total_rows=len(df),
        imported_by=user.id,
        status="completed"
    )
    session.add(batch)
    session.flush()
    
    for idx, row in df.iterrows():
        record = ColdChainRecord(
            batch_id=batch.id,
            original_line_no=idx + 1,
            source_type=DataSource.DRIVER_PHOTO,
            box_no=str(row.get("箱号", row.get("box_no", ""))),
            original_box_no=str(row.get("箱号", row.get("box_no", ""))),
            driver_name=str(row.get("司机", row.get("driver_name", ""))),
            photo_ref=str(row.get("照片路径", row.get("photo_ref", ""))),
            receive_date=_parse_date(row.get("拍摄时间", row.get("photo_time"))),
            signatory=str(row.get("签收人", row.get("signatory", ""))),
            raw_data=row.to_dict()
        )
        session.add(record)
    
    session.commit()
    
    log_operation(session, user, "import_driver_photo", "ImportBatch", batch.id, {
        "filename": os.path.basename(filepath),
        "rows": len(df),
        "batch_no": batch.batch_no
    })
    
    return batch


def _parse_date(value):
    if pd.isna(value) or value is None or str(value).strip() == "":
        return None
    try:
        return pd.to_datetime(value).to_pydatetime()
    except:
        return None


def _parse_int(value):
    if pd.isna(value) or value is None or str(value).strip() == "":
        return None
    try:
        return int(float(value))
    except:
        return None


def _parse_float(value):
    if pd.isna(value) or value is None or str(value).strip() == "":
        return None
    try:
        return float(value)
    except:
        return None


def get_import_source_function(source_type: DataSource):
    source_map = {
        DataSource.WMS_CSV: import_wms_csv,
        DataSource.TEMPERATURE_LOG: import_temperature_log,
        DataSource.SHIFT_RECORD: import_shift_record,
        DataSource.DRIVER_PHOTO: import_driver_photo_metadata,
    }
    return source_map.get(source_type)
