import hashlib
import csv
import json
import yaml
from datetime import datetime, time, timedelta
from typing import List, Dict, Any, Optional, Tuple, Iterator
from io import StringIO, TextIOWrapper
from fastapi import UploadFile
import pandas as pd

from app.models import (
    DehydratorRun, ChemicalBatch, LabMoistureResult, 
    ReviewRule, ExceptionReview, ExceptionType,
    get_shift, Shift, Session
)
from app.schemas import (
    DehydratorRunCreate, ChemicalBatchCreate,
    LabMoistureResultCreate, ReviewRuleCreate
)


def calculate_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def parse_datetime(value: str) -> datetime:
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(value.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    
    try:
        return pd.to_datetime(value).to_pydatetime()
    except Exception:
        raise ValueError(f"无法解析日期时间格式: {value}")


def parse_float(value: Any) -> Optional[float]:
    if value is None or value == "" or value == "NULL" or value == "null":
        return None
    try:
        if isinstance(value, str):
            value = value.strip().replace(",", "")
        return float(value)
    except (ValueError, TypeError):
        return None


def parse_int(value: Any) -> Optional[int]:
    if value is None or value == "" or value == "NULL" or value == "null":
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None


async def read_csv_file(file: UploadFile) -> pd.DataFrame:
    content = await file.read()
    return pd.read_csv(StringIO(content.decode('utf-8-sig')), encoding_errors='ignore')


async def read_jsonl_file(file: UploadFile) -> List[Dict[str, Any]]:
    content = await file.read()
    lines = content.decode('utf-8-sig').strip().split('\n')
    results = []
    for line in lines:
        if line.strip():
            results.append(json.loads(line))
    return results


async def read_yaml_file(file: UploadFile) -> Dict[str, Any]:
    content = await file.read()
    return yaml.safe_load(content.decode('utf-8-sig'))


def dehydrator_run_from_csv_row(row: pd.Series, source_file: str) -> DehydratorRunCreate:
    run_id = row.get('run_id', row.get('id', f"run_{datetime.now().timestamp()}"))
    
    if pd.isna(run_id) or run_id == "":
        run_id = f"run_{datetime.now().timestamp()}"
    
    start_time = parse_datetime(str(row.get('start_time', row.get('start', ''))))
    end_time_str = row.get('end_time', row.get('end'))
    end_time = parse_datetime(str(end_time_str)) if pd.notna(end_time_str) and end_time_str else None
    
    shift, shift_date = get_shift(start_time)
    
    return DehydratorRunCreate(
        run_id=str(run_id),
        machine_id=str(row.get('machine_id', row.get('machine', 'unknown'))),
        start_time=start_time,
        end_time=end_time,
        feed_sludge_volume=parse_float(row.get('feed_sludge_volume', row.get('feed_volume', 0))),
        feed_sludge_concentration=parse_float(row.get('feed_sludge_concentration', row.get('feed_concentration'))),
        dry_solids_input=parse_float(row.get('dry_solids_input', row.get('dry_solids'))),
        batch_id=str(row.get('batch_id')) if pd.notna(row.get('batch_id')) else None
    )


def chemical_batch_from_jsonl(row: Dict[str, Any], source_file: str) -> ChemicalBatchCreate:
    batch_id = row.get('batch_id', row.get('id', f"batch_{datetime.now().timestamp()}"))
    
    start_time = parse_datetime(str(row.get('start_time', row.get('start', ''))))
    end_time_str = row.get('end_time', row.get('end'))
    end_time = parse_datetime(str(end_time_str)) if end_time_str and end_time_str != "" else None
    
    return ChemicalBatchCreate(
        batch_id=str(batch_id),
        chemical_type=str(row.get('chemical_type', row.get('type', 'PAM'))),
        concentration=parse_float(row.get('concentration', 100.0)),
        dosage_rate_target=parse_float(row.get('dosage_rate_target', row.get('target_rate'))),
        dosage_rate_min=parse_float(row.get('dosage_rate_min', row.get('min_rate'))),
        dosage_rate_max=parse_float(row.get('dosage_rate_max', row.get('max_rate'))),
        start_time=start_time,
        end_time=end_time,
        total_chemical_used=parse_float(row.get('total_chemical_used', row.get('total_used'))),
        supplier=str(row.get('supplier')) if row.get('supplier') else None
    )


def lab_moisture_from_csv_row(row: pd.Series, source_file: str) -> LabMoistureResultCreate:
    result_id = row.get('result_id', row.get('id', f"lab_{datetime.now().timestamp()}"))
    
    if pd.isna(result_id) or result_id == "":
        result_id = f"lab_{datetime.now().timestamp()}"
    
    sample_time = parse_datetime(str(row.get('sample_time', row.get('sample', ''))))
    tested_at_str = row.get('tested_at', row.get('test_time'))
    tested_at = parse_datetime(str(tested_at_str)) if pd.notna(tested_at_str) and tested_at_str else None
    
    moisture_content = parse_float(row.get('moisture_content', row.get('moisture', 0)))
    cake_solids = parse_float(row.get('cake_solids', row.get('solids')))
    
    if cake_solids is None and moisture_content is not None:
        cake_solids = 100.0 - moisture_content
    
    return LabMoistureResultCreate(
        result_id=str(result_id),
        sample_time=sample_time,
        moisture_content=moisture_content,
        cake_solids=cake_solids,
        run_id=str(row.get('run_id')) if pd.notna(row.get('run_id')) else None,
        batch_id=str(row.get('batch_id')) if pd.notna(row.get('batch_id')) else None,
        tested_by=str(row.get('tested_by')) if pd.notna(row.get('tested_by')) else None,
        tested_at=tested_at
    )


def review_rule_from_yaml(rule_data: Dict[str, Any], rule_id: str) -> ReviewRuleCreate:
    return ReviewRuleCreate(
        rule_id=rule_id,
        rule_name=str(rule_data.get('name', rule_id)),
        rule_type=str(rule_data.get('type', rule_data.get('rule_type', 'general'))),
        threshold_value=parse_float(rule_data.get('threshold', rule_data.get('threshold_value'))),
        min_value=parse_float(rule_data.get('min', rule_data.get('min_value'))),
        max_value=parse_float(rule_data.get('max', rule_data.get('max_value'))),
        is_enabled=bool(rule_data.get('enabled', rule_data.get('is_enabled', True))),
        priority=parse_int(rule_data.get('priority', 1)) or 1
    )


def check_cross_shift_batch(batch: ChemicalBatch, db: Session) -> bool:
    if not batch.end_time:
        return False
    
    start_shift, _ = get_shift(batch.start_time)
    end_shift, _ = get_shift(batch.end_time)
    
    if start_shift != end_shift:
        return True
    
    start_date = batch.start_time.date()
    end_date = batch.end_time.date()
    
    if start_date != end_date:
        return True
    
    runs = db.query(DehydratorRun).filter(
        DehydratorRun.batch_id == batch.batch_id
    ).all()
    
    if len(runs) > 1:
        shifts = set()
        for run in runs:
            shifts.add((run.shift, run.shift_date.date()))
        if len(shifts) > 1:
            return True
    
    return False


def check_dosage_rate_match(
    run: DehydratorRun, 
    batch: Optional[ChemicalBatch],
    rules: List[ReviewRule],
    db: Session
) -> Tuple[bool, Optional[str], Optional[float]]:
    if not batch:
        return True, None, None
    
    if run.dry_solids_input is None or run.dry_solids_input <= 0:
        if run.feed_sludge_volume and run.feed_sludge_concentration:
            run.dry_solids_input = (
                run.feed_sludge_volume * 
                (run.feed_sludge_concentration / 100.0)
            )
        else:
            return True, None, None
    
    if batch.total_chemical_used is None:
        return True, None, None
    
    runs_for_batch = db.query(DehydratorRun).filter(
        DehydratorRun.batch_id == batch.batch_id
    ).all()
    
    total_dry_solids = sum(
        r.dry_solids_input for r in runs_for_batch 
        if r.dry_solids_input and r.dry_solids_input > 0
    )
    
    if total_dry_solids <= 0:
        return True, None, None
    
    actual_rate = batch.total_chemical_used / total_dry_solids
    
    moisture_rule = next(
        (r for r in rules if r.rule_type == "moisture_threshold" and r.is_enabled),
        None
    )
    
    dosage_rule = next(
        (r for r in rules if r.rule_type == "dosage_rate" and r.is_enabled),
        None
    )
    
    target_rate = batch.dosage_rate_target
    min_rate = batch.dosage_rate_min
    max_rate = batch.dosage_rate_max
    
    if dosage_rule:
        if min_rate is None and dosage_rule.min_value:
            min_rate = dosage_rule.min_value
        if max_rate is None and dosage_rule.max_value:
            max_rate = dosage_rule.max_value
        if target_rate is None and dosage_rule.threshold_value:
            target_rate = dosage_rule.threshold_value
    
    if target_rate is None:
        return True, None, actual_rate
    
    tolerance = 0.1
    if dosage_rule and dosage_rule.threshold_value:
        tolerance = dosage_rule.threshold_value / 100.0
    
    min_allowed = min_rate if min_rate else target_rate * (1 - tolerance)
    max_allowed = max_rate if max_rate else target_rate * (1 + tolerance)
    
    if actual_rate < min_allowed:
        return False, f"投加率偏低: 实际 {actual_rate:.3f} kg/t, 目标 {target_rate:.3f} kg/t", actual_rate
    elif actual_rate > max_allowed:
        return False, f"投加率偏高: 实际 {actual_rate:.3f} kg/t, 目标 {target_rate:.3f} kg/t", actual_rate
    
    return True, None, actual_rate


def check_feed_sludge_consistency(
    run: DehydratorRun,
    rules: List[ReviewRule]
) -> Tuple[bool, Optional[str]]:
    feed_rule = next(
        (r for r in rules if r.rule_type == "feed_sludge_range" and r.is_enabled),
        None
    )
    
    if not feed_rule:
        return True, None
    
    volume = run.feed_sludge_volume
    
    if feed_rule.min_value and volume < feed_rule.min_value:
        return False, f"进泥量偏低: 实际 {volume:.2f} m³, 最小允许 {feed_rule.min_value:.2f} m³"
    
    if feed_rule.max_value and volume > feed_rule.max_value:
        return False, f"进泥量偏高: 实际 {volume:.2f} m³, 最大允许 {feed_rule.max_value:.2f} m³"
    
    return True, None


def check_moisture_exceed(
    run: DehydratorRun,
    rules: List[ReviewRule],
    db: Session
) -> Tuple[bool, Optional[str], Optional[float]]:
    lab_results = db.query(LabMoistureResult).filter(
        LabMoistureResult.run_id == run.run_id
    ).all()
    
    if not lab_results:
        return True, None, None
    
    moisture_rule = next(
        (r for r in rules if r.rule_type == "moisture_threshold" and r.is_enabled),
        None
    )
    
    if not moisture_rule:
        return True, None, None
    
    threshold = moisture_rule.threshold_value or 80.0
    
    avg_moisture = sum(r.moisture_content for r in lab_results) / len(lab_results)
    
    if avg_moisture > threshold:
        return False, f"含水率超标: 平均 {avg_moisture:.2f}%, 阈值 {threshold:.2f}%", avg_moisture
    
    return True, None, avg_moisture


def run_exception_check(
    run: DehydratorRun,
    db: Session
) -> List[ExceptionReview]:
    exceptions = []
    
    rules = db.query(ReviewRule).filter(ReviewRule.is_enabled == True).all()
    
    existing_reviews = db.query(ExceptionReview).filter(
        ExceptionReview.run_id == run.run_id,
        ExceptionReview.is_resolved == False
    ).all()
    existing_types = {r.exception_type for r in existing_reviews}
    
    batch = None
    if run.batch_id:
        batch = db.query(ChemicalBatch).filter(
            ChemicalBatch.batch_id == run.batch_id
        ).first()
    
    if not batch and ExceptionType.MISSING_BATCH.value not in existing_types:
        exceptions.append(ExceptionReview(
            review_id=f"review_{run.run_id}_missing_batch",
            run_id=run.run_id,
            exception_type=ExceptionType.MISSING_BATCH.value,
            exception_message="运行记录未关联药剂批次",
            is_resolved=False
        ))
    
    if batch:
        is_match, msg, rate = check_dosage_rate_match(run, batch, rules, db)
        if not is_match and msg and ExceptionType.DOSAGE_MISMATCH.value not in existing_types:
            exceptions.append(ExceptionReview(
                review_id=f"review_{run.run_id}_dosage_{datetime.now().timestamp()}",
                run_id=run.run_id,
                exception_type=ExceptionType.DOSAGE_MISMATCH.value,
                exception_message=msg,
                is_resolved=False
            ))
        
        is_cross = check_cross_shift_batch(batch, db)
        if is_cross and ExceptionType.CROSS_SHIFT_BATCH.value not in existing_types:
            exceptions.append(ExceptionReview(
                review_id=f"review_{run.run_id}_cross_{datetime.now().timestamp()}",
                run_id=run.run_id,
                exception_type=ExceptionType.CROSS_SHIFT_BATCH.value,
                exception_message=f"批次 {batch.batch_id} 跨班次运行",
                is_resolved=False
            ))
    
    is_consistent, msg = check_feed_sludge_consistency(run, rules)
    if not is_consistent and msg and ExceptionType.FEED_SLUDGE_MISMATCH.value not in existing_types:
        exceptions.append(ExceptionReview(
            review_id=f"review_{run.run_id}_feed_{datetime.now().timestamp()}",
            run_id=run.run_id,
            exception_type=ExceptionType.FEED_SLUDGE_MISMATCH.value,
            exception_message=msg,
            is_resolved=False
        ))
    
    is_moisture_ok, msg, moisture = check_moisture_exceed(run, rules, db)
    if not is_moisture_ok and msg and ExceptionType.MOISTURE_EXCEED.value not in existing_types:
        exceptions.append(ExceptionReview(
            review_id=f"review_{run.run_id}_moisture_{datetime.now().timestamp()}",
            run_id=run.run_id,
            exception_type=ExceptionType.MOISTURE_EXCEED.value,
            exception_message=msg,
            is_resolved=False
        ))
    
    return exceptions


def batch_runs_by_time(run: DehydratorRun, db: Session) -> Optional[ChemicalBatch]:
    batches = db.query(ChemicalBatch).filter(
        ChemicalBatch.start_time <= run.start_time
    ).all()
    
    for batch in batches:
        if batch.end_time is None or batch.end_time >= run.start_time:
            return batch
    
    return None
