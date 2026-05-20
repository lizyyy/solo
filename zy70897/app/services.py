import csv
import json
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from io import StringIO
from sqlalchemy.orm import Session
from app.models import Batch, HandoverRecord, ErrorRecord, TellerSchedule
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def generate_batch_number() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"BATCH-{timestamp}"


def generate_error_code(batch_id: int, error_type: str, index: int) -> str:
    prefix_map = {
        "amount_mismatch": "AMT",
        "missing_signature": "SIG",
        "cross_day": "DAY",
        "data_format": "FMT",
        "duplicate": "DUP"
    }
    prefix = prefix_map.get(error_type, "ERR")
    return f"{prefix}-{batch_id:04d}-{index:04d}"


def parse_handover_csv(content: str) -> List[Dict[str, Any]]:
    records = []
    reader = csv.DictReader(StringIO(content))
    for row in reader:
        records.append({
            "handover_date": row.get("交接日期", "").strip(),
            "branch_code": row.get("网点编号", "").strip(),
            "branch_name": row.get("网点名称", "").strip(),
            "teller_from": row.get("交出柜员", "").strip(),
            "teller_to": row.get("接收柜员", "").strip(),
            "cashbox_number": row.get("尾箱编号", "").strip(),
            "system_amount": float(row.get("系统金额", 0) or 0),
            "actual_amount": float(row.get("实际金额", 0) or 0),
            "difference": float(row.get("差额", 0) or 0),
            "confirmer_1": row.get("确认人1", "").strip(),
            "confirmer_2": row.get("确认人2", "").strip(),
            "handover_time": row.get("交接时间", "").strip()
        })
    return records


def parse_schedule_json(content: str) -> List[Dict[str, Any]]:
    data = json.loads(content)
    schedules = []
    if isinstance(data, list):
        for item in data:
            schedules.append({
                "schedule_date": item.get("排班日期", "").strip(),
                "branch_code": item.get("网点编号", "").strip(),
                "teller_id": item.get("柜员编号", "").strip(),
                "teller_name": item.get("柜员姓名", "").strip(),
                "shift_type": item.get("班次类型", "").strip(),
                "working": item.get("是否上班", True)
            })
    return schedules


def check_duplicate_batch(db: Session, records: List[Dict[str, Any]]) -> bool:
    if not records:
        return False
    
    record_hash = hashlib.md5(json.dumps(records, sort_keys=True).encode()).hexdigest()
    existing_batches = db.query(Batch).all()
    
    for batch in existing_batches:
        handovers = db.query(HandoverRecord).filter(HandoverRecord.batch_id == batch.id).all()
        if handovers:
            handover_data = [{
                "handover_date": h.handover_date,
                "teller_from": h.teller_from,
                "teller_to": h.teller_to,
                "cashbox_number": h.cashbox_number
            } for h in handovers]
            existing_hash = hashlib.md5(json.dumps(handover_data, sort_keys=True).encode()).hexdigest()
            if existing_hash == record_hash:
                return True
    return False


def validate_amount_mismatch(record: Dict[str, Any]) -> Tuple[bool, str, str]:
    system_amt = record.get("system_amount", 0)
    actual_amt = record.get("actual_amount", 0)
    diff = record.get("difference", 0)
    
    calculated_diff = actual_amt - system_amt
    if abs(calculated_diff - diff) > 0.01 or abs(diff) > 0.01:
        suggestion = f"系统金额{system_amt}与实际金额{actual_amt}不符，差额{diff}。请双人现场复点并重新录入，差额需当日查明原因并登记差错登记簿。"
        return True, f"金额不平：系统与实际差额为{calculated_diff:.2f}，记录差额为{diff:.2f}", suggestion
    return False, "", ""


def validate_dual_signature(record: Dict[str, Any]) -> Tuple[bool, str, str]:
    confirmer_1 = record.get("confirmer_1", "")
    confirmer_2 = record.get("confirmer_2", "")
    
    if not confirmer_1 or not confirmer_2:
        missing = []
        if not confirmer_1:
            missing.append("确认人1")
        if not confirmer_2:
            missing.append("确认人2")
        suggestion = f"缺少{','.join(missing)}签字。尾箱交接必须双人确认，请联系相关人员补签后重新提交，确认需在当日完成。"
        return True, f"缺双签：缺少{','.join(missing)}", suggestion
    
    if confirmer_1 == confirmer_2:
        suggestion = "确认人不能为同一人。请安排不同人员确认后重新提交。"
        return True, "缺双签：确认人与交出/接收人为同一人", suggestion
    
    return False, "", ""


def validate_cross_day_handover(record: Dict[str, Any], schedules: List[Dict[str, Any]]) -> Tuple[bool, str, str]:
    handover_date = record.get("handover_date", "")
    handover_time = record.get("handover_time", "")
    teller_from = record.get("teller_from", "")
    teller_to = record.get("teller_to", "")
    
    try:
        handover_dt = datetime.strptime(f"{handover_date} {handover_time}", "%Y-%m-%d %H:%M:%S")
        
        today = datetime.now().date()
        if handover_dt.date() < today:
            suggestion = f"交接日期{handover_date}为历史日期。跨日交接需立即核查原因，确认是否存在未及时录入情况，相关责任人需当日书面说明。"
            return True, f"跨日交接：交接日期{handover_date}早于当前日期", suggestion
        
        teller_schedules = [s for s in schedules if s.get("schedule_date") == handover_date]
        from_working = any(s for s in teller_schedules if s.get("teller_name") == teller_from and s.get("working"))
        to_working = any(s for s in teller_schedules if s.get("teller_name") == teller_to and s.get("working"))
        
        if not from_working:
            suggestion = f"交出柜员{teller_from}在交接日期{handover_date}未排班。请确认是否为代班交接，代班需主管授权并登记。"
            return True, f"跨日交接：交出柜员当日未排班", suggestion
        
        if not to_working:
            suggestion = f"接收柜员{teller_to}在交接日期{handover_date}未排班。请确认是否为代班接收，代班需主管授权并登记。"
            return True, f"跨日交接：接收柜员当日未排班", suggestion
            
    except Exception as e:
        logger.warning(f"日期解析失败: {e}")
    
    return False, "", ""


def process_handover_records(
    db: Session,
    handover_records: List[Dict[str, Any]],
    schedule_records: List[Dict[str, Any]]
) -> Dict[str, Any]:
    
    if check_duplicate_batch(db, handover_records):
        raise ValueError("该批次数据已提交过，请勿重复提交。")
    
    batch_number = generate_batch_number()
    batch = Batch(batch_number=batch_number, total_records=len(handover_records))
    db.add(batch)
    db.flush()
    
    normal_items = []
    pending_items = []
    failed_items = []
    error_index = 0
    
    for record in handover_records:
        errors = []
        
        has_amount_error, amount_desc, amount_suggestion = validate_amount_mismatch(record)
        if has_amount_error:
            errors.append(("amount_mismatch", amount_desc, amount_suggestion))
        
        has_signature_error, signature_desc, signature_suggestion = validate_dual_signature(record)
        if has_signature_error:
            errors.append(("missing_signature", signature_desc, signature_suggestion))
        
        has_crossday_error, crossday_desc, crossday_suggestion = validate_cross_day_handover(record, schedule_records)
        if has_crossday_error:
            errors.append(("cross_day", crossday_desc, crossday_suggestion))
        
        handover = HandoverRecord(
            batch_id=batch.id,
            handover_date=record.get("handover_date", ""),
            branch_code=record.get("branch_code", ""),
            branch_name=record.get("branch_name", ""),
            teller_from=record.get("teller_from", ""),
            teller_to=record.get("teller_to", ""),
            cashbox_number=record.get("cashbox_number", ""),
            system_amount=record.get("system_amount", 0),
            actual_amount=record.get("actual_amount", 0),
            difference=record.get("difference", 0),
            confirmer_1=record.get("confirmer_1", ""),
            confirmer_2=record.get("confirmer_2", ""),
            handover_time=record.get("handover_time", ""),
            status="normal" if not errors else "failed"
        )
        db.add(handover)
        db.flush()
        
        if errors:
            for error_type, error_desc, suggestion in errors:
                error_index += 1
                error_code = generate_error_code(batch.id, error_type, error_index)
                
                error_record = ErrorRecord(
                    batch_id=batch.id,
                    handover_record_id=handover.id,
                    error_code=error_code,
                    error_type=error_type,
                    error_description=error_desc,
                    suggestion=suggestion,
                    original_data=json.dumps(record, ensure_ascii=False)
                )
                db.add(error_record)
                
                failed_items.append({
                    "error_code": error_code,
                    "error_type": error_type,
                    "error_description": error_desc,
                    "suggestion": suggestion,
                    "original_data": record
                })
            handover.status = "failed"
        else:
            normal_items.append(handover)
    
    for schedule in schedule_records:
        teller_schedule = TellerSchedule(
            batch_id=batch.id,
            schedule_date=schedule.get("schedule_date", ""),
            branch_code=schedule.get("branch_code", ""),
            teller_id=schedule.get("teller_id", ""),
            teller_name=schedule.get("teller_name", ""),
            shift_type=schedule.get("shift_type", ""),
            working=schedule.get("working", True)
        )
        db.add(teller_schedule)
    
    db.commit()
    
    return {
        "batch_number": batch_number,
        "normal_items": normal_items,
        "pending_items": pending_items,
        "failed_items": failed_items,
        "statistics": {
            "total": len(handover_records),
            "normal": len(normal_items),
            "pending": len(pending_items),
            "failed": len(failed_items)
        }
    }


def trace_error_by_code(db: Session, error_code: str) -> Dict[str, Any]:
    error = db.query(ErrorRecord).filter(ErrorRecord.error_code == error_code).first()
    if not error:
        return None
    
    result = {
        "error_code": error.error_code,
        "error_type": error.error_type,
        "error_description": error.error_description,
        "created_at": error.created_at,
        "is_closed": error.is_closed,
        "original_data": json.loads(error.original_data) if error.original_data else {},
        "suggestion": error.suggestion,
        "batch_info": None,
        "handover_info": None
    }
    
    if error.batch_id:
        batch = db.query(Batch).filter(Batch.id == error.batch_id).first()
        if batch:
            result["batch_info"] = batch
    
    if error.handover_record_id:
        handover = db.query(HandoverRecord).filter(HandoverRecord.id == error.handover_record_id).first()
        if handover:
            result["handover_info"] = handover
    
    return result
