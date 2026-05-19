import csv
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

from .models import (
    JobRecord, FuelRecord, RateTable, BadRecord,
    ImportBatch, RecordStatus, ImportSource, BillingType
)
from .database import (
    compute_file_hash, check_duplicate_import,
    create_import_batch, save_job_records, save_fuel_records,
    save_bad_records, save_rate_table
)


def parse_date(date_str: str) -> datetime:
    for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%m-%d-%Y', '%m/%d/%Y', '%Y%m%d']:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except (ValueError, TypeError):
            continue
    raise ValueError(f"无法解析日期: {date_str}, 支持格式: YYYY-MM-DD, YYYY/MM/DD, MM-DD-YYYY")


def parse_float(value: Any) -> Optional[float]:
    if value is None or str(value).strip() == '':
        return None
    try:
        return float(str(value).strip().replace(',', ''))
    except ValueError:
        raise ValueError(f"无效的数值: {value}")


def suggest_fix(field: str, value: Any, error: str) -> str:
    suggestions = {
        "tractor_id": "拖拉机编号不能为空，例如: T001",
        "operator_id": "机手编号不能为空，例如: OP001",
        "job_date": "请使用标准日期格式: YYYY-MM-DD",
        "work_hours": "工作小时数必须是正数，例如: 8.5",
        "work_mu": "作业亩数必须是正数，例如: 50",
        "fuel_used": "油耗必须是正数，例如: 25.5",
    }
    return suggestions.get(field, f"请检查字段值: {value}")


def import_job_sheet(file_path: Path, imported_by: Optional[str] = None) -> Tuple[ImportBatch, List[BadRecord]]:
    file_hash = compute_file_hash(file_path)
    duplicate = check_duplicate_import(file_hash, ImportSource.JOB_SHEET)
    if duplicate:
        raise ValueError(f"文件已导入，批次ID: {duplicate.batch_id}, 导入时间: {duplicate.created_at}")
    
    batch_id = f"JOB-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
    valid_records: List[JobRecord] = []
    bad_records: List[BadRecord] = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            raw_data = {str(k): (str(v) if v is not None else '') for k, v in row.items() if k is not None}
            errors = []
            
            tractor_id = row.get('tractor_id', '').strip()
            if not tractor_id:
                errors.append(("tractor_id", "拖拉机编号不能为空"))
            
            operator_id = row.get('operator_id', '').strip()
            if not operator_id:
                errors.append(("operator_id", "机手编号不能为空"))
            
            job_date = None
            try:
                date_str = row.get('job_date', '')
                if date_str:
                    job_date = parse_date(date_str)
                else:
                    errors.append(("job_date", "作业日期不能为空"))
            except ValueError as e:
                errors.append(("job_date", str(e)))
            
            work_hours = None
            try:
                work_hours = parse_float(row.get('work_hours'))
            except ValueError as e:
                errors.append(("work_hours", str(e)))
            
            work_mu = None
            try:
                work_mu = parse_float(row.get('work_mu'))
            except ValueError as e:
                errors.append(("work_mu", str(e)))
            
            fuel_used = None
            try:
                fuel_used = parse_float(row.get('fuel_used'))
            except ValueError as e:
                errors.append(("fuel_used", str(e)))
            
            if work_hours is None and work_mu is None and fuel_used is None:
                errors.append(("billing", "至少需要填写小时数、亩数或油耗之一"))
            
            if errors:
                error_msg = "; ".join([f"{k}: {v}" for k, v in errors])
                suggestion = "; ".join([suggest_fix(k, raw_data.get(k), v) for k, v in errors])
                bad_records.append(BadRecord(
                    batch_id=batch_id,
                    source_type=ImportSource.JOB_SHEET,
                    row_number=row_num,
                    raw_data=raw_data,
                    error_message=error_msg,
                    suggestion=suggestion
                ))
            else:
                billing_type = BillingType.MIXED
                if work_hours and not work_mu and not fuel_used:
                    billing_type = BillingType.PER_HOUR
                elif work_mu and not work_hours and not fuel_used:
                    billing_type = BillingType.PER_MU
                elif fuel_used and not work_hours and not work_mu:
                    billing_type = BillingType.FUEL
                
                valid_records.append(JobRecord(
                    batch_id=batch_id,
                    row_number=row_num,
                    tractor_id=tractor_id,
                    operator_id=operator_id,
                    operator_name=row.get('operator_name', '').strip() or None,
                    job_date=job_date,
                    work_hours=work_hours,
                    work_mu=work_mu,
                    fuel_used=fuel_used,
                    billing_type=billing_type,
                    status=RecordStatus.PENDING,
                raw_data=raw_data
                ))
    
    batch = ImportBatch(
        batch_id=batch_id,
        source_type=ImportSource.JOB_SHEET,
        file_name=file_path.name,
        file_hash=file_hash,
        total_records=len(valid_records) + len(bad_records),
        valid_records=len(valid_records),
        invalid_records=len(bad_records),
        imported_by=imported_by
    )
    
    create_import_batch(batch)
    if valid_records:
        save_job_records(valid_records)
    if bad_records:
        save_bad_records(bad_records)
    
    return batch, bad_records


def import_fuel_log(file_path: Path, imported_by: Optional[str] = None) -> Tuple[ImportBatch, List[BadRecord]]:
    file_hash = compute_file_hash(file_path)
    duplicate = check_duplicate_import(file_hash, ImportSource.FUEL_LOG)
    if duplicate:
        raise ValueError(f"文件已导入，批次ID: {duplicate.batch_id}, 导入时间: {duplicate.created_at}")
    
    batch_id = f"FUEL-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
    valid_records: List[FuelRecord] = []
    bad_records: List[BadRecord] = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        records = data if isinstance(data, list) else data.get('records', [])
        
        for row_num, row in enumerate(records, start=1):
            raw_data = {str(k): (str(v) if v is not None else '') for k, v in row.items() if k is not None}
            errors = []
            
            tractor_id = row.get('tractor_id', '').strip()
            if not tractor_id:
                errors.append(("tractor_id", "拖拉机编号不能为空"))
            
            fuel_date = None
            try:
                date_str = row.get('fuel_date', '')
                if date_str:
                    fuel_date = parse_date(date_str)
                else:
                    errors.append(("fuel_date", "加油日期不能为空"))
            except ValueError as e:
                errors.append(("fuel_date", str(e)))
            
            fuel_amount = None
            try:
                fuel_amount = parse_float(row.get('fuel_amount'))
                if fuel_amount is None or fuel_amount <= 0:
                    errors.append(("fuel_amount", "加油量必须是正数"))
            except ValueError as e:
                errors.append(("fuel_amount", str(e)))
            
            if errors:
                error_msg = "; ".join([f"{k}: {v}" for k, v in errors])
                suggestion = "; ".join([suggest_fix(k, raw_data.get(k), v) for k, v in errors])
                bad_records.append(BadRecord(
                    batch_id=batch_id,
                    source_type=ImportSource.FUEL_LOG,
                    row_number=row_num,
                    raw_data=raw_data,
                    error_message=error_msg,
                    suggestion=suggestion
                ))
            else:
                valid_records.append(FuelRecord(
                    batch_id=batch_id,
                    row_number=row_num,
                    tractor_id=tractor_id,
                    fuel_date=fuel_date,
                    fuel_amount=fuel_amount,
                    fuel_unit=row.get('fuel_unit', 'L').strip() or 'L',
                    status=RecordStatus.PENDING,
                raw_data=raw_data
                ))
    
    batch = ImportBatch(
        batch_id=batch_id,
        source_type=ImportSource.FUEL_LOG,
        file_name=file_path.name,
        file_hash=file_hash,
        total_records=len(valid_records) + len(bad_records),
        valid_records=len(valid_records),
        invalid_records=len(bad_records),
        imported_by=imported_by
    )
    
    create_import_batch(batch)
    if valid_records:
        save_fuel_records(valid_records)
    if bad_records:
        save_bad_records(bad_records)
    
    return batch, bad_records


def import_rate_table(file_path: Path, imported_by: Optional[str] = None) -> Tuple[ImportBatch, List[BadRecord]]:
    file_hash = compute_file_hash(file_path)
    duplicate = check_duplicate_import(file_hash, ImportSource.RATE_TABLE)
    if duplicate:
        raise ValueError(f"文件已导入，批次ID: {duplicate.batch_id}, 导入时间: {duplicate.created_at}")
    
    batch_id = f"RATE-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
    valid_records: List[RateTable] = []
    bad_records: List[BadRecord] = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            raw_data = {str(k): (str(v) if v is not None else '') for k, v in row.items() if k is not None}
            errors = []
            
            tractor_id = row.get('tractor_id', '').strip()
            if not tractor_id:
                errors.append(("tractor_id", "拖拉机编号不能为空"))
            
            effective_date = None
            try:
                date_str = row.get('effective_date', '')
                if date_str:
                    effective_date = parse_date(date_str)
                else:
                    errors.append(("effective_date", "生效日期不能为空"))
            except ValueError as e:
                errors.append(("effective_date", str(e)))
            
            hourly_rate = 0.0
            try:
                val = parse_float(row.get('hourly_rate'))
                if val is not None:
                    hourly_rate = max(0, val)
            except ValueError as e:
                errors.append(("hourly_rate", str(e)))
            
            mu_rate = 0.0
            try:
                val = parse_float(row.get('mu_rate'))
                if val is not None:
                    mu_rate = max(0, val)
            except ValueError as e:
                errors.append(("mu_rate", str(e)))
            
            fuel_rate = 0.0
            try:
                val = parse_float(row.get('fuel_rate'))
                if val is not None:
                    fuel_rate = max(0, val)
            except ValueError as e:
                errors.append(("fuel_rate", str(e)))
            
            if errors:
                error_msg = "; ".join([f"{k}: {v}" for k, v in errors])
                suggestion = "; ".join([suggest_fix(k, raw_data.get(k), v) for k, v in errors])
                bad_records.append(BadRecord(
                    batch_id=batch_id,
                    source_type=ImportSource.RATE_TABLE,
                    row_number=row_num,
                    raw_data=raw_data,
                    error_message=error_msg,
                    suggestion=suggestion
                ))
            else:
                valid_records.append(RateTable(
                    tractor_id=tractor_id,
                    effective_date=effective_date,
                    hourly_rate=hourly_rate,
                    mu_rate=mu_rate,
                    fuel_rate=fuel_rate,
                    is_active=True
                ))
    
    batch = ImportBatch(
        batch_id=batch_id,
        source_type=ImportSource.RATE_TABLE,
        file_name=file_path.name,
        file_hash=file_hash,
        total_records=len(valid_records) + len(bad_records),
        valid_records=len(valid_records),
        invalid_records=len(bad_records),
        imported_by=imported_by
    )
    
    create_import_batch(batch)
    for rate in valid_records:
        save_rate_table(rate)
    if bad_records:
        save_bad_records(bad_records)
    
    return batch, bad_records
